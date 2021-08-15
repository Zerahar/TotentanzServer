const express = require('express')
const app = express()
const port = process.env.PORT || 3002
const pass = "dbpass123"
const cors = require('cors')

app.get('/', (req, res) => {
  res.send('Hello World!')
})
app.use(express.json())
app.listen(port, () => {
  console.log(`Server started!`)
})

app.use(cors());

var mongo = require('mongodb')
const dev_db_url = `mongodb+srv://dbAdmin:${pass}@cluster0.q4dhm.mongodb.net/app?retryWrites=true&w=majority`
var url = process.env.MONGODB_URI || dev_db_url;
mongo.MongoClient.connect(url, function (err, client) {
  if (err) throw err

  const db = client.db('app')

  // Remove character
  app.get('/character/delete/:charId', (req, res) => {
    const query = { _id: new mongo.ObjectId(req.params.charId) }
    db.collection('characters').deleteOne(query, function (err, result) {
      if (err) throw err
      res.send(result)
      console.log("Removed character ", req.params.charId)
      db.close
    })
  })

  // Fetch all characters
  app.get('/character/', (req, res) => {
    db.collection('characters').find().toArray(function (err, result) {
      if (err) throw err
      res.send(result)
      console.log("Fetched all characters")
      db.close
    })
  })

  // Update character
  app.post('/character/:charId', (req, res) => {
    console.log("Character " + req.params.charId + " updated")
    let promise2, promise3
    const query = { _id: new mongo.ObjectId(req.params.charId) }
    const document = {
      $set: {
        name: req.body.name,
        age: req.body.age,
        player: req.body.player,
        gender: req.body.gender,
        description: req.body.description,
        mechanics: req.body.mechanics,
        saldo: mongo.Double(req.body.saldo),
        plots: req.body.plots,
      }
    }
    // Update character
    const promise1 = new Promise(function (resolve, reject) {
      db.collection('characters').updateOne(query, document, function (err, result) {
        if (err) reject(err)
        console.log("Update 1")
        db.close
        resolve(result)
      })
    })

    // If player changed, update new player
    if (req.body.newPlayer) {
      const query2 = { _id: new mongo.ObjectId(req.body.player) }
      const document2 = {
        $set: {
          character: req.params.charId
        }
      }
      promise2 = new Promise(function (resolve, reject) {
        db.collection('users').updateOne(query2, document2, function (err, result) {
          if (err) reject(err)
          console.log("Update 2")
          db.close
          resolve(result)
        })
      })
    }
    // If there was a previous player, update that as well
    if (req.body.oldPlayer) {
      const query3 = { _id: new mongo.ObjectId(req.body.oldPlayer) }
      const document3 = {
        $set: {
          character: ''
        }
      }
      promise3 = new Promise(function (resolve, reject) {
        db.collection('users').updateOne(query3, document3, function (err, result) {
          if (err) reject(err)
          console.log("Update 3")
          db.close
          resolve(result)
        })
      }
      )
    }
    Promise.all([promise1, promise2, promise3])
      .then(responses => res.send(responses))
      .then(console.log("Updated character ", req.params.charId))
  })

  // Add character
  app.post('/character', (req, res) => {
    const document = {
      name: req.body.name,
      age: req.body.age,
      player: req.body.player,
      gender: req.body.gender,
      description: req.body.description,
      mechanics: req.body.mechanics,
      saldo: mongo.Double(req.body.saldo),
      plots: req.body.plots
    }
    let promise2 = (id) => null
    const promise1 = new Promise(function (resolve, reject) {
      db.collection('characters').insertOne(document, function (err, result) {
        if (err) reject(err)
        resolve(result)
        db.close
      })
    })

    promise2 = (id, previousResult) => new Promise(function (resolve, reject) {
      if (req.body.player) {
        const query2 = { _id: new mongo.ObjectId(req.body.player) }
        db.collection('users').updateOne(query2, {
          $set: {
            character: id
          }
        }, function (err, result) {
          if (err) reject(err)
          resolve([previousResult, result])
          db.close
        })
      }
      else
        resolve([previousResult])
    })
    promise1
      .then(result => promise2(result.insertedId, result))
      .then(result => res.send(result))
      .then(console.log("Added a new character"))
  })

  // Add user
  app.post('/user', (req, res) => {

    db.collection('users').insertOne(req.body, function (err, result) {
      if (err) throw (err)
      db.close
      let results = [result]
      const newId = result.insertedId
      // If user had a character assigned
      if (req.body.character) {
        //If character had a player already, remove from that player
        db.collection('characters').findOne({ _id: new mongo.ObjectId(req.body.character) }, function (err, result) {
          if (err) throw (err)
          db.close
          // Check if it has a player
          if (result.player) {
            // Remove from player
            db.collection('users').updateOne({ _id: new mongo.ObjectId(result.player) }, {
              $set: {
                character: ""
              }
            }, function (err, result) {
              if (err) throw (err)
              db.close
              results.push(result)
            })
          }
          //Update character
          db.collection('characters').updateOne({ _id: new mongo.ObjectId(req.body.character) }, {
            $set: {
              player: newId
            }
          }, function (err, result) {
            if (err) throw (err)
            db.close
            results.push(result)
            res.send(results)
          })
        })
      }
      else {
        res.send(results)
      }
      console.log("Added a new user")
    })
  })

  // Update user
  app.post('/user/:userId', (req, res) => {
    let oldCharacter, newCharacter

    // Check if user had a character assigned
    const query = { _id: new mongo.ObjectId(req.params.userId) }
    const promise = new Promise((resolve, reject) => {
      db.collection('users').findOne(query, function (err, result) {
        if (err) reject(err)
        resolve(result)
        db.close
      })
    })

    // Update user
    const query2 = { _id: new mongo.ObjectId(req.params.userId) }
    const document2 = {
      $set: {
        userName: req.body.userName,
        login: req.body.login,
        character: req.body.character,
        userType: req.body.userType
      }
    }
    const promise2 = new Promise((resolve, reject) => {
      db.collection('users').updateOne(query2, document2, function (err, result) {
        if (err) reject(err)
        resolve(result)
        db.close
      })
    })



    // Check if characters need update
    function editCharacters(old) {
      oldCharacter = old
      newCharacter = req.body.character
      console.log("User character was modified, old character: ", oldCharacter, ", new: ", newCharacter)
      return Promise.all([new Promise((resolve, reject) => {
        if (newCharacter) {
          const query4 = { _id: new mongo.ObjectId(newCharacter) }
          const document4 = {
            $set: {
              player: req.params.userId
            }
          }
          db.collection('characters').updateOne(query4, document4, function (err, result) {
            if (err) reject(err)
            console.log("Updated user's current character")
            db.close
            resolve(result)
          })
        }
        else
          resolve(null)
      }), new Promise((resolve, reject) => {
        if (oldCharacter) {
          const query3 = { _id: new mongo.ObjectId(oldCharacter) }
          const document3 = {
            $set: {
              player: ''
            }
          }
          db.collection('characters').updateOne(query3, document3, function (err, result) {
            if (err) reject(err)
            db.close
            console.log("Updated user's previous character")
            resolve(result)
          })
        }
        else
          resolve(null)
      })])
    }

    // Execute all promises
    promise
      .then(result => result.character === req.body.character ? promise2 : editCharacters(result.character))
      .then(result => res.send(result))
      .then(console.log("Updated user ", req.params.userId))
  })

  // Fetch user
  app.get('/user/:login', (req, res) => {
    const query = { login: req.params.login }
    db.collection('users').findOne(query, function (err, result) {
      if (err) throw err
      if (result) {
        res.send(result)
        console.log("Successfull login attempt, id ", result._id)
      }
      else {
        res.status(404).send('')
        console.log("Unsuccessfull login attempt")
      }
      db.close
    })
  })

  // Fetch all users
  app.get('/user/', (req, res) => {
    console.log("Fetching all users")
    db.collection('users').find().toArray(function (err, result) {
      if (err) throw err
      res.send(result)
      console.log("Fetched all users")
      db.close
    })
  })

  // Remove user
  app.get('/user/delete/:userId', (req, res) => {
    const query = { _id: new mongo.ObjectId(req.params.userId) }
    db.collection('users').deleteOne(query, function (err, result) {
      if (err) throw err
      res.send(result)
      console.log("Removed user ", req.params.userId)
      db.close
    })
  })

  // Add chat
  app.post('/chat', (req, res) => {
    db.collection('chats').insertOne(req.body, function (err, result) {
      if (err) throw err
      res.send(result)
      console.log("Created a new chat, participants: ", req.body.participants)
      db.close
    })
  })

  // Fetch all chats
  app.get('/chat/', (req, res) => {
    db.collection('chats').find().toArray(function (err, result) {
      if (err) throw err
      res.send(result)
      console.log("Fetched all chats")
      db.close
    })
  })

  // Fetch all chats for certain character
  app.get('/chat/:charId', (req, res) => {
    const query = { "participants": req.params.charId }
    db.collection('chats').find(query).toArray(function (err, result) {
      if (err) throw err
      res.send(result)
      console.log("Fetched all chats for character ", req.params.charId)
      db.close
    })
  })
  // Remove chat
  app.get('/chat/delete/:chatId', (req, res) => {
    const query = { _id: new mongo.ObjectId(req.params.chatId) }
    db.collection('chats').deleteOne(query, function (err, result) {
      if (err) throw err
      db.collection('messages').deleteMany({ chat: req.params.chatId }, function (err, result) {
        if (err) throw err
        res.send(result)
        console.log("Removed chat with id ", req.params.chatId)
        db.close
      })

      db.close
    })
  })

  // Fetch a chat
  app.get('/chat/:chatId', (req, res) => {
    const query = { _id: new mongo.ObjectId(req.params.chatId) }
    db.collection('chats').findOne(query, function (err, result) {
      if (err) throw err
      console.log("Fetched a chat with id " + req.params.chatId)
      res.send(result)
      db.close
    })
  })

  // Add payment
  app.post('/pay', (req, res) => {
    const promise = new Promise((resolve, reject) => {
      // Save transaction event
      db.collection('transactions').insertOne(req.body, function (err, result) {
        if (err) reject(err)
        resolve(result)
        db.close
      })
    })
    // Increase recipient's saldo
    const query = { _id: new mongo.ObjectId(req.body.recipient) }
    const document = {
      $inc: {
        saldo: mongo.Double(req.body.amount)
      }
    }
    const promise2 = new Promise((resolve, reject) => {
      db.collection('characters').updateOne(query, document, function (err, result) {
        if (err) reject(err)
        resolve(result)
        db.close
      })
    })
    // Decrease payer's saldo
    const query2 = { _id: new mongo.ObjectId(req.body.user) }
    const document2 = {
      $inc: {
        saldo: mongo.Double(-req.body.amount)
      }
    }
    const promise3 = new Promise((resolve, reject) => {
      db.collection('characters').updateOne(query2, document2, function (err, result) {
        if (err) reject(err)
        resolve(result)
        db.close
      })
    })
    Promise.all([promise, promise2, promise3])
      .then(response => res.send(response))
      .then(console.log(req.body.user, " paid ", req.body.amount, " ED to ", req.body.recipient))
  })


  // Fetch all payments
  app.get('/transaction/', (req, res) => {
    // Sort by timestamps, newest first
    db.collection('transactions').find().sort({ "time": -1 }).toArray(function (err, result) {
      if (err) throw err
      res.send(result)
      console.log("Fetched all payments")
      db.close
    })
  })
})

