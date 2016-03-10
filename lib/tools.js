/*! lost-node(v0.1.2, 2015-12-30) - GPL - copyright richard.prinz@min.at */
"use strict";

var _ = require("lodash"), os = require("os"), util = require("util"), fs = require("fs"), http = require("http"), sprintf = require("sprintf").sprintf, colors = require("colors"), basicAuth = require("basic-auth");

var LOG_DEBUG = 0;

var LOG_INFO = 1;

var LOG_OK = 2;

var LOG_WARNING = 3;

var LOG_ERROR = 4;

var logMode = 0;

var errorTypes = {
    locationValidationUnavailable: 300,
    badRequest: 500,
    internalError: 501,
    serviceSubstitution: 502,
    defaultMappingReturned: 503,
    forbidden: 504,
    notFound: 505,
    loop: 506,
    serviceNotImplemented: 507,
    serverTimeout: 508,
    serverError: 509,
    locationInvalid: 510,
    locationProfileUnrecognized: 511
};

var errorNumbers = {};

var LostError = function LostError(message, errorType) {
    this.name = "LostError";
    this.message = message || "LoST error";
    this.type = errorType || errorTypes.internalError;
    this.stack = new Error().stack;
};

LostError.prototype = Object.create(Error.prototype);

LostError.prototype.constructor = LostError;

LostError.types = errorTypes;

exports.LostError = LostError;

exports.createError = function(errorType, message, language, isWarning, mode, format) {
    var self = this;
    if (self.isEmptyObject(errorNumbers)) for (var error in errorTypes) if (errorTypes.hasOwnProperty(error)) errorNumbers[errorTypes[error]] = error;
    if (self.isInt(errorType)) {
        if (errorNumbers.hasOwnProperty(errorType)) errorType = errorNumbers[errorType]; else errorType = errorNumbers[errorTypes.internalError];
    } else if (self.isNullOrEmpty(errorType)) errorType = errorNumbers[errorTypes.internalError]; else if (!errorTypes.hasOwnProperty(errorType)) errorType = errorNumbers[errorTypes.internalError];
    if (self.isNullOrEmpty(language)) language = "en";
    if (self.isNullOrEmpty(message)) {
        message = "Unspecified error";
        language = "en";
    }
    if (!self.isInt(mode)) mode = 0; else if (mode < 0 || mode > 2) mode = 0;
    var values = {
        blockType: "errors",
        source: "",
        errorType: errorType,
        message: "",
        language: language
    };
    if (isWarning) values.blocktype = "warnings";
    var v0, v1, v2;
    if (format) {
        v0 = "{<%=v1%>}";
        v1 = '"<%=blockType%>":[<%=v2%>]';
        v2 = '{"errorType":"<%=errorType%>","message":"<%=message%>","lang":"<%=language%>"}';
        values.message = quoteJSON(message);
    } else {
        v0 = '<?xml version="1.0" encoding="UTF-8"?>\r\n<%=v1%>';
        v1 = '<<%=blockType%> xmlns="urn:ietf:params:xml:ns:lost1" source="<%=source%>">\r\n' + "	<%=v2%>\r\n" + "</<%=blockType%>>\r\n";
        v2 = '<<%=errorType%> message="<%=message%>" xml:lang="<%=language%>"/>';
        values.message = quoteXML(message);
    }
    values.v2 = self.strTemplate(v2, values, false);
    if (mode == 2) return values.v2;
    values.v1 = self.strTemplate(v1, values, false);
    if (mode == 1) return values.v1;
    return self.strTemplate(v0, values, false);
};

