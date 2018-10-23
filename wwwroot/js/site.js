Split(['#splitPanel1', '#splitPanel2'], {
    sizes: [80, 20],
    onDragEnd: function (sizes) {
        console.log(JSON.stringify(sizes));

        this.renderer.setSize(this.element.width(), this.element.height());
        this.camera.aspect = this.element.width() / this.element.height();
        this.camera.updateProjectionMatrix();
        this.wakeAnimate();
    }
});

// variable that holds all table rows
var tableRows = undefined;

// attach an onclick event handler to the table rows 
$("#gcodelist").on('click', 'tr', function (e) {
    e.stopPropagation();

    // find clicked row index
    var clickedRowIndex = $(this).index();

    // // find currently selected row index
    // var tableRowIndex = $('#gcodelist tbody tr.table-active').index();

    // // check there is a row selected
    // if (tableRowIndex >= 0 && tableRowIndex < tableRows.length) {
    //     if (tableRowIndex == clickedRowIndex) {
    //         return;
    //     }
    // }

    highlightRow(clickedRowIndex);
});

// handle key presses
$("#gcodelist").on('keydown', function (e) {

    switch (e.which) {
        case 38:
            // up arrow
            e.stopPropagation();
            highlightRow($('#gcodelist tbody tr.table-active').index() - 1);
            break;
        case 40:
            // down Arrow
            e.stopPropagation();
            highlightRow($('#gcodelist tbody tr.table-active').index() + 1);
            break;
        case 13:
            // enter
            break;
        case 32:
            // spacebar
            break;
        case 113:
            // F2
            break;
    }
});

// $("#gcodelist tbody").on('scroll', function (e) {
//     var binder = $("#gcodelist tbody");
//     var scroll = binder.scrollTop();
//     console.log('scroll pos: ' + scroll);
// });

var highlightRowGrp = undefined;

function highlightRow(tableRowIndex) {
    // if .table-active has reached the last, start again
    if ((tableRowIndex + 1) > tableRows.length)
        tableRowIndex = 0;

    // if .table-active has reached the furst, start from the end
    if ((tableRowIndex < 0))
        tableRowIndex = tableRows.length - 1;

    // check if element exists
    var selectedTableRow = $('#gcodelist tbody tr:eq(' + tableRowIndex + ')');
    if (selectedTableRow.length > 0) {
        // remove other highlights from all table rows
        tableRows.removeClass('table-active');

        // highlight your target
        selectedTableRow.addClass('table-active');

        // and make sure to scroll the row into view
        scrollIntoView(selectedTableRow[0], "#gcodelist tbody");

        // find gcode line number
        var gcodeLineNumber = selectedTableRow.find('th');
        if (gcodeLineNumber.length > 0) {
            var lineNumber = gcodeLineNumber[0].innerHTML;
            var lineIndex = lineNumber - 1;
            // console.log('lineNumber: ' + lineNumber);

            var lines = object.userData.lines;
            var line = lines[lineIndex];
            // console.log('line: ' + line.args.origtext);
            if (this.object) {
                stopSampleRun();
                scene.remove(this.object);
            }

            if (this.highlightRowGrp != null) {
                // remove all previous preview items
                // Note! children.forEach remove doesn't work
                this.highlightRowGrp.children.length = 0;

                stopSampleRun();
                scene.remove(this.highlightRowGrp);
            }

            this.isNoSleepMode = true;
            this.wakeAnimate();

            var lineMat = new THREE.LineBasicMaterial({
                color: 0x000000,
                transparent: true,
                opacity: 1,
            });

            this.highlightRowGrp = new THREE.Group();
            if (lines[lineIndex].p2.g2 || lines[lineIndex].p2.g3) {
                var numSegments = lines[lineIndex].p2.threeObjArc.geometry.vertices.length;

                for (let i = 0; i < numSegments - 1; i++) {
                    // console.log("arc line nr: " + i + " of " + numSegments);

                    let startArcLine = lines[lineIndex].p2.threeObjArc.geometry.vertices[i];
                    let endArcLine = lines[lineIndex].p2.threeObjArc.geometry.vertices[i + 1];

                    // console.log("start line:", startArcLine);
                    // console.log("end line:", endArcLine);

                    // create a new line to show path
                    var lineGeo = new THREE.Geometry();
                    lineGeo.vertices.push(
                        new THREE.Vector3(startArcLine.x, startArcLine.y, startArcLine.z),
                        new THREE.Vector3(endArcLine.x, endArcLine.y, endArcLine.z)
                    );
                    var line = new THREE.Line(lineGeo, lineMat);
                    this.highlightRowGrp.add(line);
                    scene.add(this.highlightRowGrp);
                }
            } else {
                var endLine = lines[lineIndex].p2;
                if (!lines[lineIndex].args.isFake) {

                    // find next correct tween, i.e. ignore fake commands
                    var isLooking = true;
                    var indxStart = lineIndex - 1;

                    while (isLooking) {
                        if (indxStart < 0) {
                            console.log("we are out of lines to look at");
                            break;
                        }
                        if (lines[indxStart].args.isFake) {
                            // this is fake, skip it
                        } else {
                            // we found a good one. use it
                            isLooking = false;
                            break;
                        }
                        indxStart--;
                    }

                    // either start at origin [0,0,0] or indxStart
                    var startLine;
                    if (lines[indxStart] && lines[indxStart].p2) {
                        startLine = lines[indxStart].p2;
                    } else {
                        startLine = { x: 0, y: 0, z: 0 };
                    }

                    var lineGeo = new THREE.Geometry();
                    lineGeo.vertices.push(
                        new THREE.Vector3(startLine.x, startLine.y, startLine.z),
                        new THREE.Vector3(endLine.x, endLine.y, endLine.z)
                    );
                    var line = new THREE.Line(lineGeo, lineMat);
                    this.highlightRowGrp.add(line);
                    scene.add(this.highlightRowGrp);
                }
            }
        }
    }
}

function scrollIntoView(element, container) {
    var containerTop = $(container).scrollTop();
    var containerBottom = containerTop + $(container).height();
    var containerOffsetTop = $(container)[0].offsetTop;
    var elemTop = element.offsetTop - containerOffsetTop;
    var elemBottom = elemTop + $(element).height();
    if (elemTop < containerTop) {
        $(container).scrollTop(elemTop);
    } else if (elemBottom > containerBottom) {
        $(container).scrollTop(elemBottom - $(container).height());
    }
}

// dynamically create the table of gcode elements
function getTable() {
    var tbody = $('#gcodelist tbody');

    // clear table
    $("#gcodelist > tbody").html("");

    for (let i = 0; i < this.object.userData.lines.length; i++) {
        var line = this.object.userData.lines[i];

        if (line.args.origtext != '') {
            tbody.append('<tr><th scope="row">' + (i + 1) + '</th><td>' + line.args.origtext + '</td></tr>');
        }
    }

    // set tableRows to the newly generated table rows
    tableRows = $('#gcodelist tbody tr');
}

