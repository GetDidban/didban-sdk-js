import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  external: ['react-native'],
  noExternal: ['@didban/core'],
  dts: true,
  sourcemap: true,
  clean: true,
  minify: true,
  target: 'es2020',
  outExtension({ format }) {
    return { js: format === 'cjs' ? '.cjs' : '.js' };
  },
});
