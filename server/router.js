const express = require("express");
const JSON_CONFIG = require("./config.json");
const fs = require("fs");
const path = require("path");
const util = require("./utils");

var router = express.Router();

const DATA_DIR = path.join(__dirname, JSON_CONFIG.data_dir);

var global = {
    latest_file: util.getLatestFile(DATA_DIR)
}


router.use((req, res, next) => {
    if (JSON_CONFIG.debug || req.get("Who-is-Niupi") === "zgy") {
        next();
    } else {
        res.status(400).end("Fuck you!");
    }
});
router.use(express.json());

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
    let batch = req.body.batch;
    if (batch == undefined) {
        res.status(400).json({
            code: -1,
            msg: "Parameters error"
        });
        return;
    }

    if (!Array.isArray(batch)) {
        batch = [batch]
    }
    for (let i = 0; i < batch.length; ++ i) {
        if (batch[i].src == undefined || batch[i].topic == undefined || batch[i].data == undefined) {
            res.status(400).json({
                code: -1,
                msg: "Parameters error"
            });
            return;
        }
    }
    let buffer = "";
    for (let i = 0; i < batch.length; ++ i) {
        let src = batch[i].src,
            topic = batch[i].topic,
            data = batch[i].data,
            meta = batch[i].meta;
        meta = meta || {};
        buffer += JSON.stringify({
            src, topic, data, meta
        }) + "\n";
    }
    let nwsize = util.writeFile( DATA_DIR, global.latest_file, buffer );
    if (nwsize > JSON_CONFIG.max_file_size) {
        global.latest_file = util.createFile( DATA_DIR, util.formatDate(new Date()) );
    }
    res.json({
        code: 0,
        msg: "ok"
    });
});


module.exports = router;