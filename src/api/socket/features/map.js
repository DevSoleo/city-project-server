const mongodb = require('../../../database')
const map = require('../../../game/map')

const onLoadMap = (socket, direction) => {
    mongodb.models.Account.findOne({ _id: socket.account_id }).then((account) => {
        mongodb.models.Character.findOne({ owner: account._id }).then((character) => {

            const newCoords = map.moveCamera(character, direction)

            mongodb.models.Character.updateOne({ _id: character }, { coords: newCoords }).then(() => {
                let newPart = map.calcNewPart(newCoords.x, newCoords.y, map.world_map)

                socket.emit('map_part', { map_part: newPart })
            })
        })
    })
}

module.exports = {
    onLoadMap
}