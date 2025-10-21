module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',

  // Module resolution
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/renderer/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/src/renderer/test/__mocks__/fileMock.ts',
  },

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/src/renderer/test/setup.ts'],

  // Test match patterns
  testMatch: [
    '**/__tests__/**/*.{ts,tsx}',
    '**/*.{test,spec}.{ts,tsx}',
  ],

  // Coverage
  collectCoverageFrom: [
    'src/renderer/**/*.{ts,tsx}',
    '!src/renderer/**/*.d.ts',
    '!src/renderer/test/**',
    '!src/renderer/**/*.stories.{ts,tsx}',
    '!src/renderer/**/index.{ts,tsx}',
  ],

  coverageThreshold: {
    global: {
      statements: 70,
      branches: 60,
      functions: 70,
      lines: 70,
    },
  },

  // Transform
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        jsx: 'react',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        isolatedModules: true,
      },
    }],
  },

  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/dist-electron/',
  ],
};
