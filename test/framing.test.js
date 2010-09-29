var framing = require('../lib/framing');

function runFrameParser(datas) {
    var parser = new framing.FrameParser();
    var frames = [];
    parser.on('frame', function(frame) {
        // For easy comparison:
        frames.push(frame.more, frame.opcode, frame.data.toString('binary'));
    });
    // Simulate arbitrary fragmentation:
    datas.forEach(function(data) {
        if (typeof data === 'string')
            data = new Buffer(data, 'binary');
        parser.write(data);
    });
    return frames;
}

function runMessageReader(datas) {
    var reader = new framing.MessageReader();
    var messages = [];
    reader.on('message', function(op, payload) {
        messages.push(op, payload);
    });
    // Simulate arbitrary fragmentation:
    datas.forEach(function(data) {
        if (typeof data === 'string')
            data = new Buffer(data, 'binary');
        reader.write(data);
    });
    return messages;
}

function makeMessageWriter(op) {
    var written = '';
    var socket = {
        write: function(data) {
            written += data.toString('binary');
        }
    };
    var writer = new framing.MessageWriter(socket, op);
    writer.getWritten = function() { return written; };
    return writer;
}

module.exports = {
    'single-frame text message': function(assert, next) {
        assert.eql([false, 4, 'Hello'],
                   runFrameParser(['\x04\x05H', 'ello']));
        assert.eql(['text', 'Hello'],
                   runMessageReader(['\x04\x05He', 'llo']));

        var w = makeMessageWriter('text');
        w.end('Hello');
        assert.eql('\x04\x05Hello', w.getWritten());

        next();
    },
    'fragmented text message': function(assert, next) {
        assert.eql([true, 4, 'Hel', false, 0, 'lo'],
                   runFrameParser(['\x84\x03Hel\x00\x02lo']));

        assert.eql(['text', 'Hello'],
                   runMessageReader(['\x84\x03He', 'l\x00\x02lo']));
        var w = makeMessageWriter('text');
        w.write('Hel');
        w.end('lo');
        assert.eql('\x84\x03Hel\x00\x02lo', w.getWritten());

        next();
    },
    'ping request': function(assert, next) {
        assert.eql([false, 2, 'Hello'],
                   runFrameParser(['\x02\x05Hello']));

        next();
    },
    'ping response': function(assert, next) {
        assert.eql([false, 3, 'Hello'],
                   runFrameParser(['\x03', '\x05Hello']));

        next();
    },
    '256 bytes binary message in a single frame': function(assert, next) {
        var d = genData(256);
        assert.eql([false, 5, d.toString('binary')],
                   runFrameParser(['\x05\x7e\x01\x00', d]));

        next();
    },
    '64KiB binary message in a single frame': function(assert, next) {
        var d = genData(65536);
        assert.eql([false, 5, d.toString('binary')],
                   runFrameParser(['\x05\x7f\x00\x00\x00\x00\x00\x01\x00\x00', d]));

        next();
    }
};

function genData(length) {
    var b = new Buffer(length);
    var i;
    for(i = 0; i < b.length; i++)
        b[i] = Math.floor(Math.random() * 256);
    return b;
}
