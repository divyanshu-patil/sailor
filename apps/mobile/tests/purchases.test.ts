import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rc = vi.hoisted(() => ({
  Purchases: {
    setLogLevel: vi.fn(),
    configure: vi.fn(),
    logIn: vi.fn(),
    logOut: vi.fn(),
    getCustomerInfo: vi.fn(),
    invalidateCustomerInfoCache: vi.fn(),
    getOfferings: vi.fn(),
    purchasePackage: vi.fn(),
    restorePurchases: vi.fn(),
    showManageSubscriptions: vi.fn(),
    beginRefundRequestForActiveEntitlement: vi.fn(),
  },
  UI: {
    presentPaywall: vi.fn(),
    presentPaywallIfNeeded: vi.fn(),
    presentCustomerCenter: vi.fn(),
  },
}));
vi.mock("react-native-purchases", () => ({
  default: rc.Purchases,
  LOG_LEVEL: { DEBUG: "DEBUG", ERROR: "ERROR" },
  REFUND_REQUEST_STATUS: { SUCCESS: 0, USER_CANCELLED: 1, ERROR: 2 },
}));
vi.mock("react-native-purchases-ui", () => ({
  default: rc.UI,
  PAYWALL_RESULT: {
    NOT_PRESENTED: "NOT_PRESENTED",
    ERROR: "ERROR",
    CANCELLED: "CANCELLED",
    PURCHASED: "PURCHASED",
    RESTORED: "RESTORED",
  },
}));

type Lib = typeof import("@/lib/purchases");

/**
 * A fresh copy of the module: which store key it picks and whether it has been
 * configured are both decided once per launch, at import.
 */
async function load(
  os = "ios",
  keys = { ios: "appl_key", android: "goog_key" },
  enabled = true,
): Promise<{
  lib: Lib;
  Linking: { openURL: ReturnType<typeof vi.fn> };
}> {
  vi.resetModules();
  vi.stubEnv("EXPO_PUBLIC_REVENUECAT_IOS_API_KEY", keys.ios);
  vi.stubEnv("EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY", keys.android);
  vi.doMock("@/lib/config/env", async (importOriginal) => {
    const { ENV } = await importOriginal<typeof import("@/lib/config/env")>();
    return { ENV: { ...ENV, REVENUECAT_ENABLED: enabled } };
  });
  const rn = await import("react-native");
  rn.Platform.OS = os as never;
  return { lib: await import("@/lib/purchases"), Linking: rn.Linking as never };
}

async function configured(os = "ios") {
  const loaded = await load(os);
  loaded.lib.configurePurchases();
  return loaded;
}

const info = (over: Record<string, unknown> = {}, entitlement: Record<string, unknown> | null = {}) =>
  ({
    originalAppUserId: "user_1",
    managementURL: null,
    entitlements: {
      active: entitlement
        ? {
            pro: {
              productIdentifier: "sailor_pro_monthly",
              expirationDate: "2026-10-01",
              willRenew: true,
              unsubscribeDetectedAt: null,
              periodType: "NORMAL",
              isSandbox: false,
              ...entitlement,
            },
          }
        : {},
    },
    subscriptionsByProductIdentifier: {},
    ...over,
  }) as never;

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  (globalThis as { __DEV__?: boolean }).__DEV__ = true;
});

