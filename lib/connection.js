var sys = require('sys');
var EventEmitter = require('events').EventEmitter;
var framing = require('./framing');
var oldFraming = require('./oldFraming');

function Connection(socket, version, url, protocol) {
    var that = this;
    EventEmitter.call(this);
    this.socket = socket;
    // For user access:
    this.url = url;
    this.protocol = protocol;

    var ended = false;  // state
    socket.on('end', function() {
	socket.end();
    });

    var proxyEvent = function(type) {
	socket.on(type, function(e) {
	    var args = Array.prototype.slice(arguments);
	    that.emit.apply(that, [type].concat(args));
	});
    };
    proxyEvent('drain');
    proxyEvent('error');
    proxyEvent('close');

    var reader;
    if (version === 2) {
	reader = new framing.MessageReader();
	reader.on('message', function(op, payload) {
	    if (op === 'text') {
		that.emit('data', payload.toString('utf-8'));
	    } else if (op === 'binary') {
		that.emit('data', payload);
	    } else if (op === 'ping') {
		var w = that.makeWriter('pong');
		w.end(payload);
	    } else if (op === 'close') {
		that.emit('end');

		var w = that.makeWriter('close');
		w.end();
		socket.end();
	    }
        });

	// prototype.send already applies to draft version 2
    } else {
	reader = new oldFraming.MessageReader();
	reader.on('message', function(payload) {
	    that.emit('data', payload);
	});

	this.send = function(msg) {
	    oldFraming.writeMessage(socket, msg);
	};
    }

    socket.on('data', function(data) {
	reader.write(data);
    });
};
sys.inherits(Connection, EventEmitter);
module.exports = Connection;

Connection.prototype.makeWriter = function(op) {
    return new framing.MessageWriter(socket, op);
};

Connection.prototype.send = function(payload) {
    var w = new framing.MessageWriter(this.socket,
				      (payload.constructor === Buffer) ? 'binary' : 'text');
    w.end(payload);
};

Connection.prototype.end = function() {
    var w = this.makeWriter('close');
    w.end();
    this.socket.end();
};
