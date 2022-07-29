module.exports = f;

const dotenv = require('dotenv');
dotenv.config();

const util = require('util');

const Database = require('../classes/Database.js');

const redis = require('async-redis').createClient({
    retry_strategy: redis_retry_strategy
});
const phin = require('phin').defaults({
    'method': 'get',
    'headers': {
        'User-Agent': 'https://yawa.us cvweiss@gmail.com'
    }
});

function redis_retry_strategy(options) {
    if (options.error && options.error.code === 'ECONNREFUSED') {
        // End reconnecting on a specific error and flush all commands with
        // a individual error
        return new Error('The server refused the connection');
    }
    if (options.total_retry_time > 1000 * 60 * 60) {
        // End reconnecting after a specific timeout and flush all commands
        // with a individual error
        return new Error('Retry time exhausted');
    }
    if (options.attempt > 10) {
        // End reconnecting with built in error
        return undefined;
    }
    // reconnect after
    return Math.min(options.attempt * 100, 3000);
}

async function f() {
    const app = {};

    app.md5 = require('md5');

    app.debug = false;
    app.bailout = false;
    app.no_parsing = false;
    app.no_stats = false;
    app.error_count = 0;
    app.phin = phin;
    app.fetch = async function (url, parser, failure, options) {
        try {
            return await parser(app, await phin(url), options);
        } catch (e) {
            return failure(app, e);
        }
    };
    console.log('loaded phin');
    app.redis = redis;
    app.esi = 'https://esi.evetech.net';
    app.waitfor = async function (promises) {
        for (let i = 0; i < promises.length; i++) {
            await promises[i];
        }
    }

    app.sleep = function sleep(ms) {
        return new Promise(resolve => {
            setTimeout(resolve, ms)
        });
    }

    app.restart = function () {
        setTimeout(function() { process.exit(); }, 3000);
    }

    app.randomSleep = async function(min, max = -1) {
        min = Math.abs(min);
        if (max == -1) {
            min = 0;
            max = min;
        } else if (max < min) {
            throw 'max cannot be greather than min ' + min + ' ' + max;
        }

        let base = min;
        let diff = max - min;
        let random = Math.floor(Math.random() * diff);

        await app.sleep(base + random);
    }

    const MongoClient = require('mongodb').MongoClient;
    const url = 'mongodb://localhost:27017?maxPoolSize=500';
    const dbName = 'zkilljs';
    const client = new MongoClient(url, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        connectTimeoutMS: 3600000,
        socketTimeoutMS: 3600000,
    });

    try {
        await client.connect();
    } catch (e) {
        // server not up? wait 30 seconds and exit, let the daemon restart us
        await app.sleep(30);
        process.exit();
    }
    app.db = client.db(dbName);
    let collections = await app.db.listCollections().toArray();
    for (let i = 0; i < collections.length; i++) {
        //console.log('Prepping ' + collections[i].name);
        app.db[collections[i].name] = app.db.collection(collections[i].name);
    }
    console.log('loaded mongodb');

    let mysql = new Database({
        host: 'localhost',
        user: 'yawa',
        password: 'yawa',
        database: 'yawa_us'
    });
    app.mysql = mysql;
    console.log('loaded mysql');

    app.ztops = {};
    app.zincr = function (key) {
        app.redis.incr('zkb:ztop:' + key);
        app.ztops[key] = (app.ztops[key] || 0) + 1;
    };

    app.log = function(object) {
        console.log(util.inspect(object, false, null, true /* enable colors */));
    }

    app.now = function(mod = 0) {
        let now = Math.floor(Date.now() / 1000);
        if (mod != 0) now = now - (now % mod);
        return now;
    }

    setTimeout(function() { gc(); }, 1000);

    console.log('initialized');

    globalapp = app;
    return app;
}

let globalapp = undefined;

function gc() {
    if (global.gc) {
        global.gc();
        let used = Math.floor(process.memoryUsage().heapUsed / 1024 / 1024);
        if (used > 3500) {
            console.log("Memory exceeding 3500 MB, restarting...");
            globalapp.redis.set("RESTART", "true");
        }
        setTimeout(function() { gc(); }, 15000);
    }
}
    
