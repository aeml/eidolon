import js from '@eslint/js';
import globals from 'globals';

export default [
    {
        ignores: [
            'assets/**',
            'coverage/**',
            'node_modules/**',
            'server/**',
            'src/proto/**'
        ]
    },
    {
        files: ['src/**/*.js', 'tests/**/*.js'],
        ...js.configs.recommended,
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.node,
                ...globals.jest
            }
        },
        rules: {
            'no-unused-vars': 'off'
        }
    }
];
