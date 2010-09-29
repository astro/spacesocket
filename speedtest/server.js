var Connect = require('connect');
var spacesocket = require('../lib/spacesocket');

var dummyData = '';
for(var i = 0; i < 1024; i++)
    dummyData += 'Z';

var server = Connect.createServer(
  Connect.logger(),
  Connect.staticProvider(__dirname),
  Connect.errorHandler({ dumpExceptions: true, showStack: true })
);
var port = parseInt(process.env.PORT, 10) || 8000;
server.listen(port);
spacesocket.attach(server, function(conn) {
    if (conn.protocol === 'ping') {
        conn.on('data', function(msg) {
            if (msg === 'ping')
                conn.write('pong');
        });
    } else if (conn.protocol === 'download') {
        var sender = function() {
            while(conn.write(dummyData)) { }
        };
        conn.on('data', function(msg) {
            var duration = parseInt(msg, 10);
            setTimeout(function() {
                conn.end();
                // Disable sender:
                sender = function() { };
            }, duration * 1000);

            sender();
            conn.on('drain', sender);
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
