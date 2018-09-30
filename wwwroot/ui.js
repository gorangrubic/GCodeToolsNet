var axes = null; // global property to store axes that we drew

var tween = null;
var tweenHighlight = null;
var tweenIndex = null;
var tweenSpeed = 1;
var tweenPaused = false;
var tweenIsPlaying = false;

var gridSize = 1; // global property for size of grid. default to 1 (shapeoko rough size)
var decorate = null; // stores the decoration 3d objects
var bboxHelper = null;
var showShadow = false;

var toolhead = null;
var shadowplane = null;

var zheighttest = 0; // test toolhead going up in z
var mytimeout = null;
var renderFrameCtr = 0; // keep track of fps
var fpsCounterInterval = null;
var fpsEl = null;
var animEnable = true; // boolean tracking whether we allow animation

// 200 = 5fps, 100 = 10fps, 70=15fps, 50=20fps, 40=25fps, 30=30fps
var frameRateDelayMs = 32;
var isNoSleepMode = false;

function loadFile(path, callback) {
  $.get(path, null, callback, 'text');
}

function error(msg) {
  alert(msg);
}

function openGCodeFromPath(path) {
  var that = this;
  if (that.object) {
    this.stopSampleRun();
    that.scene.remove(that.object);
  }
  that.loadFile(path, function (gcode) {
    that.object = that.createObjectFromGCode(gcode);
    that.scene.add(that.object);
    that.viewExtents();
    that.drawAxesToolAndExtents();
    that.onUnitsChanged();
    localStorage.setItem('last-loaded', path);
    localStorage.removeItem('last-imported');
  });

  // fire off Dat Chu's scene reload signal
  //that.onSignalSceneReloaded();
}

function openGCodeFromText(gcode) {
  console.log("openGcodeFromText");
  this.wakeAnimate();
  if (this.object) {
    this.stopSampleRun();
    this.scene.remove(this.object);
  }

  this.object = this.createObjectFromGCode(gcode);
  console.log("done creating object:", this.object);
  this.scene.add(this.object);
  this.viewExtents();
  this.drawAxesToolAndExtents();
  this.onUnitsChanged();
  this.setDetails(this.object.userData.lines.length + " GCode Lines");
  this.wakeAnimate();

  // we can get a QuotaExceededError here, so catch it
  try {
    // remove old 1st to perhaps make more room for quota check
    localStorage.removeItem('last-imported');
    // now set
    localStorage.setItem('last-imported', gcode);
  } catch (e) {
    if (e.name === 'QUOTA_EXCEEDED_ERR' || e.name == "QuotaExceededError" || e.code == 22 || e.name == "NS_ERROR_DOM_QUOTA_REACHED" || e.code == 1014) {
      // show err dialog
      console.error("3D Viewer Widget. out of local storage space, but letting user proceed. err:", e);
      // $('#3dviewer-outofspace').modal();
    } else {
      console.error("3D Viewer Widget. got err with localStorage:", e);
    }
  }
  localStorage.removeItem('last-loaded');

  // fire off Dat Chu's scene reload signal
  // this.onSignalSceneReloaded();
}

function resize() {
  //console.log("got resize event. resetting aspect ratio.");
  this.renderer.setSize(this.element.width(), this.element.height());
  this.camera.aspect = this.element.width() / this.element.height();
  this.camera.updateProjectionMatrix();
  this.controls.screen.width = window.innerWidth;
  this.controls.screen.height = window.innerHeight;
  this.wakeAnimate();
}

function sceneAdd(obj) {
  console.log("sceneAdd. obj:", obj);
  this.wakeAnimate();
  this.scene.add(obj);
}

function sceneRemove(obj) {
  console.log("sceneRemove. obj:", obj);
  this.wakeAnimate();
  if (obj && 'traverse' in obj) {
    this.scene.remove(obj);
    obj.traverse(function (child) {
      if (child.geometry !== undefined) {
        child.geometry.dispose();
        child.material.dispose();
      }
    });
  }
}

function sceneClear() {
  this.stopSampleRun();
  this.wakeAnimate();
  this.object.children = [];
  this.sceneRemove(this.decorate);
}

