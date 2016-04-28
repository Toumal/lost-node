/*! lost-node(v0.1.2, 2015-12-30) - GPL - copyright richard.prinz@min.at */
"use strict";

var Q = require("q");

Q.stopUnhandledRejectionTracking();

var _ = require("lodash"),
    tools = require("./lib/tools"),
    colors = require("colors"),
    config = require("./config/config"),
    stdio = require("stdio"),
    fs = require("fs"),
    path = require("path"),
    http = require("http"),
    express = require("express"),
    favicon = require("serve-favicon"),
    FileStreamRotator = require("file-stream-rotator"),
    logger = require("morgan"),
    serveIndex = require("serve-index"),
    lostService = require("./routes/lostService"),
    odata = require("./lib/data"),
    dataLoader = require("./lib/data.loader"),
    Keycloak = require('connect-keycloak');

var options = stdio.getopt({
    dbinit: {
        key: "i",
        description: "(Re)Initialize database. " + "DELETES ALL EXISTING DATA!".red
    },
    dbtest: {
        key: "t",
        description: "Initialize database with some test data. " + "DELETES ALL EXISTING DATA!".red
    },
    dbloadfile: {
        key: "f",
        args: 1,
        description: "Imports a JSON file into the database."
    },
    dbloaddir: {
        key: "d",
        args: 1,
        description: "Imports all JSON files of a directory into the database."
    }
});

var server;

var app = express();

var session = require('express-session');
var memoryStore = new session.MemoryStore();
var keycloak = new Keycloak({ store: memoryStore });

global.odata = odata;

function showVersion() {
    console.log(("lost-node(v0.1.0) - GPLv3 - " + "Copyright 2015,2016 richard.prinz@min.at ").cyan);
    console.log("A node.js based RFC5222 LoST server".cyan);
    console.log("This program comes with ABSOLUTELY NO WARRANTY;".cyan);
    console.log("for details see https://github.com/rprinz08/lost-node".cyan);
    console.log("and http://www.gnu.org/licenses/".cyan);
    console.log();
}

function showUsage() {}

function configure() {
    return configureServer().then(function() {
        return configureDownloads();
    }).then(function() {
        return configureAPI();
    }).then(function() {
        return configureContent();
    });
}

function configureServer() {
    var msg = "Configure server ...";
    tools.logInfo(msg);
    if (config.debug) {
        app.set("json spaces", 2);
        tools.setLogMode(1);
    }
    if (process.env.LISTEN) app.set("bind", process.env.LISTEN); else app.set("bind", config.listen || "0.0.0.0");
    if (process.env.PORT) app.set("port", process.env.PORT); else app.set("port", config.port || 8080);
    var logDirectory = path.join(__dirname, "logs");
    fs.existsSync(logDirectory) || fs.mkdirSync(logDirectory);
    var streamOptions = {
        date_format: "YYYYMM",
        filename: path.join(logDirectory, "/lost-%DATE%.log"),
        frequency: "daily",
        verbose: false
    };
    streamOptions.verbose = !!config.debug;
    var accessLogStream = FileStreamRotator.getStream(streamOptions);
    app.use(logger("combined", {
        stream: {
            write: function(data) {
                accessLogStream.write(data);
                if (config.debug) console.log(data);
            }
        }
    }));

    // Install sessing storage
    app.use( session({
        secret: 'RemlaSuprumNiqasKlorix',
        resave: false,
        saveUninitialized: true,
        store: memoryStore,
    } ));
    // Install keycloak middleware
    app.use( keycloak.middleware( {
        logout: '/logout',
        admin: '/',
    } ));

    app.use(favicon("favicon.ico"));
    tools.logOK(msg + "DONE".green);
    return Q();
}

function configureDownloads() {
    var msg = "Configure downloads ...";
    tools.logInfo(msg);
    app.use(config.downloads, serveIndex("downloads", {
        icons: true
    }));
    app.use(config.downloads, express.static(path.join(__dirname, "downloads")));
    tools.logOK(msg + "DONE".green);
    return Q();
}

