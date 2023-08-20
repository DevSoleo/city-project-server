const http = require('http')
const express = require('express')
const { Server } = require('socket.io')

const app = express()
const server = http.createServer(app)
const io = new Server(server, {
    cors: {
        origin: "*",  // Autorise toutes les origines
        methods: ["GET", "POST"]
    }
})

const PORT = 3000

// Exposition des fichiers statiques
require('./backend/web').expose(app)

// Connexion à la base de données
require('./backend/database').connect('mongodb://localhost:27017/city-project')

// Gestion des sockets
require('./backend/socket').handle(server)

// Lancement du serveur web
server.listen(PORT, () => {
    console.log(`[http] Serveur en écoute sur le port ${PORT}`);
})