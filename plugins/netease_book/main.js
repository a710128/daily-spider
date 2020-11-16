const { default: Axios } = require("axios");
const sqlite3 = require("sqlite3");
const path = require("path");
const fs = require("fs");
const cheerio = require("cheerio");

Axios.defaults.timeout = 30 * 1000;



function db_init(db) {
    return new Promise((resolve, reject) => {
        db.run("CREATE TABLE article (id CHAR(40) NOT NULL, bid CHAR(24) NOT NULL, upd INT NOT NULL);", (err) => {
            if (err) reject(err);
            else {
                db.run("CREATE INDEX qryidx on article (id, bid);", (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            }
        });
    });
}

async function db_query(db, id, bid) {
    let time = parseInt(Date.now() / 1000);
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM article WHERE id = ? AND bid = ?", id, bid, (err, row) => {
            if (err) reject(err);
            else if (row) {
                db.run("UPDATE article SET upd = ? WHERE id = ? and bid = ?", time, id, bid, (err) => {
                    if (err) reject(err);
                    else resolve(false);
                });
            }
            else {
                db.run("INSERT INTO article (id, bid, upd) VALUES (?, ?, ?);", id, bid, time, (err) => {
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

function decode(string) {
    return string.replace(/&#x([0-9a-f]{1,6});/ig, (entity, code) => {
      code = parseInt(code, 16);
  
      // Don't unescape ASCII characters, assuming they're encoded for a good reason
      if (code < 0x80) return entity;
  
      return String.fromCodePoint(code);
    });
}



const BOOKS = {
    "caiwei": "http://caiwei.yuedu.163.com/bookUpdateInterface.do?from=original&subject=article&chargeable=no&gender=female&count=30",
    "guofeng": "http://guofeng.yuedu.163.com/bookUpdateInterface.do?from=original&subject=article&chargeable=no&gender=male&count=30"
}

const CAT_NAME_MAP = {
    'caiwei': "采薇",
    "guofeng": "国风"
}

async function get_book_list(sleep_timeout) {
    sleep_timeout = sleep_timeout || 4000;
    let ret = [];
    for (let cat of Object.keys(BOOKS)) {
        let url = BOOKS[cat];
        let res = await Axios.get(url);
        let lst = res.data.list;
        for (let i = 0; i < lst.length; ++ i) {
            let tmp = /^\/book_reader\/([^\/]+)\/([^\/]+)$/.exec(lst[i].latestArticleUrl);
            if (tmp) {
                let book_id = tmp[1];
                let chap_id = tmp[2];
                url = `http://${cat}.yuedu.163.com/getBook.do?id=${book_id}`;
                res = await Axios.get(url);
                let portions = res.data.portions;
                if (portions) {
                    for (let j = 0; j < portions.length; ++ j) {
                        if (portions[j].id == chap_id) {
                            ret.push({
                                author: res.data.author,
                                book_title: res.data.title,
                                desc: res.data.shareDescription,
                                pub: cat,
                                topic: lst[i].categoryLabel,
                                book_id: book_id,
                                chap_id: portions[j].id,
                                bid: portions[j].bigContentId
                            });
                            break;
                        }
                    }
                }
                await sleep(sleep_timeout);
            }
        }
    }
    return ret;
}

async function read_article(article) {
    let url = `http://${article.pub}.yuedu.163.com/getArticleContent.do?sourceUuid=${article.book_id}&articleUuid=${article.chap_id}&bigContentId=${article.bid}`;
    let res = await Axios.get(url);
    let $ = cheerio.load(Buffer.from(res.data.content, "base64").toString());
    $("#book-bottom").remove();
    return {
        data: decode($(".m-content").html()),
        author: article.author,
        book_title: article.book_title,
        desc: article.desc,
        pub: CAT_NAME_MAP[article.pub],
        topic: article.topic
    };
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

    let article_list = await get_book_list();

    let process_article = [];
    for (let article of article_list) {
        if (await db_query(db, article.chap_id, article.bid)) {
            process_article.push(article);
        }
    }

    let skip_cnt = 0;
    for (let article of process_article) {
        try {
            this.addResult(await read_article(article));
        } catch (e) {
            // skip error ones
            console.error(e);
            skip_cnt ++;
        }
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