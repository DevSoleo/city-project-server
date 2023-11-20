const { Server } = require('socket.io')
const mongoose = require('mongoose')

const auth = require('../../auth')

const { onMessage } = require('./features/chat')
const { onLoadMap } = require('./features/map')
const { inviteCharacter, replyToInvite, pullInviteMembers } = require('../socket/features/invites')
const { pullMailBox } = require('../socket/features/mailbox')

let options = {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
}

let io = null

const authSocketMiddleware = (socket, next) => {
    // since you are sending the token with the query
    const token = socket.handshake.auth.token

    auth.verifyTokenAuthenticity(token).then((decoded) => {
        socket.account_id = new mongoose.Types.ObjectId(decoded.account_id)
        socket.account_name = decoded.account_name
        socket.character_name = decoded.character_name
        socket.character_id = new mongoose.Types.ObjectId(decoded.character_id)

        socket.join(decoded.character_id)

        next()
    }).catch(err => {
        return next(err)
    })
}

const listen = (port, callback) => {
    io = new Server(port, options)

    io.disconnectSockets()

    callback()

    io.use((socket, next) => {
        authSocketMiddleware(socket, next)
    })

    io.on('connection', (socket) => {
        console.log('[socket] Nouvelle connexion établie.')

        socket.on('ping', () => {
            socket.emit('pong')
        })  

        // Client --> Push --> Server
        socket.on('push_chat_message', (content) => onMessage(io, socket, content))

        // Envoi d'invitations
        socket.on('push_invite_character', (character) => inviteCharacter(io, socket, socket.character_id, character)) 
    
        // Réponse à une invitation
        socket.on('push_invite_reply', (invite) => replyToInvite(io, socket, invite.sender, socket.character_id, invite.answer))

        // Client <-- Pull <-- Server
        socket.on('pull_map_part', (coords) => onLoadMap(socket, coords.direction))

        // Récupération des membres d'une invitation
        socket.on('pull_invite_characters', () => pullInviteMembers(io.to(socket.character_id.toString()), socket.character_id))
        socket.on('pull_character_mailbox', () => pullMailBox(io.to(socket.character_id.toString()), socket.character_id))
    })
}

module.exports = {
    getIo: () => io,
    listen,
}