/** @type {import('jest').Config} */
module.exports = {
  preset: 'react-native',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@voice2spec/shared-types$': '<rootDir>/../../packages/shared-types/src',
    '^@voice2spec/shared-types/(.*)$': '<rootDir>/../../packages/shared-types/src/$1',
  },
  // pnpm stores packages under node_modules/.pnpm/<name>@<version>/...; the
  // default RN pattern assumes a flat layout. Transform RN-family packages
  // wherever they live so their Flow/TS source is compiled.
  transformIgnorePatterns: ['node_modules/.pnpm/(?!(@?react-native|@react-navigation))'],
  testMatch: ['**/*.test.{ts,tsx}'],
};
