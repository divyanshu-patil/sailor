// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", ".expo/*", "coverage/*"],
  },
  {
    // vi.mock() has to be declared before the imports it replaces (vitest
    // hoists it anyway); keeping it at the top is what makes that readable.
    files: ["tests/**/*.ts"],
    rules: { "import/first": "off" },
  },
]);
