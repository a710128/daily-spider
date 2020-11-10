const { default: Axios } = require("axios");


class Client {
    constructor(name) {
        this.result = [];
        this.name = name;
    }

    addResult(res) {
        let formed_data = {
            src: this.name,
            meta: {}
        };
        for (let key of Object.keys(res)) {
            if (key == "topic" || key == "data") {
                formed_data[key] = res[key];
            } else {
                formed_data.meta[key] = res[key]
            }
        }
        this.result.push(formed_data);
    }

    getResults() {
        return this.result;
    }
}

process.on("message", async (msg) => {
    let plugin_name = process.argv[2];
    let plugin_path = process.argv[3];
    let config = msg.config;
    let server = msg.server;
    let dry = msg.dry;

    let exit_code = 0;
    console.log("======================" + ( new Date().toLocaleString() ) + "======================");
    console.error("======================" + ( new Date().toLocaleString() ) + "======================");
    try {
        let plugin = require(plugin_path);
        let client = new Client(plugin_name);
        await plugin.apply( client, [plugin_name, config] )
        
        let ssend = "";
        let cnt = 0;
        for (let r of client.getResults()) {
            ssend += JSON.stringify(r) + "\n";
            cnt ++;
        }

        if (!dry) {
            let res = await Axios.post(server + "/add", ssend, {
                maxBodyLength: Infinity,
                maxContentLength: Infinity
            });
            if (res.data.code == 0) {
                console.log(res.data);
                console.log(`Total length: ${cnt}`);
            } else {
                console.error(res.data);
                exit_code = res.data.code;
            }
        } else {
            console.log("Dry run result:\n");
            console.log(ssend);
            console.log("\n");
        }
        
    } catch (e) {
        console.error(e);
        exit_code = 1;
    }
    process.exit(exit_code);
});