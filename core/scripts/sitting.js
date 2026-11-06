'use strict';

const fs = require('fs');
const path = require('path');

/** Write the settings edited in the studio to a site's data/site.json. */
function writeSiteSettings(siteDir, settings) {
    if (!siteDir || typeof siteDir !== 'string') throw new TypeError('A site directory is required.');
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
        throw new TypeError('Site settings must be an object.');
    }

    const file = path.join(path.resolve(siteDir), 'site.json');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const eol = fs.existsSync(file) && /\r\n/.test(fs.readFileSync(file, 'utf8')) ? '\r\n' : '\n';
    const json = JSON.stringify(settings, null, 2).replace(/\n/g, eol) + eol;
    const temp = file + '.tmp';
    fs.writeFileSync(temp, json, 'utf8');
    fs.renameSync(temp, file);
    return file;
}

module.exports = { writeSiteSettings };