describe("configure", () => {
  it("configures once, with the platform's key", async () => {
    const { lib } = await load("ios");
    expect(lib.isPurchasesConfigured()).toBe(false);
    expect(lib.configurePurchases()).toBe(true);
    expect(lib.configurePurchases()).toBe(true);
    expect(rc.Purchases.configure).toHaveBeenCalledOnce();
    expect(rc.Purchases.configure).toHaveBeenCalledWith({ apiKey: "appl_key" });
    expect(rc.Purchases.setLogLevel).toHaveBeenCalledWith("DEBUG");
    expect(lib.isPurchasesConfigured()).toBe(true);
  });

  it("logs quietly in release, and uses the Play key on Android", async () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    const { lib } = await load("android");
    lib.configurePurchases();
    expect(rc.Purchases.setLogLevel).toHaveBeenCalledWith("ERROR");
    expect(rc.Purchases.configure).toHaveBeenCalledWith({ apiKey: "goog_key" });
  });

  it("stays off on web and without a key", async () => {
    expect((await load("web")).lib.configurePurchases()).toBe(false);
    expect((await load("ios", { ios: "", android: "" })).lib.configurePurchases()).toBe(false);
    expect(rc.Purchases.configure).not.toHaveBeenCalled();
  });

  it("switched off, never configures and grants everyone Pro", async () => {
    const { lib } = await load("ios", undefined, false);
    expect(lib.configurePurchases()).toBe(false);
    expect(rc.Purchases.configure).not.toHaveBeenCalled();
    expect(lib.hasProEntitlement(null)).toBe(true);
  });

  it("every call is a safe no-op before configure", async () => {
    const { lib } = await load();
    await expect(lib.loginPurchases("u")).resolves.toBeNull();
    await expect(lib.logoutPurchases()).resolves.toBeNull();
    await expect(lib.fetchCustomerInfo()).resolves.toBeNull();
    await expect(lib.fetchCurrentOffering()).resolves.toBeNull();
    await expect(lib.presentPaywall()).resolves.toBe("unavailable");
    await expect(lib.presentPaywallIfNeeded()).resolves.toBe("unavailable");
    await expect(lib.presentCustomerCenter()).resolves.toBe(false);
    await expect(lib.openManageSubscriptions()).resolves.toBe(false);
    await expect(lib.requestRefund()).resolves.toBe("unavailable");
    expect(Object.values(rc.Purchases).every((fn) => fn.mock.calls.length === 0)).toBe(true);
  });
});

describe("entitlement and plan", () => {
  it("decides Pro in one place", async () => {
    const { lib } = await load();
    expect(lib.hasProEntitlement(null)).toBe(false);
    expect(lib.hasProEntitlement(info({}, null))).toBe(false);
    expect(lib.hasProEntitlement(info())).toBe(true);
  });

  it("names the plan from the offering, then the subscription, then the id", async () => {
    const { lib } = await load();
    expect(lib.activePlan(null)).toBeNull();
    expect(lib.activePlan(info({}, null))).toBeNull();

    const offering = {
      availablePackages: [
        { packageType: "MONTHLY", product: { identifier: "sailor_pro_monthly", title: " Wave ", subscriptionPeriod: "P1M" } },
      ],
    } as never;
    expect(lib.activePlan(info(), offering)).toMatchObject({ name: "Wave", period: "Monthly", isTrial: false });

    // Google Play suffixes the base plan onto the product id.
    const play = info({}, { productIdentifier: "sailor_pro:yearly", periodType: "TRIAL", isSandbox: true });
    const playOffering = {
      availablePackages: [
        { packageType: "CUSTOM", product: { identifier: "sailor_pro", title: "", subscriptionPeriod: "P2W" } },
      ],
    } as never;
    expect(lib.activePlan(play, playOffering)).toMatchObject({
      name: "Sailor Pro Yearly",
      period: "Every 2 weeks",
      isTrial: true,
      isSandbox: true,
    });

    const named = info(
      { subscriptionsByProductIdentifier: { sailor_pro_monthly: { displayName: "Voyager" } } },
      {},
    );
    expect(lib.activePlan(named)).toMatchObject({ name: "Voyager", period: "Monthly" });
  });

  it("reads the billing period however the store spells it", async () => {
    const { lib } = await load();
    const period = (productIdentifier: string, subscriptionPeriod?: string | null) =>
      lib.activePlan(
        info({ subscriptionsByProductIdentifier: undefined }, { productIdentifier }),
        subscriptionPeriod === undefined
          ? null
          : ({
              availablePackages: [
                { packageType: "CUSTOM", product: { identifier: productIdentifier, subscriptionPeriod } },
              ],
            } as never),
      )!.period;

    expect(period("p", "P1D")).toBe("Daily");
    expect(period("p", "P1W")).toBe("Weekly");
    expect(period("p", "P1Y")).toBe("Annual");
    expect(period("p", "P3M")).toBe("Every 3 months");
    expect(period("p", "P5X")).toBeNull();
    expect(period("p", null)).toBeNull();
    expect(period("pro_annual")).toBe("Annual");
    expect(period("pro_weekly")).toBe("Weekly");
    expect(period("pro_forever")).toBeNull();
  });
});

