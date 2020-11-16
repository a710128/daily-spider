// section > in
// https://www.vreadtech.com/
// BIZ, mid, idx


const { default: Axios } = require("axios");
const sqlite3 = require("sqlite3");
const path = require("path");
const fs = require("fs");
const parser = require("./parser");
const url = require("url");
const cheerio = require("cheerio");

Axios.defaults.timeout = 30 * 1000;

function db_init(db) {
    return new Promise((resolve, reject) => {
        db.run("CREATE TABLE article (biz CHAR(22) NOT NULL, mid INT NOT NULL, upd INT NOT NULL);", (err) => {
            if (err) reject(err);
            else {
                db.run("CREATE INDEX qryidx on article (biz, mid);", (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            }
        });
    });
}

async function db_query(db, biz, mid) {
    let time = parseInt(Date.now() / 1000);
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM article WHERE biz = ? AND mid = ?", biz, mid, (err, row) => {
            if (err) reject(err);
            else if (row) {
                db.run("UPDATE article SET upd = ? WHERE biz = ? and mid = ?", time, biz, mid, (err) => {
                    if (err) reject(err);
                    else resolve(false);
                });
            }
            else {
                db.run("INSERT INTO article (biz, mid, upd) VALUES (?, ?, ?);", biz, mid, time, (err) => {
                    if (err) reject(err);
                    else resolve(true);
                });
            }
        });
    });
}

function sleep(timeout) {
    return new Promise(resolve => setTimeout(resolve, timeout));
}

async function get_article_list(page_num, sleep_timeout) {
    page_num = page_num || 100;
    sleep_timeout = sleep_timeout || 10;
    let start_url = "https://www.vreadtech.com/";
    let res = await Axios.get(start_url);
    let $ = cheerio.load(res.data);
    let dom = null;
    let last_cid = 0;
    let ret = [];
    for (let i = 0; i < page_num; ++ i) {
        if (i == 0) {
            dom = $("div.pannel-list");
        } else {
            res = await Axios.get(`https://www.vreadtech.com/page.php?v=${last_cid}&t=&w=3`);
            $ = cheerio.load(res.data);
            dom = $("div.pannel-list");
        }
        last_cid = dom.filter(".cid").attr("vvalue");
        for (let j = 0; j < dom.length; ++ j) {
            let dom_a = dom.eq(j).find("a.title");
            let href = dom_a.attr("href");
            let title = dom_a.text();
            let query = url.parse(href, true).query;
            ret.push({
                title: title,
                url: href,
                biz: query.__biz,
                mid: query.mid,
                topic: dom.eq(j).find(".pannel-x a").text().slice(0, -3)
            });
        }
        await sleep(sleep_timeout);
    }
    return ret;
}

async function read_article(article) {
    let url = article.url;
    let res = await Axios.get(url);
    return {
        data: parser(res.data),
        title: article.title,
        topic: article.topic
    }
}

async function main(name, config) {
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

    let article_list = await get_article_list();
    let process_article = [];
    for (let article of article_list) {
        if (await db_query(db, article.biz, article.mid)) {
            process_article.push(article);
        }
    }
    
    let skip_cnt = 0;
    for (let article of process_article) {
        try {
            this.addResult(await read_article(article));
        } catch (e) {
            // skip error ones
            skip_cnt ++;
        }
        await sleep(1000);
    }
    console.log(`Skip ${skip_cnt} articles`);
}



async function cleanup(name, config) {
    let db_path = config.db_path ||  path.join(__dirname, "db.sqlite3");
    let new_db = false;

    try {
        fs.accessSync(db_path, fs.constants.R_OK | fs.constants.W_OK);
    } catch (e) {
        new_db = true;
    }
    if (new_db) return;

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

    let threshold = parseInt(Date.now() / 1000 - 3600 * 24 * 60);
    await new Promise((resolve, reject) => {
        db.run("DELETE FROM article WHERE upd < ?", threshold, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}


module.exports = {
    main,
    cleanup
}