function drawToolhead() {

  console.group("drawToolhead");

  // remove grid if drawn previously
  if (this.toolhead != null) {
    console.log("there was a previous toolhead. remove it. toolhead:", this.toolhead, "shadowplane:", this.shadowplane);
    if (this.shadowplane != null) {
      console.log("removing shadowplane and setting null");
      this.sceneRemove(this.shadowplane);
      this.shadowplane = null;
    }
    this.sceneRemove(this.toolhead);
  } else {
    console.log("no previous toolhead or shadowplane.");
  }

  // TOOLHEAD WITH SHADOW
  var toolheadgrp = new THREE.Object3D();

  // SHADOWS
  if (this.showShadow) {
    var light = new THREE.DirectionalLight(0xffffff);
    light.position.set(0, 60, 60);
    light.castShadow = true;
    light.onlyShadow = true;
    light.shadowDarkness = 0.05;

    // these six values define the boundaries of the yellow box seen above
    light.shadowCameraNear = 0;
    light.shadowCameraFar = this.getUnitVal(1000);
    light.shadowCameraLeft = this.getUnitVal(-5);
    light.shadowCameraRight = this.getUnitVal(5);
    light.shadowCameraTop = 0;
    light.shadowCameraBottom = this.getUnitVal(-35);
    toolheadgrp.add(light);

    var light2 = light.clone();
    light2.position.set(60, 0, 60);
    light2.shadowCameraLeft = 0; //-5;
    light2.shadowCameraRight = this.getUnitVal(-35); //5;
    light2.shadowCameraTop = this.getUnitVal(-5); //0;
    light2.shadowCameraBottom = this.getUnitVal(5); //-35;
    light2.shadowDarkness = 0.03;
    toolheadgrp.add(light2);
  }

  // ToolHead Cylinder
  // API: THREE.CylinderGeometry(bottomRadius, topRadius, height, segmentsRadius, segmentsHeight)
  var cylinder = new THREE.Mesh(new THREE.CylinderGeometry(0, 5, 40, 15, 1, false), new THREE.MeshNormalMaterial());
  cylinder.overdraw = true;
  cylinder.rotation.x = -90 * Math.PI / 180;
  cylinder.position.z = 20;
  cylinder.material.opacity = 0.3;
  cylinder.material.transparent = true;
  cylinder.castShadow = true;
  console.log("toolhead cone:", cylinder);

  toolheadgrp.add(cylinder);

  if (this.showShadow) {
    // mesh plane to receive shadows
    var planeFragmentShader = [

      "uniform vec3 diffuse;",
      "uniform float opacity;",

      THREE.ShaderChunk["shadowmap_pars_fragment"],

      "void main() {",

      "gl_FragColor = vec4( 1.0, 1.0, 1.0, 1.0 );",

      THREE.ShaderChunk["shadowmap_fragment"],

      "gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 - shadowColor.x );",

      "}"

    ].join("\n");

    var planeMaterial = new THREE.ShaderMaterial({
      uniforms: THREE.ShaderLib['basic'].uniforms,
      vertexShader: THREE.ShaderLib['basic'].vertexShader,
      fragmentShader: planeFragmentShader,
      color: 0x0000FF, transparent: true
    });

    var planeW = 50; // pixels
    var planeH = 50; // pixels 
    var numW = 50; // how many wide (50*50 = 2500 pixels wide)
    var numH = 50; // how many tall (50*50 = 2500 pixels tall)
    var plane = new THREE.Mesh(new THREE.PlaneGeometry(planeW * 50, planeH * 50, planeW, planeH), new THREE.MeshLambertMaterial({ color: 0xffffff, wireframe: false, transparent: true, opacity: 0.5 }));
    var plane = new THREE.Mesh(new THREE.PlaneGeometry(planeW * 50, planeH * 50, planeW, planeH), planeMaterial);
    plane.position.z = 0;
    plane.receiveShadow = true;

    console.log("toolhead plane:", plane);
  }

  // scale the whole thing to correctly match mm vs inches
  var scale = this.getUnitVal(1);
  if (this.showShadow) plane.scale.set(scale, scale, scale);
  toolheadgrp.scale.set(scale, scale, scale);

  this.toolhead = toolheadgrp;
  if (this.showShadow) {
    this.shadowplane = plane;
    this.sceneAdd(this.shadowplane);
  }
  this.sceneAdd(this.toolhead);

  console.groupEnd();

}

function gridTurnOff() {
  if (this.grid != null) {
    console.log("there was a previous grid. remove it. grid:", this.grid);
    this.sceneRemove(this.grid);
  } else {
    console.log("no previous grid.");
  }
}

function gridTurnOn() {
  if (this.grid != null) {
    console.log("there was a previous grid. so ignoring request to turn on. grid:", this.grid);
  } else {
    console.log("no previous grid. so drawing.");
    this.drawGrid();
  }
}

