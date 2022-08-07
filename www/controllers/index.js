'use strict';

module.exports = {
    paths: ['/'],
    get: async function(req, res) {
        let ret = {
            package: null,
            maxAge: 0,
            view: 'index.pug'
        };

        return ret;
    }
}
