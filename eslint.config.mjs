import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    name: 'courtly/ignores',
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '.agents/**',
      '.opencode/**',
      'apps/web/src/routeTree.gen.ts',
    ],
  },
  js.configs.recommended,
  {
    name: 'courtly/typescript',
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    name: 'courtly/node',
    files: ['apps/api/**/*.ts', 'packages/contracts/**/*.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    name: 'courtly/web',
    files: ['apps/web/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat['recommended-latest'], reactRefresh.configs.vite],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // TanStack file routes always export `Route` beside their component, and
      // shadcn modules export their `cva` variants beside the component.
      'react-refresh/only-export-components': [
        'error',
        {
          allowExportNames: ['Route', 'buttonVariants', 'badgeVariants', 'tabsListVariants'],
        },
      ],
    },
  },
  {
    name: 'courtly/web-routes',
    // TanStack file routes export the route object (and sometimes helpers)
    // beside component declarations; the file cannot be a components-only
    // module by design.
    files: ['apps/web/src/routes/**/*.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    name: 'courtly/javascript',
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: globals.node,
    },
  },
  prettier,
);