function drawGrid() {

  // remove grid if drawn previously
  if (this.grid != null) {
    console.log("there was a previous grid. remove it. grid:", this.grid);
    this.sceneRemove(this.grid);
  } else {
    console.log("no previous grid.");
  }

  // will get mm or inches for grid
  var widthHeightOfGrid;
  var subSectionsOfGrid;
  if (this.isUnitsMm) {
    widthHeightOfGrid = 200; // 200 mm grid should be reasonable
    subSectionsOfGrid = 10; // 10mm (1 cm) is good for mm work
  } else {
    widthHeightOfGrid = 20; // 20 inches is good
    subSectionsOfGrid = 1; // 1 inch grid is nice
  }

  // TODO: for some reason we have to multiply both of them to work properly?!
  widthHeightOfGrid = widthHeightOfGrid * 2;
  subSectionsOfGrid = subSectionsOfGrid * 4;

  // see if user wants to size up grid. default is size 1
  // so this won't modify size based on default
  widthHeightOfGrid = widthHeightOfGrid * this.gridSize;

  // draw grid
  var helper = new THREE.GridHelper(widthHeightOfGrid, subSectionsOfGrid, 0x0000ff, 0x808080);
  helper.position.y = 0;
  helper.position.x = 0;
  helper.position.z = 0;
  helper.rotation.x = 90 * Math.PI / 180;
  helper.material.opacity = 0.15;
  helper.material.transparent = true;
  helper.receiveShadow = false;
  console.log("helper grid:", helper);
  this.grid = helper;
  this.sceneAdd(this.grid);
}

function drawExtentsLabels() {
  this.decorateExtents();
}

function drawAxes() {

  // remove axes if they were drawn previously
  if (this.axes != null) {
    console.log("there was a previous axes. remove it. axes:", this.axes);
    this.sceneRemove(this.axes);
  } else {
    console.log("no previous axes to remove. cool.");
  }

  // axes
  var axesgrp = new THREE.Object3D();

  axes = new THREE.AxesHelper(this.getUnitVal(100));
  axes.material.transparent = true;
  axes.material.opacity = 0.8;
  axes.material.depthWrite = false;
  axes.position.set(0, 0, -0.0001);
  axesgrp.add(axes);

  // add axes labels
  var xlbl = this.makeSprite(this.scene, "webgl", {
    x: this.getUnitVal(110),
    y: 0,
    z: 0,
    text: "X",
    color: "#ff0000"
  });
  var ylbl = this.makeSprite(this.scene, "webgl", {
    x: 0,
    y: this.getUnitVal(110),
    z: 0,
    text: "Y",
    color: "#00ff00"
  });
  var zlbl = this.makeSprite(this.scene, "webgl", {
    x: 0,
    y: 0,
    z: this.getUnitVal(110),
    text: "Z",
    color: "#0000ff"
  });

  axesgrp.add(xlbl);
  axesgrp.add(ylbl);
  axesgrp.add(zlbl);
  this.axes = axesgrp;
  this.sceneAdd(this.axes);
}

function makeText(vals) {
  var shapes, geom, mat, mesh;

  geom = new THREE.TextGeometry(vals.text, {
    font: font,
    size: vals.size ? vals.size : 10,
    height: 0.1,
    curveSegments: 12,
    bevelEnabled: false
  });

  mat = new THREE.MeshBasicMaterial({
    color: vals.color,
    transparent: true,
    opacity: vals.opacity ? vals.opacity : 0.5,
  });

  mesh = new THREE.Mesh(geom, mat);
  mesh.position.x = vals.x;
  mesh.position.y = vals.y;
  mesh.position.z = vals.z;

  return mesh;
}

