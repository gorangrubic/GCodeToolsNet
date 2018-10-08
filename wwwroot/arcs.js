/**
 * return an arc using line segments
 * @param {float} aX 
 * @param {float} aY 
 * @param {float} aZ 
 * @param {float} endaZ 
 * @param {float} aRadius 
 * @param {float} aStartAngle 
 * @param {float} aEndAngle 
 * @param {bool} aClockwise 
 * @param {string} plane 
 */
function drawArc(aX, aY, aZ, endaZ, aRadius, aStartAngle, aEndAngle, aClockwise, plane) {

    var ac = new THREE.ArcCurve(aX, aY, aRadius, aStartAngle, aEndAngle, aClockwise);

    var acmat = new THREE.LineBasicMaterial({
        color: 0x00aaff,
        opacity: 0.5,
        transparent: true
    });

    var acgeo = new THREE.Geometry();
    var ctr = 0;
    var z = aZ;

    ac.getPoints(20).forEach(function (v) {
        z = (((endaZ - aZ) / 20) * ctr) + aZ;
        acgeo.vertices.push(new THREE.Vector3(v.x, v.y, z));
        ctr++;
    });

    var aco = new THREE.Line(acgeo, acmat);

    // PIN: disabled adding this to extraObjects
    // this.extraObjects[plane].push(aco);
    return aco;
};

/**
 * 
 * @param {point} vp1 
 * @param {point} vp2 
 * @param {point} vpArc 
 * @param {argument object} args 
 */
function drawArcFrom2PtsAndCenter(vp1, vp2, vpArc, args) {

    // Find angle
    var p1deltaX = vpArc.x - vp1.x;
    var p1deltaY = vpArc.y - vp1.y;
    var p1deltaZ = vpArc.z - vp1.z;

    var p2deltaX = vpArc.x - vp2.x;
    var p2deltaY = vpArc.y - vp2.y;
    var p2deltaZ = vpArc.z - vp2.z;

    switch (args.plane) {
        case "G18":
            var anglepArcp1 = Math.atan(p1deltaZ / p1deltaX);
            var anglepArcp2 = Math.atan(p2deltaZ / p2deltaX);
            break;
        case "G19":
            var anglepArcp1 = Math.atan(p1deltaZ / p1deltaY);
            var anglepArcp2 = Math.atan(p2deltaZ / p2deltaY);
            break;
        default:
            var anglepArcp1 = Math.atan(p1deltaY / p1deltaX);
            var anglepArcp2 = Math.atan(p2deltaY / p2deltaX);
    }

    // Draw arc from arc center
    var radius = vpArc.distanceTo(vp1);
    var radius2 = vpArc.distanceTo(vp2);

    if (Number((radius).toFixed(2)) != Number((radius2).toFixed(2))) {
        console.log("Radiuses not equal. r1:", radius, ", r2:", radius2, " with args:", args, " rounded vals r1:", Number((radius).toFixed(2)), ", r2:", Number((radius2).toFixed(2)));
    }

    // arccurve
    var clwise = true;
    if (args.clockwise === false) clwise = false;

    switch (args.plane) {
        case "G19":
            if (p1deltaY >= 0) anglepArcp1 += Math.PI;
            if (p2deltaY >= 0) anglepArcp2 += Math.PI;
            break;
        default:
            if (p1deltaX >= 0) anglepArcp1 += Math.PI;
            if (p2deltaX >= 0) anglepArcp2 += Math.PI;
    }

    if (anglepArcp1 === anglepArcp2 && clwise === false) {
        // Draw full circle if angles are both zero, 
        // start & end points are same point... I think
        switch (args.plane) {
            case "G18":
                var threeObj = this.drawArc(vpArc.x, vpArc.z, (-1 * vp1.y), (-1 * vp2.y), radius, anglepArcp1, (anglepArcp2 + (2 * Math.PI)), clwise, "G18");
                break;
            case "G19":
                var threeObj = this.drawArc(vpArc.y, vpArc.z, vp1.x, vp2.x, radius, anglepArcp1, (anglepArcp2 + (2 * Math.PI)), clwise, "G19");
                break;
            default:
                var threeObj = this.drawArc(vpArc.x, vpArc.y, vp1.z, vp2.z, radius, anglepArcp1, (anglepArcp2 + (2 * Math.PI)), clwise, "G17");
        }
    } else {
        switch (args.plane) {
            case "G18":
                var threeObj = this.drawArc(vpArc.x, vpArc.z, (-1 * vp1.y), (-1 * vp2.y), radius, anglepArcp1, anglepArcp2, clwise, "G18");
                break;
            case "G19":
                var threeObj = this.drawArc(vpArc.y, vpArc.z, vp1.x, vp2.x, radius, anglepArcp1, anglepArcp2, clwise, "G19");
                break;
            default:
                var threeObj = this.drawArc(vpArc.x, vpArc.y, vp1.z, vp2.z, radius, anglepArcp1, anglepArcp2, clwise, "G17");
        }
    }
    return threeObj;
};
