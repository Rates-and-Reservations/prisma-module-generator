import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/generate-module.ts'],
  outDir: 'bin',
  format: ['esm'],
  target: 'node18',
  clean: true,
  dts: false,
  splitting: false,
  minify: false,
});
