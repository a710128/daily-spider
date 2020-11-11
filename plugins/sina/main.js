const { default: Axios } = require("axios");
const sqlite3 = require("sqlite3");
const path = require("path");
const fs = require("fs");
const cheerio = require("cheerio");
const minify = require('html-minifier').minify;


function db_init(db) {
    return new Promise((resolve, reject) => {
        db.run("CREATE TABLE article (id CHAR(28) NOT NULL, date INT NOT NULL, upd INT NOT NULL);", (err) => {
            if (err) reject(err);
            else {
                db.run("CREATE INDEX qryidx on article (id, date);", (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            }
        });
    });
}

async function db_query(db, date_id, sh_id) {
    let time = parseInt(Date.now() / 100000);
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM article WHERE id = ? AND date = ?", sh_id, date_id, (err, row) => {
            if (err) reject(err);
            else if (row) {
                db.run("UPDATE article SET upd = ? WHERE id = ? and date = ?", time, sh_id, date_id, (err) => {
                    if (err) reject(err);
                    else resolve(false);
                });
            }
            else {
                db.run("INSERT INTO article (id, date, upd) VALUES (?, ?, ?);", sh_id, date_id, time, (err) => {
                    if (err) reject(err);
                    else resolve(true);
                });
            }
        });
    });
}

const PAGE_LIST = {
    "军事": "https://mil.news.sina.com.cn/",
    "新闻": "https://news.sina.com.cn/china/",
    "新闻": "https://news.sina.com.cn/world/",
    "股票": "https://finance.sina.com.cn/stock/",
    "财经": "https://finance.sina.com.cn/",
    "手机": "https://mobile.sina.com.cn/",
    "探索": "https://tech.sina.com.cn/discovery/",
    "科技": "https://tech.sina.com.cn/",
    "体育": "http://sports.sina.com.cn/",
    "明星": "https://ent.sina.com.cn/star/",
    "电影": "https://ent.sina.com.cn/film/",
    "电视": "https://ent.sina.com.cn/tv/",
    "综艺": "https://ent.sina.com.cn/zongyi/",
    "音乐": "http://yue.sina.com.cn/",
    "时装": "https://fashion.sina.com.cn/",
    "美容": "http://fashion.sina.com.cn/beauty/",
    "美食": "http://fashion.sina.com.cn/luxury/taste/",
    "收藏": "http://collection.sina.com.cn/",
    "教育": "http://edu.sina.com.cn/",
    "文化": "http://cul.news.sina.com.cn/"
}

async function get_article_list() {
    let regex = /^https:\/\/([^\.]+)\.sina.com.cn\/.*\/([0-9]{4}-[0-9]{2}-[0-9]{2})\/(?:[0-9]+\/)?doc-([a-z0-9]+)\.shtml$/;
    let ret = [];
    for (let key of Object.keys(PAGE_LIST)) {
        let url = PAGE_LIST[key];
        let res = await Axios.get(url);
        let $ = cheerio.load(res.data);
        let as = $("a");
        for (let i = 0; i < as.length; ++ i) {
            let dom = as.eq(i);
            let href = dom.attr("href");
            if (!href) continue;
            let res = regex.exec(href);
            if (res) {
                ret.push({
                    part: res[1],
                    topic: key,
                    date: new Date(res[2]).valueOf() / 100000,
                    id: res[3],
                    url: href
                });
            }
        }
    }
    return ret;
}

async function read_article(article) {
    let url = article.url;
    let res = await Axios.get(url);
    let $ = cheerio.load(res.data, {
        decodeEntities: false
    });
    let title = $("h1.main-title").text();
    let dom = $("div.article");
    dom.contents().filter(function() {
        return this.nodeType == 8;
    }).remove();

    let chd = dom.children();
    let ret = {
        title: title,
        date: article.date,
        part: article.part,
        topic: article.topic,
    };

    for (let i = 0; i < chd.length; ++ i) {
        if (chd[i].name == "p") {
            continue;
        } else if (chd[i].name == "div" && chd.eq(i).hasClass("img_wrapper")) {
            let div_dom = chd.eq(i);
            div_dom.children("img").css({});
        } else {
            chd.eq(i).remove();
        }
    }
    ret.data = minify(dom.html(), {
        collapseWhitespace: true,
        removeEmptyElements: true,
    });
    return ret;
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
        if (await db_query(db, article.date, article.id)) {
            process_article.push(article);
        }
    }
    for (let article of process_article) {
        this.addResult(await read_article(article));
    }
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