describe("identity and state", () => {
  it("logs in and out, leaving an anonymous user alone", async () => {
    const { lib } = await configured();
    rc.Purchases.logIn.mockResolvedValueOnce({ customerInfo: info() });
    await expect(lib.loginPurchases("user_1")).resolves.toBeTruthy();
    rc.Purchases.logIn.mockRejectedValueOnce(new Error("offline"));
    await expect(lib.loginPurchases("user_1")).resolves.toBeNull();

    rc.Purchases.getCustomerInfo.mockResolvedValueOnce(info({ originalAppUserId: "$RCAnonymousID:abc" }));
    await expect(lib.logoutPurchases()).resolves.toBeTruthy();
    expect(rc.Purchases.logOut).not.toHaveBeenCalled();

    rc.Purchases.getCustomerInfo.mockResolvedValueOnce(info());
    rc.Purchases.logOut.mockResolvedValueOnce(info());
    await expect(lib.logoutPurchases()).resolves.toBeTruthy();
    rc.Purchases.getCustomerInfo.mockRejectedValueOnce(new Error("offline"));
    await expect(lib.logoutPurchases()).resolves.toBeNull();
  });

  it("reads customer info, fresh when asked, and fails closed", async () => {
    const { lib } = await configured();
    rc.Purchases.getCustomerInfo.mockResolvedValue(info());
    await lib.fetchCustomerInfo();
    expect(rc.Purchases.invalidateCustomerInfoCache).not.toHaveBeenCalled();
    await lib.fetchCustomerInfo(true);
    expect(rc.Purchases.invalidateCustomerInfoCache).toHaveBeenCalledOnce();
    rc.Purchases.getCustomerInfo.mockRejectedValueOnce(new Error("offline"));
    await expect(lib.fetchCustomerInfo()).resolves.toBeNull();
  });

  it("reads the current offering", async () => {
    const { lib } = await configured();
    rc.Purchases.getOfferings.mockResolvedValueOnce({ current: { identifier: "default" } });
    await expect(lib.fetchCurrentOffering()).resolves.toEqual({ identifier: "default" });
    rc.Purchases.getOfferings.mockResolvedValueOnce({});
    await expect(lib.fetchCurrentOffering()).resolves.toBeNull();
    rc.Purchases.getOfferings.mockRejectedValueOnce(new Error("offline"));
    await expect(lib.fetchCurrentOffering()).resolves.toBeNull();
  });
});

describe("buying", () => {
  it("tells a purchase, a dismissal and a failure apart", async () => {
    const { lib } = await configured();
    rc.Purchases.purchasePackage.mockResolvedValueOnce({ customerInfo: info() });
    expect((await lib.purchasePackage({} as never)).kind).toBe("purchased");
    rc.Purchases.purchasePackage.mockRejectedValueOnce({ userCancelled: true });
    await expect(lib.purchasePackage({} as never)).resolves.toEqual({ kind: "cancelled" });
    rc.Purchases.purchasePackage.mockRejectedValueOnce(new Error("card declined"));
    await expect(lib.purchasePackage({} as never)).resolves.toEqual({ kind: "failed", message: "card declined" });
    rc.Purchases.purchasePackage.mockRejectedValueOnce(undefined);
    expect(await lib.purchasePackage({} as never)).toMatchObject({ kind: "failed", message: expect.any(String) });
  });

  it("restores, or reports nothing to restore", async () => {
    const { lib } = await load();
    rc.Purchases.restorePurchases.mockResolvedValueOnce(info());
    await expect(lib.restorePurchases()).resolves.toBeTruthy();
    rc.Purchases.restorePurchases.mockRejectedValueOnce(new Error("offline"));
    await expect(lib.restorePurchases()).resolves.toBeNull();
  });
});

