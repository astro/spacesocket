if (window && !window.console) {
    var nop = function() { };
    window.console = { log: nop,
                       warn: nop,
                       error: nop };
}

var dummyData = '';
for(var i = 0; i < 1024; i++)
    dummyData += 'Z';

function human(i) {
    var unit = '';
    var units = ['K', 'M', 'G', 'T'];
    while(i > 1024) {
        i /= 1024;
        unit = units.shift();
    }
    return (Math.round(i * 100) / 100) + ' ' + unit;
}

function appendGraph(afterWhat) {
    var w = $('dl#results').innerWidth();
    var c = $('<canvas width="' + w + '" height="32"></canvas>');
    c.insertAfter(afterWhat);
    var canvas = c[0];
    var g = new Graph(canvas, getDuration());
    return g;
}

function Ping(ws) {
    this.ws = ws;
    this.rttSum = 0;
    this.pings = 0;
    $('#ping').text('Opening...');
}

Ping.proto = 'ping';

Ping.prototype.onOpen = function() {
    $('#ping').text('Open');
    this.graph = appendGraph('#ping');

    this.ping();
};

Ping.prototype.onMessage = function(msg) {
    var now = Date.now();

    if (msg !== 'pong') {
        console.warn('Not a pong, but: ' + msg);
        return;
    }

    var rtt = now - this.lastPing;
    this.pings++;
    this.rttSum += rtt;
    if (!this.minRtt ||
        rtt < this.minRtt)
        this.minRtt = rtt;
    if (!this.maxRtt ||
        rtt > this.maxRtt)
        this.maxRtt = rtt;

    this.graph.addData(now, rtt);

    $('#ping').empty();
    $('#ping').append(this.pings + ' pongs, avg: ' +
                    Math.round(this.rttSum / this.pings) +
                    ' ms<br>min: ' + this.minRtt +
                    ' ms, max: ' + this.maxRtt + 'ms');

    if (!this.done)
        this.ping();  // next
    else
        this.ws.close();
};

Ping.prototype.ping = function() {
    this.ws.send('ping');
    this.lastPing = Date.now();
};

Ping.prototype.onDone = function() {
    // Don't close immediately but wait for the last pong
    this.done = true;
};

function Download(ws) {
    this.ws = ws;
    $('#download').text('Opening...');
}

Download.proto = 'download';

Download.prototype.onOpen = function() {
    this.ws.send(getDuration());
    $('#download').text('Open');
    this.graph = appendGraph('#download');
    this.graph.fillStyle = '#779';
};

Download.prototype.onMessage = function(msg) {
    var that = this;
    var now = Date.now();

    if (!this.startTime) {
        this.startTime = now;
        this.lastMessage = now;
        this.bytesRecvd = 0;
    } else {
        this.graph.addData(now, msg.length / Math.max(now - this.lastMessage, 1));

        this.lastMessage = now;
        this.bytesRecvd += msg.length;

        // Schedule (complex) update:
        if (!this.textUpdate) {
            this.textUpdate = setTimeout(function() {
                delete that.textUpdate;

                var elapsed = Math.max(that.lastMessage - that.startTime, 1);
                $('#download').empty();
                $('#download').append('avg: ' +
                                      human(that.bytesRecvd * 1000 / elapsed) + 'B/s<br>' +
                                      human(that.bytesRecvd) + 'B in ' + elapsed +
                                      ' ms');
            }, 100);
        }
    }
};

Download.prototype.onDone = function() {
    this.ws.close();
};

function Upload(ws) {
    this.ws = ws;
    $('#upload').text('Opening...');
}

Upload.proto = 'upload';

Upload.prototype.onOpen = function() {
    var that = this;
    var lastSend;
    this.startTime = Date.now();
    this.bytesSent = 0;
    this.interval = setInterval(function() {
        var bytesSentNow = 0, lastMessageBefore = that.lastMessage;
        while(that.ws.bufferedAmount < dummyData.length) {
            that.ws.send(dummyData);
            that.lastMessage = Date.now();
            bytesSentNow += dummyData.length;
        }
        that.bytesSent += bytesSentNow;
        // Schedule (complex) update:
        if (bytesSentNow > 0 && !that.textUpdate) {
            that.textUpdate = setTimeout(function() {
                delete that.textUpdate;

                var elapsed = Date.now() - that.startTime;
                $('#upload').empty();
                $('#upload').append('avg: ' +
                                    human(that.bytesSent * 1000 / elapsed) + 'B/s<br>' +
                                    human(that.bytesSent) + 'B in ' + elapsed +
                                    ' ms');
            }, 100);
        }
        if (bytesSentNow > 0)
            that.graph.addData(Date.now(), bytesSentNow / Math.max(that.lastMessage - lastMessageBefore, 1));
    }, 1);
    this.graph = appendGraph('#upload');
    this.graph.fillStyle = '#977';
};

Upload.prototype.onDone = function() {
    clearInterval(this.interval);
    this.ws.close();
};

function runTest(t, cb) {
    var url = 'ws://' + document.location.host + '/';
    var ws = new WebSocket(url, t.proto);
    var test = new t(ws);

    var startTimer = function() {
        setTimeout(function() {
            test.onDone();
        }, getDuration() * 1000);
    };

    ws.onopen = function() {
        console.log('open');
        test.onOpen();
        startTimer();
    };
    ws.onmessage = function(ev) {
        test.onMessage(ev.data);
    };
    ws.onclose = function() {
        console.log('close');
        cb();
    };
    ws.onerror = function(e) {
        console.error(e);
        cb();
    };
}

if (!WebSocket) {
    $('#broken').text('Your browser does not support the WebSocket protocol :-(');
} else {
    $('#broken').remove();

    $('body').append('<p class="menu"><input type="submit" id="run" value="Run"> each test for <input id="duration" value="5" size="2"> seconds</p>');
    $('body').append('<dl id="results"></dl>');
    var fields = { ping: 'Roundtrip delay time',
                   download: 'Downstream bandwidth',
                   upload: 'Upstream bandwidth' };
    for(var id in fields) {
        $('#results').append('<dt>' + fields[id] + '</dt><dd id="' + id + '"><i>TBD</i></dd>');
    }

    $('#run').click(function() {
	// clear previous graphs:
	$('canvas').remove();

        $('#run').attr('disabled', 'disabled');
        runTest(Ping, function() {
            runTest(Download, function() {
                runTest(Upload, function() {
                    $('#run').attr('disabled', '');
                });
            });
        });
    });
}

function getDuration() {
    return parseInt($('#duration').val(), 10);
}
