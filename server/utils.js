const fs = require("fs");
const path = require("path");

module.exports = {
    formatDate(date) {
        return date.toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/[-\:]/g, '_');
    },
    createFile(dir, name) {
        let fd = fs.openSync( path.join(dir, name), "w");
        fs.closeSync(fd);
        return name;
    },
    getLatestFile(dir) {
        let files = fs.readdirSync(dir);
        if (files.length == 0) {
            let date = this.formatDate(new Date());
            return this.createFile(dir, date);
        } else {
            return files.sort().reverse()[0];
        }
    },
    writeFile(dir, fname, data) {
        let fd = fs.openSync( path.join(dir, fname), "as");
        fs.writeSync(fd, data);
        let stat = fs.fstatSync(fd);
        fs.closeSync(fd);
        return stat.size;
    }
}
