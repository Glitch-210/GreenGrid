/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: "tests",
  moduleNameMapper: {
    "^@wattshare/shared$": "<rootDir>/../../../packages/shared/src/index.ts",
  },
};
