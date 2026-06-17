module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'assets/scripts',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^cc$': '<rootDir>/__mocks__/cc.ts',
    '^cc/env$': '<rootDir>/__mocks__/cc-env.ts',
    '^db://oops-framework/(.*)$': '<rootDir>/../../extensions/oops-plugin-framework/assets/$1',
  },
  globals: {
    'ts-jest': {
      tsconfig: {
        strict: true,
        esModuleInterop: true,
      },
    },
  },
};
