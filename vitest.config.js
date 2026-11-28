import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.js';

export default mergeConfig(
  viteConfig({ mode: 'test' }),
  defineConfig({
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/tests/setup.js'],
      css: false,
      include: ['src/**/*.test.{js,jsx}'],
      restoreMocks: true,
    },
  }),
);
