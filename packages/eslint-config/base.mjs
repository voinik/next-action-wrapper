import { resolve } from 'node:path';
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import parser from '@typescript-eslint/parser';

const currentProject = resolve(process.cwd(), 'tsconfig.lint.json');
const project = [currentProject];
console.log('project: ', project);

const config = tseslint.config(
    {
        ignores: [
            // Ignore dotfiles
            '.*.js',
            'node_modules/',
            '.next/',
            'dist/',
        ],
    },
    eslint.configs.recommended,

    // Typescript ESLint
    ...tseslint.configs.recommendedTypeChecked,
    ...tseslint.configs.stylisticTypeChecked,
    {
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
            },
        },
    },
    {
        linterOptions: {
            reportUnusedDisableDirectives: true,
        },
        languageOptions: {
            parser,
            parserOptions: {
                project,
            },
        },
    },
    {
        rules: {
            'no-console': 'warn',
            'no-undef': 'off',
            'sort-imports': ['warn', { ignoreCase: true, ignoreDeclarationSort: true }],
            '@typescript-eslint/switch-exhaustiveness-check': 'error',
            '@typescript-eslint/no-floating-promises': 'error',
            '@typescript-eslint/no-explicit-any': 'error',
            '@typescript-eslint/array-type': ['error', { default: 'generic', readonly: 'generic' }],
            '@typescript-eslint/consistent-type-definitions': 'off',
            '@typescript-eslint/consistent-type-imports': [
                'warn',
                {
                    prefer: 'type-imports',
                    fixStyle: 'inline-type-imports',
                },
            ],
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                },
            ],
            '@typescript-eslint/no-misused-promises': [
                'error',
                {
                    checksVoidReturn: {
                        attributes: false,
                    },
                },
            ],
        },
    },
);

export default config;
