/**
 * Embeds fonts in the widget extension.
 *
 * A widget is a separate process with its own bundle: fonts registered for the
 * app (the expo-font plugin, or Font.loadAsync at runtime) don't exist there,
 * so SwiftUI's `Font.custom` silently falls back to the system font. expo-widgets
 * has no option for this, so this plugin copies the files into its target,
 * adds them to the target's Resources phase, and lists them in the target's
 * Info.plist under UIAppFonts.
 *
 * ORDER MATTERS: list this plugin BEFORE "expo-widgets" in app.json. Mods of
 * the same kind run last-registered-first, so being listed earlier is what
 * makes it run after expo-widgets has regenerated (and wiped) its target.
 *
 *   ["./plugins/with-widget-fonts", { "fonts": ["../../node_modules/.../X.ttf"] }]
 */
const fs = require("fs");
const path = require("path");
const plist = require("@expo/plist").default;
const {
  withDangerousMod,
  withXcodeProject,
} = require("@expo/config-plugins");

const TARGET = "ExpoWidgetsTarget";
// Prefixed so the file name can't collide with the app's own copy of the same
// font in the project's file-reference lookup.
const fileName = (font) => `Widget-${path.basename(font)}`;

const withWidgetFonts = (config, { fonts = [] } = {}) => {
  config = withDangerousMod(config, [
    "ios",
    (config) => {
      const targetDir = path.join(config.modRequest.platformProjectRoot, TARGET);
      if (!fs.existsSync(targetDir)) return config;

      for (const font of fonts) {
        fs.copyFileSync(
          path.resolve(config.modRequest.projectRoot, font),
          path.join(targetDir, fileName(font)),
        );
      }

      const plistPath = path.join(targetDir, "Info.plist");
      const info = plist.parse(fs.readFileSync(plistPath, "utf8"));
      info.UIAppFonts = Array.from(
        new Set([...(info.UIAppFonts ?? []), ...fonts.map(fileName)]),
      );
      fs.writeFileSync(plistPath, plist.build(info));
      return config;
    },
  ]);

  return withXcodeProject(config, (config) => {
    const project = config.modResults;
    const targetUuid = project.findTargetKey(TARGET);
    const groupKey = project.findPBXGroupKey({ name: TARGET });
    if (!targetUuid || !groupKey) return config;

    // Without its own Resources phase, node-xcode falls back to the first one
    // it finds — the app's — and the font would land in the wrong bundle.
    if (!project.buildPhase("Resources", targetUuid)) {
      project.addBuildPhase([], "PBXResourcesBuildPhase", "Resources", targetUuid);
    }

    for (const font of fonts) {
      // Not addResourceFile: it assumes a top-level "Resources" group, which
      // an Expo project doesn't have. addFile returns null when the file is
      // already referenced (a prebuild without --clean).
      const file = project.addFile(fileName(font), groupKey, {
        lastKnownFileType: "file",
      });
      if (!file) continue;
      file.uuid = project.generateUuid();
      file.target = targetUuid;
      project.addToPbxBuildFileSection(file);
      project.addToPbxResourcesBuildPhase(file);
    }
    return config;
  });
};

module.exports = withWidgetFonts;
