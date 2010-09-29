# WebSockets From Space*

*\** There are no users in space, only astronauts with the latest browser. Therefore no graceful fallback is attempted.

## API

### Setup

    var server = http.createServer(...);
    server.listen(port);

    require('spacesocket').attach(server, function(conn) {
        dealWithWebSocket(conn);
    });

### Reading

    conn.on('data', function(msg) {
        doStuffWithString(msg);
    });

### Writing

    conn.write('Hello, World');

### Closure

    conn.end();

### Buffer control

    conn.on('drain', function() {
        // socket write queue is empty,
        // send until queueing again:
        while(conn.send(data)) { }
    });

    // Throttle sender for 1s:
    conn.pause();
    setTimeout(function() { conn.resume(); }, 1000);
