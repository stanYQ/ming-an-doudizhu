module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/tests'],
  testMatch: ['<rootDir>/tests/__tests__/**/*.test.ts'],
  // 集成测试需要真实服务端；默认跑 npm test 时排除，
  // 单独执行：npm test -- --testPathPattern=integration --forceExit
  testPathIgnorePatterns: ['\\.integration\\.test\\.ts$'],
  moduleNameMapper: {
    // Cocos Creator runtime modules → mocks
    '^cc$':      '<rootDir>/tests/__mocks__/cc.ts',
    '^cc/env$':  '<rootDir>/tests/__mocks__/cc-env.ts',
    '^db://oops-framework/(.*)$': '<rootDir>/extensions/oops-plugin-framework/assets/$1',
    // 源码相对路径映射（test 文件里的 ../ui/X → assets/scripts/ui/X）
    '^\\.\\./(ui|game|net|shared|core|scenes)/(.*)$': '<rootDir>/assets/scripts/$1/$2',
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
