/*! lost-node(v0.1.2, 2015-12-30) - GPL - copyright richard.prinz@min.at */
"use strict";

module.exports = {
    hostname: process.env.HOST || process.env.HOSTNAME,
    environment: process.env.NODE_ENV
};