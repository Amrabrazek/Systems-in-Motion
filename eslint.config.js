import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist', 'playwright-report', 'test-results'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: ['*.config.{js,ts}', 'e2e/**'],
    languageOptions: { globals: globals.node },
  },

  // The one structural rule (CLAUDE.md): the engine is pure TS so it can run headless,
  // fast and deterministic. No UI, no clock, no unseeded randomness.
  {
    files: ['src/engine/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { regex: '^react', message: 'engine/ must not use React.' },
            {
              regex: '(^|/)(ui|sim|kits|topics|design)(/|$)',
              message: 'engine/ must not import from ui, sim, kits, topics or design.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        ...['window', 'document', 'localStorage', 'performance', 'requestAnimationFrame'].map(
          (name) => ({ name, message: 'engine/ runs headless: no browser globals.' }),
        ),
        ...['setTimeout', 'setInterval'].map((name) => ({
          name,
          message: 'engine/ has no timers: time only moves through step(state, actions, dt).',
        })),
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Date', property: 'now', message: 'Use the sim time in state, not the clock.' },
        { object: 'Math', property: 'random', message: 'Use the seeded RNG in state.' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date']",
          message: 'Use the sim time in state, not the clock.',
        },
      ],
    },
  },
  // ADR 0009: capacities, latencies and rates come from src/data/numbers, never literals.
  {
    files: ['src/engine/**/*.ts'],
    ignores: ['src/engine/**/*.test.ts'],
    rules: {
      'no-magic-numbers': ['error', { ignore: [0, 1, -1], ignoreArrayIndexes: true }],
    },
  },
  // ADR 0007: topics are isolated pages. A topic may import engine, sim, kits and
  // ui/shared, never a sibling topic (so topics can be built in parallel).
  {
    files: ['src/topics/*/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^\\.\\./(?!\\.\\.)',
              message: 'Topics never import other topics or the registry (ADR 0007).',
            },
          ],
        },
      ],
    },
  },
  prettier,
);
