const cli = require("cli");
require('dotenv').config()
require = require("esm")(module/*, options*/)
cli.parse(null, [
    'get-native',
    'calculate-price',
    'create-pool',
    'increase-allowance',
    'add-liquidity',
    'remove-liquidity',
    'test',
    'swap-native',
    'swap-token'
]);
module.exports = require("./main.js")
