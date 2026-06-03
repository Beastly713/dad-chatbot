/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: "ts-jest",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^@dad-chatbot/objective-safety$":
      "<rootDir>/../objective-safety/src/index.ts",
    "^@dad-chatbot/objective-schemas$":
      "<rootDir>/../objective-schemas/src/index.ts"
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true
      }
    ]
  },
  testMatch: ["**/__tests__/**/*.test.ts"],
  verbose: true
};
