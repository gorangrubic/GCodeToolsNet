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