function decorateExtents() {

  // remove grid if drawn previously
  if (this.decorate != null) {
    console.log("there was a previous extent decoration. remove it. grid:", this.decorate);
    this.sceneRemove(this.decorate);
  } else {
    console.log("no previous decorate extents.");
  }

  // get its bounding box
  console.log("about to do THREE.BoxHelper on this.object:", this.object);
  var helper = new THREE.BoxHelper(this.object, 0xff0000);
  helper.update();
  helper.geometry.computeBoundingBox();
  this.bboxHelper = helper;

  // If you want a visible bounding box
  // this.scene.add(helper);
  console.log("helper bbox:", helper);

  var color = '#0d0d0d';

  var material = new THREE.LineDashedMaterial({
    vertexColors: false,
    color: color,
    dashSize: this.getUnitVal(1),
    gapSize: this.getUnitVal(1),
    linewidth: 1,
    transparent: true,
    opacity: 0.3,
  });

  // Create X axis extents sprite
  var z = 0;
  var offsetFromY = this.getUnitVal(-4); // this means we'll be below the object by this padding
  var lenOfLine = this.getUnitVal(5);
  var minx = helper.geometry.boundingBox.min.x;
  var miny = helper.geometry.boundingBox.min.y;
  var maxx = helper.geometry.boundingBox.max.x;
  var maxy = helper.geometry.boundingBox.max.y;
  var minz = helper.geometry.boundingBox.min.z;
  var maxz = helper.geometry.boundingBox.max.z;

  var lineGeo = new THREE.Geometry();
  lineGeo.vertices.push(
    new THREE.Vector3(minx, miny + offsetFromY, z),
    new THREE.Vector3(minx, miny + offsetFromY - lenOfLine, z),
    new THREE.Vector3(minx, miny + offsetFromY - lenOfLine, z),
    new THREE.Vector3(maxx, miny + offsetFromY - lenOfLine, z),
    new THREE.Vector3(maxx, miny + offsetFromY - lenOfLine, z),
    new THREE.Vector3(maxx, miny + offsetFromY, z)
  );

  var line = new THREE.Line(lineGeo, material, THREE.LineSegments);
  line.computeLineDistances();
  line.type = THREE.Lines;

  // Draw text label of length
  var txt = "X " + (maxx - minx).toFixed(2);
  txt += (this.isUnitsMm) ? " mm" : " in";
  var txtX = this.makeText({
    x: minx + this.getUnitVal(1),
    y: miny + offsetFromY - lenOfLine - this.getUnitVal(3),
    z: z,
    text: txt,
    color: color,
    opacity: 0.3,
    size: this.getUnitVal(2)
  });

  // Create Y axis extents sprite
  var offsetFromX = this.getUnitVal(-4); // this means we'll be below the object by this padding

  var lineGeo2 = new THREE.Geometry();
  lineGeo2.vertices.push(
    new THREE.Vector3(minx + offsetFromX, miny, z),
    new THREE.Vector3(minx + offsetFromX - lenOfLine, miny, z),
    new THREE.Vector3(minx + offsetFromX - lenOfLine, miny, z),
    new THREE.Vector3(minx + offsetFromX - lenOfLine, maxy, z),
    new THREE.Vector3(minx + offsetFromX - lenOfLine, maxy, z),
    new THREE.Vector3(minx + offsetFromX, maxy, z)
  );

  var line2 = new THREE.Line(lineGeo2, material, THREE.LineSegments);
  line2.computeLineDistances();
  line2.type = THREE.Lines;

  // Draw text label of length
  var txt = "Y " + (maxy - miny).toFixed(2);
  txt += (this.isUnitsMm) ? " mm" : " in";
  var txtY = this.makeText({
    x: minx + offsetFromX - lenOfLine,
    y: miny - this.getUnitVal(3),
    z: z,
    text: txt,
    color: color,
    opacity: 0.3,
    size: this.getUnitVal(2)
  });

  var zlineGeo = new THREE.Geometry();
  var lenEndCap = this.getUnitVal(2);
  zlineGeo.vertices.push(
    new THREE.Vector3(maxx, miny, minz),
    new THREE.Vector3(maxx + lenOfLine, miny, minz),
    new THREE.Vector3(maxx + lenOfLine, miny, minz),
    new THREE.Vector3(maxx + lenOfLine, miny, maxz),
    new THREE.Vector3(maxx + lenOfLine, miny, maxz),
    new THREE.Vector3(maxx, miny, maxz)
  );

  var zline = new THREE.Line(zlineGeo, material, THREE.LineSegments);
  zline.computeLineDistances();
  zline.type = THREE.Lines;

  // Draw text label of z height
  var txt = "Z " + (maxz - minz).toFixed(2);
  txt += (this.isUnitsMm) ? " mm" : " in";
  var txtZ = this.makeText({
    x: maxx + offsetFromX + lenOfLine,
    y: miny - this.getUnitVal(3),
    z: z,
    text: txt,
    color: color,
    opacity: 0.3,
    size: this.getUnitVal(2)
  });

  // Rotating mesh by 90 degree in X axis.     
  // txtZ.rotateX(Math.PI / 2);
  txtZ.rotation.x = Math.PI / 2;

  var v = txtZ.position;
  txtZ.position.set(v.x + this.getUnitVal(5), v.y + this.getUnitVal(3), v.z);

  // draw lines on X axis to represent width
  // create group to put everything into
  this.decorate = new THREE.Object3D();
  this.decorate.add(line);
  this.decorate.add(txtX);
  this.decorate.add(line2);
  this.decorate.add(txtY);
  this.decorate.add(zline);
  this.decorate.add(txtZ);

  // Add estimated time and distance
  var ud = this.object.userData.lines;
  var udLastLine = ud[ud.length - 1].p2;
  //console.log("lastLine:", udLastLine, "userData:", ud, "this.object:", this.object);
  // use last array value of userData cuz it keeps a running total of time
  // and distance

  // get pretty print of time
  var ret = this.convertMinsToPrettyDuration(udLastLine.timeMinsSum);

  var txt = "Estimated Time: " + ret + ","
    + " Total Distance: " + (udLastLine.distSum).toFixed(2);
  txt = (this.isUnitsMm) ? txt + " mm" : txt + " in";

  var txtTimeDist = this.makeText({
    x: minx + this.getUnitVal(1),
    y: miny + offsetFromY - lenOfLine - this.getUnitVal(6),
    z: z,
    text: txt,
    color: color,
    opacity: 0.3,
    size: this.getUnitVal(2)
  });
  this.decorate.add(txtTimeDist);

  this.sceneAdd(this.decorate);
  console.log("just added decoration:", this.decorate);
}

