const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws) => {
  console.log('A client connected');
  
  // When one player marks a number, broadcast it to the other player
  ws.on('message', (message) => {
    // Broadcast to all clients except the sender
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });

  // Handle client disconnect
  ws.on('close', () => {
    console.log('A client disconnected');
  });
});

console.log('WebSocket server started on ws://localhost:8080');
