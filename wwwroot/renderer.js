var colorBackground = 0xeeeeee; // this is the background color of the 3d viewer

function createScene(element) {
  console.log("inside createScene: element:", element);
  var width = element.width();
  var height = element.height();

  // store element on this object
  this.element = element;

  // Scene
  var scene = new THREE.Scene();
  this.scene = scene;

  // Lights...
  var ctr = 0;
  [
    [0, 0, 1, 0xFFFFCC],
    [0, 1, 0, 0xFFCCFF],
    [1, 0, 0, 0xCCFFFF],
    [0, 0, -1, 0xCCCCFF],
    [0, -1, 0, 0xCCFFCC],
    [-1, 0, 0, 0xFFCCCC]
  ].forEach(function (position) {
    var light = new THREE.DirectionalLight(position[3]);
    light.position.set(position[0], position[1], position[2]).normalize();
    scene.add(light);
    ctr++;
  });

  // Camera...
  // If you make the near and far too much you get
  // a fail on the intersectObjects()
  var fov = 70,
    aspect = width / height,
    near = 0.01,
    far = 10000,
    camera = new THREE.PerspectiveCamera(fov, aspect, near, far);

  this.camera = camera;
  camera.rotationAutoUpdate = true;
  camera.position.x = 10;
  camera.position.y = -100;
  camera.position.z = 200;
  scene.add(camera);

  // Controls
  // controls = new THREE.OrbitControls(camera);
  controls = new THREE.TrackballControls(camera, element[0]);
  this.controls = controls; // set property for later use

  controls.rotateSpeed = 2.0;
  controls.zoomSpeed = 1.2;
  controls.panSpeed = 0.5;
  controls.noZoom = false;
  controls.noPan = false;
  controls.staticMoving = true;
  controls.dynamicDampingFactor = 0.99;

  console.log("controls:", controls);
  document.addEventListener('mousemove', controls.update.bind(controls), false);
  document.addEventListener('touchmove', controls.update.bind(controls), false);

  // load font
  loadFont();

  // Renderer
  var renderer;
  var webgl = (function () { try { return !!window.WebGLRenderingContext && !!document.createElement('canvas').getContext('experimental-webgl'); } catch (e) { return false; } })();

  if (webgl) {
    console.log('WebGL Support found!  Success: CP will work optimally on this device!');

    renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: false,
      alpha: false,
      logarithmicDepthBuffer: false
    });
  } else {
    console.error('No WebGL Support found! CRITICAL ERROR!');
    $('#' + this.id + ' .youhavenowebgl').removeClass("hidden");
    return;
  };

  this.renderer = renderer;
  renderer.setClearColor(this.colorBackground, 1);
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  element.append(renderer.domElement);

  // cast shadows
  renderer.shadowMap.enabled = true;
  // to antialias the shadow
  renderer.shadowMapSoft = true;

  // Action!
  var mouseEvtContainer = $('#widget-3dviewer-renderArea');
  console.log(mouseEvtContainer);
  controls.addEventListener('start', this.animNoSleep.bind(this));
  controls.addEventListener('end', this.animAllowSleep.bind(this));

  console.log("this wantAnimate:", this);
  this.wantAnimate = true;
  this.wakeAnimate();

  // Fix coordinates up if window is resized.
  var that = this;
  $(window).on('resize', function () {
    
    renderer.setSize(element.width(), element.height());
    camera.aspect = element.width() / element.height();
    camera.updateProjectionMatrix();
    controls.screen.width = window.innerWidth;
    controls.screen.height = window.innerHeight;
    that.wakeAnimate();
  });

  return scene;
}

function loadFont() {
  var loader = new THREE.FontLoader();
  loader.load('/fonts/helvetiker_regular.typeface.json', function (response) {
    font = response;
  });
}
