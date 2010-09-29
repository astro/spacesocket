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

        this.yTop = this.maxY * 5 / 4;
        this.drawGrid(ctx);
        this.drawData(ctx);

        // // Draw a horizontal line at maxY:
        // ctx.beginPath();
        // ctx.moveTo(0, this.maxY);
        // ctx.lineTo(this.maxT - this.minT, this.maxY);
        // ctx.closePath();
        // ctx.strokeStyle = 'red';
        // ctx.lineWidth = this.maxY / 20;
        // ctx.stroke();
    }
};

Graph.prototype.getX = function(t) {
    var w = this.canvas.width;
    return Math.floor((t - this.minT) * w / (this.maxT - this.minT)) + 0.5;
};

Graph.prototype.getY = function(y) {
    var h = this.canvas.height;
    return Math.floor(h * (1 - y / this.yTop)) + 0.5;
};

Graph.prototype.drawData = function(ctx) {
    var that = this;
    ctx.beginPath();
    ctx.moveTo(this.getX(this.minT), this.getY(0));

    var current = null, lastX = 0;
    var draw = function() {
        if (current) {
            ctx.lineTo(current.x, that.getY(current.y));
	    if (current.y > that.maxY) {
		console.log('maxY: ' + that.maxY + ' -> ' + current.y);
		that.maxY = current.y;
	    }
            current = null;
        }
    };
    var consume = function(d) {
        var x = that.getX(d.t);
        if (current && current.x === x) {
            current.y += d.y;
        } else {
            draw();
            current = { x: x, y: d.y };
        }
        lastX = x;
    };
    this.data.forEach(consume);
    draw();

    ctx.lineTo(lastX, this.getY(0));
    ctx.closePath();
    ctx.fillStyle = this.fillStyle || '#777';
    ctx.globalAlpha = 1;
    ctx.fill();
};

Graph.prototype.drawGrid = function(ctx) {
    var t;
    var duration = this.maxT - this.minT;
    for(t = 0; t <= duration; t += 100) {
        ctx.beginPath();
        ctx.moveTo(this.getX(t + this.minT), this.getY(0));
        ctx.lineTo(this.getX(t + this.minT), this.getY(this.yTop));
        ctx.closePath();

        ctx.strokeStyle = '#333';
        ctx.lineWidth = 0.5;
        if (t % 1000 == 0)
            ctx.globalAlpha = 1;
        else if (t % 500 == 0)
            ctx.globalAlpha = 0.5;
        else
            ctx.globalAlpha = 0.3;
        ctx.stroke();
    }
};
