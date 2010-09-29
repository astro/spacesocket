function Graph(canvas, duration) {
    this.canvas = canvas;
    this.data = [];
    this.minT = Date.now();
    this.maxT = this.minT + duration * 1000;
    this.maxY = 1;
}

Graph.prototype.addData = function(t, y) {
    if (this.data.length === 0) {
        this.minT = t;
        this.maxT = t + this.maxT - this.minT;
    }

    if (this.data.length > 0 &&
        this.data[this.data.length - 1].t === t) {
	// datum with exact timestamp already exists
        this.data[this.data.length - 1].y += y;
	y = this.data[this.data.length - 1].y;  // for maxY
    } else
        this.data.push({ t: t, y: y });

    if (y > this.maxY)
        this.maxY = y;

    this.scheduleDraw();
};

Graph.prototype.scheduleDraw = function() {
    var that = this;
    if (!this.drawTimer)
        this.drawTimer = setTimeout(function() {
            delete that.drawTimer;
            that.draw();
        }, 50);
};

Graph.prototype.draw = function() {
    var ctx = this.canvas.getContext("2d");
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.data.length > 0) {
        ctx.save();

        this.zoom(ctx);
        this.drawData(ctx);

	// // Draw a horizontal line at maxY:
	// ctx.beginPath();
	// ctx.moveTo(0, this.maxY);
	// ctx.lineTo(this.maxT - this.minT, this.maxY);
	// ctx.closePath();
	// ctx.strokeStyle = 'red';
	// ctx.lineWidth = this.maxY / 20;
	// ctx.stroke();

        ctx.restore();
    }
};

Graph.prototype.zoom = function(ctx) {
    var w = this.canvas.width, h = this.canvas.height;
    var yTop = this.maxY * 5 / 4;

    ctx.translate(0, h);
    ctx.scale(w / (this.maxT - this.minT), -h / yTop);
};

Graph.prototype.drawData = function(ctx) {
    var that = this;
    var lastT;
    ctx.beginPath();
    ctx.moveTo(0, 0);

    this.data.forEach(function(d) {
        ctx.lineTo(d.t - that.minT, d.y);
        lastT = d.t;
    });

    ctx.lineTo(lastT - this.minT, 0);
    ctx.closePath();
    ctx.fillStyle = this.fillStyle || '#777';
    ctx.fill();
};

