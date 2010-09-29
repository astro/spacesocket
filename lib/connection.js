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

    socket.on('end', function() {
        // end is only emitted for a 'close' frame
        socket.end();
    });
    socket.on('drain', function() {
        that.emit('drain');
    });
    socket.on('error', function(e) {
        that.emit('error', e);
    });
    socket.on('close', function() {
        that.emit('close');
    });

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
        reader.on('end', function() {
            oldFraming.writeClose(socket);
            socket.end();
        });

        this.send = function(msg) {
            oldFraming.writeMessage(socket, msg);
            return !(socket._writeQueue && socket._writeQueue.length > 0);
        };
        this.end = function() {
            oldFraming.writeClose(socket);
            socket.end();
        };
    }

    socket.on('data', function(data) {
        reader.write(data);
    });
};
sys.inherits(Connection, EventEmitter);
module.exports = Connection;

// only for framing, not oldFraming, use internally only
Connection.prototype.makeWriter = function(op) {
    return new framing.MessageWriter(socket, op);
};

// only for framing, but overwritten for oldFraming by constructor
Connection.prototype.send = function(payload) {
    var w = new framing.MessageWriter(this.socket,
                                      (payload.constructor === Buffer) ? 'binary' : 'text');
    w.end(payload);
    return !(this.socket._writeQueue && this.socket._writeQueue.length > 0);
};

Connection.prototype.write = function() {
    return this.send.apply(this, arguments);
};

Connection.prototype.end = function() {
    var w = this.makeWriter('close');
    w.end();
    this.socket.end();
};

Connection.prototype.pause = function() {
    this.socket.pause();
};

Connection.prototype.resume = function() {
    this.socket.resume();
};
