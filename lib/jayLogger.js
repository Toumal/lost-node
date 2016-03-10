/*! lost-node(v0.1.2, 2015-12-30) - GPL - copyright richard.prinz@min.at */
"use strict";

var tools = require("./tools");

$data.Class.define("$data.JayLogger", $data.TraceBase, null, {
    log: function() {
        if (arguments.length > 0) {
            var args = [];
            Array.prototype.push.apply(args, arguments);
            var msg = args[0];
            args.shift();
            tools.logInfo(msg, args.length > 0 ? args : undefined);
        }
    },
    warn: function() {
        if (arguments.length > 0) {
            var args = [];
            Array.prototype.push.apply(args, arguments);
            var msg = args[0];
            args.shift();
            tools.logWarn(msg, args.length > 0 ? args : undefined);
        }
    },
    error: function() {
        if (arguments.length > 0) {
            var args = [];
            Array.prototype.push.apply(args, arguments);
            var msg = args[0];
            args.shift();
            tools.logError(msg, args.length > 0 ? args : undefined);
        }
    }
});