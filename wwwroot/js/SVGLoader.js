/**
 * @author mrdoob / http://mrdoob.com/
 * @author zz85 / http://joshuakoo.com/
 * @author yomboprime / https://yombo.org
 * @author perivar / https://github.com/perivar
 */

THREE.SVGLoader = function (manager) {

	this.manager = (manager !== undefined) ? manager : THREE.DefaultLoadingManager;

};

THREE.SVGLoader.prototype = {

	constructor: THREE.SVGLoader,

	load: function (url, onLoad, onProgress, onError) {

		var scope = this;

		var loader = new THREE.FileLoader(scope.manager);
		loader.load(url, function (text) {

			onLoad(scope.parse(text));

		}, onProgress, onError);

	},

	parse: function (text) {

		function parseNode(node, style) {

			if (node.nodeType !== 1) return;

			var transform = getNodeTransform(node);

			var path = null;
			var dimensions = null;

			switch (node.nodeName) {

				case 'svg':
					dimensions = parseDimensions(node);
					break;

				case 'g':
					style = parseStyle(node, style);
					break;

				case 'path':
					style = parseStyle(node, style);
					if (node.hasAttribute('d') && isVisible(style)) path = parsePathNode(node, style);
					break;

				case 'rect':
					style = parseStyle(node, style);
					if (isVisible(style)) path = parseRectNode(node, style);
					break;

				case 'polygon':
					style = parseStyle(node, style);
					if (isVisible(style)) path = parsePolygonNode(node, style);
					break;

				case 'polyline':
					style = parseStyle(node, style);
					if (isVisible(style)) path = parsePolylineNode(node, style);
					break;

				case 'circle':
					style = parseStyle(node, style);
					if (isVisible(style)) path = parseCircleNode(node, style);
					break;

				case 'ellipse':
					style = parseStyle(node, style);
					if (isVisible(style)) path = parseEllipseNode(node, style);
					break;

				case 'line':
					style = parseStyle(node, style);
					if (isVisible(style)) path = parseLineNode(node, style);
					break;

				default:
					console.log(node);
			}

			if (path) {
				transformPath(path, currentTransform);

				paths.push(path);
			}

			if (dimensions) {
				paths.dimensions = dimensions;
			}

			var nodes = node.childNodes;

			for (var i = 0; i < nodes.length; i++) {
				parseNode(nodes[i], style);
			}

			if (transform) {
				currentTransform.copy(transformStack.pop());
			}
		}

		function setColorFromStyle(path, style) {
			path.color.isSet = false;

			if (style.stroke) {
				path.color.setStyle(style.stroke);
				path.color.isSet = true;
			}
			if (style.fill) {
				path.color.setStyle(style.fill);
				path.color.isSet = true;
			}
		}

		function parsePathNode(node, style) {

			var path = new THREE.ShapePath();
			setColorFromStyle(path, style);

			var point = new THREE.Vector2();
			var control = new THREE.Vector2();

			var firstPoint = new THREE.Vector2();
			var isFirstPoint = true;
			var doSetFirstPoint = false;

			var d = node.getAttribute('d');

			var commands = d.match(/[a-df-z][^a-df-z]*/ig);

			for (var i = 0, l = commands.length; i < l; i++) {

				var command = commands[i];

				var type = command.charAt(0);
				var data = command.substr(1).trim();

				if (isFirstPoint) {
					doSetFirstPoint = true;
				}
				isFirstPoint = false;

				switch (type) {

					case 'M':
						var numbers = parseFloats(data);
						for (var j = 0, jl = numbers.length; j < jl; j += 2) {
							point.x = numbers[j + 0];
							point.y = numbers[j + 1];
							control.x = point.x;
							control.y = point.y;
							if (j === 0) {
								path.moveTo(point.x, point.y);
							} else {
								path.lineTo(point.x, point.y);
							}
						}
						break;

					case 'H':
						var numbers = parseFloats(data);
						for (var j = 0, jl = numbers.length; j < jl; j++) {
							point.x = numbers[j];
							control.x = point.x;
							control.y = point.y;
							path.lineTo(point.x, point.y);
						}
						break;

					case 'V':
						var numbers = parseFloats(data);
						for (var j = 0, jl = numbers.length; j < jl; j++) {
							point.y = numbers[j];
							control.x = point.x;
							control.y = point.y;
							path.lineTo(point.x, point.y);
						}
						break;

					case 'L':
						var numbers = parseFloats(data);
						for (var j = 0, jl = numbers.length; j < jl; j += 2) {
							point.x = numbers[j + 0];
							point.y = numbers[j + 1];
							control.x = point.x;
							control.y = point.y;
							path.lineTo(point.x, point.y);
						}
						break;

					case 'C':
						var numbers = parseFloats(data);
						for (var j = 0, jl = numbers.length; j < jl; j += 6) {
							path.bezierCurveTo(
								numbers[j + 0],
								numbers[j + 1],
								numbers[j + 2],
								numbers[j + 3],
								numbers[j + 4],
								numbers[j + 5]
							);
							control.x = numbers[j + 2];
							control.y = numbers[j + 3];
							point.x = numbers[j + 4];
							point.y = numbers[j + 5];
						}
						break;

					case 'S':
						var numbers = parseFloats(data);
						for (var j = 0, jl = numbers.length; j < jl; j += 4) {
							path.bezierCurveTo(
								getReflection(point.x, control.x),
								getReflection(point.y, control.y),
								numbers[j + 0],
								numbers[j + 1],
								numbers[j + 2],
								numbers[j + 3]
							);
							control.x = numbers[j + 0];
							control.y = numbers[j + 1];
							point.x = numbers[j + 2];
							point.y = numbers[j + 3];
						}
						break;

					case 'Q':
						var numbers = parseFloats(data);
						for (var j = 0, jl = numbers.length; j < jl; j += 4) {
							path.quadraticCurveTo(
								numbers[j + 0],
								numbers[j + 1],
								numbers[j + 2],
								numbers[j + 3]
							);
							control.x = numbers[j + 0];
							control.y = numbers[j + 1];
							point.x = numbers[j + 2];
							point.y = numbers[j + 3];
						}
						break;

					case 'T':
						var numbers = parseFloats(data);
						for (var j = 0, jl = numbers.length; j < jl; j += 2) {
							var rx = getReflection(point.x, control.x);
							var ry = getReflection(point.y, control.y);
							path.quadraticCurveTo(
								rx,
								ry,
								numbers[j + 0],
								numbers[j + 1]
							);
							control.x = rx;
							control.y = ry;
							point.x = numbers[j + 0];
							point.y = numbers[j + 1];
						}
						break;

					case 'A':
						var numbers = parseFloats(data);
						for (var j = 0, jl = numbers.length; j < jl; j += 7) {
							var start = point.clone();
							point.x = numbers[j + 5];
							point.y = numbers[j + 6];
							control.x = point.x;
							control.y = point.y;
							parseArcCommand(
								path, numbers[j], numbers[j + 1], numbers[j + 2], numbers[j + 3], numbers[j + 4], start, point
							);
						}
						break;

					//

					case 'm':
						var numbers = parseFloats(data);
						for (var j = 0, jl = numbers.length; j < jl; j += 2) {
							point.x += numbers[j + 0];
							point.y += numbers[j + 1];
							control.x = point.x;
							control.y = point.y;
							if (j === 0) {
								path.moveTo(point.x, point.y);
							} else {
								path.lineTo(point.x, point.y);
							}
						}
						break;

					case 'h':
						var numbers = parseFloats(data);
						for (var j = 0, jl = numbers.length; j < jl; j++) {
							point.x += numbers[j];
							control.x = point.x;
							control.y = point.y;
							path.lineTo(point.x, point.y);
						}
						break;

					case 'v':
						var numbers = parseFloats(data);
						for (var j = 0, jl = numbers.length; j < jl; j++) {
							point.y += numbers[j];
							control.x = point.x;
							control.y = point.y;
							path.lineTo(point.x, point.y);
						}
						break;

					case 'l':
						var numbers = parseFloats(data);
						for (var j = 0, jl = numbers.length; j < jl; j += 2) {
							point.x += numbers[j + 0];
							point.y += numbers[j + 1];
							control.x = point.x;
							control.y = point.y;
							path.lineTo(point.x, point.y);
						}
						break;

					case 'c':
						var numbers = parseFloats(data);
						for (var j = 0, jl = numbers.length; j < jl; j += 6) {
							path.bezierCurveTo(
								point.x + numbers[j + 0],
								point.y + numbers[j + 1],
								point.x + numbers[j + 2],
								point.y + numbers[j + 3],
								point.x + numbers[j + 4],
								point.y + numbers[j + 5]
							);
							control.x = point.x + numbers[j + 2];
							control.y = point.y + numbers[j + 3];
							point.x += numbers[j + 4];
							point.y += numbers[j + 5];
						}
						break;

					case 's':
						var numbers = parseFloats(data);
						for (var j = 0, jl = numbers.length; j < jl; j += 4) {
							path.bezierCurveTo(
								getReflection(point.x, control.x),
								getReflection(point.y, control.y),
								point.x + numbers[j + 0],
								point.y + numbers[j + 1],
								point.x + numbers[j + 2],
								point.y + numbers[j + 3]
							);
							control.x = point.x + numbers[j + 0];
							control.y = point.y + numbers[j + 1];
							point.x += numbers[j + 2];
							point.y += numbers[j + 3];
						}
						break;

					case 'q':
						var numbers = parseFloats(data);
						for (var j = 0, jl = numbers.length; j < jl; j += 4) {
							path.quadraticCurveTo(
								point.x + numbers[j + 0],
								point.y + numbers[j + 1],
								point.x + numbers[j + 2],
								point.y + numbers[j + 3]
							);
							control.x = point.x + numbers[j + 0];
							control.y = point.y + numbers[j + 1];
							point.x += numbers[j + 2];
							point.y += numbers[j + 3];
						}
						break;

					case 't':
						var numbers = parseFloats(data);
						for (var j = 0, jl = numbers.length; j < jl; j += 2) {
							var rx = getReflection(point.x, control.x);
							var ry = getReflection(point.y, control.y);
							path.quadraticCurveTo(
								rx,
								ry,
								point.x + numbers[j + 0],
								point.y + numbers[j + 1]
							);
							control.x = rx;
							control.y = ry;
							point.x = point.x + numbers[j + 0];
							point.y = point.y + numbers[j + 1];
						}
						break;

					case 'a':
						var numbers = parseFloats(data);
						for (var j = 0, jl = numbers.length; j < jl; j += 7) {
							var start = point.clone();
							point.x += numbers[j + 5];
							point.y += numbers[j + 6];
							control.x = point.x;
							control.y = point.y;
							parseArcCommand(
								path, numbers[j], numbers[j + 1], numbers[j + 2], numbers[j + 3], numbers[j + 4], start, point
							);
						}
						break;

					//

					case 'Z':
					case 'z':
						path.currentPath.autoClose = true;
						if (path.currentPath.curves.length > 0) {
							// Reset point to beginning of Path
							point.copy(firstPoint);
							path.currentPath.currentPoint.copy(point);
							isFirstPoint = true;
						}
						break;

					default:
						console.warn(command);
				}

				if (doSetFirstPoint) {

					firstPoint.copy(point);

					doSetFirstPoint = false;
				}
			}

			return path;
		}

		/**
		 * https://www.w3.org/TR/SVG/implnote.html#ArcImplementationNotes
		 * https://mortoray.com/2017/02/16/rendering-an-svg-elliptical-arc-as-bezier-curves/ Appendix: Endpoint to center arc conversion
		 * From
		 * rx ry x-axis-rotation large-arc-flag sweep-flag x y
		 * To
		 * aX, aY, xRadius, yRadius, aStartAngle, aEndAngle, aClockwise, aRotation
		 */
		function parseArcCommand(path, rx, ry, x_axis_rotation, large_arc_flag, sweep_flag, start, end) {

			x_axis_rotation = x_axis_rotation * Math.PI / 180;

			// Ensure radii are positive
			rx = Math.abs(rx);
			ry = Math.abs(ry);

			// Compute (x1′, y1′)
			var dx2 = (start.x - end.x) / 2.0;
			var dy2 = (start.y - end.y) / 2.0;
			var x1p = Math.cos(x_axis_rotation) * dx2 + Math.sin(x_axis_rotation) * dy2;
			var y1p = - Math.sin(x_axis_rotation) * dx2 + Math.cos(x_axis_rotation) * dy2;

			// Compute (cx′, cy′)
			var rxs = rx * rx;
			var rys = ry * ry;
			var x1ps = x1p * x1p;
			var y1ps = y1p * y1p;

			// Ensure radii are large enough
			var cr = x1ps / rxs + y1ps / rys;

			if (cr > 1) {
				// scale up rx,ry equally so cr == 1
				var s = Math.sqrt(cr);
				rx = s * rx;
				ry = s * ry;
				rxs = rx * rx;
				rys = ry * ry;
			}

			var dq = (rxs * y1ps + rys * x1ps);
			var pq = (rxs * rys - dq) / dq;
			var q = Math.sqrt(Math.max(0, pq));
			if (large_arc_flag === sweep_flag) q = - q;
			var cxp = q * rx * y1p / ry;
			var cyp = - q * ry * x1p / rx;

			// Step 3: Compute (cx, cy) from (cx′, cy′)
			var cx = Math.cos(x_axis_rotation) * cxp - Math.sin(x_axis_rotation) * cyp + (start.x + end.x) / 2;
			var cy = Math.sin(x_axis_rotation) * cxp + Math.cos(x_axis_rotation) * cyp + (start.y + end.y) / 2;

			// Step 4: Compute θ1 and Δθ
			var theta = svgAngle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
			var delta = svgAngle((x1p - cxp) / rx, (y1p - cyp) / ry, (- x1p - cxp) / rx, (- y1p - cyp) / ry) % (Math.PI * 2);

			path.currentPath.absellipse(cx, cy, rx, ry, theta, theta + delta, sweep_flag === 0, x_axis_rotation);
		}

		function svgAngle(ux, uy, vx, vy) {

			var dot = ux * vx + uy * vy;
			var len = Math.sqrt(ux * ux + uy * uy) * Math.sqrt(vx * vx + vy * vy);
			var ang = Math.acos(Math.max(-1, Math.min(1, dot / len))); // floating point precision, slightly over values appear
			if ((ux * vy - uy * vx) < 0) ang = - ang;
			return ang;
		}

		function parseRectNode(node, style) {

			var x = parseFloat(node.getAttribute('x') || 0);
			var y = parseFloat(node.getAttribute('y') || 0);
			var rx = parseFloat(node.getAttribute('rx') || 0);
			var ry = parseFloat(node.getAttribute('ry') || 0);
			var width = parseFloat(node.getAttribute('width'));
			var height = parseFloat(node.getAttribute('height'));

			var path = new THREE.ShapePath();
			setColorFromStyle(path, style);

			// rounded corners example
			// https://github.com/jstenback/inkscape-gcode/blob/master/src/export_gcode.py

			const SELF_ZERO = 0.0000001;

			if (width > 0.0 && height >= 0.0) {
				if ((rx < width / 2.0) && (ry < height / 2.0)) {
					if (rx + ry > 0.0) {
						var p1 = new THREE.Vector2(x + rx, y);
						var p2 = new THREE.Vector2(x + width - rx, y);
						var p3 = new THREE.Vector2(x + width, y + ry);
						var p4 = new THREE.Vector2(x + width, y + height - ry);
						var p5 = new THREE.Vector2(x + width - rx, y + height);
						var p6 = new THREE.Vector2(x + rx, y + height);
						var p7 = new THREE.Vector2(x, y + height - ry);
						var p8 = new THREE.Vector2(x, y + ry);

						if ((Math.abs(rx - ry) < SELF_ZERO)) {
							var subpath = new THREE.Path();

							// Use arcs for corners
							var c23 = new THREE.Vector2(x + width - rx, y + ry);
							var c45 = new THREE.Vector2(x + width - rx, y + height - ry);
							var c67 = new THREE.Vector2(x + rx, y + height - ry);
							var c81 = new THREE.Vector2(x + rx, y + ry);

							StraightLineSegment(subpath, p1, p2);
							ArcSegment(subpath, p2, p3, c23, false);
							StraightLineSegment(subpath, p3, p4);
							ArcSegment(subpath, p4, p5, c45, false);
							StraightLineSegment(subpath, p5, p6);
							ArcSegment(subpath, p6, p7, c67, false);
							StraightLineSegment(subpath, p7, p8);
							ArcSegment(subpath, p8, p1, c81, false);

							path.subPaths.push(subpath);

						} else {
							var subpath = new THREE.Path();

							// Use biarcs for corners
							var p2t = new THREE.Vector2(x + width - rx / 2, y);
							var p3t = new THREE.Vector2(x + width, y + ry / 2);
							var p4t = new THREE.Vector2(x + width, y + height - ry / 2);
							var p5t = new THREE.Vector2(x + width - rx / 2, y + height);
							var p6t = new THREE.Vector2(x + rx / 2, y + height);
							var p7t = new THREE.Vector2(x, y + height - ry / 2);
							var p8t = new THREE.Vector2(x, y + ry / 2);
							var p1t = new THREE.Vector2(x + rx / 2, y);

							StraightLineSegment(subpath, p1, p2);
							BezierSegment(subpath, p2, p3, p2t, p3t);
							StraightLineSegment(subpath, p3, p4);
							BezierSegment(subpath, p4, p5, p4t, p5t);
							StraightLineSegment(subpath, p5, p6);
							BezierSegment(subpath, p6, p7, p6t, p7t);
							StraightLineSegment(subpath, p7, p8);
							BezierSegment(subpath, p8, p1, p8t, p1t);

							path.subPaths.push(subpath);
						}
					} else {
						var subpath = new THREE.Path();

						// Straight edges
						var p1 = new THREE.Vector2(x, y);
						var p2 = new THREE.Vector2(x + width, y);
						var p3 = new THREE.Vector2(x + width, y + height);
						var p4 = new THREE.Vector2(x, y + height);

						StraightLineSegment(subpath, p1, p2);
						StraightLineSegment(subpath, p2, p3);
						StraightLineSegment(subpath, p3, p4);
						StraightLineSegment(subpath, p4, p1);

						path.subPaths.push(subpath);
					}
				}
			}

			return path;
		}

		function StraightLineSegment(subpath, p1, p2) {
			if (subpath.currentPoint.x != p1.x || subpath.currentPoint.y != p1.y) {
				subpath.moveTo(p1.x, p1.y);
			}
			subpath.lineTo(p2.x, p2.y);
		}

		function ArcSegment(subpath, p1, p2, c, aClockwise) {
			var radius = c.distanceTo(p1);
			var angle1 = findAngleRadians(c, p1);
			var angle2 = findAngleRadians(c, p2);
			subpath.absarc(c.x, c.y, radius, angle1, angle2, aClockwise);
		}

		function BezierSegment(subpath, p1, p2, p1t, p2t) {
			if (subpath.currentPoint.x != p1.x || subpath.currentPoint.y != p1.y) {
				subpath.moveTo(p1.x, p1.y);
			}
			subpath.bezierCurveTo(p1t.x, p1t.y, p2t.x, p2t.y, p2.x, p2.y);
		}

		/**
		 * Calculates the angle ABC (in radians)  
		 * @param {vector} A - first point, ex: {x: 0, y: 0}
		 * @param {vector} B - second point
		 * @param {vector} C - center point
		 */
		function findAngle(A, B, C) {
			var AB = Math.sqrt(Math.pow(B.x - A.x, 2) + Math.pow(B.y - A.y, 2));
			var BC = Math.sqrt(Math.pow(B.x - C.x, 2) + Math.pow(B.y - C.y, 2));
			var AC = Math.sqrt(Math.pow(C.x - A.x, 2) + Math.pow(C.y - A.y, 2));
			return Math.acos((BC * BC + AB * AB - AC * AC) / (2 * BC * AB));
		}

		/**
		 * Calculates the angle in radians
		 * @param {vector} p1 - first point, ex: {x: 0, y: 0}
		 * @param {vector} p2 - second point
		 */
		function findAngleRadians(p1, p2) {
			return Math.atan2(p2.y - p1.y, p2.x - p1.x);
		}

		function parsePolygonNode(node, style) {

			function iterator(match, a, b) {

				var x = parseFloat(a);
				var y = parseFloat(b);

				if (index === 0) {
					path.moveTo(x, y);
				} else {
					path.lineTo(x, y);
				}

				index++;
			}

			var regex = /(-?[\d\.?]+)[,|\s](-?[\d\.?]+)/g;

			var path = new THREE.ShapePath();
			setColorFromStyle(path, style);

			var index = 0;

			node.getAttribute('points').replace(regex, iterator);

			path.currentPath.autoClose = true;

			return path;
		}

		function parsePolylineNode(node, style) {

			function iterator(match, a, b) {

				var x = parseFloat(a);
				var y = parseFloat(b);

				if (index === 0) {
					path.moveTo(x, y);
				} else {
					path.lineTo(x, y);
				}

				index++;
			}

			var regex = /(-?[\d\.?]+)[,|\s](-?[\d\.?]+)/g;

			var path = new THREE.ShapePath();
			setColorFromStyle(path, style);

			var index = 0;

			node.getAttribute('points').replace(regex, iterator);

			path.currentPath.autoClose = false;

			return path;
		}

		function parseCircleNode(node, style) {

			var x = parseFloat(node.getAttribute('cx'));
			var y = parseFloat(node.getAttribute('cy'));
			var r = parseFloat(node.getAttribute('r'));

			var subpath = new THREE.Path();
			subpath.absarc(x, y, r, 0, Math.PI * 2);

			var path = new THREE.ShapePath();
			setColorFromStyle(path, style);
			path.subPaths.push(subpath);

			return path;
		}

		function parseEllipseNode(node, style) {

			var x = parseFloat(node.getAttribute('cx'));
			var y = parseFloat(node.getAttribute('cy'));
			var rx = parseFloat(node.getAttribute('rx'));
			var ry = parseFloat(node.getAttribute('ry'));

			var subpath = new THREE.Path();
			subpath.absellipse(x, y, rx, ry, 0, Math.PI * 2);

			var path = new THREE.ShapePath();
			setColorFromStyle(path, style);
			path.subPaths.push(subpath);

			return path;
		}

		function parseLineNode(node, style) {

			var x1 = parseFloat(node.getAttribute('x1'));
			var y1 = parseFloat(node.getAttribute('y1'));
			var x2 = parseFloat(node.getAttribute('x2'));
			var y2 = parseFloat(node.getAttribute('y2'));

			var path = new THREE.ShapePath();
			path.moveTo(x1, y1);
			path.lineTo(x2, y2);
			path.currentPath.autoClose = false;
			setColorFromStyle(path, style);

			return path;
		}

		function parseDimensions(node) {

			// SVG Import Default Resolution (px/inch):
			// Illustrator: 72
			// Inkscape: 90
			// OpenSCAD: 25.4  // as 1 inch is 25.4 millimeters

			// width="8.5in" height="11in" viewBox="0 0 8.5 11"
			// width="20mm" height="20mm" viewBox="0 -20 20 20"

			// Read these numbers to determine the scale of the data inside the file.
			// width and height are the real-world widths and heights
			// viewbox is how we're going to scale the numbers in the file (expressed in pixels) to the native units of this program, which is mm

			var width = 0;
			var widthUOM = null;
			var widthMM = 0;
			if (node.hasAttribute('width')) {
				var numberObject = parseNumberWithOptionalUnit(node.getAttribute('width'));
				if (numberObject.isValid) {
					width = numberObject.number;
					widthUOM = numberObject.unitOfMeasure;
					widthMM = numberObject.numberMM;
				}
			}

			var height = 0;
			var heightUOM = null;
			var heightMM = 0;
			if (node.hasAttribute('height')) {
				var numberObject = parseNumberWithOptionalUnit(node.getAttribute('height'));
				if (numberObject.isValid) {
					height = numberObject.number;
					heightUOM = numberObject.unitOfMeasure;
					heightMM = numberObject.numberMM;
				}
			}

			// The 'ViewBox' is how we scale an mm to a pixel.
			// The default is 90dpi but it may not be.
			var scale = 1.0; // set mm to the default unit
			var minX = 0;
			var minY = 0;
			if (node.hasAttribute('viewBox')) {
				var viewBox = node.getAttribute('viewBox');
				var viewBoxArgs = viewBox.split(/\s+|,/);
				minX = parseFloat(viewBoxArgs[0]);
				minY = parseFloat(viewBoxArgs[1]);

				if (width <= 0) {
					scale = 1.0; // set mm to the default unit
					width = parseFloat(viewBoxArgs[2]);
					widthMM = width;
				} else {
					scale = (widthMM / viewBoxArgs[2]);
					minX *= scale;
					minY *= scale;
				}

				if (height <= 0) {
					height = parseFloat(viewBoxArgs[3]);
					heightMM = height;
				}
			}

			console.log('SVG Import width: ' + widthMM + ', height: ' + heightMM + ', minX: ' + minX + ', minY: ' + minY + ', scale: ' + scale);

			return { width: widthMM, height: heightMM, minX: minX, minY: minY, scale: scale };
		}

		function parseNumberWithOptionalUnit(value) {

			var numberRegexp = /([0-9]+(?:\.[0-9]+)?)(\w*)/g;
			var match = numberRegexp.exec(value);
			if (match != null) {
				var numberString = match[1];
				var number = parseFloat(numberString)
				var unitString = match[2];
				var numberMM = scaleValueWithUnit(numberString, unitString);
				return { isValid: true, number: number, unitOfMeasure: unitString, numberMM: numberMM };
			} else {
				return { isValid: false };
			}
		}

		/**
		 * Scale a passed value with the defined unit into mm
		 * i.e. 4mm or 6in
		 * @param {float} value - unit less value (defaults to mm)
		 * @param {string} unit - unit (cm, mm, in, pt, pc)
		 */
		function scaleValueWithUnit(value, unit) {

			// Read the unit
			// default is mm
			switch (unit.toLowerCase()) {
				case "in": // convert to mm
					value *= 25.4;
					break;
				case "mm": // no conversion needed
				case "":
					break;
				case "cm": // convert from cm
					value *= 10.0;
					break;
				case "pt": // 1 point = 1/72 in
					value = value * 25.4 / 72;
					break;
				case "pc": // 1 pica = 1/6 in
					value = value * 25.4 / 6;
					break;
			}

			return parseFloat(value);
		}

		function parseStyle(node, style) {

			style = Object.assign({}, style); // clone style

			if (node.hasAttribute('opacity')) style.opacity = node.getAttribute('opacity');
			if (node.style.opacity !== '') style.opacity = node.style.opacity;

			if (node.hasAttribute('fill')) style.fill = node.getAttribute('fill');
			if (node.style.fill !== '') style.fill = node.style.fill;

			// unset the fill variable if it is not visible
			if (style.fill !== 'none' || style.fill !== 'transparent') delete style.fill;

			if (node.hasAttribute('fill-opacity')) style.fillOpacity = node.getAttribute('fill-opacity');
			if (node.style.fillOpacity !== '') style.fillOpacity = node.style.fillOpacity;

			if (node.hasAttribute('stroke')) style.stroke = node.getAttribute('stroke');
			if (node.style.stroke != '') style.stroke = node.style.stroke;

			if (node.hasAttribute('stroke-width')) style.strokeWidth = node.getAttribute('stroke-width');
			if (node.style.strokeWidth != '') style.strokeWidth = node.style.strokeWidth;

			if (node.hasAttribute('stroke-opacity')) style.strokeOpacity = node.getAttribute('stroke-opacity');
			if (node.style.strokeOpacity != '') style.strokeOpacity = node.style.strokeOpacity;

			return style;
		}

		function isVisible(style) {

			// if stroke has color and stroke-width isn't 0
			var hasStroke = (typeof style.stroke != 'undefined') || style.strokeWidth > 0;

			return hasStroke || style.fill !== 'none' && style.fill !== 'transparent';
		}

		// http://www.w3.org/TR/SVG11/implnote.html#PathElementImplementationNotes
		function getReflection(a, b) {

			return a - (b - a);

		}

		function parseFloats(string) {

			// Handle concatinated values like 48.6037.7.8
			// https://stackoverflow.com/questions/48560516/regex-to-split-minifiyed-svg-path
			var array = string.match(/-?\d*(\.\d+)?([eE]-?\d*)?/g).filter(function (n) { return n != '' });

			for (var i = 0; i < array.length; i++) {

				var number = array[i];
				array[i] = parseFloat(number);
			}

			return array;
		}

		function getNodeTransform(node) {

			if (!node.hasAttribute('transform')) {
				return null;
			}

			var transform = parseTransformNode(node);

			if (transform) {

				if (transformStack.length > 0) {
					transform.premultiply(transformStack[transformStack.length - 1]);
				}

				currentTransform.copy(transform);
				transformStack.push(transform);

			}

			return transform;
		}

		function parseTransformNode(node) {

			var transformAttr = node.getAttribute('transform');
			var transform = null;
			var openParPos = transformAttr.indexOf("(");
			var closeParPos = transformAttr.indexOf(")");

			if (openParPos > 0 && openParPos < closeParPos) {

				var transformType = transformAttr.substr(0, openParPos);

				var array = parseFloats(transformAttr.substr(openParPos + 1, closeParPos - openParPos - 1));

				switch (transformType) {

					case "translate":

						if (array.length >= 1) {

							transform = new THREE.Matrix3();

							var tx = array[0];
							var ty = tx;

							if (array.length >= 2) {

								ty = array[1];

							}

							transform.translate(tx, ty);
						}

						break;

					case "rotate":

						if (array.length >= 1) {

							var angle = 0;
							var cx = 0;
							var cy = 0;

							transform = new THREE.Matrix3();

							// Angle
							angle = - array[0] * Math.PI / 180;

							if (array.length >= 3) {

								// Center x, y
								cx = array[1];
								cy = array[2];

							}

							// Rotate around center (cx, cy)
							tempTransform1.identity().translate(-cx, -cy);
							tempTransform2.identity().rotate(angle);
							tempTransform3.multiplyMatrices(tempTransform2, tempTransform1);
							tempTransform1.identity().translate(cx, cy);
							transform.multiplyMatrices(tempTransform1, tempTransform3);
						}

						break;

					case "scale":

						if (array.length >= 1) {

							transform = new THREE.Matrix3();

							var scaleX = array[0];
							var scaleY = scaleX;

							if (array.length >= 2) {
								scaleY = array[1];
							}

							transform.scale(scaleX, scaleY);
						}

						break;

					case "skewX":

						if (array.length === 1) {

							transform = new THREE.Matrix3();

							transform.set(
								1, Math.tan(array[0] * Math.PI / 180), 0,
								0, 1, 0,
								0, 0, 1
							);
						}

						break;

					case "skewY":

						if (array.length === 1) {

							transform = new THREE.Matrix3();

							transform.set(
								1, 0, 0,
								Math.tan(array[0] * Math.PI / 180), 1, 0,
								0, 0, 1
							);
						}

						break;

					case "matrix":

						if (array.length === 6) {

							transform = new THREE.Matrix3();

							transform.set(
								array[0], array[2], array[4],
								array[1], array[3], array[5],
								0, 0, 1
							);
						}

						break;
				}
			}

			return transform;
		}

		function transformPath(path, m) {

			function transfVec2(v2) {

				tempV3.set(v2.x, v2.y, 1).applyMatrix3(m);

				v2.set(tempV3.x, tempV3.y);
			}

			var isRotated = isTransformRotated(m);

			var tempV2 = new THREE.Vector2();
			var tempV3 = new THREE.Vector3();

			var subPaths = path.subPaths;

			for (var i = 0, n = subPaths.length; i < n; i++) {

				var subPath = subPaths[i];
				var curves = subPath.curves;

				for (var j = 0; j < curves.length; j++) {

					var curve = curves[j];

					if (curve.isLineCurve) {

						transfVec2(curve.v1);
						transfVec2(curve.v2);

					} else if (curve.isCubicBezierCurve) {

						transfVec2(curve.v0);
						transfVec2(curve.v1);
						transfVec2(curve.v2);
						transfVec2(curve.v3);

					} else if (curve.isQuadraticBezierCurve) {

						transfVec2(curve.v0);
						transfVec2(curve.v1);
						transfVec2(curve.v2);

					} else if (curve.isEllipseCurve) {

						if (isRotated) {
							console.warn("SVGLoader: Elliptic arc or ellipse rotation or skewing is not implemented.");
						}

						tempV2.set(curve.aX, curve.aY);
						transfVec2(tempV2);
						curve.aX = tempV2.x;
						curve.aY = tempV2.y;

						curve.xRadius *= getTransformScaleX(m);
						curve.yRadius *= getTransformScaleY(m);
					}
				}
			}
		}

		function isTransformRotated(m) {
			return m.elements[1] !== 0 || m.elements[3] !== 0;
		}

		function getTransformScaleX(m) {
			var te = m.elements;
			return Math.sqrt(te[0] * te[0] + te[1] * te[1])
		}

		function getTransformScaleY(m) {
			var te = m.elements;
			return Math.sqrt(te[3] * te[3] + te[4] * te[4])
		}

		// start parsing

		console.log('THREE.SVGLoader');

		var paths = [];

		var transformStack = [];

		var tempTransform1 = new THREE.Matrix3();
		var tempTransform2 = new THREE.Matrix3();
		var tempTransform3 = new THREE.Matrix3();

		var currentTransform = new THREE.Matrix3();

		console.time('THREE.SVGLoader: DOMParser');

		var xml = new DOMParser().parseFromString(text, 'image/svg+xml'); // application/xml

		console.timeEnd('THREE.SVGLoader: DOMParser');

		console.time('THREE.SVGLoader: Parse');

		parseNode(xml.documentElement, { fill: '#000' });

		console.timeEnd('THREE.SVGLoader: Parse');

		return paths;
	}
};
