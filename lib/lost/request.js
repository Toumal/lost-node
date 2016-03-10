/*! lost-node(v0.1.2, 2015-12-30) - GPL - copyright richard.prinz@min.at */
"use strict";

var Q = require("q"), _ = require("lodash"), tools = require("../tools"), xmlLib = require("libxmljs"), xml2js = require("libxml-to-js"), fs = require("fs");

var schemaDoc;

exports.init = function() {
    var rng = fs.readFileSync("./lib/schemas/LoST.rng");
    schemaDoc = xmlLib.parseXml(rng);
};

exports.process = function(lostReq, callback) {
    var deferred = Q.defer();
    if (!_.isString(lostReq)) deferred.reject(new Error("LoST request must be a XML string"));
    var reqXmlDoc = xmlLib.parseXml(lostReq);
    var isOK = reqXmlDoc.rngValidate(schemaDoc);
    if (!isOK) deferred.reject(new Error("LoST request XML invalid (" + reqXmlDoc.validationErrors.toString().replace(/[\r\n\t]/g, " ") + ")"));
    xml2js(lostReq, function(error, result) {
        if (error) deferred.reject(new Error("Error parsing LoST request XML (" + error + ")"));
        result.requestType = reqXmlDoc.root().name();
        deferred.resolve(result);
    });
    return deferred.promise;
};

exports.init();