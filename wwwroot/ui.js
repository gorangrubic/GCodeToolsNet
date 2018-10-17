var object = null; // main object to show
var axes = null; // global property to store axes that we drew
var grid = null; // stores grid
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

var isLookAtToolHeadMode = false;

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

  for (let i = 0; i < this.object.userData.lines.length; i++) {
    var line = this.object.userData.lines[i];
    // $('.list-group').append("<li class='list-group-item'><small>" + line.args.origtext + "</small></li>");
  }

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
      // $('#widget-3dviewer-outofspace').modal();
    } else {
      console.error("3D Viewer Widget. got err with localStorage:", e);
    }
  }
  localStorage.removeItem('last-loaded');

  // fire off Dat Chu's scene reload signal
  // this.onSignalSceneReloaded();
}

function resize() {

  this.renderer.setSize(this.element.width(), this.element.height());
  this.camera.aspect = this.element.width() / this.element.height();
  this.camera.updateProjectionMatrix();
  // this.controls.screen.width = window.innerWidth;
  // this.controls.screen.height = window.innerHeight;
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
    var light = new THREE.DirectionalLight(0xffffff, 0.2);
    light.position.set(0, 60, 60);
    light.castShadow = true;

    light.shadow.camera.near = this.getUnitVal(0);
    light.shadow.camera.far = this.getUnitVal(1000);
    light.shadow.camera.left = this.getUnitVal(-5);
    light.shadow.camera.right = this.getUnitVal(5);
    light.shadow.camera.top = this.getUnitVal(0);
    light.shadow.camera.bottom = this.getUnitVal(-35);

    // make sure the ligth follows the target
    light.target = toolheadgrp;
    toolheadgrp.add(light);
  }

  // ToolHead Cylinder
  var cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(0, 5, 40, 15, 1, false),
    new THREE.MeshNormalMaterial()
  );
  cylinder.overdraw = true;
  cylinder.rotation.x = -90 * Math.PI / 180;
  cylinder.position.z = 20;
  cylinder.material.opacity = 0.3;
  cylinder.material.transparent = true;
  cylinder.castShadow = true;

  toolheadgrp.add(cylinder);

  if (this.showShadow) {
    // mesh plane to receive shadows
    var planeMaterial = new THREE.ShadowMaterial({ depthWrite: false }); // added depthWrite to reduce flickering
    planeMaterial.opacity = 0.1;

    var planeW = 50; // pixels
    var planeH = 50; // pixels 
    var plane = new THREE.Mesh(
      new THREE.PlaneBufferGeometry(planeW * 50, planeH * 50, planeW, planeH),
      planeMaterial
    );
    plane.position.z = 0;
    plane.receiveShadow = true;
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
    color: "#ff0000" // red
  });
  var ylbl = this.makeSprite(this.scene, "webgl", {
    x: 0,
    y: this.getUnitVal(110),
    z: 0,
    text: "Y",
    color: "#00ff00" // green 
  });
  var zlbl = this.makeSprite(this.scene, "webgl", {
    x: 0,
    y: 0,
    z: this.getUnitVal(110),
    text: "Z",
    color: "#0000ff" // blue
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
  var helper = new THREE.BoxHelper(this.object, 0xff0000);
  helper.update();
  helper.geometry.computeBoundingBox();
  this.bboxHelper = helper;

  // If you want a visible bounding box
  // this.scene.add(helper);

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

  var line = new THREE.Line(lineGeo, material);
  line.computeLineDistances();

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

  var line2 = new THREE.Line(lineGeo2, material);
  line2.computeLineDistances();

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
  zlineGeo.vertices.push(
    new THREE.Vector3(maxx, miny, minz),
    new THREE.Vector3(maxx + lenOfLine, miny, minz),
    new THREE.Vector3(maxx + lenOfLine, miny, minz),
    new THREE.Vector3(maxx + lenOfLine, miny, maxz),
    new THREE.Vector3(maxx + lenOfLine, miny, maxz),
    new THREE.Vector3(maxx, miny, maxz)
  );

  var zline = new THREE.Line(zlineGeo, material);
  zline.computeLineDistances();

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

function lookAtCenter() {
  // this method makes the trackball controls look at center of gcode object
  this.controls.target.x = this.object.userData.center2.x;
  this.controls.target.y = this.object.userData.center2.y;
  this.controls.target.z = this.object.userData.center2.z;
}

function lookAtToolHead() {
  // this method makes the trackball controls look at the tool head
  if (this.isLookAtToolHeadMode) {
    this.controls.target.x = this.toolhead.position.x;
    this.controls.target.y = this.toolhead.position.y;
    this.controls.target.z = this.toolhead.position.z;
  }
}

function toCameraCoords(position) {
  return this.camera.matrixWorldInverse.multiplyVector3(position.clone());
}

function viewExtents() {
  console.log("viewExtents. object.userData:", this.object.userData);
  console.log("controls:", this.controls);
  this.wakeAnimate();

  // lets override the bounding box with a newly
  // generated one
  var helper = new THREE.BoxHelper(this.object, 0xff0000);
  helper.update();
  helper.geometry.computeBoundingBox();
  this.bboxHelper = helper;

  // If you want a visible bounding box
  // this.scene.add(this.bboxHelper);
  // console.log("helper bbox:", helper);

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

  // var L = dist;
  // var camera = this.controls.object;
  // var vector = controls.target.clone();
  // var l = (new THREE.Vector3()).subVectors(camera.position, vector).length();
  // var up = camera.up.clone();
  // var quaternion = new THREE.Quaternion();

  // // Zoom correction
  // camera.translateZ(L - l);
  // console.log("up:", up);
  // up.y = 1; up.x = 0; up.z = 0;
  // quaternion.setFromAxisAngle(up, 0.5);

  // up.y = 0; up.x = 1; up.z = 0;
  // quaternion.setFromAxisAngle(up, 0.5);
  // camera.position.applyQuaternion(quaternion);
  // up.y = 0; up.x = 0; up.z = 1;
  // quaternion.setFromAxisAngle(up, 0.5);

  // camera.lookAt(vector);

  this.controls.object.updateProjectionMatrix();
}

// SIMULATOR
var tween = null;
var tweenHighlight = null;
var tweenIndex = null;
var tweenSpeed = 1;
var tweenPaused = false;
var tweenIsPlaying = false;

function btnSetup() {

  // attach button bar features
  var that = this;
  this.isLookAtToolHeadMode = true;
  $('.widget-3d-menu-lookattoolhead').click(function () {
    if (that.isLookAtToolHeadMode) {
      // turn off looking at toolhead
      that.isLookAtToolHeadMode = false;
      $('.widget-3d-menu-lookattoolhead').removeClass("active btn-primary");
    } else {
      // turn on looking at toolhead
      that.isLookAtToolHeadMode = true;
      that.lookAtToolHead();
      $('.widget-3d-menu-lookattoolhead').addClass("active btn-primary");
    }
  });

  $('.widget-3d-menu-viewextents').click(function () {
    that.viewExtents()
  });

  $('.widget-3d-menu-samplerun').click(function () {
    that.playSampleRun()
  });

  $('.widget-3d-menu-samplerunstop').click(function () {
    that.stopSampleRun()
  });

  $('.widget-3d-menu-samplerunspeed').click(function () {
    that.speedUp()
  });

  $('.widget-3d-menu-samplerunpause').click(function () {
    that.pauseSampleRun()
  }).prop('disabled', true);

  $('.widget-3d-menu-samplerunstop').prop('disabled', true);

  $('.btn').popover({
    animation: true,
    placement: "auto",
    trigger: "hover"
  });
}

function setDetails(txt) {
  $('#widget-3dviewer-renderArea .data-details').text(txt);
}

function speedUp() {
  console.log("speedUp. tweenSpeed:", this.tweenSpeed);
  this.tweenSpeed = this.tweenSpeed * 10;
  if (this.tweenSpeed > 1024) this.tweenSpeed = 1;
  var txt = "x" + this.tweenSpeed;
  $('.widget-3d-menu-samplerunspeed').text(txt);
}

function stopSampleRun(evt) {
  console.log("stopSampleRun. tween:", this.tween);
  this.tweenIsPlaying = false;

  if (this.tweenHighlight) this.scene.remove(this.tweenHighlight);
  if (this.tween) this.tween.stop();

  $('.widget-3d-menu-samplerun').prop('disabled', false);
  $('.widget-3d-menu-samplerunstop').prop('disabled', true);
  $('.widget-3d-menu-samplerunstop').popover('hide');
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

  this.lookAtToolHead();
  this.animAllowSleep();

  // animate goto line
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

  // callback methods
  var onStartCallback = function (object) {
    // create a new line to show path
    var lineGeo = new THREE.Geometry();
    lineGeo.vertices.push(
      new THREE.Vector3(startLine.x, startLine.y, startLine.z),
      new THREE.Vector3(endLine.x, endLine.y, endLine.z),
    );
    var line = new THREE.Line(lineGeo, lineMat);

    that.tweenHighlight = line;
    that.scene.add(line);
  }

  var onUpdateCallback = function (object) {
    that.toolhead.position.x = object.x;
    that.toolhead.position.y = object.y;
    that.toolhead.position.z = object.z;
    that.lookAtToolHead();
  }

  var onCompleteCallback = function (object) {
    that.scene.remove(that.tweenHighlight);
    if (isGotoLine) {
      console.log("got onComplete for tween and since isGotoLine mode we are stopping");
      that.stopSampleRun();
    } else {
      that.playNextTween();
    }
  }

  var lines = this.object.userData.lines;
  if (this.tweenIndex + 1 > lines.length - 1) {
    console.log("Done with tween");
    this.stopSampleRun();
    return;
  }

  var lineMat = new THREE.LineBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 1,
  });

  // find next correct tween, i.e. ignore fake commands
  var isLooking = true;
  var indxStart = this.tweenIndex + 1;

  while (isLooking) {
    if (indxStart > lines.length - 1) {
      console.log("we are out of lines to look at");
      that.stopSampleRun();
      return;
    }
    if (lines[indxStart].args.isFake) {
      // this is fake, skip it
    } else {
      // we found a good one. use it
      isLooking = false;
      break;
    }
    indxStart++;
  }

  // either start at origin [0,0,0] or tweenIndex
  var startLine;
  if (lines[this.tweenIndex].p2) {
    startLine = lines[this.tweenIndex].p2;
  } else {
    startLine = { x: 0, y: 0, z: 0 };
  }
  // console.log("start line:", lines[this.tweenIndex].args.origtext, ":", startLine);

  this.tweenIndex = indxStart;
  var endLine = lines[this.tweenIndex].p2;
  // console.log("end line:", lines[this.tweenIndex].args.origtext, ":", endLine);

  var curTween = undefined;
  if (lines[this.tweenIndex].p2.g2 || lines[this.tweenIndex].p2.g3) {
    var numSegments = lines[this.tweenIndex].p2.threeObjArc.geometry.vertices.length;
    var origStartLine = startLine;
    var origEndLine = endLine;

    for (let i = 0; i < numSegments - 1; i++) {
      // console.log("arc line nr: " + i + " of " + numSegments);

      let startArcLine = lines[this.tweenIndex].p2.threeObjArc.geometry.vertices[i];
      let endArcLine = lines[this.tweenIndex].p2.threeObjArc.geometry.vertices[i + 1];

      // console.log("start line:", startArcLine);
      // console.log("end line:", endArcLine);

      var speed = 1000 / that.tweenSpeed / numSegments;

      if (curTween == undefined) {
        curTween = new TWEEN.Tween({
          x: startArcLine.x,
          y: startArcLine.y,
          z: startArcLine.z
        })
          .to({
            x: endArcLine.x,
            y: endArcLine.y,
            z: endArcLine.z
          }, speed)
          .onStart(
            function (object) {
              // create a new line to show path
              var lineGeo = new THREE.Geometry();
              lineGeo.vertices.push(
                new THREE.Vector3(startArcLine.x, startArcLine.y, startArcLine.z),
                new THREE.Vector3(endArcLine.x, endArcLine.y, endArcLine.z),
              );
              var line = new THREE.Line(lineGeo, lineMat);
              that.tweenHighlight = line;
              that.scene.add(line);
            }
          )
          .onUpdate(onUpdateCallback)
          .onComplete(
            function (object) {
              that.scene.remove(that.tweenHighlight)
            }
          )
          .start();
      } else {
        var nextTween = new TWEEN.Tween({
          x: startArcLine.x,
          y: startArcLine.y,
          z: startArcLine.z
        })
          .to({
            x: endArcLine.x,
            y: endArcLine.y,
            z: endArcLine.z
          }, speed)
          .onStart(
            function (object) {
              // create a new line to show path
              var lineGeo = new THREE.Geometry();
              lineGeo.vertices.push(
                new THREE.Vector3(startArcLine.x, startArcLine.y, startArcLine.z),
                new THREE.Vector3(endArcLine.x, endArcLine.y, endArcLine.z),
              );
              var line = new THREE.Line(lineGeo, lineMat);
              that.tweenHighlight = line;
              that.scene.add(line);
            }
          )
          .onUpdate(onUpdateCallback)
          .onComplete(
            function (object) {
              that.scene.remove(that.tweenHighlight)
            }
          );

        curTween.chain(nextTween);
        curTween = nextTween;
      }
    }

    // complete the drawing
    curTween.onComplete(onCompleteCallback);

  } else {
    curTween = new TWEEN.Tween({
      x: startLine.x,
      y: startLine.y,
      z: startLine.z
    })
      .to({
        x: endLine.x,
        y: endLine.y,
        z: endLine.z
      }, 1000 / that.tweenSpeed)
      .onStart(onStartCallback)
      .onComplete(onCompleteCallback)
      .onUpdate(onUpdateCallback);

    this.tween = curTween;
    this.tween.start();
  }
}

