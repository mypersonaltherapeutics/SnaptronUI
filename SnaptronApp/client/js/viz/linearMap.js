/**
 * Created by Phani on 2/14/2016.
 */

const VIEWBOX_WIDTH = 1000;
const VIEWBOX_HEIGHT = 350;

const MARKER_LABEL_STYLE = "fill:#EEEEEE;stroke:black;stroke-width:1";
const MARKER_LINE_STYLE = "stroke:#DDDDDD;stroke-width:1";
const MIN_DISPLAY_LENGTH_PX = 3;

const MID_AXIS_LINE_HEIGHT = 4;

const JUNCTION_MAX_VAL_COLOR = "#d9230f";
const JUNCTION_NORMAL_COLOR = "black";
const JUNCTION_BOOL_TRUE_COLOR = "#d9230f";
const JUNCTION_HIGHLIGHT_COLOR = "#3a87ad";
const JUNCTION_SELECTED_COLOR = "#33BCFF";
const JUNCTION_NORMAL_WIDTH = 2;
const JUNCTION_HIGHLIGHTED_WIDTH = 3;
const JUNCTION_SELECTED_WIDTH = 4;

const AXIS_K_CUTOFF = 10000;
const MARKER_LABEL_HEIGHT = 25;

var linearMapXScale;
var linearMapXAxis;
var zoom = null;
var linearMapSelectedJunction = null;

var colorScale;
var colorByKey = null;
var colorLog = false;

Session.setDefault("numCurrentlyVisible", 0);

Template.linearMap.events({
    "click .resetView": function (event, template) {
        if (zoom != null) {
            zoom.scale(1);
            zoom.translate([0, 0]);
            onZoom();
        }
    },
    "click #colorBySelect": function (event, template) {
        var selected = template.find("#colorBySelect").value;
        if (selected === "None") {
            colorByKey = null;
        } else if (selected.startsWith("log(")) {
            colorLog = true;
            colorByKey = selected.replace("log(", "").replace(")", "");
        }
        else {
            colorLog = false;
            colorByKey = selected;
        }
        updateColorScale();
        d3.select(".junctionmap").selectAll(".jnct").remove();
        updateJunctions();
    }
});

Template.linearMap.helpers({
    "currentlyVisible": function () {
        return Session.get("numCurrentlyVisible") + " Junctions Currently Visible";
    }
});

Template.linearMap.onRendered(function () {
    colorByKey = null;
    updateMap();
    updateControls();
});

function updateControls() {
    // Update color-by option
    var numKeys = getJunctionNumberKeys();
    var options = ["None"].concat(getJunctionBoolKeys().concat(numKeys));
    //Add log options
    var logKeys = [];
    for (var i = 0; i < numKeys.length; i++) {
        logKeys.push("log(" + numKeys[i] + ")");
    }
    options = options.concat(logKeys);

    var selection = d3.select("#colorBySelect")
        .selectAll("option")
        .data(options, function (opt) {
            return opt;
        });
    selection.exit().remove();
    selection.enter()
        .append("option")
        .text(function (d) {
            return d;
        });
}

function updateMap() {
    var junctions = Junctions.find().fetch();
    var _limits = getLimits(junctions);
    var start = _limits.start;
    var stop = _limits.stop;
    linearMapXScale = d3.scale.linear().range([0, VIEWBOX_WIDTH])
        .domain([start, stop]);

    zoom = d3.behavior.zoom()
        .x(linearMapXScale)
        .scaleExtent([1, Infinity])
        .on("zoom", onZoom);

    var svg = d3.select(".svg-container").classed("svg-container", true)
        .selectAll('svg').data([0])
        .enter().append("svg")
        .attr("class", "junctionmap")
        .attr("preserveAspectRatio", "xMinYMin meet")
        .attr("viewBox", "0 0 " + VIEWBOX_WIDTH + " " + VIEWBOX_HEIGHT)
        .classed("svg-content-responsive", true)
        .on("mouseout", removeMouseMarker)
        .on("mousemove", updateMouseMarker)
        .call(zoom);

    updateFrame();
    updateJunctions();
}

function getVisibleJunctions() {
    var leftLim = linearMapXScale.invert(0);
    var rightLim = linearMapXScale.invert(VIEWBOX_WIDTH);
    var minLength = linearMapXScale.invert(MIN_DISPLAY_LENGTH_PX) - leftLim;
    var visibleJunctions = Junctions.find({
        start: {"$gte": leftLim},
        end: {"$lte": rightLim},
        length: {"$gte": minLength}
    }).fetch();
    return visibleJunctions;
}

