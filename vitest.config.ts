import 'dotenv/config'; // Load .env immediately at module level
import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Load .env file - empty prefix loads all vars including ANTHROPIC_API_KEY
  const env = loadEnv(mode, process.cwd(), '');

  // Also inject into process.env for module-level code
  Object.assign(process.env, env);

  return {
    test: {
      globals: true,
      environment: 'node',
      include: ['tests/**/*.test.ts'],
      setupFiles: ['./tests/setup.ts'],
      env: {
        ...env,
      },
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        include: ['src/**/*.ts'],
        exclude: ['src/**/*.d.ts'],
      },
    },
  };
});
