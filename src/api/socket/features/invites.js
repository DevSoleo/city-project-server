const mongodb = require('../../../database')
const mongoose = require('mongoose')

const moment = require('moment')

const { getCharacterIdFromName } = require('../../../character')
const { pullMailBox } = require('./mailbox')

const { handleSocketError } = require('../errors')

const isAlreadyInvited = (sender, receiver) => {
    return mongodb.models.Invite.findOne({ sender: sender }).then((invite) => {
        if (invite) {
            for (const [_, value] of Object.entries(invite.receiver)) {
                if (value.character_id.toString() == receiver.toString()) {
                    return true
                }
            }
        }

        return false
    })
}

const inviteCharacter = async (io, socket, sender, receiver) => {
    // On type correctement les variables sender et receiver
    try {
        // Validation des entrées
        sender = new mongoose.Types.ObjectId(sender)
        receiver = new mongoose.Types.ObjectId(await getCharacterIdFromName(receiver))
        if (!receiver) throw new Error("CHARACTER_NOT_FOUND")

        // Vérifier si l'expéditeur et le destinataire sont différents
        if (sender.toString() === receiver.toString()) throw new Error("SELF_INVITE")

        // Essayer de trouver l'invitation
        const invite = await mongodb.models.Invite.findOne({ sender: sender })

        // Début de la transaction
        const session = await mongoose.startSession()
        session.startTransaction()

        try {
            let invite_id
            // Si l'invitation n'existe pas, on la crée
            if (!invite) { 
                let new_invite = await mongodb.models.Invite.collection.insertOne({
                    sender: sender,
                    receiver: [
                        { 
                            _id: new mongoose.mongo.ObjectId(),
                            character_id: receiver,
                            status: 0,
                            date: new Date(moment().format())
                        }
                    ]
                }, { session: session })

                invite_id = new_invite.insertedId
            } else { // Sinon, on ajoute le destinataire à la liste des destinataires
                // On vérifie si le personnage a déjà été invité par le sender
                for (const [_, value] of Object.entries(invite.receiver)) {
                    if (value.character_id.toString() == receiver.toString()) throw new Error("ALREADY_INVITED")
                }
                
                invite_id = invite._id
                await mongodb.models.Invite.updateOne({ sender: sender }, { $push: { receiver: { character_id: receiver, status: 0, date: new Date(moment().format()) } } }, { session: session })
            }

            // Et on ajoute l'id de l'invitation créée dans la liste des invitations du personnage qui a reçu l'invitation
            await mongodb.models.Character.collection.updateOne({ _id: receiver }, { $push: { invites: invite_id } }, { session: session })
            
            await session.commitTransaction()
            session.endSession()
        } catch (error) {
            await session.abortTransaction()
            session.endSession()

            throw error
        }

        await pullInviteMembers(socket, sender)
        // On met à jour la messagerie du client qui a recu l'invitation
        await pullMailBox(io.to(receiver.toString()), receiver.toString())
    } catch (error) {
        handleSocketError(socket, error.message)
    }
}

const replyToInvite = async (io, socket, sender, receiver, answer) => {
    // answer = true / false

    // On type correctement les variables sender et receiver
    sender = new mongoose.Types.ObjectId(sender)
    receiver = new mongoose.Types.ObjectId(receiver)

    const character = await mongodb.models.Character.findOne({ _id: receiver })

    if (answer) {
        await mongodb.models.Invite.updateMany({ _id: { $in: character.invites }, 'receiver.character_id': receiver }, { $set: { 'receiver.$.status': 2 } })
    }

    // Mettre à jour le statut à 1 (acceptée) pour l'invitation où sender = senderValue
    await mongodb.models.Invite.updateOne(
        { 'sender': sender, 'receiver.character_id': receiver },
        { $set: { 'receiver.$.status': (answer) ? 1 : 2 } }
    )

    // On met à jour la boîte de réception du personnage qui a recu l'invitation
    await pullMailBox(io, socket.character_id)

    // On met à jour la liste d'invitation du client qui a envoyé l'invitation et de tous les autres clients ayant invité le même personnage
    // await updateInvitesList(io, socket.character_id)

    const invites = await mongodb.models.Invite.find({ _id: { $in: character.invites } })

    invites.forEach(invite => {
        pullInviteMembers(io.to(invite.sender.toString()), invite.sender)
    })
}

const pullInviteMembers = async (socket, sender) => {
    mongodb.models.Invite.findOne({ sender: sender }).then((invites) => {
        if (!invites) return
        
        let invites_member_list = invites.receiver

        mongodb.models.Character.find({ _id: { $in: invites_member_list.map((value) => value.character_id) } }).select("character_name").then((characters) => {
            // Créez un objet de correspondance entre les caractères et leurs noms
            let characterMap = {}
            characters.forEach(character => {
                characterMap[character._id] = character.character_name
            })

            // Fusionnez les deux listes en ajoutant la propriété "character_name" à chaque élément de "result"
            let mergedResult = invites_member_list.map(item => ({
                character_id: item.character_id,
                status: item.status,
                character_name: characterMap[item.character_id]
            }))

            // Envoie de la nouvelle liste de membres au client
            socket.emit('update_invite_members', { members_list: mergedResult })
        })
    })
}

module.exports = {
    inviteCharacter,
    replyToInvite,
    pullInviteMembers
}