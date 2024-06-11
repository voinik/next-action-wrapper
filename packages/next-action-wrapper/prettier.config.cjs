//import globalConfig from '@repo/prettier-config/global-config';
const globalConfig = require('@repo/prettier-config/global-config.cjs');
/** @type {import("prettier").Config} */
module.exports = {
    ...globalConfig,
};

