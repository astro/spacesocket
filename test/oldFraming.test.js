var oldFraming = require('../lib/oldFraming');

function runMessageReader(datas) {
    var reader = new oldFraming.MessageReader();
    var messages = [];
    reader.on('message', function(payload) {
        messages.push(payload);
    });
    // Simulate arbitrary fragmentation:
    datas.forEach(function(data) {
        if (typeof data === 'string')
            data = new Buffer(data, 'binary');
        reader.write(data);
    });
    return messages;
}

function write(msg) {
    var written = '';
    var socket = {
        write: function(data) {
            written += data;
        }
    };
    oldFraming.writeMessage(socket, msg);
    return written;
}

module.exports = {
    'parse one message': function(assert, next) {
        assert.eql(['Hello'],
                   runMessageReader(['\x00Hello\xFF']));

        next();
    },
    'parse one fragmented message': function(assert, next) {
        assert.eql(['Hello'],
                   runMessageReader(['\x00', 'H', 'ell', 'o', '\xFF']));

        next();
    },
    'parse two fragmented messages': function(assert, next) {
        assert.eql(['Hello', 'World'],
                   runMessageReader(['\x00Hell', 'o\xFF\x00W', 'orld\xFF']));

        next();
    },
    'write one message': function(assert, next) {
        assert.eql("\x00Hello\xFF",
                   write('Hello'));

        next();
    }
};
