'use strict';

let express = require('express');
let path = require('path');
let debug = require('debug')('server');
let http = require('http');
let morgan = require('morgan');
let watch = require('node-watch');

let app = undefined;
let server;

async function getApp() {
    if (app === undefined) {
        let req = require('./init.js');
        app = await req();
    }
    return app;
}

const server_started = Date.now();

startWebListener();

async function startWebListener() {
    let www = express();

    www.app = await getApp();

    www.root = __dirname + "/../";

    www.set('views', path.join(__dirname, '../www/views'));
    www.set('view engine', 'pug');

    //www.enable('etag');
    
    www.use((req, res, next) => {
        res.locals.server_started = server_started;
        res.locals.googleua = process.env.googleua;
        res.locals.app = www.app;
        next();
    });

    www.use(morgan(':method :url :status :res[content-length] - :response-time ms'));

    www.disable('x-powered-by');
    www.use('/api/', require('cors')());

    console.log(path.join(__dirname, '../www/public'));

    www.use('/', express.static(path.join(__dirname, '../www/public')));
    let indexRouter = require('../www/routes.js');
    www.use('/', indexRouter);

    server = http.createServer(www);
    process.env.PORT = '3002';
    server.listen((process.env.PORT || '3001'));
    server.timeout = 3600000;
    server.on('error', onError);
    server.on('listening', onListening);

    console.log('Listening on port ' + (process.env.PORT || '3001'));
    // Start the websocket
    //www.app.ws = require(__dirname + '/websocket');
    //wsServerStarted(app);

    watch('bin/init.js', {resursive: true}, app.restart);
    watch('bin/www.js', {resursive: true}, app.restart);
    watch('www/', {recursive: true}, app.restart);
}

async function wsServerStarted() {
    let msg = JSON.stringify({
        'action': 'server_status', 
        'server_started': server_started, 
        'mails_parsed': await app.redis.get('www:status:mails_parsed')
    });
    await app.redis.publish('zkilljs:public', msg);

    setTimeout(wsServerStarted, 1000);
}

function onError(error) {
    if (error.syscall !== 'listen') {
        throw error;
    }

    let bind = typeof process.env.PORT === 'string' ?
        'Pipe ' + process.env.PORT :
        'Port ' + process.env.PORT;
    // handle specific listen errors with friendly messages
    switch (error.code) {
    case 'EACCES':
        console.error(bind + ' requires elevated privileges');
        process.exit(1);
        break;
    case 'EADDRINUSE':
        console.error(bind + ' is already in use');
        process.exit(1);
        break;
    default:
        throw error;
    }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
    let addr = server.address();
    let bind = typeof addr === 'string' ?
        'pipe ' + addr :
        'port ' + addr.port;
    debug('Listening on ' + bind);
}
