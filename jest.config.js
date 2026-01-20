export default {
    testEnvironment: 'jsdom',
    transform: {},
    moduleNameMapper: {
        '^three$': '<rootDir>/node_modules/three/build/three.module.js',
        '^three/addons/(.*)$': '<rootDir>/node_modules/three/examples/jsm/$1'
    },
    setupFiles: ['<rootDir>/tests/setup.js'],
    
    // Coverage configuration
    collectCoverageFrom: [
        'src/**/*.js',
        '!src/**/*.test.js',
        '!**/node_modules/**'
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    // Start with low thresholds - increase as test coverage improves
    coverageThreshold: {
        global: {
            branches: 0,
            functions: 0,
            lines: 0,
            statements: 0
        }
    }
};
