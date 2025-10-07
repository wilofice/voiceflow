module.exports = {
  env: {
    node: true,
    es6: true,
  },
  extends: [
    'eslint:recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: ['@typescript-eslint', 'import'],
  settings: {
    'import/resolver': {
      typescript: {
        project: ['./tsconfig.main.json', './tsconfig.renderer.json', './tsconfig.preload.json'],
      },
    },
  },
  rules: {
    // Allow console in development
    'no-console': 'warn',
    
    // Allow any types for now (we'll gradually reduce these)
    '@typescript-eslint/no-explicit-any': 'warn',
    
    // Allow unused vars if they start with underscore
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],
    'no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],
    
    // Allow require statements for dynamic imports in main process
    '@typescript-eslint/no-var-requires': 'warn',
    '@typescript-eslint/no-require-imports': 'warn',
    
    // Allow undefined globals in electron context
    'no-undef': 'off',
    
    // Disable import/namespace for now due to electron-log issues
    'import/namespace': 'off',
    
    // Import ordering
    'import/order': [
      'error',
      {
        groups: [
          'builtin',
          'external',
          'internal',
          'parent',
          'sibling',
          'index',
        ],
        'newlines-between': 'always',
        alphabetize: {
          order: 'asc',
          caseInsensitive: true,
        },
      },
    ],
  },
  overrides: [
    {
      // Main process specific rules
      files: ['src/main/**/*.ts'],
      env: {
        node: true,
        browser: false,
      },
      rules: {
        // Allow require in main process for conditional loading
        '@typescript-eslint/no-var-requires': 'off',
      },
    },
    {
      // Renderer process specific rules  
      files: ['src/renderer/**/*.{ts,tsx}'],
      env: {
        browser: true,
        node: false,
      },
      extends: ['plugin:react/recommended'],
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      settings: {
        react: {
          version: 'detect',
        },
      },
      rules: {
        'react/react-in-jsx-scope': 'off', // Not needed with React 17+
      },
    },
  ],
};