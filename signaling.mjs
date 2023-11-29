import http from 'node:http';
import WebSocket, { WebSocketServer } from 'ws';

const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Signaling server');
});

// Create a WebSocket server
const wss = new WebSocketServer({ server });

wss.on('connection', ws => {
  ws.on('message', message => {
    // Broadcast any received message to all clients
    // console.log('received: %s', message, ws, wss.clients)
    wss.clients.forEach(client => {
      console.log(client.readyState, client !== ws);
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });
});

// Start the server
server.listen(8080, () => {
  console.log('Server is running on port 8080');
});