function convertMinsToPrettyDuration(mins) {
  // Minutes and seconds
  var time = mins * 60;
  //var mins = ~~(time / 60);
  //var secs = time % 60;

  // Hours, minutes and seconds
  var hrs = ~~(time / 3600);
  var mins = ~~((time % 3600) / 60);
  var secs = time % 60;

  // Output like "1:01" or "4:03:59" or "123:03:59"
  ret = "";

  if (hrs > 0)
    ret += "" + hrs + "h " + (mins < 10 ? "0" : "");

  ret += "" + mins + "m " + (secs < 10 ? "0" : "");
  ret += "" + secs.toFixed(0) + "s";
  return ret;
}

function makeSprite(scene, rendererType, vals) {
  var canvas = document.createElement('canvas'),
    context = canvas.getContext('2d'),
    metrics = null,
    textHeight = 100,
    textWidth = 0,
    actualFontSize = this.getUnitVal(10);

  var txt = vals.text;
  if (vals.size) actualFontSize = vals.size;

  context.font = "normal " + textHeight + "px Arial";
  metrics = context.measureText(txt);
  var textWidth = metrics.width;

  canvas.width = textWidth;
  canvas.height = textHeight;
  context.font = "normal " + textHeight + "px Arial";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = vals.color;

  context.fillText(txt, textWidth / 2, textHeight / 2);

  var texture = new THREE.Texture(canvas);
  texture.needsUpdate = true;

  var material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0.6
  });

  var textObject = new THREE.Object3D();
  textObject.position.x = vals.x;
  textObject.position.y = vals.y;
  textObject.position.z = vals.z;

  var sprite = new THREE.Sprite(material);
  textObject.textHeight = actualFontSize;
  textObject.textWidth = (textWidth / textHeight) * textObject.textHeight;

  if (rendererType == "2d") {
    sprite.scale.set(textObject.textWidth / textWidth, textObject.textHeight / textHeight, 1);
  } else {
    sprite.scale.set(textWidth / textHeight * actualFontSize, actualFontSize, 1);
  }

  textObject.add(sprite);

  return textObject;
}

function getInchesFromMm(mm) {
  return mm * 0.0393701;
}

function getUnitVal(val) {
  // if drawing units is mm just return cuz default
  if (this.isUnitsMm) return val;

  // if drawing is in inches convert
  return this.getInchesFromMm(val);
}

function drawAxesToolAndExtents() {
  // these are drawn after the gcode is rendered now
  // so we can see if in inch or mm mode
  // these items scale based on that mode
  this.drawToolhead();
  this.drawGrid();
  this.drawExtentsLabels();
  this.drawAxes();
}

function viewExtents() {
  console.log("viewExtents. object.userData:", this.object.userData);
  console.log("controls:", this.controls);
  this.wakeAnimate();

  // lets override the bounding box with a newly
  // generated one
  // get its bounding box
  var helper = new THREE.BoxHelper(this.object, 0xff0000);
  helper.update();
  helper.geometry.computeBoundingBox();
  this.bboxHelper = helper;

  // If you want a visible bounding box
  //this.scene.add(this.bboxHelper);
  console.log("helper bbox:", helper);

  var minx = helper.geometry.boundingBox.min.x;
  var miny = helper.geometry.boundingBox.min.y;
  var maxx = helper.geometry.boundingBox.max.x;
  var maxy = helper.geometry.boundingBox.max.y;
  var minz = helper.geometry.boundingBox.min.z;
  var maxz = helper.geometry.boundingBox.max.z;

  var ud = this.object.userData;
  ud.bbox2 = helper.box;
  ud.center2.x = minx + ((maxx - minx) / 2);
  ud.center2.y = miny + ((maxy - miny) / 2);
  ud.center2.z = minz + ((maxz - minz) / 2);

  this.controls.reset();

  // get max of any of the 3 axes to use as max extent
  var lenx = maxx - minx;
  var leny = maxy - miny;
  var lenz = maxz - minz;
  console.log("lenx:", lenx, "leny:", leny, "lenz:", lenz);

  var maxBeforeWarnX = 50;
  var maxBeforeWarnY = 50;
  var maxBeforeWarnZ = 50;

  if (lenx > maxBeforeWarnX || leny > maxBeforeWarnY || lenz > maxBeforeWarnZ) {
    // alert("too big!");
  }

  var maxlen = Math.max(lenx, leny, lenz);
  var dist = 2 * maxlen;

  // center camera on gcode objects center pos, but twice the maxlen
  this.controls.object.position.x = ud.center2.x;
  this.controls.object.position.y = ud.center2.y;
  this.controls.object.position.z = ud.center2.z + dist;
  this.controls.target.x = ud.center2.x;
  this.controls.target.y = ud.center2.y;
  this.controls.target.z = ud.center2.z;
  console.log("maxlen:", maxlen, "dist:", dist);

  var fov = 2.2 * Math.atan(maxlen / (2 * dist)) * (180 / Math.PI);
  console.log("new fov:", fov, " old fov:", this.controls.object.fov);
  if (isNaN(fov)) {
    console.log("giving up on viewing extents because fov could not be calculated");
    return;
  }
  this.controls.object.fov = fov;

  var L = dist;
  var camera = this.controls.object;
  var vector = controls.target.clone();
  var l = (new THREE.Vector3()).subVectors(camera.position, vector).length();
  var up = camera.up.clone();
  var quaternion = new THREE.Quaternion();

  // Zoom correction
  camera.translateZ(L - l);
  console.log("up:", up);
  up.y = 1; up.x = 0; up.z = 0;
  quaternion.setFromAxisAngle(up, 0.5);

  up.y = 0; up.x = 1; up.z = 0;
  quaternion.setFromAxisAngle(up, 0.5);
  camera.position.applyQuaternion(quaternion);
  up.y = 0; up.x = 0; up.z = 1;
  quaternion.setFromAxisAngle(up, 0.5);

  camera.lookAt(vector);

  this.controls.object.updateProjectionMatrix();
}

