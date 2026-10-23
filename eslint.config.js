// eslint.config.js — flat config format required by ESLint v9+.
// We use the built-in recommended ruleset and override a few rules to match
// the code-style rules in .agent/rules/code-style.md.
const js = require('@eslint/js');

module.exports = [
  js.configs.recommended,
  {
    // Apply to all JS source and test files.
    files: ['src/**/*.js', 'tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        // Node.js globals
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        process: 'readonly',
        console: 'readonly',
        // Node.js built-in globals available since Node 10+
        URL: 'readonly',
        URLSearchParams: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        // Jest globals
        jest: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
      },
    },
    rules: {
      // Enforce single quotes (code-style.md)
      'quotes': ['error', 'single'],
      // Require semicolons (code-style.md)
      'semi': ['error', 'always'],
      // Warn on unused variables (common bug source)
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // Prefer const (code-style.md)
      'prefer-const': 'error',
      // No var
      'no-var': 'error',
    },
  },
];
