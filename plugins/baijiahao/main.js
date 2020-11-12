const { default: Axios } = require("axios");
const sqlite3 = require("sqlite3");
const path = require("path");
const fs = require("fs");
const cheerio = require("cheerio");
const minify = require('html-minifier').minify;


function db_init(db) {
    return new Promise((resolve, reject) => {
        db.run("CREATE TABLE article (id CHAR(32) NOT NULL, date INT NOT NULL, upd INT NOT NULL);", (err) => {
            if (err) reject(err);
            else {
                db.run("CREATE INDEX qryidx on article (id);", (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            }
        });
    });
}

async function db_query(db, date_id, sh_id) {
    let time = parseInt(Date.now() / 1000);
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM article WHERE id = ?", sh_id, (err, row) => {
            if (err) reject(err);
            else if (row) {
                
                db.run("UPDATE article SET upd = ? WHERE id = ?", time, sh_id, (err) => {
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

const RANK_PAGES = {
    "娱乐": "https://zmt.aizhan.com/bjh/hot/c1_p1.html",
    "体育": "https://zmt.aizhan.com/bjh/hot/c2_p1.html",
    "财经": "https://zmt.aizhan.com/bjh/hot/c3_p1.html",
    "国际": "https://zmt.aizhan.com/bjh/hot/c4_p1.html",
    "科技": "https://zmt.aizhan.com/bjh/hot/c5_p1.html",
    "军事": "https://zmt.aizhan.com/bjh/hot/c6_p1.html",
    "三农": "https://zmt.aizhan.com/bjh/hot/c7_p1.html",
    "社会": "https://zmt.aizhan.com/bjh/hot/c8_p1.html",
    "汽车": "https://zmt.aizhan.com/bjh/hot/c9_p1.html",
    "房产": "https://zmt.aizhan.com/bjh/hot/c10_p1.html",
    "旅游": "https://zmt.aizhan.com/bjh/hot/c11_p1.html",
    "健康": "https://zmt.aizhan.com/bjh/hot/c12_p1.html",
    "感情": "https://zmt.aizhan.com/bjh/hot/c13_p1.html",
    "时尚": "https://zmt.aizhan.com/bjh/hot/c14_p1.html",
    "游戏": "https://zmt.aizhan.com/bjh/hot/c15_p1.html",
    "美食": "https://zmt.aizhan.com/bjh/hot/c16_p1.html",
    "生活": "https://zmt.aizhan.com/bjh/hot/c17_p1.html",
    "育儿": "https://zmt.aizhan.com/bjh/hot/c18_p1.html",
    "影视": "https://zmt.aizhan.com/bjh/hot/c19_p1.html",
    "音乐": "https://zmt.aizhan.com/bjh/hot/c20_p1.html",
    "动漫": "https://zmt.aizhan.com/bjh/hot/c21_p1.html",
    "搞笑": "https://zmt.aizhan.com/bjh/hot/c22_p1.html",
    "教育": "https://zmt.aizhan.com/bjh/hot/c23_p1.html",
    "文化": "https://zmt.aizhan.com/bjh/hot/c24_p1.html",
    "宠物": "https://zmt.aizhan.com/bjh/hot/c25_p1.html",
    "星座": "https://zmt.aizhan.com/bjh/hot/c26_p1.html",
    "家居": "https://zmt.aizhan.com/bjh/hot/c27_p1.html",
    "阅读": "https://zmt.aizhan.com/bjh/hot/c28_p1.html",
    "艺术": "https://zmt.aizhan.com/bjh/hot/c29_p1.html",
    "摄影": "https://zmt.aizhan.com/bjh/hot/c30_p1.html",
    "女人": "https://zmt.aizhan.com/bjh/hot/c31_p1.html",
    "养生": "https://zmt.aizhan.com/bjh/hot/c32_p1.html",
    "科学": "https://zmt.aizhan.com/bjh/hot/c33_p1.html",
    "数码": "https://zmt.aizhan.com/bjh/hot/c34_p1.html",
    "职场": "https://zmt.aizhan.com/bjh/hot/c35_p1.html",
    "综合": "https://zmt.aizhan.com/bjh/hot/c36_p1.html",
    "百科": "https://zmt.aizhan.com/bjh/hot/c37_p1.html",
    "学术": "https://zmt.aizhan.com/bjh/hot/c38_p1.html",
    "互联网": "https://zmt.aizhan.com/bjh/hot/c39_p1.html",
    "历史": "https://zmt.aizhan.com/bjh/hot/c40_p1.html",
    "人文": "https://zmt.aizhan.com/bjh/hot/c41_p1.html",
}

async function get_author_list() {
    let all_author_list = [];
    for (let topic of Object.keys(RANK_PAGES)) {
        let url = RANK_PAGES[topic];
        let res = await Axios.get(url);
        let $ = cheerio.load(res.data);
        let author_list = $("div.list dl");
        for (let i = 0; i < author_list.length; ++ i) {
            all_author_list.push({
                author_page_url: "https://zmt.aizhan.com" + author_list.eq(i).children("a").eq(0).attr("href"),
                name: author_list.eq(i).children(".w1").text().replace(/\s/g, ""),
                topic: topic
            });
        }
    }
    let ret = [];
    for(let author of all_author_list) {
        let url = author.author_page_url;
        let res = await Axios.get(url);
        let $ = cheerio.load(res.data);
        ret.push({
            url: $(".name.fl a.btn").attr("href"),
            topic: author.topic,
            name: author.name,
        });
    }
    return ret;
}

function read_author_list_config(fname) {
    try {
        let res = fs.readFileSync(fname);
        return JSON.parse(res.toString("utf-8"))
    } catch (e) {
        return {
            time: 0,
            author: []
        }
    }
}

function write_author_list_config(fname, data) {
    fs.writeFileSync(fname, JSON.stringify(data), {
        encoding: "utf-8"
    });
}


async function get_info_list(author) {
    let url = author.url;
    let res = await Axios.get(url);
    let cookie = '';
    for (let it of res.headers['set-cookie']) {
        cookie += it.split(";")[0] + ";";
    }
    
    let v = /"uk":"([0-9a-zA-Z]+)"/g.exec(res.data);
    if (!v) return [];
    v = v[1];
    let data_dynamic = (await Axios.get(`https://mbd.baidu.com/webpage?tab=dynamic&num=10&uk=${v}&type=newhome&format=json`, {
        headers: {
            Cookie: cookie
        }
    })).data;
    if (data_dynamic.data && data_dynamic.data.dynamic && data_dynamic.data.dynamic.list) {
        data_dynamic = data_dynamic.data.dynamic.list;
        data_dynamic = data_dynamic.map((v) => ({
            date: v.itemData.ctime,
            id: v.itemData.nid,
            data: v.itemData.origin_title,
            topic: author.topic,
            author: author.name,
            type: 'dynamic',
        }));
    } else {
        data_dynamic = [];
    }
    
    let data_article = (await Axios.get(`https://mbd.baidu.com/webpage?tab=article&num=10&uk=${v}&type=newhome&format=json`, {
        headers: {
            Cookie: cookie
        }
    })).data;
    if (data_article.data && data_article.data.dynamic && data_article.data.dynamic.list) {
        data_article = data_article.data.dynamic.list;
        data_article = data_article.map((v) => ({
            date: v.itemData.created_at,
            id: v.itemData.id,
            data: v.itemData.url,
            topic: author.topic,
            author: author.name,
            type: 'article'
        }));
    } else {
        data_article = [];
    }
    let a = [];
    return data_dynamic.concat( data_article ).filter((v) => !!v.id);
}

function sleep(timeout) {
    return new Promise((resolve) => {
        setTimeout(resolve, timeout);
    });
}

async function read_article(url) {
    let res = await Axios.get(url);
    let $ = cheerio.load(res.data, {decodeEntities: false});
    let dom = $("div.article-content");
    dom.find(".bjh-p").removeClass("bjh-p");
    let imgs = dom.find("img");
    for (let i = 0; i < imgs.length; ++ i) {
        for (let key of Object.keys(imgs.eq(i).attr())) {
            if (key != "src") imgs.eq(i).removeAttr(key);
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
    let author_path = config.author_path || path.join(__dirname, "author.json");
    let author_update_day = config.author_update_day || 30;
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
    
    let author_cfg = read_author_list_config(author_path);
    if (author_cfg.time < parseInt(Date.now() / 100000 - 36 * 24 * author_update_day)) {
        // update author list per ${author_update_day} day
        author_cfg.time = Date.now() / 100000;
        author_cfg.author = await get_author_list();
        write_author_list_config(author_path, author_cfg);
        console.log("Update author list");
    }

    let author_list = author_cfg.author;
    

    let page_list = [];
    for (let author of author_list) {
        for (let result of  await get_info_list(author)) {
            if (await db_query(db, result.date, result.id)) {
                page_list.push(result);
            }
        }
    }

    let skip_count = 0;
    for (let page of page_list) {
        try {
            if (page.type == "article") {
                page.data = await read_article(page.data);
            }
            this.addResult(page);
            await sleep(1000); // sleep one second
        } catch (e) {
            skip_count += 1;
        }
    }
    console.log(`Skip ${skip_count} articles.`);
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