function updateJunctions() {
    var visibleJunctions = getVisibleJunctions();
    var selection = d3.select(".junctionmap").selectAll(".jnct")
        .data(visibleJunctions, getKeyForJunction);
    // Update
    selection.attr("d", junctionPath);
    // Add newly visisble
    selection.enter()
        .append("path")
        .attr("class", "jnct")
        .attr("stroke", getJunctionColor)
        .attr("fill", "none")
        .attr("stroke-width", JUNCTION_NORMAL_WIDTH)
        .attr("pointer-events", "visiblePainted")
        .attr("d", junctionPath)
        .on("click", onJunctionMouseClick)
        .on("mouseover", onJunctionMouseOver);
    // Remove no longer visible
    selection.exit().remove();
    Session.set("numCurrentlyVisible", visibleJunctions.length);
}

function junctionPath(jnct) {
    var endpointY = (VIEWBOX_HEIGHT) / 2;
    var startX = parseInt(linearMapXScale(jnct.start));
    var endX = parseInt(linearMapXScale(jnct.end));
    var range = endX - startX;
    var cPoint1X = parseInt(startX + 2 * range / 6);
    var cPoint2X = parseInt(startX + 4 * range / 6);
    var annotatedMod = jnct[JUNCTION_ANNOTATED] ? -1 : 1;
    var cPointY = (VIEWBOX_HEIGHT ) / 2 - annotatedMod * parseInt((VIEWBOX_HEIGHT / 2) * (parseFloat(range) / (VIEWBOX_WIDTH / 3)));
    endpointY -= annotatedMod * MID_AXIS_LINE_HEIGHT / 2;
    cPointY = Math.max(0, cPointY);
    cPointY = Math.min(VIEWBOX_HEIGHT, cPointY);
    return "M" + startX + " " + endpointY + " C " + cPoint1X + " " + cPointY + " " + cPoint2X + " " + cPointY + " " + endX + " " + endpointY;
}

function updateFrame() {
    var svg = d3.select(".junctionmap");
    //Draw axis
    var numTicks = parseInt(VIEWBOX_WIDTH / 120);
    var leftLim = linearMapXScale.invert(35);
    var rightLim = linearMapXScale.invert(VIEWBOX_WIDTH - 35);
    var step = (rightLim - leftLim) / (numTicks);
    var tickValues = [];
    for (var i = 0; i <= numTicks; i++) {
        tickValues.push(parseInt(leftLim + i * step));
    }
    linearMapXAxis = d3.svg.axis()
        .orient("bottom")
        .scale(linearMapXScale)
        .tickValues(tickValues)
        .tickFormat(function (d) {
            if (Math.abs(d) > AXIS_K_CUTOFF) {
                return parseInt(d / 1000) + "k";
            }
            return d;
        });
    svg.selectAll("g.xaxis").data([0])
        .enter().append("g")
        .attr("class", "xaxis")
        .attr("transform", "translate(0," + (VIEWBOX_HEIGHT - 25) + ")")
        .call(linearMapXAxis);
    svg.selectAll("#midAxisLine").data([0])
        .enter().append("rect")
        .attr("id", "midAxisLine")
        .attr("transform", "translate(0,0)")
        .attr("x", 0).attr("y", VIEWBOX_HEIGHT / 2 - MID_AXIS_LINE_HEIGHT / 2).attr("width", VIEWBOX_WIDTH)
        .attr("height", MID_AXIS_LINE_HEIGHT).attr("fill", "#000000");
}

function getLimits(junctions) {
    var start = 9007199254740990;
    var stop = -1;
    for (var i = 0; i < junctions.length; i++) {
        if (junctions[i].start < start) {
            start = junctions[i].start;
        }
        if (junctions[i].end > stop) {
            stop = junctions[i].end;
        }
    }
    if (stop == -1) {
        start = 0;
        stop = 1;
    }
    return {start: start, stop: stop};
}
function onZoom() {
    d3.select(".xaxis").call(linearMapXAxis);
    updateJunctions();
    updateFrame();
}

function addMouseMarker() {
    var marker = d3.select("g.mousemarker");
    if (marker.empty()) {
        marker = d3.select(".junctionmap").append("g").attr("class", "mousemarker");
        // Marker line
        marker.append("line")
            .attr("class", "markerline")
            .attr("x1", 0)
            .attr("y1", 0)
            .attr("x2", 0)
            .attr("y2", VIEWBOX_HEIGHT)
            .attr("style", MARKER_LINE_STYLE)
            .attr("pointer-events", "none");
        var label = marker.append("g").attr("class", "markerlabel").attr("transform", "translate(0,0)");
        //Label box and text
        label.append("rect")
            .attr("class", "markerlabelbox")
            .attr("x", 5)
            .attr("y", 0)
            .attr("rx", 5)
            .attr("ry", 5)
            .attr("width", 10)
            .attr("height", MARKER_LABEL_HEIGHT)
            .attr("pointer-events", "none")
            .attr("style", MARKER_LABEL_STYLE);
        label.append("text")
            .attr("class", "markerlabeltext")
            .attr("pointer-events", "none")
            .attr("x", 10)
            .attr("y", MARKER_LABEL_HEIGHT / 2 + 5);
    }
}

