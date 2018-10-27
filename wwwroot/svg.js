function openSVGFromText(svg, callbackAfterObjectLoaded) {
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

        var material = new THREE.MeshBasicMaterial({
            color: path.color,
            side: THREE.DoubleSide,
            depthWrite: false
        });

        var shapes = path.toShapes(true);

        for (var j = 0; j < shapes.length; j++) {
            var shape = shapes[j];

            var shape3d = new THREE.ExtrudeBufferGeometry(shape, {
                depth: 10,
                bevelEnabled: false
            });

            // var geometry = new THREE.ShapeBufferGeometry(shape);
            // var mesh = new THREE.Mesh(geometry, material);

            var mesh = new THREE.Mesh(shape3d, material);

            group.add(mesh);
        }
    }

    scene.add(group);
}
