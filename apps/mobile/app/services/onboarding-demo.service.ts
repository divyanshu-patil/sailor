import { apiClient } from "@/lib/api/client";
import type { AudienceType } from "@/types/presentation";
import type { ScriptMood } from "@/types/settings/preferences";
import type { Profession } from "@/types/user";

/**
 * The onboarding demo — a script and deck made before sign-up.
 *
 * Every demo was produced once by the real pipeline and is stored on the
 * server (see backend services/onboarding_demos.py), so both endpoints are
 * public reads that answer instantly. They're also cached here for the life of
 * the app process: stepping back and forth through the demo never waits twice.
 */

export interface DemoOption {
  id: string;
  /** The onboarding speaking context it was chosen for, e.g. "work". */
  context: string;
  label: string;
  /** What would have been typed into step one of the wizard. */
  brief: string;
  durationMinutes: number;
  cardCount: number;
  audience: AudienceType;
  mood: ScriptMood;
  profession: Profession;
}

export interface DemoCard {
  position: number;
  title: string;
  description: string;
  keywords: string[];
  impact: number;
  delivery: string;
  color: string;
}

export interface DemoDetail extends DemoOption {
  title: string;
  script: string;
  deck: {
    title: string;
    description: string;
    color: string;
    cards: DemoCard[];
  };
}

const options = new Map<string, Promise<DemoOption[]>>();
const details = new Map<string, Promise<DemoDetail>>();

/** A cached promise that doesn't cache a failure — a retry has to refetch. */
function remember<T>(
  cache: Map<string, Promise<T>>,
  key: string,
  load: () => Promise<T>,
): Promise<T> {
  const hit = cache.get(key);
  if (hit) return hit;
  const pending = load().catch((error: unknown) => {
    cache.delete(key);
    throw error;
  });
  cache.set(key, pending);
  return pending;
}

export const onboardingDemoService = {
  listDemos(contexts: string[], limit = 4): Promise<DemoOption[]> {
    const key = `${contexts.join(",")}|${limit}`;
    return remember(options, key, async () => {
      const response = await apiClient.get<DemoOption[]>(
        "/api/v1/onboarding-demos",
        { params: { contexts: contexts.join(","), limit } },
      );
      return response.data;
    });
  },

  getDemo(id: string): Promise<DemoDetail> {
    return remember(details, id, async () => {
      const response = await apiClient.get<DemoDetail>(
        `/api/v1/onboarding-demos/${encodeURIComponent(id)}`,
      );
      return response.data;
    });
  },

  /** Drop every cached answer. For tests, and a manual "reload the demo". */
  clearCache() {
    options.clear();
    details.clear();
  },
};
