/*! lost-node(v0.1.2, 2015-12-30) - GPL - copyright richard.prinz@min.at */
"use strict";

var tools = require("./tools"), _ = require("lodash"), xmlLib = require("libxmljs"), point = require("./point");

exports.parseRequestGMLtoGeoJson = function(req) {
    var id;
    var gmlNs = "";
    var geomTypes = [ "Point", "Polygon", "Circle", "Ellipse", "ArcBand" ];
    var locations = [];
    var locationTypes = {};
    var ns = tools.get(req, "@.xmlns");
    if (ns) {
        for (var n in ns) {
            if (ns.hasOwnProperty(n)) {
                if (ns[n] === global.LoST.XML_GML_URN) {
                    gmlNs = n;
                    break;
                }
            }
        }
    }
    if (!req.location) throw new Error("location missing");
    locations = req.location.constructor === Array ? req.location : [ req.location ];
    if (locations.length < 1) throw new Error("location missing");
    locations.forEach(function(loc) {
        id = tools.get(loc, "@.id");
        if (!id) throw new Error("location.id missing");
        loc.id = id;
        if (!tools.has(loc, "@.id") || !tools.has(loc, "@.profile")) throw new Error("location.id or location.profile missing");
        var lp = loc["@"].profile;
        if (lp != "geodetic-2d" && lp != "civic") throw new Error("location.profile (" + lp + ") invalid");
        if (!locationTypes.hasOwnProperty(lp)) locationTypes[lp] = 0;
        locationTypes[lp]++;
        if (locationTypes[lp] > 1) throw new Error("location.profile (" + lp + ") used more than once");
        loc.profile = lp;
        delete loc["@"];
        if (loc.profile == "civic") {
            var civic = tools.get(loc, "civicAddress");
            if (!civic) throw new Error('address infos for profile "civic" missing');
            loc.civic = civic;
            delete loc.civicAddress;
        }
        if (loc.profile == "geodetic-2d") {
            var geom;
            var geomName;
            geomTypes.some(function(gt) {
                geomName = (gmlNs ? gmlNs + ":" : "") + gt;
                geom = tools.get(loc, geomName);
                if (geom) {
                    geom.type = gt;
                    return true;
                } else return false;
            });
            geom.ns = gmlNs;
            switch (geom.type) {
              case "Point":
                geom = new point.Point(geom);
                break;

              default:
                throw new Error("location has invalid or unsupported " + "geometry type (" + geom.type + ")");
                break;
            }
            loc.geom = geom;
            delete loc[geomName];
        }
    });
    return locations;
};

exports.GeoJsonToGML = function(geom, xmlNode) {
    if (!geom) return null;
    var geomType = _.get(geom, "type", null);
    var geomCrs = _.get(geom, "crs.properties.name", null);
    if (tools.isNullOrEmpty(geomType) || tools.isNullOrEmpty(geomCrs)) return null;
    var rootNode = xmlNode;
    if (!rootNode) rootNode = new xmlLib.Document();
    var xmlNs = rootNode.namespaces();
    var lostNs;
    var gmlNs;
    xmlNs.forEach(function(ns) {
        if (ns && !lostNs && ns.href() === global.LoST.XML_LOST_URN) lostNs = ns;
        if (ns && !gmlNs && ns.href() === global.LoST.XML_GML_URN) gmlNs = ns;
    });
    lostNs = lostNs ? lostNs : rootNode.defineNamespace(global.LoST.XML_LOST_URN);
    gmlNs = gmlNs ? gmlNs : rootNode.defineNamespace("p2", global.LoST.XML_GML_URN);
    var createNodeNs = function(parentNode, nodeName, nodeValue, namespace) {
        var node = parentNode.node(nodeName, nodeValue);
        if (namespace) node.namespace(namespace);
        return node;
    };
    var createNode = function(_type, _parentNode, _coords, _addSRS) {
        var _c = _coords ? _coords : geom.coordinates;
        var _node = createNodeNs(_parentNode, _type, null, gmlNs);
        if (_addSRS) _node.attr({
            srsName: "urn:ogc:def:crs:" + geomCrs.replace(":", "::")
        });
        switch (_type) {
          case "MultiPolygon":
            var polygonMemberNode = createNodeNs(_node, "polygonMember", null, gmlNs);
            _c.forEach(function(polygon) {
                createNode("Polygon", polygonMemberNode, polygon, false);
            });
            break;

          case "Polygon":
            _c.forEach(function(ring, index) {
                var ringTypeNode = createNodeNs(_node, !index ? "exterior" : "interior", null, gmlNs);
                var ringNode = createNodeNs(ringTypeNode, "LinearRing", null, gmlNs);
                ring.forEach(function(position) {
                    createNodeNs(ringNode, "pos", position[0] + " " + position[1], gmlNs);
                });
            });
            break;

          case "Point":
            _node.attr({
                axisLabels: "x y"
            });
            createNodeNs(_node, "pos", _c[0] + " " + _c[1], gmlNs);
            break;
        }
    };
    createNode(geomType, rootNode, null, true);
    return rootNode;
};