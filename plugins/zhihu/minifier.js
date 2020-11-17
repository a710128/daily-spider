const cheerio = require("cheerio");
const minify = require('html-minifier').minify;

const block_tags = [
    "address", "article", "aside", "blockquote", "details",
    "dialog", "dd", "div", "dl", "dt", "fieldset", "figcaption",
    "figure", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6",
    "header", "hgroup", "hr", "li", "main", "nav", "ol", "p", "pre",
    "section", "section", "table", "ul"
]

function search_build( $, dom ) {
    if (dom[0].nodeType == 1) {
        let tag_name = dom[0].tagName.toLowerCase();
        if (tag_name === "figure") {
            let img = dom.find("img");
            let src = img.attr("data-original");
            if (!src) {
                src = img.attr("data-actualsrc");
            }
            if (!!src) {
                dom.html(
                    $.html(
                        $("<img>").attr("src", src)
                    )
                );
            }
            for (let key of Object.keys(dom.attr())) {
                dom.removeAttr(key);
            }
        } else {
            for (let key of Object.keys(dom.attr())) {
                dom.removeAttr(key);
            }
            let chd = dom.children();
            for (let i = 0; i < chd.length; ++ i) {
                search_build($, chd.eq(i));
            }
        }
    } else if (dom[0].nodeType == 3) {
        return;
    }
}

function decode(string) {
    return string.replace(/&#x([0-9a-f]{1,6});/ig, (entity, code) => {
      code = parseInt(code, 16);
  
      // Don't unescape ASCII characters, assuming they're encoded for a good reason
      if (code < 0x80) return entity;
  
      return String.fromCodePoint(code);
    });
}

  
module.exports = function(raw_html) {
    let $ = cheerio.load(raw_html);
    let article = $("body");
    let contents = article.contents();
    for (let i = 0; i < contents.length; ++ i) {
        // console.log(">>>", decode(contents.eq(i).html()));
        search_build( $, contents.eq(i) );
        // console.log("<<<", decode(contents.eq(i).html()));
    }
    return  minify(decode(article.html()), {
        removeEmptyAttributes: true,
        collapseWhitespace: true,
        removeEmptyElements: true,
    });
}