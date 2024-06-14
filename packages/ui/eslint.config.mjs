import customConfig from '@repo/eslint-config/react';

const config = [
    ...customConfig,
    {
        ignores: ['src/components/ui/**/*'],
    },
];

export default config;

