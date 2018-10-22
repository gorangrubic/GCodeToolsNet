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

// variable that holds the window object
var w = $(window);

// variable that holds all table rows
var tableRows = undefined;

// attach an onclick event handler to the table rows 
$("#gcodelist").on('click', 'tr', function (e) {
    e.stopPropagation();

    // find clicked row index
    var clickedRowIndex = $(this).index();

    // find currently selected row index
    var tableRowIndex = $('#gcodelist tbody tr.table-active').index();

    // check there is a row selected
    if (tableRowIndex >= 0 && tableRowIndex < tableRows.length) {
        if (tableRowIndex == clickedRowIndex) {
            // wavesurfer.playPause();
            return;
        }
    }

    highlightRow(clickedRowIndex);
});

// handle key presses
$("#gcodelist").on('keydown', function (e) {

    switch (e.which) {
        case 38:
            // up arrow
            // e.preventDefault();
            e.stopPropagation();
            // $('#goto_prev').trigger('click');
            highlightRow($('#gcodelist tbody tr.table-active').index() - 1);
            break;
        case 40:
            // down Arrow
            // e.preventDefault();
            e.stopPropagation();
            // $('#goto_next').trigger('click');
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

$("#gcodelist tbody").on('scroll', function (e) {
    var binder = $("#gcodelist tbody");
    var scroll = binder.scrollTop();
    console.log('scroll pos: ' + scroll);
});

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

    // empty table
    $("#gcodelist > tbody").html("");

    for (let i = 0; i < this.object.userData.lines.length; i++) {
        var line = this.object.userData.lines[i];

        if (line.args.origtext != '') {
            tbody.append('<tr><th scope="row"><small>' + (i + 1) + '</small></th><td><small>' + line.args.origtext + '</small></td></tr>');
        }
    }

    // set tableRows to the newly generated table rows
    tableRows = $('#gcodelist tbody tr');
}

function getList() {
    for (let i = 0; i < this.object.userData.lines.length; i++) {
        var line = this.object.userData.lines[i];

        if (line.args.origtext != '') {
            $('.list-group').append("<li class='list-group-item'><small>" + line.args.origtext + "</small></li>");
        }
    }

    $('.list-group').on('keydown', function (e) {

        var firstIndex = $(this).find('.list-group-item').first().index();
        var lastIndex = $(this).find('.list-group-item').last().index();

        e.stopPropagation();
        // e.preventDefault();

        var index = $(this).find('.active').index();

        switch (e.which) {
            case 38:
                // index = (index == firstIndex ? lastIndex : index - 1);
                index = (index == firstIndex ? 0 : index - 1);
                break;
            case 40:
                // index = (index == lastIndex ? 0 : index + 1);
                index = (index == lastIndex ? lastIndex : index + 1);
                break;
        }

        $(this).find('.active').removeClass('active');
        $(this).find('.list-group-item:eq( ' + index + ' )').addClass('active');

        highlightListGroupItem(index);
    });

    $('.list-group-item').on('click', function (e) {
        // e.stopPropagation();
        // e.preventDefault();

        var $this = $(this);
        var index = $this.index();
        highlightListGroupItem(index);

        $('.active').removeClass('active');
        $this.toggleClass('active')
    });
}

function highlightListGroupItem(index) {
    // get gcodelist
    // var w = $('#gcodelist');

    // check if element exists
    var selectedTableRow = $('.list-group .list-group-item:eq( ' + index + ' )');
    if (selectedTableRow.length > 0) {
        // and make sure to scroll the row into view
        // w.scrollTop(selectedTableRow.offset().top - (w.height() / 2));
    }
}

var defaultTreeData = [
    {
        text: 'Parent 1',
        href: '#parent1',
        tags: ['4'],
        nodes: [
            {
                text: 'Child 1',
                href: '#child1',
                tags: ['2'],
                nodes: [
                    {
                        text: 'Grandchild 1',
                        href: '#grandchild1',
                        tags: ['0']
                    },
                    {
                        text: 'Grandchild 2',
                        href: '#grandchild2',
                        tags: ['0']
                    }
                ]
            },
            {
                text: 'Child 2',
                href: '#child2',
                tags: ['0']
            }
        ]
    },
    {
        text: 'Parent 2',
        href: '#parent2',
        tags: ['0']
    },
    {
        text: 'Parent 3',
        href: '#parent3',
        tags: ['0']
    },
    {
        text: 'Parent 4',
        href: '#parent4',
        tags: ['0']
    },
    {
        text: 'Parent 5',
        href: '#parent5',
        tags: ['0']
    }
];

var NodeElement = {
    init: function (text, href, tags, nodes) {
        this.text = text;
        // this.href = href;
        // this.tags = tags;
        // this.nodes = nodes;
    },

    describe: function () {
        var description = this.title + " (" + this.year + ")";
        return description;
    }
};

function getTree() {
    var tree = [];

    for (let i = 0; i < this.object.userData.lines.length; i++) {
        var line = this.object.userData.lines[i];

        if (line.args.origtext != '') {
            var nodeElement = Object.create(NodeElement);
            nodeElement.init(line.args.origtext, "", [], []);
            tree.push(nodeElement);
        }
    }
    $('#treeview').treeview({
        data: tree,
        // enableLinks: true,
        showBorder: false
    });
}

function getTreeJSON() {
    $.getJSON("/api/GetTree", function (tree) {
        $('#treeview').treeview({
            data: tree,
            enableLinks: true,
            showBorder: false
        });
    });
}

