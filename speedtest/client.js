var dummyData = '';
for(var i = 0; i < 64 * 1024; i++)
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

function Ping(ws) {
    this.ws = ws;
    this.rttSum = 0;
    this.pings = 0;
}

Ping.proto = 'ping';

Ping.prototype.onOpen = function() {
    this.ping();
};

Ping.prototype.onMessage = function(msg) {
    if (msg !== 'pong') {
	console.warn('Not a pong, but: ' + msg);
	return;
    }

    var rtt = Date.now() - this.lastPing;
    this.pings++;
    this.rttSum += rtt;
    if (!this.minRtt ||
	rtt < this.minRtt)
	this.minRtt = rtt;
    if (!this.maxRtt ||
	rtt > this.maxRtt)
	this.maxRtt = rtt;

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
}

Download.proto = 'download';

Download.prototype.onOpen = function() {
    this.startTime = Date.now();
    this.bytesRecvd = 0;
};

Download.prototype.onMessage = function(msg) {
    this.bytesRecvd += msg.length;
    var elapsed = Date.now() - this.startTime;
    $('#download').empty();
    $('#download').append(human(this.bytesRecvd * 1000 / (elapsed)) + 'B/s<br>' +
			  human(this.bytesRecvd) + 'B in ' + elapsed +
			  ' ms');
};

Download.prototype.onDone = function() {
    this.ws.close();
};

function Upload(ws) {
    this.ws = ws;
}

Upload.proto = 'upload';

Upload.prototype.onOpen = function() {
    var that = this;
    this.startTime = Date.now();
    this.bytesSent = 0;
    this.interval = setInterval(function() {
	if (that.ws.bufferedAmount < 1) {
	    that.ws.send(dummyData);
	    that.bytesSent += dummyData.length;
	    var elapsed = Date.now() - that.startTime;
	    $('#upload').empty();
	    $('#upload').append(human(that.bytesSent * 1000 / elapsed) + 'B/s<br>' +
				human(that.bytesSent) + 'B in ' + elapsed +
				' ms');
	}
    }, 5);
};

Upload.prototype.onDone = function() {
    clearInterval(this.interval);
    this.ws.close();
};

function runTest(t, cb) {
    var url = 'ws://' + document.location.host + '/';
    var ws = new WebSocket(url, t.proto);
    var test = new t(ws);

    ws.onopen = function() {
	console.log('open');
	test.onOpen();
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
	test.onError(e);
    };

    setTimeout(function() {
	test.onDone();
    }, parseInt($('#duration').val(), 10) * 1000);
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