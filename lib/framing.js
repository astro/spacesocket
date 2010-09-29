var sys = require('sys');
var EventEmitter = require('events').EventEmitter;

var OPCODES = ['continuation', 'close',
               'ping', 'pong',
               'text', 'binary'];

/**
 * Parses frame-by-frame
 */
function FrameParser() {
    this.bufferLength = 0;
    this.buffers = [];

    // Indicates state
    this.frame = null;
}
sys.inherits(FrameParser, EventEmitter);
exports.FrameParser = FrameParser;

FrameParser.prototype.write = function(data) {
    this.bufferLength += data.length;
    this.buffers.push(data);

    this.parse();
};

FrameParser.prototype.take = function(nBytes) {
    var result, buffer, offset;

    if (this.bufferLength < nBytes)
        return null;
    else {
        result = new Buffer(nBytes);
        offset = 0;

        while(offset < nBytes) {
            if (offset + this.buffers[0].length <= nBytes) {
                buffer = this.buffers.shift();
                buffer.copy(result, offset, 0);
                offset += buffer.length;
            } else {
                buffer = this.buffers[0];
                buffer.copy(result, offset, 0, nBytes - offset);
                this.buffers[0] = buffer.slice(nBytes - offset, buffer.length);
                offset = nBytes;
            }
        }

        this.bufferLength -= result.length;
        return result;
    }
};

FrameParser.prototype.parse = function() {
    if (this.frame === null)
        this.parseHead();
    else
        this.parseData();
};

FrameParser.prototype.parseHead = function() {
    var buf = this.take(2);
    if (buf === null)
        return;  // Nothing to parse yet
    var putBack = function() {  // in case we can't parse the length yet
        this.bufferLength += buf.length;
        this.buffers.splice(0, 0, [buf]);
    };

    var more = (buf[0] & 0x80) !== 0;
    var opcode = buf[0] & 0x0F;
    var length = buf[1] & 0x7F;

    // frame-length-16
    if (length === 0x7E) {
        var lengthBuf = this.take(2);
        if (lengthBuf === null) {
            putBack();
            return;
        }
        length = lengthBuf[0] << 8 |
                lengthBuf[1];
    }
    // frame-length-63
    if (length === 0x7F) {
        var lengthBuf = this.take(8);
        if (lengthBuf === null) {
            putBack();
            return;
        }
        length = lengthBuf[0] << 56 |
                lengthBuf[1] << 48 |
                lengthBuf[2] << 40 |
                lengthBuf[3] << 32 |
                lengthBuf[4] << 24 |
                lengthBuf[5] << 16 |
                lengthBuf[6] << 8 |
                lengthBuf[7];
    }

    this.frame = { length: length,
                   opcode: opcode,
                   more: more
                 };
    this.parse();
};

FrameParser.prototype.parseData = function() {
    var data = this.take(this.frame.length);
    if (data !== null) {
        this.frame.data = data;
        this.emit('frame', this.frame);

        this.frame = null;
        this.parse();
    }
};

/**
 * Joins individual frames
 *
 * TODO: restrict maximum message size
 */
function MessageReader() {
    var that = this;
    this.parser = new FrameParser();

    // State when fragments follow:
    var opcode = null, buffers = [], bufferLength = 0;
    this.parser.on('frame', function(frame) {
        if (opcode == null)
            opcode = frame.opcode;

        buffers.push(frame.data);
        bufferLength += frame.data.length;

        if (frame.more)
            opcode = frame.opcode;
        else {
            // join buffers:
            var payload = new Buffer(bufferLength), offset = 0;
            buffers.forEach(function(buffer) {
                buffer.copy(payload, offset, 0);
                offset += buffer.length;
            });
            var op = OPCODES[opcode];
            if (op === 'text')
                payload = payload.toString('utf-8');
            that.emit('message', op, payload);

            // Reset state:
            opcode = null;
            buffers = [];
            bufferLength = 0;
        }
    });
}
sys.inherits(MessageReader, EventEmitter);
exports.MessageReader = MessageReader;

MessageReader.prototype.write = function(data) {
    this.parser.write(data);
};

function MessageWriter(socket, opcode) {
    this.socket = socket;
    this.opcode = (typeof opcode === 'string') ?
        OPCODES.indexOf(opcode) :
        opcode;
    this.frames = 0;
}
exports.MessageWriter = MessageWriter;

MessageWriter.prototype.write = function(data, isFinal) {
    if (data.constructor !== Buffer) {
        if (typeof data !== 'string')
            data = data.toString();
        data = new Buffer(data, 'utf-8');
    }

    var head;
    if (data.length > 65535) {
        head = new Buffer(10);
        head[1] = 0x7F;
        head[2] = (data.length >> 56) & 0x7F;
        head[3] = (data.length >> 48) & 0xFF;
        head[4] = (data.length >> 40) & 0xFF;
        head[5] = (data.length >> 32) & 0xFF;
        head[6] = (data.length >> 24) & 0xFF;
        head[7] = (data.length >> 16) & 0xFF;
        head[8] = (data.length >> 8) & 0xFF;
        head[9] = data.length & 0xFF;
    } else if (data.length > 125) {
        head = new Buffer(4);
        head[1] = 0x7E;
        head[2] = (data.length >> 8) & 0xFF;
        head[3] = data.length & 0xFF;
    } else {
        head = new Buffer(2);
        head[1] = data.length & 0xFF;
    }

    head[0] = (this.frames === 0) ? this.opcode : 0;
    if (!isFinal)
        head[0] |= 0x80;

    this.socket.write(head);
    this.socket.write(data);
    this.frames++;
};

MessageWriter.prototype.end = function(data) {
    this.write(data || '', true);
};
