/**
 * These tests are not finished and broken. Asynchronous testing is
 * hard, let's go shopping instead...
 */

var spacesocket = require('../lib/spacesocket');
    http = require('http'),
    net = require('net');

var PORT = 12345;

module.exports = {
    'test from page 5': function(assert, next) {
        var server = http.createServer(function() { });
        server.listen(PORT, '0.0.0.0');
        spacesocket.attach(server);

        var client = net.createConnection(PORT);
        client.on('connect', function() {
            client.write("GET /demo HTTP/1.1\r\n" +
                         "Host: example.com\r\n" +
                         "Connection: Upgrade\r\n" +
                         "Sec-WebSocket-Key2: 12998 5 Y3 1  .P00\r\n"  +
                         "Sec-WebSocket-Protocol: sample\r\n" +
                         "Upgrade: WebSocket\r\n" +
                         "Sec-WebSocket-Key1: 4 @1  46546xW%0l 1 5\r\n" +
                         "Origin: http://example.com\r\n" +
                         "Sec-WebSocket-Draft: 2\r\n" +
                         "\r\n" +
                         "^n:ds[4U");
        });
        client.setEncoding('ascii');  // actually binary, but example is safe
        client.on('data', function(data) {
            console.log(data);
            assert.equal(0, data.indexOf('HTTP/1.1 101 '));
            assert.ok(data.indexOf('Connection: Upgrade') > 0);
            assert.ok(data.indexOf('Upgrade: WebSocket') > 0);
            client.end();
            console.log('next...')
            next();
            console.log('next?')
        });

            /*assert.equal(101, res.statusCode);
            assert.equal('WebSocket', res.headers.upgrade);
            assert.equal('Upgrade', res.headers.connection);
            assert.equal('http://example.com', res.headers['Sec-WebSocket-Origin']);
            // Sec-WebSocket-Location: ws://example.com/demo
            assert.equal('sample', res.headers['Sec-WebSocket-Protocol']);
            assert.equal("8jKS'y:G*Co,Wxa-", head.toString());*/
    }
};
