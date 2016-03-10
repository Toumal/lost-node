/*! lost-node(v0.1.2, 2015-12-30) - GPL - copyright richard.prinz@min.at */
"use strict";

var Q = require("q"), _ = require("lodash"), config = require("../config/config"), tools = require("./tools"), glob = require("glob"), path = require("path"), fs = require("fs"), guid = require("node-uuid"), moment = require("moment"), JsonValidator = require("jsonschema").Validator;

if (config.debug) tools.setLogMode(1);

var v = new JsonValidator();

var rootSchema;

exports.isInitialized = false;

exports.initialize = function() {
    var self = this;
    if (self.isInitialized) return;
    var msg = "Load JSON schema: ";
    var schemaRootPath = "./lib/schemas";
    var schemaExt = ".json";
    var schemaPath = schemaRootPath + "/Frame" + schemaExt;
    tools.logDebug(msg + schemaPath.cyan);
    rootSchema = JSON.parse(fs.readFileSync(schemaPath, "utf-8"));
    v.addSchema(rootSchema);
    function importNextSchema() {
        var nextSchema = v.unresolvedRefs.shift();
        if (!nextSchema) return;
        if (_.startsWith(nextSchema, "/") && nextSchema.indexOf("#") < 0) {
            var nextSchemaPath = schemaRootPath + nextSchema + schemaExt;
            tools.logDebug(msg + nextSchemaPath.cyan);
            v.addSchema(JSON.parse(fs.readFileSync(nextSchemaPath, "utf-8")));
            importNextSchema();
        }
    }
    importNextSchema();
    self.isInitialized = true;
};

exports.loadDirectory = function(directoryPath) {
    var self = this;
    var deferred = Q.defer();
    tools.logInfo("Importing files from " + directoryPath.cyan);
    var options = {};
    glob(directoryPath + "/*.json", options, function(error, files) {
        if (error) {
            deferred.reject(error);
            return;
        }
        var importQueue = [];
        files.forEach(function(file) {
            importQueue.push(self.loadFile(file));
        });
        Q.all(importQueue).then(function(result) {
            deferred.resolve(result.length);
        }).fail(function(error) {
            deferred.reject(error);
        });
    });
    return deferred.promise;
};

exports.loadFile = function(filePath) {
    var self = this;
    var deferred = Q.defer();
    tools.logDebug("Import file " + path.basename(filePath).cyan);
    var obj;
    fs.readFile(filePath, "utf8", function(error, data) {
        if (error) {
            deferred.reject(error);
            return;
        }
        try {
            obj = JSON.parse(data);
        } catch (ex) {
            deferred.reject(new Error("Unable to import " + filePath + " (" + ex + ")"));
        }
        self.loadData(obj).then(function(count) {
            deferred.resolve(count);
        });
    });
    return deferred.promise;
};

exports.loadData = function(obj) {
    var self = this;
    if (!self.isInitialized) self.initialize();
    var deferred = Q.defer();
    var totalCount = 0;
    var now = moment();
    var exp = now.clone().add(1, "year");
    var validationResult = _.get(v.validate(obj, rootSchema), "errors");
    if (_.isArray(validationResult)) {
        if (validationResult.length > 0) {
            tools.logError("Error importing object", validationResult);
            deferred.reject("Error importing object");
            return deferred.promise;
        }
    } else {
        deferred.reject("Internal error importing object, result not array");
        return deferred.promise;
    }
    if (obj.type === "service") {
        tools.logInfo("Import service: " + obj.service.DisplayName.cyan + " (" + obj.service.ServiceID.cyan + ")");
        global.odata.createContext().then(function(context) {
            var objService = obj.service;
            var svc = new Lost.Servicex({
                ServiceID: objService.ServiceID,
                Expires: objService.Expires || exp,
                LastUpdated: now,
                DisplayName: objService.DisplayName,
                Description: objService.Description,
                LanguageCode: objService.LanguageCode,
                URN: objService.URN
            });
            context.SVCs.add(svc);
            objService.URIs.forEach(function(uri) {
                context.ServiceURIs.add(new Lost.ServiceURI({
                    Schema: uri.Schema,
                    URI: uri.URI,
                    SVC: svc
                }));
            });
            objService.Numbers.forEach(function(num) {
                context.ServiceNumbers.add(new Lost.ServiceNumber({
                    Number: num,
                    SVC: svc
                }));
            });
            var objBoundaries = obj.boundaries;
            objBoundaries.forEach(function(boundary) {
                context.ServiceBoundaries.add(new Lost.ServiceBoundary({
                    ReferenceID: boundary.ReferenceID,
                    BoundaryGeom: boundary.Geom,
                    SVC: svc
                }));
            });
            context.saveChanges(function(count) {
                totalCount += count;
                tools.logInfo("DONE".green);
                deferred.resolve(totalCount);
            });
        });
    } else if (obj.type === "boundary") {
        tools.logInfo("Import boundary: " + obj.boundary.ReferenceID.cyan);
        deferred.reject("Import type (" + obj.type + ") not implemented");
    } else deferred.reject("Unsupported import type (" + obj.type + ")");
    return deferred.promise;
};