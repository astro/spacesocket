var sys = require('sys');
var EventEmitter = require('events').EventEmitter;

function MessageReader() {
    // State: null when not in a message
    this.msg = null;
}

sys.inherits(MessageReader, EventEmitter);
exports.MessageReader = MessageReader;

MessageReader.prototype.write = function(data) {
    var i;
    // All messages are at least 2 bytes:
    if (data.length < 2)
        return;

    if (this.msg === null) {
        if (data[0] === 0) {
            // begin text
            this.msg = '';
            // recurse with rest
            this.write(data.slice(1, data.length));
        } else {
            // probably \xFF\x00
            this.emit('end');
        }
    } else {
        // Read until \xFF
        for(i = 0; i < data.length && data[i] !== 0xFF; i++) { }
        this.msg += data.slice(0, i).toString('utf-8');
        if (data[i] == 0xFF) {
            this.emit('message', this.msg);

            this.msg = null;
            // recurse with rest
            this.write(data.slice(i + 1, data.length));
        }
    }
};

function writeMessage(socket, msg) {
    socket.write("\x00", 'binary');
    socket.write(msg, 'utf-8');
    socket.write("\xFF", 'binary');
}
exports.writeMessage = writeMessage;

function writeClose(socket) {
    socket.write("\xFF\x00", 'binary');
}
exports.writeClose = writeClose;
