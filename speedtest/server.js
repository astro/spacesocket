var Connect = require('connect');
var spacesocket = require('../lib/spacesocket');

var dummyData = '';
for(var i = 0; i < 64 * 1024; i++)
    dummyData += 'Z';

var server = Connect.createServer(
  Connect.logger(),
  Connect.staticProvider(__dirname),
  Connect.errorHandler({ dumpExceptions: true, showStack: true })
);
server.listen(8000);
spacesocket.attach(server, function(conn) {
    if (conn.protocol === 'ping') {
	conn.on('data', function(msg) {
	    if (msg === 'ping')
		conn.send('pong');
	});
    } else if (conn.protocol === 'download') {
	conn.send(dummyData);
	conn.on('drain', function() {
	    conn.send(dummyData);
	});
    } else if (conn.protocol !== 'upload') {
	conn.end();
    }

    conn.on('error', function(e) {
	console.log(e.message);
    });
});

process.on('uncaughtException', function(e) {
    console.log(e.stack);
    // There's no state to clean up. Phew.
});
