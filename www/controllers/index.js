'use strict';

module.exports = {
    paths: ['/'],
    get: async function(req, res) {
        let ret = {
            package: {},
            view: 'index.pug'
        };

        return ret;
    }
}
