import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs', 'iife'],
  globalName: 'DidbanSDK',
  noExternal: ['@didban/core'],
  dts: true,
  sourcemap: true,
  clean: true,
  minify: true,
  target: 'es2020',
  outExtension({ format }) {
    return { js: format === 'cjs' ? '.cjs' : format === 'iife' ? '.global.js' : '.js' };
  },
});
