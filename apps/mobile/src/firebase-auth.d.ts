import type { Persistence } from "firebase/auth";

/**
 * `getReactNativePersistence` only exists in `@firebase/auth`'s `react-native` export condition.
 * Metro resolves that condition at bundle time, but TypeScript resolves the package's top-level
 * `types` entry instead, so the symbol is invisible to tsc without this augmentation.
 *
 * Remove once Firebase ships React Native types through the standard conditional exports.
 */
declare module "firebase/auth" {
  export function getReactNativePersistence(storage: {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
  }): Persistence;
}
