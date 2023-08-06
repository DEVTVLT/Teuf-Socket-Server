const http = require("http");
const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors({
    origin: function (origin, callback) {
        // Liste des origines autorisées
        const allowedOrigins = ['http://exemple.fr', 'http://localhost:3000'];

        // Si l'origine de la requête est dans notre liste ou si la requête n'a pas d'en-tête d'origine (par exemple, pour les requêtes POSTman)
        // alors on autorise l'origine
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Origine non autorisée par la politique CORS'));
        }
    }
}));

app.use(express.static("public"));

const serverPort = process.env.PORT || 3000;
const server = http.createServer(app);
const WebSocket = require("ws");
const connectedUsers = new Set();

let keepAliveId;

const wss =
    process.env.NODE_ENV === "production"
        ? new WebSocket.Server({server})
        : new WebSocket.Server({port: 5001});

server.listen(serverPort);
console.log(`Server started on port ${serverPort} in stage ${process.env.NODE_ENV}`);

wss.on("connection", function (ws, req) {
    console.log("Connection Opened");
    console.log("Client size: ", wss.clients.size);

    if (wss.clients.size === 1) {
        console.log("first connection. starting keepalive");
        keepServerAlive();
    }

    ws.on("message", (data) => {

      const message = data.toString();

        if (message.startsWith("username:")) {
            const username = message.replace("username:", "").trim();
            console.log("Received username: ", username);

            // Associate the username with the WebSocket connection
            ws.username = username;

            // Add the WebSocket connection to the set of connected users
            connectedUsers.add(ws);

            if (wss.clients.size === 1) {
                console.log("first connection. starting keepalive");
                keepServerAlive();
            }
        } else {
            let stringifiedData = data.toString();
            if (stringifiedData === 'pong') {
                console.log('keepAlive');
                return;
            }
            broadcast(ws, stringifiedData, false);
        }
    });

    ws.on("close", (data) => {
        console.log("closing connection");

        connectedUsers.delete(ws);

        if (wss.clients.size === 0) {
            console.log("last client disconnected, stopping keepAlive interval");
            clearInterval(keepAliveId);
        }
    });
});

// Implement broadcast function because of ws doesn't have it
const broadcast = (ws, message, includeSelf) => {
    if (includeSelf) {
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    } else {
        wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }
};

/**
 * Sends a ping message to all connected clients every 50 seconds
 */
const keepServerAlive = () => {
    keepAliveId = setInterval(() => {
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send('ping');
            }
        });
    }, 50000);
};


app.get('/', (req, res) => {
    res.send('Hello World!');
});

// Route API pour obtenir les utilisateurs connectés
app.get('/api/connected-users', (req, res) => {
    // Convertir la liste des utilisateurs connectés en tableau et renvoyer en JSON
    const users = [...connectedUsers].map(user => user); // Supposons que l'utilisateur ait une propriété "id"
    res.json({users});
});
