// from https://github.com/tmpvar/gcode-simulator/blob/master/js/svg2gcode.js

function group2gcode(group, settings) {

    settings = settings || {};
    settings.passes = settings.passes || 1;
    settings.materialWidth = settings.materialWidth || 1;
    settings.passWidth = settings.materialWidth / settings.passes;
    settings.scale = settings.scale || 1;
    settings.cutZ = settings.cutZ || -1; // cut z (compensate for the material width)
    settings.safeZ = settings.safeZ || 10;   // safe z
    settings.feedRate = settings.feedRate || 1400;
    settings.seekRate = settings.seekRate || 1100;
    settings.bitWidth = settings.bitWidth || 1; // in mm

    var scale = function (val) {
        return val * settings.scale
    };

    var paths = group.children;
    var idx = paths.length;

    while (idx--) {
        var bounds = { x: Infinity, y: Infinity, x2: -Infinity, y2: -Infinity, area: 0 };

        var line = paths[idx];

        // // find lower and upper bounds
        // var path = line.geometry.vertices;
        // var subidx = path.length;

        // while (subidx--) {
        //     if (path[subidx].x < bounds.x) {
        //         bounds.x = path[subidx].x;
        //     }

        //     if (path[subidx].y < bounds.y) {
        //         bounds.y = path[subidx].y;
        //     }

        //     if (path[subidx].x > bounds.x2) {
        //         bounds.x2 = path[subidx].x;
        //     }

        //     if (path[subidx].y > bounds.y2) {
        //         bounds.y2 = path[subidx].y;
        //     }
        // }

        // get the bounds from the computed bounding box
        bounds.x = line.geometry.boundingBox.min.x;
        bounds.x2 = line.geometry.boundingBox.max.x;
        bounds.y = line.geometry.boundingBox.min.y;
        bounds.y2 = line.geometry.boundingBox.max.y;

        // calculate area
        bounds.area = (1 + bounds.x2 - bounds.x) * (1 + bounds.y2 - bounds.y);
        paths[idx].bounds = bounds;
    }

    // cut the inside parts first
    paths.sort(function (a, b) {
        // sort by area
        return (a.bounds.area < b.bounds.area) ? -1 : 1;
    });

    var gcode = [
        'G90',
        'G1 Z' + settings.safeZ,
        'M4 (start the spindle turning counterclockwise)'
    ];

    for (var pathIdx = 0, pathLength = paths.length; pathIdx < pathLength; pathIdx++) {
        var line = paths[pathIdx];
        var path = line.geometry.vertices;

        // seek to index 0
        // gcode.push(['G1',
        //     'X' + scale(path[0].x),
        //     'Y' + scale(path[0].y),
        //     'F' + settings.seekRate
        // ].join(' '));

        gcode.push(['G0',
            'X' + scale(path[0].x),
            'Y' + scale(path[0].y)
        ].join(' '));

        for (var p = settings.passWidth; p <= settings.materialWidth; p += settings.passWidth) {

            // begin the cut by dropping the tool to the work
            gcode.push(['G1',
                'Z' + (settings.cutZ + p),
                'F' + '200'
            ].join(' '));

            // keep track of the current path being cut, as we may need to reverse it
            var localPath = [];
            // starting the segment with 1 seems to work (instead of 0)
            for (var segmentIdx = 1, segmentLength = path.length; segmentIdx < segmentLength; segmentIdx++) {
                var segment = path[segmentIdx];

                var localSegment = ['G1',
                    'X' + scale(segment.x),
                    'Y' + scale(segment.y),
                    'F' + settings.feedRate
                ].join(' ');

                // feed through the material
                gcode.push(localSegment);
                localPath.push(localSegment);

                // if the path is not closed, reverse it, drop to the next cut depth and cut
                // this handles lines
                if (segmentIdx === segmentLength - 1 &&
                    (segment.x !== path[0].x || segment.y !== path[0].y)) {

                    p += settings.passWidth;
                    if (p < settings.materialWidth) {
                        // begin the cut by dropping the tool to the work
                        gcode.push(['G1',
                            'Z' + (settings.cutZ + p),
                            'F' + '200'
                        ].join(' '));

                        Array.prototype.push.apply(gcode, localPath.reverse());
                    }
                }
            }
        }

        // go safe
        gcode.push(['G1',
            'Z' + settings.safeZ,
            'F' + '300'
        ].join(' '));
    }

    // just wait there 
    gcode.push('G4 P100 (dwell for 100 ms)');

    // turn off the spindle
    gcode.push('M5 (stop the spindle)');

    // go home
    gcode.push('G0 X0 Y0 (go home)');

    return gcode.join('\n');
}