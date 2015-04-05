// This is the node.js server application

var WebSocketServer = require('websocket').server;
var express = require('express');
var http = require('http');
var app = express();
var fs = require('fs');
var clients = [];

app.use(express.static(__dirname + '/client'));

server = http.createServer(app);

var port = process.env.PORT || 1337;
server.listen(port, function() {
  console.log((new Date()) + " Server is listening on port " + port);
});

// create the server
wsServer = new WebSocketServer({
  httpServer: server
});

function sendCallback(err) {
  if (err) console.error("send() error: " + err);
}

// This callback function is called every time someone
// tries to connect to the WebSocket server
wsServer.on('request', function(request) {
  console.log((new Date()) + ' Connection from origin ' + request.origin + '.');
  var connection = request.accept(null, request.origin);
  console.log(' Connection ' + connection.remoteAddress);
  clients.push(connection);

  // This is the most important callback for us, we'll handle
  // all messages from users here.
  connection.on('message', function(message) {
    if (message.type === 'utf8') {
      // process WebSocket message
      console.log((new Date()) + ' Received Message ' + message.utf8Data);
      // broadcast message to all connected clients
      clients.forEach(function (outputConnection) {
        if (outputConnection != connection) {
          outputConnection.send(message.utf8Data, sendCallback);
        }
      });
    }
  });

  connection.on('close', function(connection) {

    clients.forEach(function (outputConnection) {
      if (outputConnection != connection) {
        outputConnection.send(JSON.stringify({
          "pc": 0,
          "messageType": "bye"
        }));
      }
    });
    // close user connection
    console.log((new Date()) + " Peer disconnected.");
  });
});

