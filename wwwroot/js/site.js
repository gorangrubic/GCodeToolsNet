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


$('.list-group').on('keydown', function (e) {

    var firstIndex = $(this).find('.list-group-item').first().index();
    var lastIndex = $(this).find('.list-group-item').last().index();

    e.stopPropagation();
    // e.preventDefault();

    var index = $(this).find('.active').index();

    switch (e.which) {
        case 38:
            index = (index == firstIndex ? lastIndex : index - 1);
            break;
        case 40:
            index = (index == lastIndex ? 0 : index + 1);
            break;
    }

    $(this).find('.active').removeClass('active');
    $(this).find('.list-group-item:eq( ' + index + ' )').addClass('active');
});

$('.list-group-item').on('click', function (e) {
    // e.stopPropagation();
    // e.preventDefault();

    var $this = $(this);

    $('.active').removeClass('active');
    $this.toggleClass('active')
})