function removeMouseMarker() {
    d3.selectAll("g.mousemarker").remove();
}

function updateMouseMarker() {
    addMouseMarker();
    var coords = d3.mouse(this);
    coords[0] = Math.max(coords[0], 0);
    coords[0] = Math.min(coords[0], VIEWBOX_WIDTH);
    var marker = d3.select("g.mousemarker");
    marker.attr("transform", "translate(" + coords[0] + ",0)");
    var markerLabel = marker.select(".markerlabel");
    var label = markerLabel.select(".markerlabelbox");
    var text = markerLabel.select(".markerlabeltext");
    text.text(function () {
        return numberWithCommas(parseInt(linearMapXScale.invert(coords[0])));
    });

    var w = text.node().getBBox().width;
    var xOffset = -10 - w / 2;
    if (coords[0] - w - 50 <= 0) {
        //Goes offscreen, go to other side of line
        xOffset = 0;
    } else if (coords[0] + w + 50 >= VIEWBOX_WIDTH) {
        xOffset -= w / 2 + 10;
    }
    markerLabel.transition().attr("transform", "translate (" + xOffset + ",0)");
    label.attr("width", w + 10);
}

function getKeyForJunction(jnct) {
    if (jnct == null) {
        return "";
    }
    return jnct._id;
}

function onJunctionMouseOver(jnct) {
    d3.selectAll(".jnct")
        .attr("stroke-width", JUNCTION_NORMAL_WIDTH)
        .attr("stroke", getJunctionColor)
        .data([jnct], getKeyForJunction)
        .attr("stroke-width", JUNCTION_HIGHLIGHTED_WIDTH)
        .attr("stroke", JUNCTION_HIGHLIGHT_COLOR);
    d3.selectAll(".jnct")
        .data([linearMapSelectedJunction], getKeyForJunction)
        .attr("stroke", JUNCTION_SELECTED_COLOR)
        .attr("stroke-width", JUNCTION_SELECTED_WIDTH);
}
function onJunctionMouseClick(jnct) {
    linearMapSelectedJunction = jnct;
    onJunctionMouseOver(jnct);
}
function numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function updateColorScale() {
    if (colorByKey != null && colorByKey !== "bool") {
        var junctions = getVisibleJunctions();
        var colorByMin = 9007199254740990;
        var colorByMax = -9007199254740990;
        for (var i = 0; i < junctions.length; i++) {
            if (junctions[i][colorByKey] > colorByMax) {
                colorByMax = junctions[i][colorByKey];
            }
            if (junctions[i][colorByKey] < colorByMin) {
                colorByMin = junctions[i][colorByKey];
            }
        }
        if (colorLog) {
            colorScale = d3.scale.log();
        } else {
            colorScale = d3.scale.linear();
        }
        colorScale = colorScale.domain([colorByMin, colorByMax])
            .interpolate(d3.interpolateLab)
            .range([JUNCTION_NORMAL_COLOR, JUNCTION_MAX_VAL_COLOR]);
    } else {
        d3.select("#scale").remove();
    }
}

function getJunctionColor(jnct) {
    if (colorByKey == null) {
        return JUNCTION_NORMAL_COLOR;
    }
    if (JUNCTION_COLUMN_TYPES[colorByKey] === "bool") {
        return jnct[colorByKey] ? JUNCTION_BOOL_TRUE_COLOR : JUNCTION_NORMAL_COLOR;
    }
    return colorScale(jnct[colorByKey]);
}

getJunctionNumberKeys = function () {
    var keys = Object.keys(JUNCTION_COLUMN_TYPES);
    var numberKeys = [];
    for (var i = 0; i < keys.length; i++) {
        var type = JUNCTION_COLUMN_TYPES[keys[i]];
        if (type === "int" || type === "float") {
            numberKeys.push(keys[i])
        }
    }
    return numberKeys;
};

getJunctionBoolKeys = function () {
    var keys = Object.keys(JUNCTION_COLUMN_TYPES);
    var boolKeys = [];
    for (var i = 0; i < keys.length; i++) {
        var type = JUNCTION_COLUMN_TYPES[keys[i]];
        if (type === "bool") {
            boolKeys.push(keys[i])
        }
    }
    return boolKeys;
};

