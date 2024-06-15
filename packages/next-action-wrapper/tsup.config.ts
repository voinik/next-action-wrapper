import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts', 'src/hooks.ts'],
    format: ['esm', 'cjs'],
    clean: true,
    splitting: false,
    sourcemap: true,
    dts: true,
});
