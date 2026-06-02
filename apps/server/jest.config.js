/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  moduleNameMapper: {
    '^@voice2spec/shared-types$': '<rootDir>/../../packages/shared-types/src',
    '^@voice2spec/shared-types/(.*)$': '<rootDir>/../../packages/shared-types/src/$1',
  },
  collectCoverageFrom: [
    'src/services/languageService.ts',
    'src/services/piiService.ts',
    'src/services/encryptionService.ts',
    'src/services/contextFilterService.ts',
    'src/utils/**/*.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
  testMatch: ['**/*.test.ts'],
  // Ensure the runner exits even when integration tests are pointed at live
  // Postgres/Redis (whose client sockets outlive the per-test singleton reset).
  forceExit: true,
};