function stopSampleRun(evt) {
  console.log("stopSampleRun. tween:", this.tween);
  this.tweenIsPlaying = false;

  if (this.tweenHighlight) this.scene.remove(this.tweenHighlight);
  if (this.tween) this.tween.stop();

  $('menu-samplerun').prop('disabled', false);
  $('menu-samplerunstop').prop('disabled', true);
  $('menu-samplerunstop').popover('hide');
  this.animAllowSleep();
}

function pauseSampleRun() {
  console.log("pauseSampleRun");
  if (this.tweenPaused) {
    // the tween was paused, it's being non-paused
    console.log("unpausing tween");
    this.animNoSleep();
    this.tweenIsPlaying = true;
    this.tweenPaused = false;
    this.playNextTween();
  } else {
    console.log("pausing tween on next playNextTween()");
    this.tweenIsPlaying = false;
    this.tweenPaused = true;
    this.animAllowSleep();
  }
}

function gotoXyz(data) {
  // we are sent this command by the CNC controller generic interface
  console.log("gotoXyz. data:", data);
  this.animNoSleep();
  this.tweenIsPlaying = false;
  this.tweenPaused = true;

  if ('x' in data && data.x != null) this.toolhead.position.x = data.x;
  if ('y' in data && data.y != null) this.toolhead.position.y = data.y;
  if ('z' in data && data.z != null) this.toolhead.position.z = data.z;
  if (this.showShadow) {
    this.toolhead.children[0].target.position.set(this.toolhead.position.x, this.toolhead.position.y, this.toolhead.position.z);
    this.toolhead.children[1].target.position.set(this.toolhead.position.x, this.toolhead.position.y, this.toolhead.position.z);
  }
  this.lookAtToolHead();

  // see if jogging, if so rework the jog tool
  // double check that our jog 3d object is defined
  // cuz on early load we can get here prior to the
  // jog cylinder and other objects being defined
  if (this.isJogSelect && this.jogArrowCyl) {
    if ('z' in data && data.z != null) {
      console.log("adjusting jog tool:", this.jogArrow);
      var cyl = this.jogArrowCyl; //.children[0];
      var line = this.jogArrowLine; //.children[2];
      var shadow = this.jogArrowShadow; //.children[3];
      var posZ = data.z * 3; // acct for scale
      cyl.position.setZ(posZ + 20);
      console.log("line:", line.geometry.vertices);
      line.geometry.vertices[1].z = posZ; // 2nd top vertex
      line.geometry.verticesNeedUpdate = true;
      shadow.position.setX(posZ * -1); // make x be z offset
    }
  }

  this.animAllowSleep();
}

function gotoLine(data) {
  // this method is sort of like playNextTween, but we are jumping to a specific
  // line based on the gcode sender
  console.log("got gotoLine. data:", data);

  this.animNoSleep();
  this.tweenIsPlaying = false;
  this.tweenPaused = true;

  var lines = this.object.userData.lines;
  console.log("userData.lines:", lines[data.line]);
  var curLine = lines[data.line];
  var curPt = curLine.p2;

  console.log("p2 for toolhead move. curPt:", curPt);
  this.toolhead.position.x = curPt.x;
  this.toolhead.position.y = curPt.y;
  this.toolhead.position.z = curPt.z;

  if (this.showShadow) {
    this.toolhead.children[0].target.position.set(this.toolhead.position.x, this.toolhead.position.y, this.toolhead.position.z);
    this.toolhead.children[1].target.position.set(this.toolhead.position.x, this.toolhead.position.y, this.toolhead.position.z);
  }

  this.lookAtToolHead();
  this.animAllowSleep();

  /* GOOD STUFF BUT IF DON'T WANT ANIM*/
  if (this.tweenHighlight) this.scene.remove(this.tweenHighlight);
  if (this.tween) this.tween.stop();
  if (data.anim && data.anim == "anim") {
    console.log("being asking to animate gotoline");
    this.animNoSleep();
    this.tweenPaused = false;
    this.tweenIsPlaying = true;
    this.tweenIndex = data.line;
    this.playNextTween(true);
  }
}

