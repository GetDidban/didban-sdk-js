declare module 'react-native' {
  export const Platform: {
    OS: string;
    Version: string | number;
    constants?: {
      reactNativeVersion?: { major: number; minor: number; patch: number };
      [key: string]: unknown;
    };
  };

  export const Dimensions: {
    get(name: 'window' | 'screen'): { width: number; height: number };
  };
}
