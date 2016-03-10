/*! lost-node(v0.1.2, 2015-12-30) - GPL - copyright richard.prinz@min.at */
"use strict";

var Q = require("q");

Q.stopUnhandledRejectionTracking();

var _ = require("lodash"), config = require("../config/config"), tools = require("./tools"), colors = require("colors"), odata_server = require("odata-server"), lostContextType = require("./data.entities.js");

var MongoDB = require("mongodb").Db, MongoServer = require("mongodb").Server;

(function(odata) {
    if (config.database.jayLog) {
        require("./jayLogger");
        $data.Trace = new $data.JayLogger();
    }
    var dbConf = _.clone(config.database, true);
    dbConf.databaseName = dbConf.name;
    dbConf.name = dbConf.type;
    odata.__config = dbConf;
    odata.__context = null;
    odata.__native = null;
    odata.dropDB = function() {
        var deferred = Q.defer();
        var msg = "Dropping database (" + config.database.name + ") ... ";
        if (odata.__config.type === "mongoDB") {
            tools.logInfo(msg);
            var db = new MongoDB(config.database.name, new MongoServer(config.database.address, config.database.port), {
                w: 0
            });
            var drop = function() {
                db.dropDatabase({}, function(error) {
                    db.close();
                    if (error) deferred.reject(error); else {
                        tools.logOK(msg + "DONE".green);
                        deferred.resolve();
                    }
                });
            };
            db.open(function(error, db) {
                if (error) deferred.reject(error); else {
                    if (!tools.isNullOrEmpty(config.database.username)) db.authenticate(config.database.username, config.database.password, function(error) {
                        if (error) deferred.reject(error); else drop();
                    }); else drop();
                }
            });
        } else throw new Error("Unsupported DB provider (" + odata.__config.type + ")");
        return deferred.promise;
    };
    odata.createContext = function() {
        var deferred = Q.defer();
        tools.logInfo("oData create entity context");
        var lostContext = new LostContext(odata.__config);
        lostContext.onReady({
            success: function(dbContext) {
                deferred.resolve(dbContext);
            },
            error: function(error) {
                deferred.reject(error);
            }
        });
        return deferred.promise;
    };
    odata.initializeClient = function() {
        var self = this;
        var msg = "oData initialize client ... ";
        tools.logInfo(msg);
        return self.createContext().then(function(dbContext) {
            odata.__context = dbContext;
            return lostContextType.doNativeSetupActions(dbContext).then(function(nativeDb) {
                odata.__native = nativeDb;
                tools.logOK(msg + "DONE".green);
                return dbContext;
            });
        });
    };
    odata.initializeServer = function(app) {
        var msg = "Start oData server ... ";
        tools.logInfo(msg);
        if (config.data.auth && !tools.isNullOrEmpty(config.data.auth.user) && !tools.isNullOrEmpty(config.data.auth.password)) app.use(config.data.api, tools.basicAuth(config.data.auth.user, config.data.auth.password));
        app.use(config.data.api, $data.ODataServer({
            type: lostContextType,
            CORS: true,
            database: config.database.name,
            responseLimit: 100,
            provider: odata.__config
        }));
        tools.logOK(msg + "DONE".green);
        return Q();
    };
})(module.exports);