/*! lost-node(v0.1.2, 2015-12-30) - GPL - copyright richard.prinz@min.at */
"use strict";

var Q = require("q"), config = require("../config/config"), tools = require("./tools"), util = require("util");

if (config.debug) tools.setLogMode(1);

$data.Entity.extend("Lost.Servicex", {
    ID: {
        key: true,
        type: "id",
        nullable: false,
        computed: true
    },
    ServiceID: {
        type: "string",
        nullable: false,
        required: true
    },
    Expires: {
        type: "datetime",
        nullable: false,
        required: true
    },
    LastUpdated: {
        type: "datetime",
        nullable: false,
        required: true
    },
    DisplayName: {
        type: "string",
        nullable: false,
        required: true
    },
    Description: {
        type: "string",
        maxLength: Number.POSITIVE_INFINITY
    },
    LanguageCode: {
        type: "string",
        nullable: false,
        required: true
    },
    URN: {
        type: "string",
        nullable: false,
        required: true
    },
    URIs: {
        type: "Array",
        elementType: "Lost.ServiceURI",
        inverseProperty: "SVC"
    },
    Numbers: {
        type: "Array",
        elementType: "Lost.ServiceNumber",
        inverseProperty: "SVC"
    },
    Boundaries: {
        type: "Array",
        elementType: "Lost.ServiceBoundary",
        inverseProperty: "SVC"
    }
});

$data.Entity.extend("Lost.ServiceURI", {
    ID: {
        key: true,
        type: "id",
        nullable: false,
        computed: true
    },
    Schema: {
        type: "string",
        nullable: false,
        required: true
    },
    URI: {
        type: "string",
        nullable: false,
        required: true
    },
    SVC: {
        type: "Lost.Servicex",
        inverseProperty: "URIs"
    }
});

$data.Entity.extend("Lost.ServiceNumber", {
    ID: {
        key: true,
        type: "id",
        nullable: false,
        computed: true
    },
    Number: {
        type: "string",
        nullable: false,
        required: true
    },
    SVC: {
        type: "Lost.Servicex",
        inverseProperty: "Numbers"
    }
});

$data.Entity.extend("Lost.ServiceBoundary", {
    ID: {
        key: true,
        type: "id",
        nullable: false,
        computed: true
    },
    BoundaryGeom: {
        type: $data.GeographyMultiPolygon,
        nullable: false,
        required: true
    },
    ReferenceID: {
        type: "string",
        nullable: false,
        required: true
    },
    SVC: {
        type: "Lost.Servicex",
        inverseProperty: "Boundaries"
    }
});

$data.Class.define("LostContext", $data.EntityContext, null, {
    SVCs: {
        type: $data.EntitySet,
        elementType: Lost.Servicex,
        indices: [ {
            name: "ixServiceID",
            keys: [ "ServiceID" ],
            unique: true
        }, {
            name: "ixURN",
            keys: [ "URN" ],
            unique: false
        } ]
    },
    ServiceURIs: {
        type: $data.EntitySet,
        elementType: Lost.ServiceURI
    },
    ServiceNumbers: {
        type: $data.EntitySet,
        elementType: Lost.ServiceNumber
    },
    ServiceBoundaries: {
        type: $data.EntitySet,
        elementType: Lost.ServiceBoundary,
        indices: [ {
            name: "ixReferenceID",
            keys: [ "ReferenceID" ],
            unique: true
        } ]
    },
    getServiceURIs: function(serviceID) {
        ///<returns type="Array" elementType="Lost.ServiceURI"/>
        if (!serviceID) serviceID = null;
        return function(success, error) {
            this.SVCs.include("URIs").first(function(service) {
                return service.ID == this.id;
            }, {
                id: serviceID
            }, function(service) {
                if (success) success(service.URIs);
            }).fail(function(err) {
                if (success) success([]);
            });
        };
    },
    getServiceNumbers: function(serviceID) {
        ///<returns type="Array" elementType="Lost.ServiceNumber"/>
        if (!serviceID) serviceID = null;
        return function(success, error) {
            this.SVCs.include("Numbers").first(function(service) {
                return service.ID == this.id;
            }, {
                id: serviceID
            }, function(service) {
                if (success) success(service.Numbers);
            }).fail(function(err) {
                if (success) success([]);
            });
        };
    },
    getURNs: function() {
        ///<returns type="Array" elementType="string"/>
        return function(success, error) {
            this.SVCs.orderBy(function(service) {
                return service.URN;
            }).toArray(function(services) {
                var urns = services.map(function(service) {
                    return service.URN;
                }).filter(function(value, index, self) {
                    return self.indexOf(value) === index;
                });
                if (success) success(urns);
            }).fail(function(err) {
                if (success) success([]);
            });
        };
    }
});

LostContext.doNativeSetupActions = function(dbContext) {
    var deferred = Q.defer();
    tools.logInfo("Native DB setup actions ...");
    if (global.odata.__config.type === "mongoDB") {
        var nativeDb = dbContext.storageProvider.driver.MongoClient;
        var cfg = global.odata.__config;
        var up = !tools.isNullOrEmpty(cfg.username) ? cfg.username : "";
        if (!tools.isNullOrEmpty(up) && !tools.isNullOrEmpty(cfg.password)) up += ":" + cfg.password;
        if (!tools.isNullOrEmpty(up)) up += "@";
        var url = "mongodb://" + up + cfg.address + ":" + cfg.port + "/" + cfg.databaseName;
        nativeDb.__url = url;
        tools.logDebug("Native connection to: " + url.cyan);
        nativeDb.connect(url, function(error, db) {
            if (error) deferred.reject(error);
            nativeDb.__context = db;
            var serviceBoundaries = db.collection("ServiceBoundaries");
            serviceBoundaries.ensureIndex({
                BoundaryGeom: "2dsphere"
            }, function(error, result) {
                if (error) deferred.reject(error); else {
                    tools.logOK("Native DB setup actions ... " + "DONE".green);
                    deferred.resolve(nativeDb);
                }
            });
        });
    } else throw new Error("Unsupported DB provider (" + global.odata.__config.type + ")");
    return deferred.promise;
};

module.exports = exports = LostContext;