function playNextTween(isGotoLine) {

  if (this.tweenPaused) return;

  var that = this;
  var lines = this.object.userData.lines;
  if (this.tweenIndex + 1 > lines.length - 1) {
    // done tweening
    console.log("Done with tween");
    this.stopSampleRun();
    return;
  }

  var lineMat = new THREE.LineBasicMaterial({
    color: 0xff0000,
    lineWidth: 1,
    transparent: true,
    opacity: 1,
  });

  // find next correct tween, i.e. ignore fake commands
  var isLooking = true;
  var indxStart = this.tweenIndex + 1;

  //console.log("starting while loop");
  while (isLooking) {
    if (indxStart > lines.length - 1) {
      console.log("we are out of lines to look at");
      that.stopSampleRun();
      return;
    }
    if (lines[indxStart].args.isFake) {
      // this is fake, skip it
      //console.log("found fake line at indx:", indxStart);
    } else {
      // we found a good one. use it
      //console.log("found one at indx:", indxStart);
      isLooking = false;
      break;
    }
    indxStart++;
  }

  var ll;
  if (lines[this.tweenIndex].p2) ll = lines[this.tweenIndex].p2;
  else ll = { x: 0, y: 0, z: 0 };
  console.log("start line:", lines[this.tweenIndex], "ll:", ll);

  this.tweenIndex = indxStart;
  var cl = lines[this.tweenIndex].p2;
  console.log("end line:", lines[this.tweenIndex], " el:", cl);

  var curTween = new TWEEN.Tween({
    x: ll.x,
    y: ll.y,
    z: ll.z
  })
    .to({
      x: cl.x,
      y: cl.y,
      z: cl.z
    }, 1000 / that.tweenSpeed)
    .onStart(function () {
      that.tween = curTween;
      //console.log("onStart");
      // create a new line to show path
      var lineGeo = new THREE.Geometry();
      lineGeo.vertices.push(new THREE.Vector3(ll.x, ll.y, ll.z), new THREE.Vector3(cl.x, cl.y, cl.z));
      var line = new THREE.Line(lineGeo, lineMat);
      line.type = THREE.Lines;
      that.tweenHighlight = line;
      that.scene.add(line);

    })
    .onComplete(function () {
      //console.log("onComplete");
      that.scene.remove(that.tweenHighlight);
      //setTimeout(function() {that.playNextTween();}, 0);
      if (isGotoLine) {
        console.log("got onComplete for tween and since isGotoLine mode we are stopping");
        that.stopSampleRun();
      } else {
        that.playNextTween();
      }
    })
    .onUpdate(function () {
      that.toolhead.position.x = this.x;
      that.toolhead.position.y = this.y;
      that.toolhead.position.z = this.z;

      // update where shadow casting light is looking
      if (this.showShadow) {
        that.toolhead.children[0].target.position.set(this.x, this.y, that.toolhead.position.z);
        that.toolhead.children[1].target.position.set(this.x, this.y, that.toolhead.position.z);
      }

      that.lookAtToolHead();
    });

  this.tween = curTween;
  this.tween.start();
}

function playSampleRun(evt) {
  console.log("controls:", this.controls);
  this.animNoSleep();
  $('menu-samplerun').prop('disabled', true);
  $('menu-samplerun').popover('hide');
  $('menu-samplerunstop').prop('disabled', false);
  $('menu-samplerunpause').prop('disabled', false);

  this.tweenPaused = false;
  this.tweenIsPlaying = true;
  this.tweenIndex = 0;

  var that = this;
  console.log("playSampleRun");

  // cleanup previous run
  TWEEN.removeAll();

  // we will tween all gcode locs in order
  var tween = new TWEEN.Tween({
    x: 0,
    y: 0,
    z: 0
  })
    .to({
      x: 0,
      y: 0,
      z: 0
    }, 20)
    .easing(TWEEN.Easing.Quadratic.InOut)
    .onComplete(function () {
      //console.log("onComplete");
      that.playNextTween();
    })
    .onUpdate(function () {
      that.toolhead.position.x = this.x;
      that.toolhead.position.y = this.y;
      //that.toolhead.position.z = this.z + 20;
      that.toolhead.position.z = this.z;
      // update where shadow casting light is looking
      if (this.showShadow) {
        that.toolhead.children[0].target.position.set(this.x, this.y, that.toolhead.position.z);
        that.toolhead.children[1].target.position.set(this.x, this.y, that.toolhead.position.z);
      }

      //console.log("onUpdate. toolhead:", that.toolhead);
    });

  this.tween = tween;
  this.tweenIndex = 0;
  this.tween.start();
}

