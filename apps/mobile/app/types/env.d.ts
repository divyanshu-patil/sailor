declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_API_URL: string;
  }
}

// Metro copies .lottie files through as assets (see metro.config.js); TS needs
// to be told the require() resolves to an asset id.
declare module "*.lottie" {
  const source: number;
  export default source;
}
