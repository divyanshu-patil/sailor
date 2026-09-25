// Types for the few modules the tests reach that ship none this app can see.

// react-dom ships no types of its own and @types/react-dom isn't installed;
// the store tests only need this one function from it.
declare module "react-dom/server" {
  import type { ReactElement } from "react";
  export function renderToString(element: ReactElement): string;
}

// No @types/node here (it would clash with React Native's globals); setup.ts
// only needs to teach node's require about image files.
declare module "node:module" {
  export function createRequire(url: string): {
    extensions: Record<string, (module: { exports: unknown }, filename: string) => void>;
  };
}

// Reanimated's pure interpolation and easing files, imported directly so the
// tests skip the native module the package entry loads.
declare module "react-native-reanimated/lib/module/interpolation.js" {
  export { Extrapolation, interpolate } from "react-native-reanimated";
}
declare module "react-native-reanimated/lib/module/Easing.js" {
  export { Easing } from "react-native-reanimated";
}
