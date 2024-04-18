const auth = require('../../auth')
const events = require('./events').events

let connections = []

const destroyPreviousSession = (io, socket) => {
    io.sockets.sockets.forEach((s) => {
        if (connections[socket.character_id] == s.id) {
            console.log('[socket] Déconnexion de la session précédente.')
            s.disconnect()
        }
    })

    connections[socket.character_id] = socket.id

    console.log(connections)
}

const authSocketMiddleware = (socket, next) => {
    let token = socket.handshake.auth.token

    if (socket.handshake.headers.cookie) {
        const cookie_token = socket.handshake.headers.cookie.split("; ").filter((cookie) => {
            return cookie.startsWith("token=")
        })[0].split("=")[1]

        token = cookie_token
    }

    if (token) {
        auth.verifyTokenAuthenticity(token).then((decoded) => {
            socket.account_id = decoded.account_id
            socket.account_name = decoded.account_name
            socket.character_name = decoded.character_name
            socket.character_id = decoded.character_id
    
            socket.join(decoded.character_id)
    
            next()
        }).catch(err => {
            return next(err)
        })
    } else {
        console.log('[socket] No token provided.')
    }
}

const listen = (io, callback) => {
    io.disconnectSockets()

    callback()

    io.use((socket, next) => authSocketMiddleware(socket, next))

    io.on('connection', (socket) => {
        destroyPreviousSession(io, socket)
        
        console.log('[socket] Nouvelle connexion établie.')

        for (const [event, handler] of Object.entries(events)) {
            socket.on(event, (content) => handler({ io: io, socket: socket, content: content }))
        }
    })
}

module.exports = {
    getIo: () => io,
    listen,
}