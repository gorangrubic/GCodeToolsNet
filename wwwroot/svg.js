function openSVGFromText(svg, callbackAfterObjectLoaded) {

    console.log("openSVGFromText");
    this.wakeAnimate();
    if (this.object) {
        this.stopSampleRun();
        this.scene.remove(this.object);
    }

    // var draw = SVG('drawing');
    // draw.svg(svg);

    // draw.each(function (i, children) {
    //     var attr = this.attr();
    //     console.log(this.node.nodeName);
    //     console.log(JSON.stringify(attr));
    // }, true);

    var paths = svgLoader.parse(svg);

    var group = new THREE.Group();

    for (var i = 0; i < paths.length; i++) {

        var path = paths[i];

        // var material = new THREE.MeshBasicMaterial({
        //     color: path.color,
        //     side: THREE.DoubleSide,
        //     depthWrite: false
        // });

        var lineMaterial = new THREE.LineBasicMaterial({
            color: (path.color ? path.color : 0x000000)
        });

        var shapes = path.toShapes(true, true);

        for (var j = 0; j < shapes.length; j++) {
            var shape = shapes[j];

            // var geometry = new THREE.ShapeBufferGeometry(shape);

            // var mesh = new THREE.Mesh(geometry, lineMaterial);

            // var shape3d = new THREE.ExtrudeBufferGeometry(shape, {
            //     depth: 10,
            //     bevelEnabled: false
            // });
            // var mesh = new THREE.Mesh(shape3d, material);

            // group.add(mesh);

            shape.autoClose = (path.currentPath ? path.currentPath.autoClose : false); // closes the shape between first and last point
            let shape3d = new THREE.Geometry().setFromPoints(shape.getPoints());

            // flip
            // var flip = new THREE.Matrix4().makeScale(1, -1, 1);
            // shape3d.applyMatrix(flip);
            shape3d.scale(1, -1, 1);

            // translate up by the max height
            if (paths.dimensions.height > 0) {
                shape3d.translate(0, paths.dimensions.height, 0);
            }

            let line = new THREE.Line(shape3d, lineMaterial);

            group.add(line);
        }
    }

    scene.add(group);
}
