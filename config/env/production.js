/*! lost-node(v0.1.2, 2015-12-30) - GPL - copyright richard.prinz@min.at */
"use strict";

module.exports = {
    debug: false,
    port: 8080,
    downloads: "/downloads",
    data: {
        api: "/lost.data.svc",
        auth: {
            user: "admin",
            password: "admin"
        }
    },
    lost: {
        api: "/lost.svc",
        apinoauth: "/lostnoauth.svc",
        auth: null,
        source: "production.example.com"
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