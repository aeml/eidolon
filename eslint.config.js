import js from '@eslint/js';
import globals from 'globals';

export default [
    {
        ignores: [
            'assets/**',
            'coverage/**',
            'node_modules/**',
            'playwright-report/**',
            'server/**',
            'src/proto/**',
            'test-results/**',
            'vendor/**'
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
            ...js.configs.recommended.rules,
            'no-unused-vars': 'off'
        }
    },
    {
        files: ['playwright.config.js', 'scripts/**/*.js', 'scripts/**/*.mjs'],
        ...js.configs.recommended,
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.node
            }
        }
    }
];
