export default {
    testEnvironment: 'jsdom',
    transform: {},
    moduleNameMapper: {
        '^three$': '<rootDir>/node_modules/three/build/three.module.js',
        '^three/addons/(.*)$': '<rootDir>/node_modules/three/examples/jsm/$1'
    },
    setupFiles: ['<rootDir>/tests/setup.js']
};
