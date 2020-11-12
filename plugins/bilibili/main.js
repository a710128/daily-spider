const { default: Axios } = require("axios");
const sqlite3 = require("sqlite3");
const path = require("path");
const fs = require("fs");
const cheerio = require("cheerio");
const { dirxml } = require("console");
const minify = require('html-minifier').minify;


function db_init(db) {
    return new Promise((resolve, reject) => {
        db.run("CREATE TABLE article (id INT NOT NULL, tp INT NOT NULL, upd INT NOT NULL);", (err) => {
            if (err) reject(err);
            else {
                db.run("CREATE INDEX qryidx on article (id, tp);", (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            }
        });
    });
}

async function db_query(db, sh_id, doctype) {
    let time = parseInt(Date.now() / 100000);
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM article WHERE id = ? AND tp = ?", sh_id, doctype, (err, row) => {
            if (err) reject(err);
            else if (row) {
                db.run("UPDATE article SET upd = ? WHERE id = ? and tp = ?", time, sh_id, doctype, (err) => {
                    if (err) reject(err);
                    else resolve(false);
                });
            }
            else {
                db.run("INSERT INTO article (id, tp, upd) VALUES (?, ?, ?);", sh_id, doctype, time, (err) => {
                    if (err) reject(err);
                    else resolve(true);
                });
            }
        });
    });
}

async function sleep(timeout) {
    return new Promise(resolve => setTimeout(resolve, timeout));
}

const ARTICLE_TPYES = {
    dynamic: 0,
    article: 1,
};




async function get_dynamics(repeat_times, sleep_timeout) {
    repeat_times = repeat_times || 200;
    sleep_timeout = sleep_timeout || 10 * 1000;
    let has_print_err = false;


    let ret = [];

    for (let i = 0; i < repeat_times; ++ i) {
        let fake_uid = Math.random().toString().slice(2, 8);
        let url = `https://api.vc.bilibili.com/dynamic_svr/v1/dynamic_svr/unlogin_dynamics?fake_uid=${fake_uid}&hot_offset=0`;
        let res = await Axios.get(url);
        if (res.data.code === 0) {
            let cards = res.data.data.cards;
            for (let card of cards) {
                try {
                    card.card = JSON.parse(card.card);
                    ret.push({
                        id: card.card.item.id,
                        tp: ARTICLE_TPYES.dynamic,
                        topic: card.card.item.category,
                        data: card.card.item.description,
                        author: card.desc.uid
                    });
                } catch (e) {
                    if (!has_print_err) {
                        console.error(e);
                        has_print_err = true;
                    }
                    // Skip error ones
                }
            }
        }
        await sleep(sleep_timeout);
    }
    return ret;
}

// "https://api.bilibili.com/x/article/recommends?cid=2&ps=20&aids=&sort=0&pn=",
const PAGE_MAP = {
    "游戏": 1,
    "动画": 2,
    "影视": 28,
    "生活": 3,
    "兴趣": 29,
    "轻小说": 16,
    "科技": 17,
}

async function get_articles(max_pageid) {
    max_pageid = max_pageid || 20;
    let has_print_err = false;

    let ret = [];
    for (let topic of Object.keys(PAGE_MAP)) {
        for (let page_id = 0; page_id < max_pageid; page_id ++) {
            let url = `https://api.bilibili.com/x/article/recommends?cid=${PAGE_MAP[topic]}&ps=20&aids=&sort=0&pn=${page_id + 1}`;
            try {
                let res = (await Axios.get(url)).data;
                if (res.code === 0) {
                    for (let obj of res.data) {
                        ret.push({
                            id: obj.id,
                            tp: ARTICLE_TPYES.article,
                            topic: topic,
                            data: null,
                            title: obj.title,
                            author: obj.author.mid
                        });
                    }
                }
            } catch(e) {
                if (!has_print_err) {
                    console.error(e);
                    has_print_err = true;
                }
                // Skip errors
            }
        }
    }
    return ret;
}

async function read_article(article_id) {
    let url = `https://www.bilibili.com/read/cv${article_id}`;
    let res = await Axios.get(url);
    let $ = cheerio.load(res.data, {
        decodeEntities: false
    });
    let dom = $("div.article-holder");
    dom.find("figcaption").remove();

    let img_chd = dom.children("figure");
    for (let i = 0; i < img_chd.length; ++ i) {
        if (img_chd.eq(i).children("img").length > 0) {
            img_chd.eq(i).removeClass("img-box");
            img_chd.eq(i).removeAttr("contenteditable");

            let img = img_chd.eq(i).children("img").eq(0);
            let src = img.attr("data-src");
            for (let key of Object.keys(img.attr()) ) {
                img.removeAttr(key);
            }
            img.attr("src", src);
        } else {
            img_chd.eq(i).remove();
        }
    }
    return minify(dom.html(), {
        removeEmptyAttributes: true,
        collapseWhitespace: true,
        removeEmptyElements: true,
    });
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

    let lst = (await get_dynamics()).concat(await get_articles());
    
    let process_article = [];
    for (let obj of lst) {
        if ( await db_query(db, obj.id, obj.tp) ) {
            if (obj.tp == ARTICLE_TPYES.article) {
                process_article.push(obj);
            } else {
                this.addResult(obj);
            }
        }
    }

    let skip_cnt = 0;
    let article_sleep = config.sleep || (2 * 1000);
    for (let obj of process_article) {
        try {
            obj.data = await read_article(obj.id);
            this.addResult(obj);
        } catch(e) {
            skip_cnt ++;
        }
        await sleep(article_sleep);
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