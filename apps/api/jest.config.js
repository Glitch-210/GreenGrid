/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: "tests",
  setupFiles: ["<rootDir>/setup-env.ts"],
  moduleNameMapper: {
    "^@wattshare/shared$": "<rootDir>/../../../packages/shared/src/index.ts",
  },
};
