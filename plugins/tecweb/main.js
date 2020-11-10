const { default: Axios } = require("axios");
const sqlite3 = require("sqlite3");
const path = require("path");
const fs = require("fs");
const cheerio = require("cheerio");
const minify = require('html-minifier').minify;


function db_init(db) {
    return new Promise((resolve, reject) => {
        db.run("CREATE TABLE article (id INT NOT NULL, date INT NOT NULL);", (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

async function db_query(db, date_id, sh_id) {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM article WHERE id = ? AND date = ?", sh_id, date_id, (err, row) => {
            if (err) reject(err);
            else if (row) resolve(false);
            else {
                db.run("INSERT INTO article (id, date) VALUES (?, ?);", sh_id, date_id, (err) => {
                    if (err) reject(err);
                    else resolve(true);
                });
            }
        });
    });
}

async function get_article_list() {
    let url = "http://www.techweb.com.cn/roll/list_1.shtml";
    let res = await Axios.get(url);
    let $ = cheerio.load(res.data);
    let lst = $(".newslist > ul li:not(.line)");
    let ret = [];
    for (let i = 0; i < lst.length; ++ i) {
        let line = lst.eq(i);
        let topic = line.find(".column").text().replace(/\s*/g, "")
        ret.push({
            topic: topic,
            url: line.find(".tit a").eq(0).attr("href")
        });
    }
    return ret;
}

async function read_article(url, topic) {
    let res = await Axios.get(url);
    let $ = cheerio.load(res.data, {
        decodeEntities: false
    });
    let dom = $(".content .main_c #content");
    dom.contents().filter(function() {
        return this.nodeType == 8;
    }).remove();
    return {
        data: minify(dom.html(), {
            collapseWhitespace: true,
            removeEmptyElements: true,
        }),
        topic: topic,
        title: $(".content .main_c h1").eq(0).text(),
    };
}

module.exports = async function(name, config) {
    let db_path = config.db_path ||  path.join(__dirname, "db.sqlite3");
    let new_db = false;

    try {
        fs.accessSync(db_path, fs.constants.R_OK | fs.constants.W_OK);
    } catch (e) {
        new_db = true;
    }

    let db = await new Promise((resolve) => {
        let v = new sqlite3.Database(db_path, (err) => {
            if (err) {
                console.error(err);
                resolve(null);
            } else {
                resolve(v);
            }
        });
    });
    if (!db) return;
    if (new_db) await db_init(db);

    let news_list = await get_article_list();
    for (let news of news_list) {
        let tmp = /([0-9]{4}-[0-9]{2}-[0-9]{2})\/([0-9]+)\.shtml$/.exec(news.url);
        let date = new Date(tmp[1]).valueOf() / 100000;
        let shid = parseInt(tmp[2]);
        if (await db_query(db, date, shid)) {
            this.addResult(await read_article(news.url, news.topic))
        }
    }
}