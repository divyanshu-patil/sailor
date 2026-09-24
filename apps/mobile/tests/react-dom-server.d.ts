// react-dom ships no types of its own and @types/react-dom isn't installed;
// the store tests only need this one function from it.
declare module "react-dom/server" {
  import type { ReactElement } from "react";
  export function renderToString(element: ReactElement): string;
}
