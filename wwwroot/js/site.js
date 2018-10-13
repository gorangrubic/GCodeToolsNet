Split(['#one', '#two'], {
    sizes: [80, 20],
    onDragEnd: function (sizes) {
        console.log(JSON.stringify(sizes));

        this.renderer.setSize(this.element.width(), this.element.height());
        this.camera.aspect = this.element.width() / this.element.height();
        this.camera.updateProjectionMatrix();
        this.wakeAnimate();
    }
});

$('.widget-3dviewer-gcode').on('keydown', function (e) {
    e.stopPropagation();

    var textarea = $('.widget-3dviewer-gcode')[0];
    var linenumber = textarea.value.substr(0, textarea.selectionStart).split("\n").length;
    console.log(linenumber);
    // $('.widget-3dviewer-units-indicator').text(v);
});