function fpsCounterStart() {

  if (this.fpsEl == null) {
    // pull dom el and cache so the dom updates are efficient
    this.fpsEl = $('.frames-per-sec');
  }

  // if 3d viewer disabled, exit
  if (this.animEnable == false) {
    this.fpsEl.html('<span class="alert-danger" style="font-size:12px;">Manually Disabled. Go to cog wheel icon to choose a frame rate to re-enable.</span>');
    return;
  }

  // update fps each second
  if (this.fpsCounterInterval == null) {
    // start fps counting
    this.renderFrameCtr = 0;
    console.log("starting fps counting");
    this.fpsCounterInterval = setInterval(this.fpsCounterOnInterval.bind(this), 1000);
  }
}

function fpsCounterOnInterval() {
  this.fpsEl.html(this.renderFrameCtr + "&nbsp;fps");
  this.renderFrameCtr = 0;
}

function fpsCounterEnd() {
  console.log("stopping fps counting");
  clearInterval(this.fpsCounterInterval);
  this.fpsCounterInterval = null;
  console.log("checking if anim is disabled. this.animEnable:", this.animEnable);
  if (this.animEnable == false) {
    this.fpsEl.html('<div class="alert-danger" style="font-size:12px;line-height: 12px;padding: 6px;">Manually Disabled. Go to cog wheel icon to choose a frame rate to re-enable.</div>');
  } else {
    // set fps to just a dash
    this.fpsEl.html("-&nbsp;fps");
  }
}

function setFrameRate(rate) {

  localStorage.setItem('fpsRate', rate);
  console.log("Set fpsRate in storage:  ", rate);

  // see if disabled
  if (rate == 0) {
    this.animateDisabled();
  } else {
    this.animateEnabled();
  }

  // rate is frames per second
  if (rate == 5) this.frameRateDelayMs = 200;
  if (rate == 10) this.frameRateDelayMs = 100;
  if (rate == 15) this.frameRateDelayMs = 70;
  if (rate == 30) this.frameRateDelayMs = 32;
  if (rate == 60) this.frameRateDelayMs = 0;
}

function animateDisabled() {
  console.log("disabling animation");
  this.animEnable = false;
  this.fpsEl.html('<span class="alert-danger">Disabled</span>');
}

function animateEnabled() {
  console.log("enabling animation");
  this.animEnable = true;
}

function animate() {

  // if 3d viewer disabled, exit
  if (this.animEnable == false) {
    console.log("animate(). this.animEnable false, so exiting.");
    return;
  }

  TWEEN.update();
  if (this.wantAnimate) {

    // see if we're adding delay to slow frame rate
    if (this.frameRateDelayMs > 0) {
      var that = this;
      setTimeout(function () {
        requestAnimationFrame(that.animate.bind(that));
      }, this.frameRateDelayMs);
    } else {
      requestAnimationFrame(this.animate.bind(this));
    }
  }
  this.controls.update();
  this.renderer.render(this.scene, this.camera);
  this.renderFrameCtr++;
}

function wakeAnimate(evt) {

  // if 3d viewer disabled, exit
  if (this.animEnable == false) {
    return;
  }

  //console.log("wakeAnimate:", evt);
  this.wantAnimate = true;
  this.fpsCounterStart();
  if (!this.mytimeout) {
    this.mytimeout = setTimeout(this.sleepAnimate.bind(this), 10000);
    //console.log("wakeAnimate");
    requestAnimationFrame(this.animate.bind(this));
  }
}

function sleepAnimate() {
  this.mytimeout = null;
  if (this.isNoSleepMode) {
    // skip sleeping the anim
    console.log("Being asked to sleep anim, but in NoSleepMode");
  } else {
    this.wantAnimate = false;
    this.fpsCounterEnd();
    console.log("slept animate");
  }
}

function cancelSleep() {
  clearTimeout(this.mytimeout);
}

function animNoSleep() {
  //console.log("anim no sleep");
  this.isNoSleepMode = true;
  this.wakeAnimate();
}

function animAllowSleep() {
  //console.log("anim allow sleep");

  // even if we're being asked to allow sleep
  // but the tween is playing, don't allow it
  if (this.tweenIsPlaying) return;

  // if we get here, then allow sleep
  this.isNoSleepMode = false;
  if (!this.mytimeout) this.mytimeout = setTimeout(this.sleepAnimate.bind(this), 5000);
}

function setUnits(units) {
  if (units == "mm")
    this.isUnitsMm = true;
  else
    this.isUnitsMm = false;
  this.onUnitsChanged();
}

function onUnitsChanged() {
  //console.log("onUnitsChanged");
  // we need to publish back the units
  var units = "mm";
  if (!this.isUnitsMm) units = "inch";
  $('.units-indicator').text(units);
}    