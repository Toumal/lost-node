/*! lost-node(v0.1.2, 2015-12-30) - GPL - copyright richard.prinz@min.at */
"use strict";

var _ = require("lodash"), fs = require("fs");

process.env.NODE_ENV = ~fs.readdirSync("./config/env").map(function(file) {
    return file.slice(0, -3);
}).indexOf(process.env.NODE_ENV) ? process.env.NODE_ENV : "development";

var config = {
    debug: false,
    port: 8080,
    downloads: "/downloads",
    data: {
        api: "/lost.data.svc",
        auth: null
    },
    lost: {
        api: "/lost.svc",
        apinoauth: "/lostnoauth.svc",
        auth: null,
        source: "example.com"
    },
    database: {
        type: "mongoDB",
        name: "lost",
        address: "localhost",
        port: 27017,
        username: null,
        password: null,
        jayLog: false
    }
};

_.extend(config, require("./env/" + process.env.NODE_ENV) || {});

module.exports = _.extend(require("./env/all"), config);