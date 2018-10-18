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

// $('.widget-3dviewer-gcode').on('keydown', function (e) {
//     e.stopPropagation();

//     // var textarea = $('.widget-3dviewer-gcode')[0];
//     // var linenumber = textarea.value.substr(0, textarea.selectionStart).split("\n").length;
//     // console.log(linenumber);
//     // $('.widget-3dviewer-units-indicator').text(v);
// });

// variable that holds the window object
var w = $(window);

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

        highlightRow(index);
    });

    $('.list-group-item').on('click', function (e) {
        // e.stopPropagation();
        // e.preventDefault();

        var $this = $(this);
        var index = $this.index();
        highlightRow(index);

        $('.active').removeClass('active');
        $this.toggleClass('active')
    });
}

function highlightRow(index) {
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

