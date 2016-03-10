/*! lost-node(v0.1.2, 2015-12-30) - GPL - copyright richard.prinz@min.at */
"use strict";

var Q = require("q"), _ = require("lodash"), config = require("../../config/config"), moment = require("moment"), xmlLib = require("libxmljs"), tools = require("../tools"), btoa = require("btoa"), geoTools = require("../geoTools");

var LostError = tools.LostError;

exports.process = function(req) {
    if (!req) throw new LostError("findService request empty", LostError.types.badRequest);
    var serviceURN = req.service;
    var locations = geoTools.parseRequestGMLtoGeoJson(req);
    if (locations.length < 1) throw new LostError("Invalid findService request. Locations missing", LostError.types.badRequest);
    if (global.odata.__config.type === "mongoDB") {
        var db = global.odata.__native.__context;
        var geometrySearchQueue = [];
        locations.forEach(function(location) {
            switch (location.profile) {
              case "geodetic-2d":
                geometrySearchQueue.push(findBoundaries(db.collection("ServiceBoundaries"), "BoundaryGeom", location, {
                    SVC__ID: true,
                    ReferenceID: true
                }));
                break;

              default:
                tools.logWarning("Unsupported location profile (" + location.profile + ") - ignored");
                break;
            }
        });
        return Q.all(geometrySearchQueue).then(function(locations) {
            var searchQueue = [];
            locations.forEach(function(location) {
                var servicesSearchQueue = [];
                location.services = [];
                location.boundaries.forEach(function(boundary) {
                    servicesSearchQueue.push(findService(boundary.SVC__ID, serviceURN));
                });
                searchQueue.push(Q.all(servicesSearchQueue).then(function(services) {
                    services = services.filter(function(service) {
                        return !!service;
                    });
                    location.services = services;
                    return location;
                }));
            });
            return Q.all(searchQueue);
        }).then(function(locations) {
            locations = locations.filter(function(service) {
                return !!service;
            });
            var xml = createResponse(_.get(locations, "0", null), req);
            return xml;
        });
    } else throw new LostError("Unsupported DB provider (" + global.odata.__config.type + ")", LostError.types.internalError);
};

function createResponse(location, req) {
    if (!location || !location.services || !location.services.length) throw new LostError("No services found", LostError.types.notFound);
    var res = new xmlLib.Document();
    var root = res.node("findServiceResponse");
    root.defineNamespace(global.LoST.XML_LOST_URN);
    root.defineNamespace("p2", global.LoST.XML_GML_URN);
    location.services.forEach(function(service) {
        var uris = _.get(service, "URIs", []);
        var numbers = _.get(service, "Numbers", []);
        var boundaries = _.get(service, "Boundaries", []);
        var mapping = root.node("mapping").attr({
            expires: moment(_.get(service, "Expires", moment())).toISOString(),
            lastUpdated: moment(_.get(service, "LastUpdated", moment())).toISOString(),
            source: _.get(config, "lost.source", "unknown"),
            sourceId: _.get(service, "ServiceID", "unknown")
        });
        mapping.node("displayName", _.get(service, "DisplayName", "")).attr({
            "xml:lang": _.get(service, "LanguageCode", "en")
        }).parent().node("service", _.get(service, "URN", ""));
        var boundaryResponse = _.get(req, "@.serviceBoundary", "value");
        boundaries.forEach(function(boundaryEntry) {
            var boundaryRef = _.get(boundaryEntry, "initData.ReferenceID", "");
            if (boundaryResponse === "value") {
                var geom = _.get(boundaryEntry, "initData.BoundaryGeom", null);
                if (geom) {
                    var boundaryNode = mapping.node("serviceBoundary").attr({
                        profile: "geodetic-2d"
                    });
                    geoTools.GeoJsonToGML(geom, boundaryNode, null);
                }
            } else if (boundaryResponse === "reference") {
                mapping.node("serviceBoundaryReference").attr({
                    source: "",
                    key: boundaryRef
                });
            } else throw new LostError("Invalid serviceBoundary attribute in request", LostError.types.badRequest);
        });
        uris.forEach(function(uriEntry) {
            var schema = _.get(uriEntry, "initData.Schema", null);
            var uri = _.get(uriEntry, "initData.URI", null);
            if (!tools.isNullOrEmpty(schema) && !tools.isNullOrEmpty(uri)) mapping.node("uri", schema + ":" + uri);
        });
        numbers.forEach(function(numberEntry) {
            var number = _.get(numberEntry, "initData.Number", null);
            if (!tools.isNullOrEmpty(number)) mapping.node("serviceNumber", number);
        });
    });
    root.node("path").node("via").attr({
        source: "resolver.example"
    }).parent().node("via").attr({
        source: "authoritative.example"
    });
    root.node("locationUsed").attr({
        id: location.id
    });
    return res;
}

function findService(serviceID, serviceURN) {
    var mongoID = btoa(serviceID);
    return global.odata.__context.SVCs.include("URIs").include("Numbers").include("Boundaries").single(function(service) {
        return service.ID == this.id && service.URN == this.urn;
    }, {
        id: mongoID,
        urn: serviceURN
    }).then(function(service) {
        return service;
    }).fail(function(error) {
        return null;
    });
}

function findBoundaries(collection, field, location, projection) {
    var deferred = Q.defer();
    var request = {};
    request[field] = {
        $geoIntersects: {
            $geometry: location.geom
        }
    };
    if (!projection) projection = {};
    collection.find(request, projection).toArray(function(error, result) {
        if (error) deferred.reject(error); else {
            location.boundaries = result;
            deferred.resolve(location);
        }
    });
    return deferred.promise;
}

