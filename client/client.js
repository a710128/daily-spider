const path = require("path");
const fs = require("fs");
const child_process = require("child_process");
const argv = require("./src/args");
const { ADDRCONFIG } = require("dns");

const JSON_CONFIG = require(argv.config);
const PLUGINS = Object.keys(JSON_CONFIG.plugins).filter((v) => {
    if (argv.plugin) return argv.plugin.indexOf(v) !== -1;
    else return true;
});

console.log(PLUGINS);

const LOG_FILE_PATH = path.isAbsolute(JSON_CONFIG.log) ? JSON_CONFIG.log : path.join(__dirname, JSON_CONFIG.log);


function startWorker(plugin_path, plugin_name) {
    let fout = fs.openSync(path.join( LOG_FILE_PATH, plugin_name + ".log" ), "a");
    let ferr = fs.openSync(path.join( LOG_FILE_PATH, plugin_name + ".error.log" ), "a");

    let child = child_process.fork(path.join(__dirname, "src", "plugins.js"), [plugin_name, plugin_path, JSON_CONFIG.authorize_key], {
        silent: true,
        detached: true,
        stdio: [ 'ignore', fout, ferr, 'ipc']
    });
    child.send({
        server: JSON_CONFIG.server,
        config: JSON_CONFIG.plugins[plugin_name],
        dry: argv.dry,
        cleanup: argv.clean,
    });

    child.on("exit", (code) => {
        child.stoped = true;
        console.log(new Date().toISOString(), plugin_name, "stoped with code", code);
    });
    return child;
}


// Get last pid
let pid_file = JSON_CONFIG.pid_file || path.join(__dirname, "./dailyspider.pid");
let last_pid = 0;
try {
    last_pid = parseInt(fs.readFileSync(pid_file).toString());
} catch(e) {
}
console.log(`Last pid: ${last_pid}`)

// check whether process is running
if (last_pid) {
    if (require("is-running")(last_pid)) {
        console.error("Spider client is running");
        process.exit(1);
    }
}

// set new pid
fs.writeFileSync( pid_file, process.pid.toString() );

// start plugins
let children = [];
for (let i in PLUGINS) {
    let plugin_name = PLUGINS[i];

    let plugin_path = "";
    if  (path.isAbsolute(JSON_CONFIG.plugins[plugin_name].path )) {
        plugin_path = JSON_CONFIG.plugins[plugin_name].path;
    } else {
        plugin_path = path.join(__dirname, JSON_CONFIG.plugins[plugin_name].path);
    }
    children.push( startWorker(plugin_path, plugin_name) );
}

// kill plugins

function killall(signal) {
    for (let child of children) {
        if (!child.stoped) {
            console.log(`Kill ${child.pid}`)
            child.kill(signal);
        }
    }
}

function exit_handler() {
    console.log("SIGTERM!");
    if (!killing_process) {
        killing_process = true;
        killall("SIGTERM");
        setTimeout(() => {
            killall("SIGKILL");
            process.exit(1);
        }, 1000);
    }
}

let killing_process = false;
process.on("SIGTERM", exit_handler);
process.on("SIGINT", exit_handler);