const { Server } = require('ws');

const wss = new Server({ app });


wss.on('connection', function connection(ws) {
  console.log("New connection")
  ws.on('message', function incoming(rawdata) {
    const data = JSON.parse(rawdata)
    // The new connection sent its identifications
    if (data.type === "new") {
      console.log("New connection identity: ", data)
      ws.characterId = data.id || "admin"
    }
    // User opened a chat
    if (data.type === "openChat") {
      console.log("Chat was opened, id: ", data.chat)
      // send back chat history when chat is opened
      mongo.MongoClient.connect(url, function (err, dbclient) {
        if (err) throw err
        const db = dbclient.db('app')
        db.collection('messages').find({ chat: data.chat }).toArray(function (err, result) {
          if (err) throw err
          console.log("Sent chat history")
          ws.send(JSON.stringify({ type: 'history', data: result }));
          db.close
        })
      })
    }
    // User sent a message in chat
    if (data.type === "message") {
      console.log("Received a message: ", data)
      // Modify for database saving
      var obj = {
        time: (new Date()).getTime(),
        text: data.text,
        author: data.name,
        authorId: data.characterId,
        chat: data.chat._id
      };
      mongo.MongoClient.connect(url, function (err, client) {
        if (err) throw err
        const db = client.db('app')
        db.collection('messages').insertOne(obj, function (err, result) {
          if (err) throw err
          db.close
        })
      })
      console.log("Saved message to database")
    }
    wss.clients.forEach(function each(client) {

      // User sent a message in chat
      if (data.type === "message") {
        // Modify for database saving
        var obj = {
          time: (new Date()).getTime(),
          text: data.text,
          author: data.name,
          authorId: data.id,
          chat: data.chat._id
        };
        // Broadcast if part of the chat
        if (client.readyState === WebSocket.OPEN && (client.characterId === "admin" || data.chat.participants.find(a => a._id == client.characterId))) {
          console.log("Broadcasted to " + client.characterId)
          const packet = { type: "message", data: obj }
          client.send(JSON.stringify(packet));
        }
      }
    });
  });


});
