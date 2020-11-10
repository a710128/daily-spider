const { boolean } = require("yargs");
const yargs = require("yargs");

let argv = yargs.option(
    'config', {
        alias: 'c',
        type: 'string',
        default: './config.json',
        description: 'Path to config file'
    }).option(
    'dry', {
        alias: 'd',
        type: 'boolean',
        default: false,
        description: 'Dry run'
    }).option(
    'plugin', {
        alias: 'p',
        type: 'string',
        array: true,
        description: 'Allowed plugins'
    }).option(
        'daemon', {
            alias: 'D',
            type: 'boolean',
            default: false,
            description: 'Run client as daemon'
    }).option(
        'clean', {
            alias: 'C',
            type: 'boolean',
            default: false,
            description: 'Run clean up script'
    }).help("help").argv;

if (argv.plugin) {
    let nw_plugin = [];
    for (let v of argv.plugin) {
        nw_plugin = nw_plugin.concat(v.split(/[;,]/).filter((v) => v.length > 0));
    }
    argv.plugin = argv.p = nw_plugin;
}

module.exports = argv;