
const { default: Axios } = require("axios");
const sqlite3 = require("sqlite3");
const path = require("path");
const fs = require("fs");

const TOPICS = [
    "total",
    "science",
    "digital",
    "sport",
    "fashion",
    "car",
    "depth",
    "school",
    "focus",
    "film"
]

function getZhihuHot() {
    return Promise.all( TOPICS.map((topic) => {
        return new Promise((resolve, reject) => {
            Axios.get(`https://www.zhihu.com/api/v3/feed/topstory/hot-lists/${topic}?limit=50`).then((res) => {
                if (res.data && res.data.data) {
                    let data = res.data.data;
                    resolve( data.map((v) => ({
                        id : v.target.id,
                        topic: topic
                    })) );
                } else {
                    reject(topic);
                }
            });
        })
    })).then((res) => {
        let ret = [];
        let vis = new Set();
        for (const question_list of res) {
            for (const question of question_list) {
                if (!vis.has(question.id)) {
                    ret.push(question);
                    vis.add(question.id);
                }
            }
        }
        return ret;
    });
}

function db_init(db) {
    return new Promise((resolve, reject) => {
        db.run(`CREATE TABLE question (id INT NOT NULL, topic CHAR(15) NOT NULL, state CHAR(15) NOT NULL);`, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

function db_query_pending(db) {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM question WHERE state = ?", "pending", (err, rows) => {
            if (err) reject(err);
            else resolve(rows.map((v) => ({
                id: v.id,
                topic: v.topic
            })));
        });
    });
}

function db_insert_if_not_exists(db, question) {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM question WHERE id = ?", question.id, (err, row) => {
            if (err) reject(err);
            else if (row) resolve();
            else {
                db.run("INSERT INTO question (id, topic, state) VALUES (?, ?, ?);", 
                    question.id, question.topic, "pending", (err) => {
                    
                    if (err) reject(err);
                    else resolve();
                });
            }
        });
    })
}

function db_set_done(db, qid) {
    return new Promise((resolve, reject) => {
        db.run("UPDATE question SET state = ? WHERE id = ?", 'done', qid, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

async function read_question(qid, topic) {
    let limit = 10;
    let vis_id_set = new Set();
    
    let ret = [];
    let url = `https://www.zhihu.com/api/v4/questions/${qid}/answers?include=data[*].is_normal,admin_closed_comment,reward_info,is_collapsed,annotation_action,annotation_detail,collapse_reason,is_sticky,collapsed_by,suggest_edit,comment_count,can_comment,content,editable_content,voteup_count,reshipment_settings,comment_permission,created_time,updated_time,review_info,relevant_info,question,excerpt,relationship.is_authorized,is_author,voting,is_thanked,is_nothelp,is_labeled,is_recognized,paid_info,paid_info_content;data[*].mark_infos[*].url;data[*].author.follower_count,badge[*].topics;settings.table_of_content.enabled;&limit=${limit}&offset=0&platform=desktop&sort_by=default`;

    try {
        while (true) {
            let res = await Axios.get(url);
            let data = res.data;
            if (data.error) {
                console.error(`Error parse ${qid}`, data.error);
                break;
            } else {
                data = data.data.map((v) => {
                    return {
                        id: v.id,
                        type: v.type,
                        comment: false,
                        question: {
                            id: v.question.id,
                            type: v.question.type,
                            title: v.question.title
                        },
                        data: v.content,
                        topic: topic
                    };
                });
                for (let ans of data) {
                    if (!vis_id_set.has(ans.id)) {
                        vis_id_set.add(ans.id);
                        ret.push(ans);
                    }
                }

                let paging = res.data.paging;
                if (paging.is_end) break;
                else {
                    url = paging.next;
                }
                if (ret.length > 500) {
                    break;
                }
            }
        }
    } catch (e) {
        console.error(`Error request ${qid} `, url, e);
    }
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

    let hot_qs = await getZhihuHot();
    let pending_qs = await db_query_pending(db);
    let processing_qs = [];
    const hot_ids = new Set( hot_qs.map((v) => v.id) );
    for (let question of pending_qs) {
        if (!hot_ids.has(question.id)) {
            // Cool down now!
            processing_qs.push(question);
        } else {
            // Still hot
        }
    }
    for (let question of hot_qs) {
        await db_insert_if_not_exists(db, question);
    }

    for (let question of processing_qs) {
        let answers = await read_question(question.id, question.topic);
        for (let ans of answers) {
            this.addResult(ans);
        }
        await db_set_done(db, question.id);
    }
}

async function cleanup(name, config) {

}

module.exports =  {
    main,
    cleanup
}