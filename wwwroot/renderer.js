var scene = null;
var camera = null;
var controls = null;
var element = null;
var renderer = null;

var wantAnimate = true; // we automatically timeout rendering to save on cpu
var colorBackground = 0xeeeeee; // this is the background color of the 3d viewer

function createScene(element) {
  console.log("Inside createScene: element:", element);
  // store element on this object
  this.element = element;

  if (WEBGL.isWebGLAvailable() === false) {
    console.error(WEBGL.getWebGLErrorMessage());
    $('#' + this.id + ' .youhavenowebgl').removeClass("hidden");
    return;
  }

  var width = element.width();
  var height = element.height();

  // CAMERA
  // If you make the near and far too much you get
  // a fail on the intersectObjects()
  var fov = 60;
  var aspect = width / height;
  var near = 0.1;
  var far = 10000;
  var camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
  camera.rotationAutoUpdate = true;
  // camera.position.x = 10;
  // camera.position.y = -100;
  camera.position.z = 200;
  this.camera = camera;

  // SCENE
  var scene = new THREE.Scene();
  this.scene = scene;

  // RENDERER
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setClearColor(this.colorBackground, 1);
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);

  // cast shadows
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap; // default THREE.PCFShadowMap

  // add the render to the htm5 div
  element.append(renderer.domElement);
  this.renderer = renderer;

  // CONTROLS
  var controls = new THREE.OrbitControls(camera, element[0]);
  controls.screenSpacePanning = true;
  document.addEventListener('mousemove', controls.update.bind(controls), false);
  document.addEventListener('touchmove', controls.update.bind(controls), false);
  controls.addEventListener('start', this.animNoSleep.bind(this));
  controls.addEventListener('end', this.animAllowSleep.bind(this));
  this.controls = controls; // set property for later use

  // ANIMATE
  this.wantAnimate = true;
  this.wakeAnimate();

  // Fix coordinates up if window is resized.
  var that = this;
  $(window).on('resize', function () {

    renderer.setSize(element.width(), element.height());
    camera.aspect = element.width() / element.height();
    camera.updateProjectionMatrix();
    // controls.screen.width = window.innerWidth;
    // controls.screen.height = window.innerHeight;
    that.wakeAnimate();
  });

  return scene;
}