function playSampleRun(evt) {
  console.log("controls:", this.controls);
  this.animNoSleep();
  $('.widget-3d-menu-samplerun').prop('disabled', true);
  $('.widget-3d-menu-samplerun').popover('hide');
  $('.widget-3d-menu-samplerunstop').prop('disabled', false);
  $('.widget-3d-menu-samplerunpause').prop('disabled', false);

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
      that.playNextTween();
    })
    .onUpdate(function (object) {
      that.toolhead.position.x = object.x;
      that.toolhead.position.y = object.y;
      that.toolhead.position.z = object.z;
    });

  this.tween = tween;
  this.tweenIndex = 0;
  this.tween.start();
}

function fpsCounterStart() {

  if (this.fpsEl == null) {
    // pull dom el and cache so the dom updates are efficient
    this.fpsEl = $('.widget-3dviewer-frames-per-sec');
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


  this.wantAnimate = true;
  this.fpsCounterStart();
  if (!this.mytimeout) {
    this.mytimeout = setTimeout(this.sleepAnimate.bind(this), 10000);

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

  this.isNoSleepMode = true;
  this.wakeAnimate();
}

function animAllowSleep() {

  // even if we're being asked to allow sleep
  // but the tween is playing, don't allow it
  if (this.tweenIsPlaying) return;

  // if we get here, then allow sleep
  this.isNoSleepMode = false;
  if (!this.mytimeout) this.mytimeout = setTimeout(this.sleepAnimate.bind(this), 5000);
}

function setupCogMenu() {
  $('.widget-3dviewer-settings-shadows').click(this.onToggleShadowClick.bind(this));
}

function onToggleShadowClick(evt, param) {
  console.log("got onToggleShadowClick. evt:", evt, "param:", param);
  this.showShadow = !this.showShadow; // toggle
  this.drawToolhead();
}

function setupFpsMenu() {
  $('.widget-3dviewer-settings-fr-5').click(5, this.onFpsClick.bind(this));
  $('.widget-3dviewer-settings-fr-10').click(10, this.onFpsClick.bind(this));
  $('.widget-3dviewer-settings-fr-15').click(15, this.onFpsClick.bind(this));
  $('.widget-3dviewer-settings-fr-30').click(30, this.onFpsClick.bind(this));
  $('.widget-3dviewer-settings-fr-60').click(60, this.onFpsClick.bind(this));
  $('.widget-3dviewer-settings-fr-0').click(0, this.onFpsClick.bind(this));
  $('.widget-3dviewer-settings-fr--5').click(-5, this.onFpsClick.bind(this));
}

function onFpsClick(evt, param) {
  console.log("got onFpsClick. evt:", evt, "param:", param);
  var fr = evt.data;
  this.setFrameRate(fr);

  // set css to show selected
  $('.widget-3dviewer-settings-fr').removeClass('alert-info');
  $('.widget-3dviewer-settings-fr-' + fr).addClass('alert-info');
  this.wakeAnimate();
}

function setupGridSizeMenu() {
  $('.widget-3dviewer-gridsizing-1x').click(1, this.onGridSizeClick.bind(this));
  $('.widget-3dviewer-gridsizing-2x').click(2, this.onGridSizeClick.bind(this));
  $('.widget-3dviewer-gridsizing-5x').click(5, this.onGridSizeClick.bind(this));
  $('.widget-3dviewer-gridsizing-10x').click(10, this.onGridSizeClick.bind(this));
}

function onGridSizeClick(evt, param) {
  console.log("got onGridSizeClick. evt:", evt, "param:", param);

  // remove old css
  $('.widget-3dviewer-gridsizing-' + this.gridSize + 'x').removeClass("alert-info");

  var size = evt.data;
  this.gridSize = size;

  // redraw grid
  this.drawGrid();

  $('.widget-3dviewer-gridsizing-' + this.gridSize + 'x').addClass("alert-info");
}

function setUnits(units) {
  if (units == "mm")
    this.isUnitsMm = true;
  else
    this.isUnitsMm = false;
  this.onUnitsChanged();
}

function requestUnits() {
  console.log("requestUnits");
  // we need to publish back the units
  var units = "mm";
  if (!this.isUnitsMm) units = "inch";
  // chilipeppr.publish("/" + this.id + "/recvUnits", units);
}

function onUnitsChanged() {

  // we need to publish back the units
  var units = "mm";
  if (!this.isUnitsMm) units = "inch";
  // chilipeppr.publish("/" + this.id + "/unitsChanged", units);
  $('.widget-3dviewer-units-indicator').text(units);
}


// INSPECT CODE REGION
var isInspectSelect = false;
var inspectArrowGrp = null;
var inspectCurPos = null;
var inspectLastObj = { uuid: "" };
var inspectLastDecorateGroup = null;
var inspectDlgEl = null;

function initInspect() {
  // attach click event
  console.log("doing one time run of initial inspect setup. this should not run more than once!!!");
  $('.widget-3d-menu-inspect').click(this.toggleInspect.bind(this));

  // attach shortcut key
  var el = $('#widget-3dviewer-renderArea');
  el.focus();
  $(document).keydown(this.inspectKeyDown.bind(this));
  $(document).keyup(this.inspectKeyUp.bind(this));

  this.inspectLastDecorateGroup = new THREE.Group();
  this.sceneAdd(this.inspectLastDecorateGroup);

  // get dialog element
  this.inspectDlgEl = $('.widget-3dviewer-inspect');

  // setup click event
  this.inspectDlgEl.find('.inspect-btn-goto').click(this.onInspectGoto.bind(this));
  this.inspectDlgEl.find('.close').click(function () {
    $('.widget-3dviewer-inspect').addClass("hidden");
  });

  // create three.js group to hold all preview lines
  this.inspectPreviewGroup = new THREE.Group();
}

function setupInspect(evt) {

  console.log("setupInspect.");
  if (this.isInspectSelect) {
    console.log("we are already in inspect mode. being asked to setup, but returning cuz u can't setup more than once.");
    return;
  }

  // start watching mouse
  var el = $(this.renderer.domElement);
  el.mousemove(this.inspectMouseMove.bind(this));
  el.click(this.inspectMouseClick.bind(this));
  $('.widget-3d-menu-inspect').addClass("active");
  $('.widget-3d-menu-inspect').addClass("btn-primary");

  // make sure animation stays on
  if (this.inspectArrowGrp != null) {
    this.sceneAdd(this.inspectArrowGrp);
  }

  this.sceneAdd(this.inspectPreviewGroup);

  this.isInspectSelect = true;
}

function unsetupInspect() {
  console.log("unsetupInspect");
  if (!this.isInspectSelect) {
    console.log("we are being asked to unsetup inspect, but it is not running so why are we getting called?");
    return;
  }

  var el = $(this.renderer.domElement);
  el.unbind("mousemove");
  el.unbind("click");
  $('.widget-3d-menu-inspect').removeClass("active");
  $('.widget-3d-menu-inspect').removeClass("btn-primary");

  if (this.inspectArrowGrp != null) {
    this.sceneRemove(this.inspectArrowGrp);
  }

  this.sceneRemove(this.inspectPreviewGroup);
  this.isInspectSelect = false;
}

function toggleInspect(evt) {
  if ($('.widget-3d-menu-inspect').hasClass("active")) {
    // turn off
    this.unsetupInspect(evt);
  } else {
    this.setupInspect(evt);
  }
}

function inspectKeyDown(evt) {
  if ((evt.shiftKey) && !this.isInspectSelect) {
    this.wakeAnimate();
    this.setupInspect(evt);
  }
}

function inspectKeyUp(evt) {
  if ((evt.keyCode == 16) && this.isInspectSelect) {
    this.unsetupInspect(evt);
  }
}

function inspectMouseClick(evt) {
  console.log("inspectMouseClick. evt:", evt);
  return;
  if (evt.ctrlKey || evt.altKey) {
    if (this.jogCurPos != null) {
      var pt = this.jogCurPos;
      var gcode = "G90 G0 X" + pt.x.toFixed(3) + " Y" + pt.y.toFixed(3);
      gcode += "\n";
      // chilipeppr.publish("/serialport/send", gcode);
    } else {
      console.warn("this.jogCurPos should not be null");
    }
  }
}

function onInspectGoto(evt) {
  if (this.inspectLastObj.uuid != "") {
    var lineNum = this.inspectLastObj.userData.args.indx + 1;
    // chilipeppr.publish("/gcode/jumpToLine", lineNum);
  }
}

function createInspectArrow() {

  if (this.inspectArrowGrp != null) return;

  // build pointer line
  this.inspectArrowGrp = new THREE.Group();

  // draw dotted lines from jog tip and shadow
  var lineMat = new THREE.LineDashedMaterial({ color: 0xff0000, dashSize: this.getUnitVal(1), gapSize: this.getUnitVal(1), transparent: true, opacity: 0.5 });
  var lineGeo = new THREE.Geometry();
  lineGeo.vertices.push(new THREE.Vector3(0, 0, this.getUnitVal(-100)));
  lineGeo.vertices.push(new THREE.Vector3(0, 0, this.getUnitVal(100)));

  var line = new THREE.Line(lineGeo, lineMat);
  line.computeLineDistances();
  this.inspectArrowLine = line;
  this.inspectArrowGrp.add(line);

  this.sceneAdd(this.inspectArrowGrp);
  console.log("just added inspectArrowGrp:", this.inspectArrowGrp);
}

function inspectMouseMove(evt) {

  if (!this.isInspectSelect) {
    return;
  }

  // this.createInspectArrow();

  this.wakeAnimate();

  console.log("inspectMouseMove. evt:", evt);

  // https://stackoverflow.com/questions/34698393/get-mouse-clicked-points-3d-coordinate-in-three-js

  var width = element.width(); // same as renderer.domElement.clientWidth - window.innerWidth is too large
  var height = element.height(); // same as renderer.domElement.clientHeight - window.innerHeight is too large
  var offset = element.offset(); // get the offset relative to the window

  var mouse = {};
  mouse.x = ((evt.clientX - offset.left) / width) * 2 - 1;
  mouse.y = - ((evt.clientY - offset.top) / height) * 2 + 1;

  var vector = new THREE.Vector3(mouse.x, mouse.y, 0.5);
  vector.unproject(camera);
  var dir = vector.sub(camera.position).normalize();
  var distance = - camera.position.z / dir.z;
  var pos = camera.position.clone().add(dir.multiplyScalar(distance));

  // $('.widget-3dviewer-coordinates').text("x: " + mouse.x.toFixed(2) + ", y: " + mouse.y.toFixed(2) + " [" + pos.x.toFixed(2) + "/" + pos.y.toFixed(2) + "]");
  $('.widget-3dviewer-coordinates').text("[" + pos.x.toFixed(2) + "/" + pos.y.toFixed(2) + "]");

  // update the picking ray with the camera and mouse position
  var raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);

  // calculate objects intersecting the picking ray
  var io = raycaster.intersectObjects(this.object.userData.inspect3dObj.children, true);

  // remove all previous preview items
  this.inspectPreviewGroup.children.forEach(function (threeObj) {
    this.inspectPreviewGroup.remove(threeObj);
  }, this);

  if (io.length > 0) {
    // we hit some objects
    var obj = io[0];

    // see if this is a new object we haven't hit yet
    // if (this.inspectLastObj.uuid != obj.object.uuid) {
    if (true) {

      var o = obj.object;
      var ud = o.userData;

      console.log("hit new object:", o);

      // remove all previous preview items
      this.inspectPreviewGroup.children.forEach(function (threeObj) {
        this.inspectPreviewGroup.remove(threeObj);
      }, this);

      // create glow
      var glow = this.createGlow(o);
      this.inspectPreviewGroup.add(glow);

      // show dialog
      var x = event.clientX;
      var y = event.clientY;

      x += 30; // slide right to clear mouse
      y += -140;
      this.inspectDlgEl.css('left', x + "px").css('top', y + "px");
      this.inspectDlgEl.find('.inspect-line').text(ud.args.indx + 1);
      this.inspectDlgEl.find('.inspect-gcode').text(ud.args.origtext);
      this.inspectDlgEl.find('.inspect-end').text("X:" + ud.p2.x + ", Y:" + ud.p2.y + ", Z:" + ud.p2.z);
      this.inspectDlgEl.find('.inspect-feedrate').text(ud.p2.feedrate);
      this.inspectDlgEl.find('.inspect-distance').text(ud.p2.dist.toFixed(3));
      this.inspectDlgEl.find('.inspect-time').text((ud.p2.timeMins * 60).toFixed(2) + "s");
      var pretty = this.convertMinsToPrettyDuration(ud.p2.timeMinsSum);
      this.inspectDlgEl.find('.inspect-timeSum').text(pretty);
      this.inspectDlgEl.removeClass("hidden");

      // set the last object to this one
      this.inspectLastObj = o;
    }

    // move arrow
    this.inspectArrowGrp.position.set(pt.x, pt.y, 0);
    this.inspectCurPos = pt.clone();
  }
}

function createGlow(threeObj) {
  // console.log("createGlow. threeObj:", threeObj);
  var obj = new THREE.Group();
  if (threeObj instanceof THREE.Line) {
    // console.log("threeObj is Line");

    var material = new THREE.MeshNormalMaterial({
      transparent: true,
      opacity: 0.1
    });

    // draw an arrow and cylinder for each line
    var step = 0;
    for (step = 0; step < threeObj.geometry.vertices.length - 1; step++) {
      var v1 = threeObj.geometry.vertices[step];
      var v2 = threeObj.geometry.vertices[step + 1];

      var length = v1.distanceTo(v2);
      var dir = v2.clone().sub(v1).normalize();
      var ray = new THREE.Ray(v1, dir);
      var geometry = new THREE.CylinderGeometry(1, 1, length);
      var cylinder = new THREE.Mesh(geometry, material);

      // figure out rotation
      var arrow = new THREE.ArrowHelper(dir, v1, length, 0xff0000);
      obj.add(arrow);

      var rot = arrow.rotation.clone()
      cylinder.rotation.set(rot.x, rot.y, rot.z);

      var cpos = new THREE.Vector3();
      ray.at(length / 2, cpos);
      cylinder.position.set(cpos.x, cpos.y, cpos.z);

      // console.log("adding cylinder:", cylinder);
      obj.add(cylinder);
    }

  } else {
    console.log("threeObj not Line");
  }
  return obj;
}

function createGlowCubeCaps(threeObj) {
  console.log("createGlow. threeObj:", threeObj);
  var obj = new THREE.Group();
  if (threeObj instanceof THREE.Line) {
    console.log("threeObj is Line");
    // draw a cube at each end point
    var v1 = threeObj.geometry.vertices[0];
    var v2 = threeObj.geometry.vertices[threeObj.geometry.vertices.length - 1];
    var geometry = new THREE.BoxGeometry(1, 1, 1);
    var material = new THREE.MeshNormalMaterial({
      transparent: true,
      opacity: 0.1
    });

    var cube = new THREE.Mesh(geometry, material);
    cube.position.set(v1.x, v1.y, v1.z);
    var cube2 = cube.clone();
    cube2.position.set(v2.x, v2.y, v2.z);

    console.log("adding cube:", cube, "cube2:", cube2);
    obj.add(cube);
    obj.add(cube2);
  } else {
    console.log("threeObj not Line");
  }
  return obj;
}


// JOG CODE REGION
var isJogBtnAttached = false; // is the jog btn setup?
var isJogSelect = false; // indicates we're in 3d jog mode
var arrowHelper = null;
var jogPlane = null;
var isJogRaycaster = false;
var jogArrow = null;
var jogArrowCyl = null;
var jogArrowLine = null;
var jogArrowShadow = null;
var jogCurPos = null;

function initJog() {
  if (!this.isJogBtnAttached) {
    // attach click event
    console.log("doing one time run of initial jog setup. this should not run more than once!!!");
    $('.widget-3d-menu-jog').click(this.toggleJog.bind(this));

    // attach shortcut key
    var el = $('#widget-3dviewer-renderArea');
    el.focus();
    $(document).keydown(this.jogKeyDown.bind(this));
    $(document).keyup(this.jogKeyUp.bind(this));
    this.isJogBtnAttached = true;
  }
}

function setupJog(evt) {

  console.log("setupJog.");
  if (this.isJogSelect) {
    console.log("we are already in jogging mode. being asked to setup, but returning cuz u can't setup more than once.");
    return;
  }

  // start watching mouse
  var el = $(this.renderer.domElement);
  el.mousemove(this.jogMouseMove.bind(this));
  el.click(this.jogMouseClick.bind(this));
  $('.widget-3d-menu-jog').addClass("active");
  $('.widget-3d-menu-jog').addClass("btn-primary");

  // make sure animation stays on
  this.isJogSelect = true;
}

function unsetupJog() {

  if (!this.isJogSelect) {
    console.log("we are being asked to unsetup jog, but it is not running so why are we getting called?");
    return;
  }

  var el = $(this.renderer.domElement);
  el.unbind("mousemove");
  el.unbind("click");
  $('.widget-3d-menu-jog').removeClass("active");
  $('.widget-3d-menu-jog').removeClass("btn-primary");
  this.unsetupJogRaycaster();
  this.isJogSelect = false;
}

function toggleJog(evt) {
  if ($('.widget-3d-menu-jog').hasClass("active")) {
    // turn off
    this.unsetupJog(evt);
  } else {
    this.setupJog(evt);
  }
}

function jogKeyDown(evt) {

  if ((evt.ctrlKey) && !this.isJogSelect) {
    this.wakeAnimate();
    this.setupJog(evt);
  } else {

  }
}

function jogKeyUp(evt) {
  if ((evt.keyCode == 17) && this.isJogSelect) {
    this.unsetupJog(evt);
  }
}

function unsetupJogRaycaster() {
  this.sceneRemove(this.jogPlane);
  this.sceneRemove(this.jogArrow);
  this.isJogRaycaster = false;
}

function setupJogRaycaster() {
  console.log("doing setupJogRaycaster");
  console.log("mimic grid size:", this.grid);
  var helper = new THREE.BoxHelper(this.grid, 0xff0000);
  helper.update();
  helper.geometry.computeBoundingBox();

  // If you want a visible bounding box
  //scene.add(helper);

  // If you just want the numbers
  console.log("boundingbox:", helper.geometry.boundingBox);
  var minx = helper.geometry.boundingBox.min.x;
  var miny = helper.geometry.boundingBox.min.y;
  var maxx = helper.geometry.boundingBox.max.x;
  var maxy = helper.geometry.boundingBox.max.y;

  var w = maxx - minx;
  var h = maxy - miny;

  // create plane at z 0 to project onto
  var geometry = new THREE.PlaneBufferGeometry(w, h);
  var material = new THREE.MeshBasicMaterial({ color: 0xffff00, side: THREE.DoubleSide });
  this.jogPlane = new THREE.Mesh(geometry, material);

  // setup arrow helper
  console.group("draw jogArrow");

  // remove grid if drawn previously
  if (this.jogArrow != null) {
    console.log("there was a previous jogArrow. remove it. jogArrow:", this.jogArrow);

    this.sceneRemove(this.jogArrow);
  } else {
    console.log("no previous jogArrow.");
  }

  // TOOLHEAD WITH SHADOW
  var jogArrowGrp = new THREE.Object3D();

  // jogArrow Cylinder
  var cylinder = new THREE.Mesh(new THREE.CylinderGeometry(0, 5, 40, 15, 1, false), new THREE.MeshNormalMaterial());
  cylinder.overdraw = true;
  cylinder.rotation.x = -90 * Math.PI / 180;
  cylinder.position.z = 20;
  cylinder.material.opacity = 0.3;
  cylinder.material.transparent = true;
  cylinder.castShadow = false;
  console.log("jogArrow cone:", cylinder);

  // move the cylinder up in the group to account for z pos of toolhead
  // acct for scale
  var posZ = (this.toolhead.position.z * 3);
  cylinder.position.setZ(posZ + 20);
  this.jogArrowCyl = cylinder;
  jogArrowGrp.add(cylinder);

  // scale the whole thing to correctly match mm vs inches
  var scale = this.getUnitVal(1);
  jogArrowGrp.scale.set(scale / 3, scale / 3, scale / 3);

  // add fake shadow
  var triangleShape = new THREE.Shape();
  triangleShape.moveTo(0, 0);
  triangleShape.lineTo(-8, 3);
  triangleShape.lineTo(-8.5, 2);
  triangleShape.lineTo(-8.7, 1);
  triangleShape.lineTo(-8.72, 0);
  triangleShape.lineTo(-8.7, -1);
  triangleShape.lineTo(-8.5, -2);
  triangleShape.lineTo(-8, -3);
  triangleShape.lineTo(0, 0); // close path

  var geometry = new THREE.ShapeGeometry(triangleShape);

  var mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color: 0x000000, transparent: true, opacity: 0.05 }));

  // figure out z position
  // move shadow left by the amount by amount of z height
  mesh.position.setX(posZ * -1);
  this.jogArrowShadow = mesh;
  jogArrowGrp.add(mesh);

  // draw dotted lines from jog tip and shadow
  var lineMat = new THREE.LineDashedMaterial({ color: 0x000000 });
  var lineGeo = new THREE.Geometry();
  lineGeo.vertices.push(new THREE.Vector3(0, 0, 0));
  lineGeo.vertices.push(new THREE.Vector3(0, 0, posZ));
  var line = new THREE.Line(lineGeo, lineMat, THREE.LineStrip);
  line.computeLineDistances();
  this.jogArrowLine = line;
  jogArrowGrp.add(line);

  // add text
  var txt = "Ctrl Click to XY Jog Here";
  var txtObj = this.makeText({
    x: 4,
    y: (this.getUnitVal(7) / 2) * -1,
    z: 0,
    text: txt,
    color: 0x000000,
    opacity: 0.2,
    size: 7
  });

  jogArrowGrp.add(txtObj);

  this.jogArrow = jogArrowGrp;

  this.sceneAdd(this.jogArrow);

  console.groupEnd();

  this.isJogRaycaster = true;
}

