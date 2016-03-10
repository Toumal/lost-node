/*! lost-node(v0.1.2, 2015-12-30) - GPL - copyright richard.prinz@min.at */
"use strict";

var Q = require("q"), _ = require("lodash"), util = require("util"), moment = require("moment"), xmlLib = require("libxmljs"), tools = require("../tools"), atob = require("atob"), btoa = require("btoa"), geoTools = require("../geoTools");

var LostError = tools.LostError;

exports.process = function(req) {
    if (!req) throw new LostError("listServicesByLocation request empty", LostError.types.badRequest);
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
                    servicesSearchQueue.push(findServices(boundary.SVC__ID, serviceURN));
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
    var root = res.node("listServicesByLocationResponse");
    root.defineNamespace(global.LoST.XML_LOST_URN);
    root.defineNamespace("p2", global.LoST.XML_GML_URN);
    location.services = _.uniq(location.services, false, "initData.URN");
    var serviceList = "";
    location.services.forEach(function(service) {
        var urn = _.get(service, "initData.URN", null);
        if (urn) serviceList += urn + "\n";
    });
    root.node("serviceList", serviceList);
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

function findServices(serviceID, serviceURN) {
    var mongoID = btoa(serviceID);
    var context = global.odata.__context.SVCs.include("URIs").include("Numbers").include("Boundaries");
    var query;
    if (tools.isNullOrEmpty(serviceURN)) query = context.single(function(service) {
        return service.ID == this.id;
    }, {
        id: mongoID
    }); else query = context.single(function(service) {
        return service.ID == this.id && service.URN.startsWith(this.urn);
    }, {
        id: mongoID,
        urn: serviceURN
    });
    return query.then(function(service) {
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