function configureAPI() {
    var msg = "Configure API's ...";
    tools.logInfo(msg);
    app.all(config.lost.api, lostService.crossSite);
    app.all(config.lost.apinoauth, lostService.crossSite);
    app.post(config.lost.api, keycloak.protect(), lostService.handleRequest);
    app.post(config.lost.apinoauth, lostService.handleRequest);

    app.use(config.lost.api, lostService.handleError);
    app.use(config.lost.apinoauth, lostService.handleError);
    return odata.initializeClient().then(function(dbContext) {
        odata.initializeServer(app).then(function() {
            tools.logOK(msg + "DONE".green);
        });
    });
}

function configureContent() {
    var msg = "Configure content ...";
    tools.logInfo(msg);
    if (config.debug) require("express-debug")(app, {
        depth: 4,
        path: "/express-debug"
    });
    app.get("/info", generateDebugPage);
    app.use("/", express.static(path.join(__dirname, "docs")));
    tools.logOK(msg + "DONE".green);
    return Q();
}

function generateDebugPage(req, res) {
    var h = "";
    for (var header in req.headers) h += header + " = <b>" + req.headers[header] + "</b><br>";
    res.send("<html><head></head><body>" + "Your IP: <b>" + req.connection.remoteAddress + "</b><br><p>" + "Headers:<br>" + h + "</body></html>");
}

function initialize() {
    var msg = "Initialize ...";
    tools.logInfo(msg);
    global.LoST = {
        XML_LOST_URN: "urn:ietf:params:xml:ns:lost1",
        XML_GML_URN: "http://www.opengis.net/gml"
    };
    tools.logOK(msg + "DONE".green);
    return Q();
}

function startServer() {
    var msg = "Start server ...";
    tools.logInfo(msg);
    server = http.createServer(app);
    server.listen(app.get("port"), app.get("bind"), function() {
        var addr = server.address();
        tools.logOK("Server listening on " + (_.get(addr, "address", "null").toString() + ":" + _.get(addr, "port", "null").toString()).cyan);
        tools.listIPs();
    });
    tools.logOK(msg + "DONE".green);
    return Q();
}

function cleanUp() {
    var db = _.get(global, "odata.__context", null);
    if (db) {}
    var native = _.get(global, "odata.__native.__context", null);
    if (native) {
        native.close();
    }
}

process.on("SIGINT", function() {
    tools.logWarning("SIGINT signal received");
    cleanUp();
    process.exit(1);
});

process.on("uncaughtException", function(error) {
    tools.logError("Unhandled exception", error);
    cleanUp();
    process.exit(100);
});

showVersion();

if (options.dbinit) {
    odata.dropDB().then(function() {
        cleanUp();
    }).fail(function(error) {
        tools.logError("Error initializing database", error);
        cleanUp();
        process.exit(10);
    });
} else if (options.dbloadfile) {
    if (!_.isString(options.dbloadfile)) {
        tools.logError("Filename argument missing");
        process.exit(30);
    }
    var fileName = options.dbloadfile;
    odata.initializeClient().then(function(dbContext) {
        return dataLoader.loadFile(fileName);
    }).then(function(count) {
        tools.logInfo("File " + fileName.cyan + " imported");
        cleanUp();
        process.exit(0);
    }).fail(function(error) {
        tools.logError("Error initializing database", error);
        cleanUp();
        process.exit(10);
    });
} else if (options.dbloaddir || options.dbtest) {
    var directoryPath;
    if (options.dbtest) directoryPath = path.resolve(path.dirname(process.mainModule.filename), "testdata"); else {
        if (!_.isString(options.dbloaddir)) {
            tools.logError("Directory argument missing");
            process.exit(30);
        }
        directoryPath = options.dbloaddir;
    }
    odata.initializeClient().then(function(dbContext) {
        return dataLoader.loadDirectory(directoryPath);
    }).then(function(count) {
        tools.logInfo(count.toString().cyan + " file" + (count === 1 ? "" : "s") + " imported");
        cleanUp();
        process.exit(0);
    }).fail(function(error) {
        tools.logError("Error initializing database", error);
        cleanUp();
        process.exit(10);
    });
} else configure().then(function() {
    return initialize();
}).then(function() {
    return startServer();
}).fail(function(error) {
    tools.logError("Error starting server", error);
    cleanUp();
    process.exit(20);
});