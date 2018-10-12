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
 * @param {string} plane - G17, G18 or G19
 */
function drawArc(aX, aY, aZ, endaZ, aRadius, aStartAngle, aEndAngle, aClockwise, plane) {

    var numSegments = 20;

    var ac = new THREE.ArcCurve(aX, aY, aRadius, aStartAngle, aEndAngle, aClockwise);

    var acmat = new THREE.LineBasicMaterial({
        color: 0x00aaff,
        opacity: 0.5,
        transparent: true
    });

    var acgeo = new THREE.Geometry();
    var ctr = 0;
    var z = aZ;

    ac.getPoints(numSegments).forEach(function (v) {
        z = (((endaZ - aZ) / numSegments) * ctr) + aZ;
        acgeo.vertices.push(new THREE.Vector3(v.x, v.y, z));
        ctr++;
    });

    var aco = new THREE.Line(acgeo, acmat);
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

/**
 * Return at Three Line object
 * @param {point} p1 - object with x, y, z, e, f etc 
 * @param {point} p2 
 * @param {argument object} args 
 */
function getArcThreeLine(p1, p2, args) {

    // figure out the 3 pts we are dealing with
    // the start, the end, and the center of the arc circle
    // radius is dist from p1 x/y/z to pArc x/y/z
    var vp1 = new THREE.Vector3(p1.x, p1.y, p1.z);
    var vp2 = new THREE.Vector3(p2.x, p2.y, p2.z);
    var vpArc;

    // if this is an R arc gcode command, we're given the radius, so we
    // don't have to calculate it. however we need to determine center
    // of arc
    if (args.r != null) {

        radius = parseFloat(args.r);

        // First, find the distance between points 1 and 2.  We'll call that q, 
        // and it's given by sqrt((x2-x1)^2 + (y2-y1)^2).
        var q = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2) + Math.pow(p2.z - p1.z, 2));

        // Second, find the point halfway between your two points.  We'll call it 
        // (x3, y3).  x3 = (x1+x2)/2  and  y3 = (y1+y2)/2.  
        var x3 = (p1.x + p2.x) / 2;
        var y3 = (p1.y + p2.y) / 2;
        var z3 = (p1.z + p2.z) / 2;

        // There will be two circle centers as a result of this, so
        // we will have to pick the correct one. In gcode we can get
        // a + or - val on the R to indicate which circle to pick
        // One answer will be:
        // x = x3 + sqrt(r^2-(q/2)^2)*(y1-y2)/q
        // y = y3 + sqrt(r^2-(q/2)^2)*(x2-x1)/q  
        // The other will be:
        // x = x3 - sqrt(r^2-(q/2)^2)*(y1-y2)/q
        // y = y3 - sqrt(r^2-(q/2)^2)*(x2-x1)/q  
        var pArc_1 = undefined;
        var pArc_2 = undefined;
        var calc = Math.sqrt((radius * radius) - Math.pow(q / 2, 2));

        // calc can be NaN if q/2 is epsilon larger than radius due to finite precision
        // When that happens, the calculated center is incorrect
        if (isNaN(calc)) {
            calc = 0.0;
        }

        switch (args.plane) {
            case "G18":
                pArc_1 = {
                    x: x3 + calc * (p1.z - p2.z) / q,
                    y: y3 + calc * (p2.y - p1.y) / q,
                    z: z3 + calc * (p2.x - p1.x) / q
                };
                pArc_2 = {
                    x: x3 - calc * (p1.z - p2.z) / q,
                    y: y3 - calc * (p2.y - p1.y) / q,
                    z: z3 - calc * (p2.x - p1.x) / q
                };
                angle_point = Math.atan2(p1.z, p1.x) - Math.atan2(p2.z, p2.x);
                if (((p1.x - pArc_1.x) * (p1.z + pArc_1.z)) + ((pArc_1.x - p2.x) * (pArc_1.z + p2.z)) >=
                    ((p1.x - pArc_2.x) * (p1.z + pArc_2.z)) + ((pArc_2.x - p2.x) * (pArc_2.z + p2.z))) {
                    var cw = pArc_1;
                    var ccw = pArc_2;
                } else {
                    var cw = pArc_2;
                    var ccw = pArc_1;
                }
                break;
            case "G19":
                pArc_1 = {
                    x: x3 + calc * (p1.x - p2.x) / q,
                    y: y3 + calc * (p1.z - p2.z) / q,
                    z: z3 + calc * (p2.y - p1.y) / q
                };
                pArc_2 = {
                    x: x3 - calc * (p1.x - p2.x) / q,
                    y: y3 - calc * (p1.z - p2.z) / q,
                    z: z3 - calc * (p2.y - p1.y) / q
                };

                if (((p1.y - pArc_1.y) * (p1.z + pArc_1.z)) + ((pArc_1.y - p2.y) * (pArc_1.z + p2.z)) >=
                    ((p1.y - pArc_2.y) * (p1.z + pArc_2.z)) + ((pArc_2.y - p2.y) * (pArc_2.z + p2.z))) {
                    var cw = pArc_1;
                    var ccw = pArc_2;
                } else {
                    var cw = pArc_2;
                    var ccw = pArc_1;
                }
                break;
            default:
                pArc_1 = {
                    x: x3 + calc * (p1.y - p2.y) / q,
                    y: y3 + calc * (p2.x - p1.x) / q,
                    z: z3 + calc * (p2.z - p1.z) / q
                };
                pArc_2 = {
                    x: x3 - calc * (p1.y - p2.y) / q,
                    y: y3 - calc * (p2.x - p1.x) / q,
                    z: z3 - calc * (p2.z - p1.z) / q
                };
                if (((p1.x - pArc_1.x) * (p1.y + pArc_1.y)) + ((pArc_1.x - p2.x) * (pArc_1.y + p2.y)) >=
                    ((p1.x - pArc_2.x) * (p1.y + pArc_2.y)) + ((pArc_2.x - p2.x) * (pArc_2.y + p2.y))) {
                    var cw = pArc_1;
                    var ccw = pArc_2;
                } else {
                    var cw = pArc_2;
                    var ccw = pArc_1;
                }
        }

        if ((p2.clockwise === true && radius >= 0) || (p2.clockwise === false && radius < 0)) {
            vpArc = new THREE.Vector3(cw.x, cw.y, cw.z);
        } else {
            vpArc = new THREE.Vector3(ccw.x, ccw.y, ccw.z);
        }

    } else {
        // this code deals with IJK gcode commands
        var pArc = {
            x: p2.arci,
            y: p2.arcj,
            z: p2.arck,
        };

        vpArc = new THREE.Vector3(pArc.x, pArc.y, pArc.z);
    }

    var threeObjArc = this.drawArcFrom2PtsAndCenter(vp1, vp2, vpArc, args);

    return threeObjArc;
}