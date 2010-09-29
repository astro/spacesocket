var crypto = require('crypto');
var Connection = require('./connection');

// http://tools.ietf.org/html/draft-ietf-hybi-thewebsocketprotocol-02
module.exports.attach = function(server, connListener) {
    server.on('upgrade', function(req, socket, key3) {
        var sendError = function(msg) {
            socket.write("HTTP/1.1 400 " + msg + "\r\n" +
                         "Connection: close\r\n\r\n");
            socket.end();
        };

        // names pertain to the draft
        var key1, key2;
        var keyNumber1, keyNumber2;
        var spaces1, spaces2;
        var part1, part2;
        var hash, challenge;

        // Check all invariants
        if (req.method !== 'GET') {
            sendError('GET method expected');
            return;
        }
        if (!req.headers.upgrade ||
            req.headers.upgrade.toLowerCase() !== 'websocket') {
            sendError('Can only upgrade to WebSocket');
            return;
        }
        if (!req.headers.connection ||
            req.headers.connection.toLowerCase() !== 'upgrade') {
            sendError('WebSocket without Connection: Upgrade');
            return;
        }
        // Allowed to be missing
        if (req.headers['sec-websocket-draft'] &&
            req.headers['sec-websocket-draft'] !== '2') {
            sendError('WebSocket draft not implementeed');
            return;
        }

        key1 = req.headers['sec-websocket-key1'] || '';
        key2 = req.headers['sec-websocket-key2'] || '';

        keyNumber1 = keyDigits(key1);
        spaces1 = keySpaces(key1);
        if (keyNumber1 % spaces1 !== 0) {
            sendError('WebSocket Key1 invalid');
            return;
        }
        part1 = keyNumber1 / spaces1;

        keyNumber2 = keyDigits(key2);
        spaces2 = keySpaces(key2);
        if (keyNumber2 % spaces2 !== 0) {
            sendError('WebSocket Key1 invalid');
            return;
        }
        part2 = keyNumber2 / spaces2;

        if (key3.length != 8) {
            sendError('WebSocket Key3 missing');
            return;
        }

        hash = crypto.createHash('md5');
        hash.update(htonl(part1));
        hash.update(htonl(part2));
        hash.update(key3);
        challenge = hash.digest('binary');

        // TODO: wss:// for https
        var wsUrl = 'ws://' + req.headers.host + req.url;
        // Prepare single write buffer
        socket.write("HTTP/1.1 101 WebSocket Protocol Handshake\r\n" +
                     "Upgrade: WebSocket\r\n" +
                     "Connection: Upgrade\r\n" +
                     "Sec-WebSocket-Location: " + wsUrl + "\r\n" +
                     "Sec-WebSocket-Origin: " + req.headers.origin + "\r\n");
        if (req.headers['sec-websocket-protocol'])
            socket.write("Sec-WebSocket-Protocol: " + req.headers['sec-websocket-protocol'] + "\r\n");
        socket.write("\r\n");
        socket.write(challenge, 'binary');

        var conn = new Connection(socket, req.headers['sec-websocket-protocol'],
                                  req.url, req.headers['sec-websocket-protocol']);
        connListener(conn);
    });
};


function keyDigits(key) {
    return parseInt((key.match(/\d+/g) || []).join(''), 10);
}


/**
 * Amount of spaces in a string
 */
function keySpaces(key) {
    var i, spaces = 0;

    for(i = 0; i < key.length; i++)
        if (key.charAt(i) === ' ')
            spaces++;

    return spaces;
}

function htonl(n) {
    var b = new Buffer(4);
    b[0] = (n >> 24) & 0xFF;
    b[1] = (n >> 16) & 0xFF;
    b[2] = (n >> 8) & 0xFF;
    b[3] = n & 0xFF;
    return b;
}
