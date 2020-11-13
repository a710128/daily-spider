const { default: Axios } = require("axios");
const sqlite3 = require("sqlite3");
const path = require("path");
const fs = require("fs");
const cheerio = require("cheerio");
const minify = require('html-minifier').minify;

Axios.defaults.timeout = 30 * 1000;