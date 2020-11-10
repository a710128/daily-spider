const path = require("path");
const fs = require("fs");
const child_process = require("child_process");
const argv = require("./src/args");

const JSON_CONFIG = require(argv.config);
const PLUGINS = Object.keys(JSON_CONFIG.plugins).filter((v) => {
    if (argv.plugin) return argv.plugin.indexOf(v) !== -1;
    else return true;
});

const LOG_FILE_PATH = path.isAbsolute(JSON_CONFIG.log) ? JSON_CONFIG.log : path.join(__dirname, JSON_CONFIG.log);


function startWorker(plugin_path, plugin_name) {
    let fout = fs.openSync(path.join( LOG_FILE_PATH, plugin_name + ".log" ), "a");
    let ferr = fs.openSync(path.join( LOG_FILE_PATH, plugin_name + ".error.log" ), "a");

    let child = child_process.fork(path.join(__dirname, "src", "plugins.js"), [plugin_name, plugin_path], {
        silent: true,
        detached: true,
        stdio: [ 'ignore', fout, ferr, 'ipc']
    });
    child.send({
        server: JSON_CONFIG.server,
        config: JSON_CONFIG.plugins[plugin_name],
        dry: argv.dry
    });
}

for (let i in PLUGINS) {
    let plugin_name = PLUGINS[i];

    let plugin_path = "";
    if  (path.isAbsolute(JSON_CONFIG.plugins[plugin_name].path )) {
        plugin_path = JSON_CONFIG.plugins[plugin_name].path;
    } else {
        plugin_path = path.join(__dirname, JSON_CONFIG.plugins[plugin_name].path);
    }
    startWorker(plugin_path, plugin_name);
}