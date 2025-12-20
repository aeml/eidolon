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
    coverageThreshold: {
        global: {
            branches: 10,
            functions: 10,
            lines: 10,
            statements: 10
        }
    }
};