function quoteXML(value) {
    return _.trim(value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"));
}

function quoteJSON(value) {
    return _.trim(value.replace('"', '\\"').replace(/[\r\n\t]/g, " "));
}

exports.basicAuth = function(username, password) {
    return function(req, res, next) {
        var user = basicAuth(req);
        if (!user || user.name !== username || user.pass !== password) {
            res.set("WWW-Authenticate", "Basic realm=Authorization Required");
            return res.sendStatus(401);
        }
        next();
    };
};

exports.setLogMode = function(mode) {
    var self = this;
    self.logMode = mode ? mode : 0;
    if (!self.isInt(self.logMode)) self.logMode = 0;
    self.logMode = Math.abs(self.logMode);
    if (self.logMode < 0 || self.logMode > 2) self.logMode = 0;
};

exports.get = function(obj, key) {
    return key.split(".").reduce(function(o, x) {
        return typeof o == "undefined" || o === null ? o : o[x];
    }, obj);
};

exports.has = function(obj, key) {
    return key.split(".").every(function(x) {
        if (typeof obj != "object" || obj === null || !x in obj) return false;
        obj = obj[x];
        return true;
    });
};

exports.inspect = function(obj, depth) {
    var self = this;
    if (!self.isInt(depth)) depth = 2;
    console.log(util.inspect(obj, {
        showHidden: true,
        depth: depth,
        colors: true
    }));
};

exports.download = function(url, dest, timeOut, cb) {
    var self = this;
    var timing = new Date();
    var contentLength = 0;
    var req = http.get(url, function(res) {
        if (res.headers["transfer-encoding"] === "chunked") {
            res.on("data", function(chunk) {
                contentLength += chunk.length;
            });
        } else contentLength = res.headers["content-length"];
        if (res.statusCode === 200) {
            var file = fs.createWriteStream(dest);
            res.pipe(file);
            file.on("finish", function() {
                file.close();
                var duration = (new Date() - timing) / 1e3;
                if (cb) cb(undefined, duration, contentLength);
            }).on("error", function(error) {
                if (cb) cb(error);
            });
        } else {
            if (cb) cb(res.statusCode);
        }
    }).on("error", function(error) {
        fs.unlink(dest);
        if (cb) cb(error);
    });
    if (timeOut === undefined) timeOut = 12e3;
    if (timeOut > 0) req.setTimeout(timeOut, function() {
        req.abort();
    });
};

exports.logDebug = function(message, object, logTime, eolMode) {
    var self = this;
    if (typeof logTime === "undefined") logTime = true;
    self.log(LOG_DEBUG, logTime, message, object, eolMode);
};

exports.logInfo = function(message, object, logTime, eolMode) {
    var self = this;
    if (typeof logTime === "undefined") logTime = true;
    self.log(LOG_INFO, logTime, message, object, eolMode);
};

exports.logOK = function(message, object, logTime, eolMode) {
    var self = this;
    if (typeof logTime === "undefined") logTime = true;
    self.log(LOG_OK, logTime, message, object, eolMode);
};

exports.logWarning = function(message, object, logTime, eolMode) {
    var self = this;
    if (typeof logTime === "undefined") logTime = true;
    self.log(LOG_WARNING, logTime, message, object, eolMode);
};

exports.logError = function(message, object, logTime, eolMode) {
    var self = this;
    if (typeof logTime === "undefined") logTime = true;
    self.log(LOG_ERROR, logTime, message, object, eolMode);
};

exports.log = function(severity, logTime, message, object, eolMode) {
    var self = this;
    var ts = "";
    var w;
    var eol;
    switch (eolMode) {
      case 1:
        eol = "";
        break;

      case 2:
        eol = process.platform == "win32" || process.platform == "win64" ? "[0G" : "\r";
        break;

      default:
        eol = os.EOL;
        break;
    }
    if (self.logMode == 2) return;
    if (logTime === true) {
        var now = new Date();
        ts = sprintf(" %04d%02d%02d %02d%02d%02d.%03d", now.getFullYear(), now.getMonth() + 1, now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
    }
    switch (severity) {
      case LOG_DEBUG:
        if (self.logMode == 1) {
            w = "[DBG" + ts + "] ";
            process.stdout.write(w.grey + message + eol);
        }
        break;

      case LOG_OK:
        w = "[OK " + ts + "] ";
        process.stdout.write(w.green + message + eol);
        break;

      case LOG_WARNING:
        w = "[WRN" + ts + "] ";
        process.stdout.write(w.yellow + message + eol);
        break;

      case LOG_ERROR:
        w = "[ERR" + ts + "] ";
        process.stdout.write(w.red + message + eol);
        break;

      default:
        w = "[INF" + ts + "] ";
        process.stdout.write(w.white + message + eol);
        break;
    }
    if (object) if (severity > 0 || self.logMode == 1) {
        var obj = object;
        if (!_.isString(obj)) obj = util.inspect(obj, {
            depth: 5,
            colors: true
        });
        obj = "     " + obj;
        obj = obj.replace(/\n/g, "\n     ");
        console.log(obj);
    }
};

exports.isInt = function(i_int) {
    var i = parseInt(i_int);
    if (isNaN(i)) return false;
    return i_int == i && i_int.toString() == i.toString();
};

exports.realTypeOf = function(obj) {
    return Object.prototype.toString.call(obj).slice(8, -1);
};

exports.getObjectClass = function(obj) {
    if (obj && obj.constructor && obj.constructor.toString) {
        var arr = obj.constructor.toString().match(/function\s*(\w+)/);
        if (arr && arr.length == 2) {
            return arr[1];
        }
    }
    return undefined;
};

exports.isNullOrEmpty = function(s_str) {
    return !s_str || s_str == "";
};

exports.isEmptyObject = function(obj) {
    return Object.keys(obj).length === 0;
};

exports.isString = function(o_str) {
    return o_str instanceof String || typeof o_str == "string";
};

exports.isInt = function(i_int) {
    var i = parseInt(i_int);
    if (isNaN(i)) return false;
    return i_int == i && i_int.toString() == i.toString();
};

exports.indexOf = function(s_str, i_len, s_substr) {
    var i_ret = -1;
    if (s_str && s_substr) i_ret = s_str.indexOf(s_substr);
    return i_ret < i_len ? i_ret : -1;
};

exports.endsWith = function(s_str, s_suffix) {
    return s_str.indexOf(s_suffix, s_str.length - s_suffix.length) !== -1;
};

exports.clearHtml = function(s_str) {
    if (this.isNullOrEmpty(s_str)) return "";
    return s_str.replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>?/gi, "");
};

exports.contains = function(s_str, i_len, s_substr) {
    return this.indexOf(s_str, i_len, s_substr) >= 0;
};

exports.unquote = function(s_str, c_lquote, c_rquote) {
    var s_ret = s_str;
    if (s_ret) {
        var i_len = s_ret.length;
        if (i_len >= 2 && s_ret[0] == c_lquote && s_ret[i_len - 1] == c_rquote) s_ret = s_str.substring(1, i_len - 1);
    }
    return s_ret;
};

exports.unquote2 = function(s_str) {
    return this.unquote(s_str, '"', '"');
};

exports.strdup = function(s_str) {
    if (s_str) return new String(s_str).toString();
    return s_str;
};

exports.strformat = function(s_str) {
    for (var i = 1; i < arguments.length; i++) {
        var regexp = new RegExp("\\{" + (i - 1) + "\\}", "gi");
        s_str = s_str.replace(regexp, arguments[i]);
    }
    return s_str;
};

exports.strTemplate = function(template, values, keepUnknown) {
    if (this.isNullOrEmpty(template)) return "";
    if (values) {
        template = template.replace(/<%\s*=\s*(\w[\w\d]*)\s*%>/g, function(g0, g1) {
            return values[g1] || (keepUnknown == true ? g0 : "");
        });
    }
    return template;
};

exports.streq = function(s_1, s_2) {
    return s_1 == s_2;
};

exports.strieq = function(s_1, s_2) {
    if (s_1 && s_2) return s_1.toLowerCase() == s_2.toLowerCase();
    return s_1 == s_2;
};

exports.strRandomFromDict = function(i_length, s_dict) {
    var s_ret = "";
    for (var i = 0; i < i_length; i++) s_ret += s_dict[Math.floor(Math.random() * s_dict.length)];
    return s_ret;
};

exports.strRandom = function(i_length) {
    var s_dict = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";
    return this.strRandomFromDict(i_length, s_dict);
};

exports.strRandomUUID = function() {
    var s_dict = "0123456789abcdef";
    return this.strformat("{0}-{1}-{2}-{3}-{4}", this.strRandomFromDict(8, s_dict), this.strRandomFromDict(4, s_dict), this.strRandomFromDict(4, s_dict), this.strRandomFromDict(4, s_dict), this.strRandomFromDict(12, s_dict));
};

exports.strParseUrl = function(s_url) {
    if (!s_url) return null;
    var i_0 = s_url.indexOf("://");
    var i_1 = s_url.lastIndexOf(":");
    if (i_0 == -1 || i_1 == -1) return null;
    var ao_params = new Array();
    ao_params.push(s_url.substring(0, i_0));
    ao_params.push(s_url.substring(i_0 + 3, i_1));
    try {
        var i_3 = s_url.substring(i_0 + 3).indexOf("/");
        if (i_3 == -1) {
            ao_params.push(parseInt(s_url.substring(i_1 + 1), 10));
        } else {
            ao_params.push(parseInt(s_url.substring(i_1 + 1, i_3 + i_0 + 3), 10));
            ao_params.push(s_url.substring(i_3 + i_0 + 3 + 1));
        }
    } catch (e) {
        return null;
    }
    return ao_params;
};

exports.listIPs = function() {
    var ifaces = os.networkInterfaces();
    Object.keys(ifaces).forEach(function(ifname) {
        var alias = 0;
        ifaces[ifname].forEach(function(iface) {
            console.log(sprintf("%-40s %6s   %s", sprintf("%s:%d%s", ifname, alias, iface.internal ? "*" : ""), iface.family, iface.address.cyan));
            alias++;
        });
    });
};