describe("paywall and customer center", () => {
  it("maps every paywall result", async () => {
    const { lib } = await configured();
    for (const [result, outcome] of [
      ["PURCHASED", "purchased"],
      ["RESTORED", "restored"],
      ["CANCELLED", "dismissed"],
      ["ERROR", "unavailable"],
    ]) {
      rc.UI.presentPaywall.mockResolvedValueOnce(result);
      await expect(lib.presentPaywall()).resolves.toBe(outcome);
    }
    rc.UI.presentPaywall.mockRejectedValueOnce(new Error("not configured"));
    await expect(lib.presentPaywall()).resolves.toBe("unavailable");
  });

  it("treats an existing subscriber as good to go", async () => {
    const { lib } = await configured();
    rc.UI.presentPaywallIfNeeded.mockResolvedValueOnce("NOT_PRESENTED");
    await expect(lib.presentPaywallIfNeeded()).resolves.toBe("purchased");
    rc.UI.presentPaywallIfNeeded.mockResolvedValueOnce("CANCELLED");
    await expect(lib.presentPaywallIfNeeded()).resolves.toBe("dismissed");
    rc.UI.presentPaywallIfNeeded.mockRejectedValueOnce(new Error("x"));
    await expect(lib.presentPaywallIfNeeded()).resolves.toBe("unavailable");
  });

  it("re-reads the plan on the way out of the customer center", async () => {
    const { lib, Linking } = await configured();
    const onInfo = vi.fn();
    rc.UI.presentCustomerCenter.mockImplementationOnce(async ({ callbacks }) => {
      callbacks.onRestoreCompleted({ customerInfo: "restored" });
      callbacks.onManagementOptionSelected({ option: "custom_url", url: "https://help" });
      callbacks.onManagementOptionSelected({ option: "cancel" });
      callbacks.onManagementOptionSelected(undefined);
    });
    rc.Purchases.getCustomerInfo.mockResolvedValueOnce("fresh");
    await expect(lib.presentCustomerCenter(onInfo)).resolves.toBe(true);
    expect(onInfo.mock.calls).toEqual([["restored"], ["fresh"]]);
    expect(Linking.openURL).toHaveBeenCalledOnce();

    // No callback given, and nothing to re-read.
    rc.UI.presentCustomerCenter.mockImplementationOnce(async ({ callbacks }) => {
      callbacks.onRestoreCompleted({ customerInfo: "restored" });
    });
    rc.Purchases.getCustomerInfo.mockRejectedValueOnce(new Error("offline"));
    await expect(lib.presentCustomerCenter()).resolves.toBe(true);

    rc.UI.presentCustomerCenter.mockRejectedValueOnce(new Error("not configured"));
    await expect(lib.presentCustomerCenter()).resolves.toBe(false);
  });
});

describe("management", () => {
  it("opens the store's screen, or its management link", async () => {
    const { lib, Linking } = await configured();
    await expect(lib.openManageSubscriptions()).resolves.toBe(true);

    rc.Purchases.showManageSubscriptions.mockRejectedValueOnce(new Error("old iOS"));
    rc.Purchases.getCustomerInfo.mockResolvedValueOnce(info({ managementURL: "https://apps.apple.com/account" }));
    await expect(lib.openManageSubscriptions()).resolves.toBe(true);
    expect(Linking.openURL).toHaveBeenCalledWith("https://apps.apple.com/account");

    rc.Purchases.showManageSubscriptions.mockRejectedValueOnce(new Error("old iOS"));
    rc.Purchases.getCustomerInfo.mockResolvedValueOnce(info());
    await expect(lib.openManageSubscriptions()).resolves.toBe(false);
  });

  it("asks Apple for a refund, and only on iOS", async () => {
    const { lib } = await configured();
    for (const [status, outcome] of [
      [0, "submitted"],
      [1, "cancelled"],
      [2, "unavailable"],
    ] as const) {
      rc.Purchases.beginRefundRequestForActiveEntitlement.mockResolvedValueOnce(status);
      await expect(lib.requestRefund()).resolves.toBe(outcome);
    }
    rc.Purchases.beginRefundRequestForActiveEntitlement.mockRejectedValueOnce(new Error("none"));
    await expect(lib.requestRefund()).resolves.toBe("unavailable");

    const android = await configured("android");
    await expect(android.lib.requestRefund()).resolves.toBe("unavailable");
  });
});
