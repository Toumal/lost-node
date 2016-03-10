/*! lost-node(v0.1.2, 2015-12-30) - GPL - copyright richard.prinz@min.at */
"use strict";

var Q = require("q"), _ = require("lodash"), xmlLib = require("libxmljs"), tools = require("../tools"), geoTools = require("../geoTools");

var LostError = tools.LostError;

exports.process = function(req) {
    if (!req) throw new LostError("getServiceBoundary request empty", LostError.types.badRequest);
    var referenceID = _.get(req, "@.key", null);
    if (global.odata.__config.type === "mongoDB") {
        var db = global.odata.__native.__context;
        return mongoFindBoundary(db.collection("ServiceBoundaries"), "ReferenceID", referenceID).then(function(boundaries) {
            if (!_.isArray(boundaries)) throw new LostError("Invalid database response querying boundary (" + referenceID + ")", LostError.types.internalError);
            if (boundaries.length < 1) throw new LostError("Service boundary (" + referenceID + ") not found", LostError.types.notFound);
            if (boundaries.length > 1) throw new LostError("Multiple service boundaries with same key (" + referenceID + ")", LostError.types.internalError);
            var xml = createResponse(_.get(boundaries, "0", null), req);
            return xml;
        });
    } else throw new LostError("Unsupported DB provider (" + global.odata.__config.type + ")", LostError.types.internalError);
};

function createResponse(boundary, req) {
    if (!boundary) throw new LostError("Boundary not found", LostError.types.notFound);
    var res = new xmlLib.Document();
    var root = res.node("getServiceBoundaryResponse");
    root.defineNamespace(global.LoST.XML_LOST_URN);
    root.defineNamespace("p2", global.LoST.XML_GML_URN);
    var geom = _.get(boundary, "BoundaryGeom", null);
    if (geom) {
        var boundaryNode = root.node("serviceBoundary").attr({
            profile: "geodetic-2d"
        });
        geoTools.GeoJsonToGML(geom, boundaryNode, null);
    }
    root.node("path").node("via").attr({
        source: "resolver.example"
    }).parent().node("via").attr({
        source: "authoritative.example"
    });
    return res;
}

function mongoFindBoundary(collection, field, referenceID, projection) {
    var deferred = Q.defer();
    var request = {};
    request[field] = referenceID;
    if (!projection) projection = {};
    collection.find(request, projection).toArray(function(error, result) {
        if (error) deferred.reject(error); else deferred.resolve(result);
    });
    return deferred.promise;
}

