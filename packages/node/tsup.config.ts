import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  noExternal: ['@didban/core'],
  dts: true,
  sourcemap: true,
  clean: true,
  minify: true,
  target: 'node18',
  platform: 'node',
  outExtension({ format }) {
    return { js: format === 'cjs' ? '.cjs' : '.js' };
  },
});
