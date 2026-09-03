import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';

const LEGACY_COMPLEXITY = Object.freeze({
  'app.js': 23,
  'public/js/private/crops.js': 13,
  'public/js/private/plagues.js': 27,
  'public/js/private/product.js': 21,
  'public/js/private/suppliers.js': 24,
  'public/js/public/plagues.js': 11,
  'src/controllers/private/cropsController.js': 66,
  'src/controllers/private/plagueController.js': 15,
  'src/controllers/private/productsController.js': 15,
  'src/controllers/private/suppliersController.js': 28,
  'src/controllers/private/usersController.js': 13,
  'src/controllers/public/cropController.js': 14,
  'src/controllers/public/plagueController.js': 13,
  'src/controllers/public/productController.js': 12,
  'src/middlewares/rateLimiter.js': 15,
  'src/scripts/seedDefaultUsers.js': 12,
  'src/services/plagueDetailService.js': 18,
  'src/services/plagueValidationService.js': 16,
  'src/services/plagueWorkflowService.js': 15,
});

const legacyComplexityOverrides = Object.entries(LEGACY_COMPLEXITY).map(
  ([file, maximum]) => ({
    files: [file],
    rules: {
      complexity: ['error', maximum],
    },
  }),
);

export default [
  {
    ignores: [
      'node_modules/**',
      'coverage/**',
      'public/css/**',
      'src/data/**',
      'src/views/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
    rules: {
      complexity: ['error', 10],
      'no-console': 'off',
      'no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
          varsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    files: ['public/js/**/*.js'],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ['public/js/private/lands.js'],
    languageOptions: {
      globals: {
        L: 'readonly',
      },
    },
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      globals: globals.jest,
    },
  },
  ...legacyComplexityOverrides,
  eslintConfigPrettier,
];
