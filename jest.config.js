/** @type {import('jest').Config} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['**/src/test/**/*.test.ts'],
    testPathIgnorePatterns: ['/node_modules/', '/src/test/ui/', '/.vscode-test/'],
    modulePathIgnorePatterns: ['<rootDir>/.vscode-test/'],
    transform: {
        '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }]
    },
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1'
    },
    collectCoverageFrom: [
        'src/core/FileEntryMatcher.ts',
        'src/core/GroupFileRemoval.ts',
        'src/core/GroupFileTargets.ts'
    ],
    coverageThreshold: {
        global: {
            statements: 90,
            branches: 80,
            functions: 90,
            lines: 90
        }
    }
};
