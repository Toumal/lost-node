/*! lost-node(v0.1.2, 2015-12-30) - GPL - copyright richard.prinz@min.at */
"use strict";

var _ = require("lodash"), xmlLib = require("libxmljs"), tools = require("../tools");

var LostError = tools.LostError;

exports.process = function(req) {
    if (!req) throw new LostError("listServices request empty", LostError.types.badRequest);
    var serviceURNpattern = _.get(req, "service", null);
    if (!serviceURNpattern) throw new LostError("No URN to query for specified", LostError.types.badRequest);
    return findServices(serviceURNpattern).then(function(services) {
        if (!_.isArray(services)) throw new LostError("Invalid database response querying services " + "with URN (" + serviceURNpattern + ")", LostError.types.internalError);
        if (services.length < 1) throw new LostError("No services matching URN pattern " + "(" + serviceURNpattern + ") found", LostError.types.notFound);
        var xml = createResponse(services, req);
        return xml;
    });
};

function createResponse(services, req) {
    if (!_.isArray(services) || services.length < 1) throw new LostError("No services found", LostError.types.notFound);
    var res = new xmlLib.Document();
    var root = res.node("listServicesResponse");
    root.defineNamespace(global.LoST.XML_LOST_URN);
    services = _.uniq(services, false, "initData.URN");
    var serviceList = "";
    services.forEach(function(service) {
        var urn = _.get(service, "initData.URN", null);
        if (urn) serviceList += urn + "\n";
    });
    root.node("serviceList", serviceList);
    root.node("path").node("via").attr({
        source: "resolver.example"
    }).parent().node("via").attr({
        source: "authoritative.example"
    });
    return res;
}

function findServices(serviceURNpattern) {
    return global.odata.__context.SVCs.filter(function(service) {
        return service.URN.startsWith(this.urn);
    }, {
        urn: serviceURNpattern
    }).toArray().then(function(services) {
        return services;
    }).fail(function(error) {
        return null;
    });
}