const cheerio = require("cheerio");
const minify = require('html-minifier').minify;

const block_tags = [
    "address", "article", "aside", "blockquote", "details",
    "dialog", "dd", "div", "dl", "dt", "fieldset", "figcaption",
    "figure", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6",
    "header", "hgroup", "hr", "li", "main", "nav", "ol", "p", "pre",
    "section", "section", "table", "ul"
]

function search_build($, dom ) {
    if (dom[0].nodeType == 1) {
        let tag_name = dom[0].tagName.toLowerCase();
        let is_block = (block_tags.indexOf(tag_name) !== -1);
        if (dom.css("display")) {
            if (dom.css("display").toLowerCase() === "block") is_block = true;
            else is_block = false;
        }
        
        let src = dom.attr("data-src");
        if (!!src) {
            return {
                text: $.html($(`<${tag_name}>`).attr("src", src)),
                block: false
            }
        } else {
            let contents = dom.contents();
            let pending_text = "";
            let ret_text = "";
            let last_block = false;

            if (contents.length == 1 && contents[0].nodeType == 3) {
                // only has a text child
                return {
                    text: $.html($(`<${tag_name}>`).text( dom.text() )),
                    block: is_block
                }
            }  else {
                // other cases
                if (tag_name == "br") {
                    return {
                        text: "<br>",
                        block: is_block
                    };
                }

                for (let i = 0; i < contents.length; ++ i) {
                    let res = search_build($, contents.eq(i));
                    last_block = res.block;
                    if (last_block) {
                        if (pending_text.length > 0) {
                            ret_text += $.html($("<p>").html(pending_text));
                            pending_text = "";
                        }
                        ret_text += res.text;
                    } else {
                        pending_text += res.text;
                    }
                }
                if (!last_block && pending_text.length > 0)  {
                    if (is_block) {
                        ret_text += $.html($("<p>").html(pending_text));
                    } else {
                        ret_text += pending_text;
                    }
                    pending_text = "";
                }
                return {
                    text: ret_text,
                    block: is_block
                }
            }
        }
    } else if (dom[0].nodeType == 3) {
        return {
            text: $.html($("<span>").text(dom.text().replace(/^\s+/, '').replace(/\s+$/, '').replace(/\s+/g, ' '))),
            block: false,
        }
    }
}

function minify_html($) {
    let p_list = $("p");
    for (let i = 0; i < p_list.length; ++ i) {
        let dom = p_list.eq(i);
        if (dom.children().length == 1 && dom.children("span").length == 1) {
            // only has a span
            dom.text(dom.text());
        }
    }
    return $("body").html();
}

module.exports = function(raw_html) {
    let $ = cheerio.load(raw_html, {decodeEntities: false});
    let article = $("#js_content");
    $ = cheerio.load(search_build($, article).text, {decodeEntities: false});
    return  minify(minify_html($), {
        removeEmptyAttributes: true,
        collapseWhitespace: true,
        removeEmptyElements: true,
    });
}