import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  // Base configuration for all files
  {
    files: ['**/*.{js,mjs,cjs,ts}'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      parser: tsparser,
      parserOptions: {
        // Disable project-based type checking for now to avoid tsconfig issues
        project: false,
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        require: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      // ESLint recommended rules
      ...js.configs.recommended.rules,
      // TypeScript ESLint recommended rules
      ...tseslint.configs.recommended.rules,
      // Additional rules for better code quality
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off', // Allow implicit return types for cleaner code
      '@typescript-eslint/no-explicit-any': 'warn', // Warn about any types but don't fail
      'prefer-const': 'error',
      '@typescript-eslint/no-var-requires': 'off', // Allow require() in CommonJS
      'no-console': 'off', // Allow console for CLI tools and debugging
      'no-unused-vars': 'off', // Use TypeScript version instead
      'no-undef': 'off', // TypeScript handles this
    },
  },
  // Configuration for test files
  {
    files: ['**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off', // Allow any in tests for mocking
      '@typescript-eslint/no-non-null-assertion': 'off', // Allow non-null assertions in tests
    },
  },
  // Ignore patterns
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/*.d.ts',
      '**/*.js.map',
      '**/*.d.ts.map',
      'packages/vscode-extension/media/**', // HTML/JS files in webview
      '.cairn/**', // Cairn data directory
      'docs/**', // Documentation files
      'scripts/**', // Build scripts
      'eslint.config.js', // ESLint config itself
    ],
  },
];