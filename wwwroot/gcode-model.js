var colorG0 = 0xff0000; // red
var colorG1 = 0x0000ff; // blue
var colorG2 = 0x00ff00; // green
var colorG3 = 0xeee000; // yellow

function createObjectFromGCode(gcode, indxMax) {
  // debugger;
  // Credit goes to https://github.com/joewalnes/gcode-viewer
  // for the initial inspiration and example code.
  // 
  // GCode descriptions come from:
  //    http://reprap.org/wiki/G-code
  //    http://en.wikipedia.org/wiki/G-code
  //    SprintRun source code

  this.offsetG92 = { x: 0, y: 0, z: 0, e: 0 };
  this.setUnits("mm");

  var lastLine = {
    x: 0,
    y: 0,
    z: 0,
    e: 0,
    f: 0,
    feedrate: null,
    extruding: false
  };

  // we have been using an approach where we just append
  // each gcode move to one monolithic geometry. we
  // are moving away from that idea and instead making each
  // gcode move be it's own full-fledged line object with
  // its own userData info
  // G2/G3 moves are their own child of lots of lines so
  // that even the simulator can follow along better
  var inspect3dObj = new THREE.Group();
  var plane = "G17"; //set default plane to G17 - Assume G17 if no plane specified in gcode.
  var lineGeo = new THREE.Geometry();
  var layers = [];
  var layer = undefined;
  var lines = [];
  var totalDist = 0;
  var bbbox = {
    min: {
      x: 100000,
      y: 100000,
      z: 100000
    },
    max: {
      x: -100000,
      y: -100000,
      z: -100000
    }
  };
  var bbbox2 = {
    min: {
      x: 100000,
      y: 100000,
      z: 100000
    },
    max: {
      x: -100000,
      y: -100000,
      z: -100000
    }
  };

  /**
   * add a new layer
   * @param {point} line 
   */
  this.newLayer = function (line) {
    layer = {
      type: {},
      layer: layers.length,
      geometries: [],
      z: line.z,
    };
    layers.push(layer);
  };

  /**
   * initialise a new group of lines
   * @param {point} line - object with x, y, z, e, f etc
   * @param {arguments} args 
   */
  this.getLineGroup = function (line, args) {

    if (layer == undefined) this.newLayer(line);

    var speed = Math.round(line.e / 1000);
    var grouptype = (line.extruding ? 10000 : 0) + speed;
    var color = new THREE.Color(line.extruding ? 0xff00ff : this.colorG1);

    if (line.g0) {
      grouptype = "g0";
      color = new THREE.Color(this.colorG0);
    } else if (line.g1) {
      grouptype = "g1";
      color = new THREE.Color(this.colorG1);
    } else if (line.g2) {
      grouptype = "g2";
      color = new THREE.Color(this.colorG2);
    } else if (line.g3) {
      grouptype = "g3";
      color = new THREE.Color(this.colorG3);
    }

    // see if we have reached indxMax, if so draw, but 
    // make it ghosted
    if (args.indx > indxMax) {
      grouptype = "ghost";
      color = new THREE.Color(0x000000);
    }

    if (layer.type[grouptype] == undefined) {
      layer.type[grouptype] = {
        type: grouptype,
        feed: line.e,
        extruding: line.extruding,
        color: color,
        segmentCount: 0,
        material: line.g0 ?
          new THREE.LineDashedMaterial({
            color: color,
            dashSize: this.getUnitVal(1),
            gapSize: this.getUnitVal(1),
            linewidth: 1,
          })
          :
          new THREE.LineBasicMaterial({
            color: color,
            opacity: line.extruding ? 0.2 : 1.0,
            transparent: true,
            linewidth: 1,
            vertexColors: THREE.FaceColors
          })
      }

      if (args.indx > indxMax) {
        layer.type[grouptype].material.opacity = 0.05;
      }
    }
    return layer.type[grouptype];
  };

  /**
   * add a fake segment 
   * @param {arguments} args 
   */
  this.addFakeSegment = function (args) {

    var arg2 = {
      isFake: true,
      cmd: args.cmd,
      indx: args.indx,
      origtext: args.origtext,
      text: args.text
    };

    // check if comment
    if (arg2.text.match(/^(;|\(|<)/)) arg2.isComment = true;

    lines.push({
      p2: lastLine,    // since this is fake, just use lastLine as xyz
      'args': arg2
    });
  }

  /**
   * add segment
   * @param {point} p1 - object with x, y, z, e, f etc
   * @param {point} p2  - object with x, y, z, e, f etc
   * @param {arguments} args 
   */
  this.addSegment = function (p1, p2, args) {

    // add segment to array for later use
    lines.push({
      p2: p2,
      'args': args
    });

    var group = this.getLineGroup(p2, args);
    group.segmentCount++;
    group.plane = args.plane;

    // see if we need to draw an arc
    if (p2.g2 || p2.g3) {

      // get the three line object
      var threeObjArc = getArcThreeLine(p1, p2, args);

      // still push the normal p1/p2 point to calculate distance later
      p2.threeObjArc = threeObjArc;

      // add the geometry to the layer object
      // not as performant as using one large geometry
      // var cmd = {
      //   type: group.type,
      //   geometry: threeObjArc.geometry
      // }
      // layer.geometries.push(cmd);

      // use lineGeo to combine all lines into one large geometry
      lineGeo.vertices.push.apply(
        lineGeo.vertices,
        threeObjArc.geometry.vertices
      );
      // add colors
      for (var i = 0; i < threeObjArc.geometry.vertices.length; i++) {
        lineGeo.colors.push(group.color);
      }

    } else {
      // not an arc, draw a line

      // add the geometry to the layer object
      // not as performant as using one large geometry
      // var geom = new THREE.Geometry();

      // geom.vertices.push(
      //   new THREE.Vector3(p1.x, p1.y, p1.z),
      //   new THREE.Vector3(p2.x, p2.y, p2.z)
      // );
      // // add colors
      // geom.colors.push(
      //   group.color,
      //   group.color,
      // );

      // var cmd = {
      //   type: group.type,
      //   geometry: geom
      // }
      // layer.geometries.push(cmd);

      // use lineGeo to combine all lines into one large geometry
      lineGeo.vertices.push(
        new THREE.Vector3(p1.x, p1.y, p1.z),
        new THREE.Vector3(p2.x, p2.y, p2.z)
      );

      // add colors
      lineGeo.colors.push(
        group.color,
        group.color
      );
    }

    if (p2.extruding) {
      bbbox.min.x = Math.min(bbbox.min.x, p2.x);
      bbbox.min.y = Math.min(bbbox.min.y, p2.y);
      bbbox.min.z = Math.min(bbbox.min.z, p2.z);
      bbbox.max.x = Math.max(bbbox.max.x, p2.x);
      bbbox.max.y = Math.max(bbbox.max.y, p2.y);
      bbbox.max.z = Math.max(bbbox.max.z, p2.z);
    }

    // global bounding box calc
    bbbox2.min.x = Math.min(bbbox2.min.x, p2.x);
    bbbox2.min.y = Math.min(bbbox2.min.y, p2.y);
    bbbox2.min.z = Math.min(bbbox2.min.z, p2.z);
    bbbox2.max.x = Math.max(bbbox2.max.x, p2.x);
    bbbox2.max.y = Math.max(bbbox2.max.y, p2.y);
    bbbox2.max.z = Math.max(bbbox2.max.z, p2.z);


    // NEW METHOD OF CREATING THREE.JS OBJECTS
    // create new approach for three.js objects which is
    // a unique object for each line of gcode, including g2/g3's
    // make sure userData is good too
    var gcodeInspectObj;

    if (p2.g2 || p2.g3) {
      // use the arc that already got built
      gcodeInspectObj = p2.threeObjArc;
    } else {
      // make a new line to be used as inspection line
      var color = 0x0000ff;

      var material = new THREE.LineBasicMaterial({
        color: color,
        opacity: 0.5,
        transparent: true
      });

      var geometry = new THREE.Geometry();
      geometry.vertices.push(
        new THREE.Vector3(p1.x, p1.y, p1.z),
        new THREE.Vector3(p2.x, p2.y, p2.z)
      );

      var line = new THREE.Line(geometry, material);
      gcodeInspectObj = line;
    }

    gcodeInspectObj.userData.args = args;
    gcodeInspectObj.userData.p2 = p2;
    inspect3dObj.add(gcodeInspectObj);

    // DISTANCE CALC
    // add distance so we can calc estimated time to run
    var dist = 0;
    if (p2.g2 || p2.g3) {
      // calc dist of all lines
      var arcGeo = p2.threeObjArc.geometry;

      var tad2 = 0;
      for (var arcLineCtr = 0; arcLineCtr < arcGeo.vertices.length - 1; arcLineCtr++) {
        tad2 += arcGeo.vertices[arcLineCtr].distanceTo(arcGeo.vertices[arcLineCtr + 1]);
      }
      dist = tad2;

    } else {
      // just do straight line calc
      var a = new THREE.Vector3(p1.x, p1.y, p1.z);
      var b = new THREE.Vector3(p2.x, p2.y, p2.z);
      dist = a.distanceTo(b);
    }

    if (dist > 0) {
      this.totalDist += dist;
    }

    // time to execute this move
    // if this move is 10mm and we are moving at 100mm/min then
    // this move will take 10/100 = 0.1 minutes or 6 seconds
    var timeMinutes = 0;
    if (dist > 0) {
      var fr;
      if (args.feedrate > 0) {
        fr = args.feedrate
      } else {
        fr = 100;
      }
      timeMinutes = dist / fr;

      // adjust for acceleration, meaning estimate
      // this will run longer than estimated from the math
      // above because we don't start moving at full feedrate
      // obviously, we have to slowly accelerate in and out
      timeMinutes = timeMinutes * 1.32;
    }
    this.totalTime += timeMinutes;

    p2.feedrate = args.feedrate;
    p2.dist = dist;
    p2.distSum = this.totalDist;
    p2.timeMins = timeMinutes;
    p2.timeMinsSum = this.totalTime;
  }

  // reset the total dist and time counters
  this.totalDist = 0;
  this.totalTime = 0;


  // check whether using relative positions
  var relative = false;

  /**
   * return delta between two positions
   * @param {float} v1 
   * @param {float} v2 
   */
  this.delta = function (v1, v2) {
    return relative ? v2 : v2 - v1;
  }

  /**
   * return absolute between two positions
   * @param {float} v1 
   * @param {float} v2 
   */
  this.absolute = function (v1, v2) {
    return relative ? v1 + v2 : v2;
  }

  var ijkrelative = true;  // For Mach3 Arc IJK Absolute mode
  /**
   * return absolute between two positions (For Mach3 Arc IJK Absolute mode)
   * @param {float} v1 
   * @param {float} v2 
   */
  this.ijkabsolute = function (v1, v2) {
    return ijkrelative ? v1 + v2 : v2;
  }



  var cofg = this;
  var parser = new this.GCodeParser({
    // set the g92 offsets for the parser - defaults to no offset

    G0: function (args, indx) {
      // When doing CNC, generally G0 just moves to a new location
      // as fast as possible which means no milling or extruding is happening in G0.
      // So, let's color it uniquely to indicate it's just a toolhead move.

      var newLine = {
        x: args.x !== undefined ? cofg.absolute(lastLine.x, args.x) + cofg.offsetG92.x : lastLine.x,
        y: args.y !== undefined ? cofg.absolute(lastLine.y, args.y) + cofg.offsetG92.y : lastLine.y,
        z: args.z !== undefined ? cofg.absolute(lastLine.z, args.z) + cofg.offsetG92.z : lastLine.z,
        e: args.e !== undefined ? cofg.absolute(lastLine.e, args.e) + cofg.offsetG92.e : lastLine.e,
        f: args.f !== undefined ? cofg.absolute(lastLine.f, args.f) : lastLine.f,
      };
      newLine.g0 = true;
      cofg.addSegment(lastLine, newLine, args);
      lastLine = newLine;
    },
    G1: function (args, indx) {
      // Example: G1 Z1.0 F3000
      //          G1 X99.9948 Y80.0611 Z15.0 F1500.0 E981.64869
      //          G1 E104.25841 F1800.0
      // Go in a straight line from the current (X, Y) point
      // to the point (90.6, 13.8), extruding material as the move
      // happens from the current extruded length to a length of
      // 22.4 mm.

      var newLine = {
        x: args.x !== undefined ? cofg.absolute(lastLine.x, args.x) + cofg.offsetG92.x : lastLine.x,
        y: args.y !== undefined ? cofg.absolute(lastLine.y, args.y) + cofg.offsetG92.y : lastLine.y,
        z: args.z !== undefined ? cofg.absolute(lastLine.z, args.z) + cofg.offsetG92.z : lastLine.z,
        e: args.e !== undefined ? cofg.absolute(lastLine.e, args.e) + cofg.offsetG92.e : lastLine.e,
        f: args.f !== undefined ? cofg.absolute(lastLine.f, args.f) : lastLine.f,

      };

      // layer change detection is or made by watching Z, it's made by
      // watching when we extrude at a new Z position
      if (cofg.delta(lastLine.e, newLine.e) > 0) {
        newLine.extruding = cofg.delta(lastLine.e, newLine.e) > 0;
        if (layer == undefined || newLine.z != layer.z) cofg.newLayer(newLine);
      }

      newLine.g1 = true;
      cofg.addSegment(lastLine, newLine, args);
      lastLine = newLine;
    },
    G2: function (args, indx, gcp) {
      // this is an arc move from lastLine's xy to the new xy. we'll
      // show it as a light gray line, but we'll also sub-render the
      // arc itself by figuring out the sub-segments.

      args.plane = plane; //set the plane for this command to whatever the current plane is

      var newLine = {
        x: args.x !== undefined ? cofg.absolute(lastLine.x, args.x) + cofg.offsetG92.x : lastLine.x,
        y: args.y !== undefined ? cofg.absolute(lastLine.y, args.y) + cofg.offsetG92.y : lastLine.y,
        z: args.z !== undefined ? cofg.absolute(lastLine.z, args.z) + cofg.offsetG92.z : lastLine.z,
        e: args.e !== undefined ? cofg.absolute(lastLine.e, args.e) + cofg.offsetG92.e : lastLine.e,
        f: args.f !== undefined ? cofg.absolute(lastLine.f, args.f) : lastLine.f,
        arci: args.i !== undefined ? cofg.ijkabsolute(lastLine.x, args.i) : lastLine.x,
        arcj: args.j !== undefined ? cofg.ijkabsolute(lastLine.y, args.j) : lastLine.y,
        arck: args.k !== undefined ? cofg.ijkabsolute(lastLine.z, args.k) : lastLine.z,
        arcr: args.r ? args.r : null,
      };

      newLine.g2 = true;
      newLine.clockwise = true;
      if (args.clockwise === false) newLine.clockwise = args.clockwise;
      if (args.g3 === true) {
        newLine.g3 = true;
        newLine.g2 = false;
      }
      cofg.addSegment(lastLine, newLine, args);
      lastLine = newLine;
    },
    G3: function (args, indx, gcp) {
      // this is an arc move from lastLine's xy to the new xy. same
      // as G2 but reverse
      args.g3 = true;
      args.clockwise = false;
      gcp.handlers.G2(args, indx, gcp);
    },

    G73: function (args, indx, gcp) {
      // peck drilling. just treat as g1
      console.log("G73 gcp:", gcp);
      gcp.handlers.G1(args);
    },

    G92: function (args) { // E0
      // G92: Set Position
      // Example: G92 E0
      // Allows programming of absolute zero point, by reseting the
      // current position to the values specified. This would set the
      // machine's X coordinate to 10, and the extrude coordinate to 90.
      // No physical motion will occur.

      // TODO: Only support E0
      var newLine = lastLine;

      cofg.offsetG92.x = (args.x !== undefined ? (args.x === 0 ? newLine.x : newLine.x - args.x) : 0);
      cofg.offsetG92.y = (args.y !== undefined ? (args.y === 0 ? newLine.y : newLine.y - args.y) : 0);
      cofg.offsetG92.z = (args.z !== undefined ? (args.z === 0 ? newLine.z : newLine.z - args.z) : 0);
      cofg.offsetG92.e = (args.e !== undefined ? (args.e === 0 ? newLine.e : newLine.e - args.e) : 0);

      cofg.addFakeSegment(args);
    },
    M30: function (args) {
      cofg.addFakeSegment(args);
    },

    'default': function (args, info) {
      // if (!args.isComment)
      // console.log('Unknown command:', args.cmd, args, info);
      cofg.addFakeSegment(args);
    },
  },
    // Mode-setting non-motion commands, of which many may appear on one line
    // These take no arguments
    {
      G17: function () {
        console.log("SETTING XY PLANE");
        plane = "G17";
      },

      G18: function () {
        console.log("SETTING XZ PLANE");
        plane = "G18";
      },

      G19: function () {
        console.log("SETTING YZ PLANE");
        plane = "G19";
      },

      G20: function () {
        // G21: Set Units to Inches
        // We don't really have to do anything since 3d viewer is unit agnostic
        // However, we need to set a global property so the trinket decorations
        // like toolhead, axes, grid, and extent labels are scaled correctly
        // later on when they are drawn after the gcode is rendered
        cofg.setUnits("inch");
      },

      G21: function () {
        // G21: Set Units to Millimeters
        // Example: G21
        // Units from now on are in millimeters. (This is the RepRap default.)
        cofg.setUnits("mm");
      },

      // A bunch of no-op modes that do not affect the viewer
      G40: function () { }, // Tool radius compensation off
      G41: function () { }, // Tool radius compensation left
      G42: function () { }, // Tool radius compensation right
      G45: function () { }, // Axis offset single increase
      G46: function () { }, // Axis offset single decrease
      G47: function () { }, // Axis offset double increase
      G48: function () { }, // Axis offset double decrease
      G49: function () { }, // Tool length offset compensation cancle
      G54: function () { }, // Select work coordinate system 1
      G55: function () { }, // Select work coordinate system 2
      G56: function () { }, // Select work coordinate system 3
      G57: function () { }, // Select work coordinate system 4
      G58: function () { }, // Select work coordinate system 5
      G59: function () { }, // Select work coordinate system 6
      G61: function () { }, // Exact stop check mode
      G64: function () { }, // Cancel G61
      G69: function () { }, // Cancel G68

      G90: function () {
        // G90: Set to Absolute Positioning
        // Example: G90
        // All coordinates from now on are absolute relative to the
        // origin of the machine. (This is the RepRap default.)
        relative = false;
      },

      'G90.1': function () {
        // G90.1: Set to Arc Absolute IJK Positioning
        // Example: G90.1
        // From now on, arc centers are specified directly by
        // the IJK parameters, e.g. center_x = I_value
        // This is Mach3-specific
        ijkrelative = false;
      },

      G91: function () {
        // G91: Set to Relative Positioning
        // Example: G91
        // All coordinates from now on are relative to the last position.
        relative = true;
      },

      'G91.1': function () {
        // G91.1: Set to Arc Relative IJK Positioning
        // Example: G91.1
        // From now on, arc centers are relative to the starting
        // coordinate, e.g. center_x = this_x + I_value
        // This is the default, and the only possibility for most
        // controllers other than Mach3
        ijkrelative = true;
      },

      // No-op modal macros that do not affect the viewer
      M07: function () { }, // Coolant on (mist)
      M08: function () { }, // Coolant on (flood)
      M09: function () { }, // Coolant off
      M10: function () { }, // Pallet clamp on
      M11: function () { }, // Pallet clamp off
      M21: function () { }, // Mirror X axis
      M22: function () { }, // Mirror Y axis
      M23: function () { }, // Mirror off
      M24: function () { }, // Thread pullout gradual off
      M41: function () { }, // Select gear 1
      M42: function () { }, // Select gear 2
      M43: function () { }, // Select gear 3
      M44: function () { }, // Select gear 4
      M48: function () { }, // Allow feedrate override
      M49: function () { }, // Disallow feedrate override
      M52: function () { }, // Empty spindle
      M60: function () { }, // Automatic pallet change

      M82: function () {
        // M82: Set E codes absolute (default)
        // Descriped in Sprintrun source code.

        // No-op, so long as M83 is not supported.
      },

      M84: function () {
        // M84: Stop idle hold
        // Example: M84
        // Stop the idle hold on all axis and extruder. In some cases the
        // idle hold causes annoying noises, which can be stopped by
        // disabling the hold. Be aware that by disabling idle hold during
        // printing, you will get quality issues. This is recommended only
        // in between or after printjobs.

        // No-op
      },
    });


  parser.parse(gcode);

  console.log("Inside creatGcodeFromObject. this:", this);

  var object = new THREE.Object3D();

  // Draw using the lineGeo combines geometry
  // the function  below of using different layers is just not performant enough
  // with large gcode models
  var lineMaterial = new THREE.LineBasicMaterial({
    color: 0xffffff,
    opacity: 1.0,
    transparent: true,
    linewidth: 1,
    vertexColors: THREE.FaceColors
  });

  // For some reason the Three.Line seems faster than using the convertLineGeometryToBufferGeometryColors
  // var bufferGeo = this.convertLineGeometryToBufferGeometryColors(lineGeo);
  // var allLines = new THREE.Line(bufferGeo, lineMaterial);
  var allLines = new THREE.Line(lineGeo, lineMaterial);
  object.add(allLines);

  // https://stackoverflow.com/questions/19221527/three-js-how-to-draw-a-discontinuous-line-using-buffergeometry
  // https://stackoverflow.com/questions/41302840/when-drawing-a-three-js-buffergeometry-lines-colors-dont-stick-to-segments

  // draw all segments
  console.log("Layer Count ", layers.length);
  for (var lid in layers) {
    var layer = layers[lid];
    console.log("Processing layer: ", layer.layer);

    for (var gid in layer.geometries) {
      var cmd = layer.geometries[gid];
      var type = cmd.type;
      var geometry = cmd.geometry;
      var group = layer.type[type];

      // using buffer geometry
      var bufferGeo = this.convertLineGeometryToBufferGeometry(geometry, group.color);

      // var tmp = new THREE.LineSegments(bufferGeo, group.material)
      var tmp = new THREE.Line(bufferGeo, group.material)

      switch (group.plane) {
        case "G18":
          tmp.rotateOnAxis(new THREE.Vector3(1, 0, 0), Math.PI / 2);
          break;
        case "G19":
          tmp.rotateOnAxis(new THREE.Vector3(1, 0, 0), Math.PI / 2);
          tmp.rotateOnAxis(new THREE.Vector3(0, 1, 0), Math.PI / 2);
          break;
        default:
      }

      // make sure to compute line distaces when using dashed material
      tmp.computeLineDistances();
      object.add(tmp);
    }
  }


  // use new approach of building 3d object where each
  // gcode line is its own segment with its own userData

  console.log("bbox ", bbbox);

  // Center
  var scale = 1; // TODO: Auto size

  var center = new THREE.Vector3(
    bbbox.min.x + ((bbbox.max.x - bbbox.min.x) / 2),
    bbbox.min.y + ((bbbox.max.y - bbbox.min.y) / 2),
    bbbox.min.z + ((bbbox.max.z - bbbox.min.z) / 2));
  console.log("center ", center);

  var center2 = new THREE.Vector3(
    bbbox2.min.x + ((bbbox2.max.x - bbbox2.min.x) / 2),
    bbbox2.min.y + ((bbbox2.max.y - bbbox2.min.y) / 2),
    bbbox2.min.z + ((bbbox2.max.z - bbbox2.min.z) / 2));
  console.log("center2 of all gcode ", center2);

  // store meta data in userData of object3d for later use like in animation
  // of toolhead
  object.userData.bbbox2 = bbbox2;
  object.userData.lines = lines; // used by the simulator
  object.userData.layers = layers;
  object.userData.center2 = center2;
  object.userData.inspect3dObj = inspect3dObj; // used for the inspect method

  console.log("userData for this object3d:", object.userData);
  console.log("final object:", object);

  return object;
}

function convertLineGeometryToBufferGeometry(lineGeometry, color) {

  var positions = new Float32Array(lineGeometry.vertices.length * 3);
  var colors = new Float32Array(lineGeometry.vertices.length * 3);

  var geometry = new THREE.BufferGeometry();

  for (var i = 0; i < lineGeometry.vertices.length; i++) {

    var x = lineGeometry.vertices[i].x;
    var y = lineGeometry.vertices[i].y;
    var z = lineGeometry.vertices[i].z;

    // positions
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    // colors
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));

  return geometry;
}

function convertLineGeometryToBufferGeometryColors(lineGeometry) {

  var positions = new Float32Array(lineGeometry.vertices.length * 3);
  var colors = new Float32Array(lineGeometry.vertices.length * 3);

  var geometry = new THREE.BufferGeometry();

  for (var i = 0; i < lineGeometry.vertices.length; i++) {

    // positions
    positions[i * 3] = lineGeometry.vertices[i].x;
    positions[i * 3 + 1] = lineGeometry.vertices[i].y;
    positions[i * 3 + 2] = lineGeometry.vertices[i].z;

    // colors
    colors[i * 3] = lineGeometry.colors[i].r;
    colors[i * 3 + 1] = lineGeometry.colors[i].g;
    colors[i * 3 + 2] = lineGeometry.colors[i].b;
  }

  geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));

  return geometry;
}
