
const express = require('express');
const JSON_CONFIG = require("./config.json");

const router = require("./router");

const app = express();


app.get('/', (req, res) => res.send('Hello World!'))
app.use("/api", router);


app.listen(JSON_CONFIG.port, JSON_CONFIG.host, () => {
    console.log(`Example app listening on ${JSON_CONFIG.host}:${JSON_CONFIG.port} !`);
});
