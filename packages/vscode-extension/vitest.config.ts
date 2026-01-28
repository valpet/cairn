import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
  resolve: {
    alias: {
      vscode: fileURLToPath(new URL('./src/__mocks__/vscode.ts', import.meta.url)),
    },
  },
});
