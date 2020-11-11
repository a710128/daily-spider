const express = require("express");
const JSON_CONFIG = require("./config.json");
const fs = require("fs");
const path = require("path");
const util = require("./utils");

var router = express.Router();

const DATA_DIR = path.isAbsolute(JSON_CONFIG.data_dir) ? JSON_CONFIG.data_dir : path.join(__dirname, JSON_CONFIG.data_dir);

var global = {
    latest_file: util.getLatestFile(DATA_DIR),
    latest_fd : util.getLatestFD(DATA_DIR),
}


router.use((req, res, next) => {
    if (JSON_CONFIG.debug || req.get("X-Who-is-Niupi") === "zgy") {
        next();
    } else {
        res.status(400).end("Fuck you!");
    }
});

router.get("/list", (req, res) => {
    fs.readdir( DATA_DIR, (err, files) => {
        if (err) {
            res.json({
                code: -1,
                msg: err.message
            });
        } else {
            res.json({
                code: 0,
                msg: files.filter((v) =>  v != global.latest_file ).sort().reverse()
            });
        }
    });
});

router.get(/^\/file\/([0-9]{4}(?:_[0-9]{2}){5})$/, (req, res) => {
    res.sendFile( path.join(DATA_DIR, req.params['0']) );
});

router.post("/add", (req, res) => {
    let nwsize = 0;
    req.on("data", (chunk) => {
        nwsize = util.writeFile( global.latest_fd, chunk );
    })
    req.on("end", () => {
        if (nwsize > JSON_CONFIG.max_file_size) {
            fs.closeSync(global.latest_fd);
            global.latest_file = util.createFile( DATA_DIR, util.formatDate(new Date()) );
            global.latest_fd = util.getLatestFD( DATA_DIR );
        }
        res.json({
            code: 0,
            msg: "ok"
        });
    })
});


module.exports = router;