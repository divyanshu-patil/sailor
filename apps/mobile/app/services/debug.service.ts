const DEBUG_ENABLED = __DEV__;

export const debugService = {
  log(scope: string, message: string, data?: unknown) {
    if (!DEBUG_ENABLED) return;
    // eslint-disable-next-line no-unused-expressions
    data !== undefined
      ? console.log(`[debug:${scope}] ${message}`, data)
      : console.log(`[debug:${scope}] ${message}`);
  },
  warn(scope: string, message: string, data?: unknown) {
    if (!DEBUG_ENABLED) return;
    console.warn(`[debug:${scope}] ${message}`, data ?? "");
  },
};
