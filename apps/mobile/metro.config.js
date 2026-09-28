const path = require("path");
const {
  getSentryExpoConfig
} = require("@sentry/react-native/metro");
// Find the workspace root, this can be replaced with find-yarn-workspace-root
const workspaceRoot = path.resolve(__dirname, "../..");
const projectRoot = __dirname;
const config = getSentryExpoConfig(projectRoot);
// 1. Watch all files within the monorepo
config.watchFolders = [workspaceRoot];
// 2. Let Metro know where to resolve packages, and in what order
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
// dotLottie files ship as a zip; Metro must copy them verbatim rather than
// try to parse them.
config.resolver.assetExts.push("lottie");
// RevenueCat is switched off (REVENUECAT_ENABLED in app/lib/config/env.ts).
// Its native code is excluded from autolinking in package.json, so its JS is
// left out of the bundle too rather than shipped pointing at nothing.
const REVENUECAT = new Set(["react-native-purchases", "react-native-purchases-ui"]);
const resolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) =>
  REVENUECAT.has(moduleName)
    ? { type: "empty" }
    : resolveRequest(context, moduleName, platform);
config.resolver.alias = {
  "@": path.resolve(projectRoot, "src"),
  "@/assets": path.resolve(projectRoot, "assets"),
};
module.exports = config;