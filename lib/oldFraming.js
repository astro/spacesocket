var sys = require('sys');
var EventEmitter = require('events').EventEmitter;

function MessageReader() {
    this.msg = null;
}

sys.inherits(MessageReader, EventEmitter);
exports.MessageReader = MessageReader;

MessageReader.prototype.write = function(data) {
    var i;
    if (this.msg === null) {
	// No message yet, skip to \x00
	for(i = 0; i < data.length && data[i] != 0; i++) { }

	if (i < data.length) {
	    this.msg = '';
	    // recurse with rest
	    this.write(data.slice(i + 1, data.length));
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