function jogMouseClick(evt) {
  console.log("jogMouseClick. evt:", evt);
  if (evt.ctrlKey || evt.altKey) {
    if (this.jogCurPos != null) {
      var pt = this.jogCurPos;
      var gcode = "G90 G0 X" + pt.x.toFixed(3) + " Y" + pt.y.toFixed(3);
      gcode += "\n";
      // chilipeppr.publish("/serialport/send", gcode);
    } else {
      console.warn("this.jogCurPos should not be null");
    }
  }
}

function jogMouseMove(evt) {

  if (!this.isJogSelect) {
    return;
  }

  this.wakeAnimate();

  var width = element.width(); // same as renderer.domElement.clientWidth - window.innerWidth is too large
  var height = element.height(); // same as renderer.domElement.clientHeight - window.innerHeight is too large
  var offset = element.offset(); // get the offset relative to the window

  var mouse = {};
  mouse.x = ((evt.clientX - offset.left) / width) * 2 - 1;
  mouse.y = - ((evt.clientY - offset.top) / height) * 2 + 1;

  var vector = new THREE.Vector3(mouse.x, mouse.y, 0.5).unproject(this.camera);
  var origin = this.camera.position.clone();
  var dir = vector.sub(this.camera.position).normalize();

  if (!this.isJogRaycaster) {
    this.setupJogRaycaster();
  }

  var raycaster = new THREE.Raycaster(origin, dir);
  var io = raycaster.intersectObject(this.jogPlane, false);

  if (io.length > 0) {
    // we hit the jog plane
    var pt = io[0].point;

    // $('.widget-3dviewer-coordinates').text("x: " + mouse.x.toFixed(2) + ", y: " + mouse.y.toFixed(2) + " [" + pos.x.toFixed(2) + "/" + pos.y.toFixed(2) + "]");
    $('.widget-3dviewer-coordinates').text("[" + pt.x.toFixed(2) + "/" + pt.y.toFixed(2) + "]");

    // move arrow
    this.jogArrow.position.set(pt.x, pt.y, 0);
    this.jogCurPos = pt.clone();
  }
}