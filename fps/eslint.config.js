// Lint for the game's own scripts: what is likely a mistake, plus a light house style. Run `npm install` once in the project
// folder, then `npm run lint` (or `npm run lint:fix`). The ESLint extension VS Code suggests (.vscode/extensions.json)
// underlines the same things as you type and fixes the style when you save.
import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  // What the engine writes or ships, not the game's own code.
  globalIgnores(['brave/**', 'node_modules/**', 'dist/**', 'out/**', 'build/**', 'ui/**']),

  js.configs.recommended,
  tseslint.configs.recommended,

  {
    // .sdr and .ppfx are TypeScript too.
    files: ['**/*.{ts,sdr,ppfx}'],
    plugins: { '@stylistic': stylistic },
    rules: {
      // Style: a warning, never blocking, and fixed on save (or with `npm run lint:fix`). Template literals (a shader's
      // source) are left alone.
      '@stylistic/quotes': ['warn', 'single', { avoidEscape: true, allowTemplateLiterals: 'always' }],
      '@stylistic/indent': ['warn', 2, { SwitchCase: 1, ignoredNodes: ['TemplateLiteral *'] }],
      '@stylistic/no-tabs': 'warn',
      '@stylistic/semi': ['warn', 'always'],
      '@stylistic/eol-last': 'warn',
      '@stylistic/no-trailing-spaces': 'warn',

      // Likely mistakes. `any` and an unused variable are allowed to stay (a warning), a `_` prefix says it is on purpose.
      eqeqeq: ['warn', 'always', { null: 'ignore' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
    },
  },
);
