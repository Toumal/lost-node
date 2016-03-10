/*! lost-node(v0.1.2, 2015-12-30) - GPL - copyright richard.prinz@min.at */
"use strict";

var tools = require("./tools");

function Point(reqLocGeom) {
    var self = this;
    self.type = "Point";
    if (!reqLocGeom) return;
    if (!reqLocGeom.type || reqLocGeom.type != "Point") throw new Error("Unable to create point from invalid location");
    var gmlNs = reqLocGeom.ns;
    self.srs = tools.get(reqLocGeom, "@.srsName");
    if (!self.srs) throw new Error("location.Point.srsName missing.");
    var pointPos = tools.get(reqLocGeom, (gmlNs ? gmlNs + ":" : "") + "pos");
    var pointRx = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*(-?\d{1,3}(?:\.\d+)?)\s*(-?\d+(?:\.\d+)?)?\s*$/;
    var pointMatch = pointRx.exec(pointPos);
    if (!pointMatch) throw new Error("location.Point.pos missing or invalid");
    self.coordinates = [ parseFloat(pointMatch[2]), parseFloat(pointMatch[1]) ];
}

module.exports.Point = Point;