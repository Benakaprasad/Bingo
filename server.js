// server.js

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

const rooms = {}; // Store rooms and their players

// Generate unique 4-letter room ID
function generateRoomId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let id = "";
  for (let i = 0; i < 4; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

// Generate a unique random Bingo board (1-25 shuffled)
function generateBoard() {
  const numbers = Array.from({ length: 25 }, (_, i) => i + 1);
  for (let i = numbers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
  }
  return numbers;
}

// Perform coin toss to decide who starts (1 or 2)
function coinToss() {
  return Math.random() < 0.5 ? 1 : 2;
}

io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  // Create a room
  socket.on("createRoom", ({ name }) => {
    let roomId;
    do {
      roomId = generateRoomId();
    } while (rooms[roomId]);

    rooms[roomId] = {
      players: [],
      boards: {},
      currentTurn: null,
      gameStarted: false,
      gameEnded: false,
      winner: null,
      restartRequests: new Set(),
    };

    rooms[roomId].players.push({ id: socket.id, name, playerIndex: 1 });
    rooms[roomId].boards[socket.id] = generateBoard();

    socket.join(roomId);
    socket.emit("roomCreated", { roomId });
    console.log(`Room ${roomId} created by ${name} (${socket.id})`);
  });
  
  // Join existing room
  socket.on("joinRoom", ({ name, roomId }) => {
    const room = rooms[roomId];
    if (!room) {
      socket.emit("errorMessage", "Room does not exist.");
      return;
    }
    if (room.players.length >= 2) {
      socket.emit("errorMessage", "Room is full.");
      return;
    }

    // Assign playerIndex based on current room players count
    const playerIndex = room.players.length === 0 ? 1 : 2;

    room.players.push({ id: socket.id, name, playerIndex });
    room.boards[socket.id] = generateBoard();

    socket.join(roomId);
    socket.emit("roomJoined", { roomId, playerIndex });

    // Notify the other player if any joined
    const otherPlayer = room.players.find(p => p.id !== socket.id);
    if (otherPlayer) {
      io.to(otherPlayer.id).emit("playerJoined", { name, roomId });
    }

    console.log(`${name} (${socket.id}) joined room ${roomId} as Player ${playerIndex}`);

    // Start game logic once both players are present
    if (room.players.length === 2) {
      // Randomly select who calls toss
      const callerIndex = Math.random() < 0.5 ? 1 : 2;
      io.to(roomId).emit("chooseTossCaller", { caller: callerIndex });

      // You can defer actual startGame until after toss is decided
    }
  });

  // MODIFIED: Enhanced playerTossChoice handler
  socket.on("playerTossChoice", ({ roomId, player, choice }) => {
    const room = rooms[roomId];
    if (!room || room.gameStarted) return;

    const serverChoice = Math.random() < 0.5 ? "head" : "tails";
    const tossWinner = (choice === serverChoice) ? player : (player === 1 ? 2 : 1);
    const startingPlayer = tossWinner;

    room.gameStarted = true;
    room.currentTurn = startingPlayer;

    // Send boards to both players with proper player mapping
    const player1Socket = room.players.find(p => p.playerIndex === 1);
    const player2Socket = room.players.find(p => p.playerIndex === 2);

    io.to(roomId).emit("bothPlayersReady", {
      player1Board: room.boards[player1Socket.id],
      player2Board: room.boards[player2Socket.id],
      startingPlayer: room.currentTurn
    });

    // Emit enhanced toss result with clear winner info
    io.to(roomId).emit("tossResult", { 
      serverChoice,        // "head"/"tails"
      playerChoice: choice,
      startingPlayer,      // 1 or 2
      tossWinner          // 1 or 2
    });

    console.log(`Coin toss: server chose ${serverChoice}, player ${player} chose ${choice}. Player ${tossWinner} wins and starts.`);
  });

  // Player chooses a number
  socket.on("chooseNumber", ({ roomId, player, number }) => {
    const room = rooms[roomId];
    if (!room || !room.gameStarted || room.gameEnded) return;

    if (socket.id !== room.players[player - 1].id) {
      socket.emit("errorMessage", "Not your turn.");
      return;
    }
    if (room.currentTurn !== player) {
      socket.emit("errorMessage", "Not your turn.");
      return;
    }

    // Broadcast chosen number to both players
    io.to(roomId).emit("playerMove", { player, number });

    // Change turn and notify only if game hasn't ended
    if (!room.gameEnded) {
      room.currentTurn = player === 1 ? 2 : 1;
      io.to(roomId).emit("turnChanged", { currentPlayer: room.currentTurn });
    }
  });

  // Handle player winning
  socket.on("playerWon", ({ roomId, winner }) => {
    const room = rooms[roomId];
    if (!room || !room.gameStarted || room.gameEnded) return;

    // Mark game as ended
    room.gameEnded = true;
    room.winner = winner;

    // Broadcast winner to both players
    io.to(roomId).emit("gameWinner", { winner });

    console.log(`Game in room ${roomId} ended. Player ${winner} won!`);
  });

  // Handle restart request
  socket.on("requestRestart", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || !room.gameEnded) return;

    const playerIndex = room.players.findIndex(p => p.id === socket.id) + 1;
    
    // Mark this player as ready for restart
    if (!room.restartRequests) {
      room.restartRequests = new Set();
    }
    room.restartRequests.add(playerIndex);

    console.log(`Player ${playerIndex} requested restart in room ${roomId}`);

    // Check if both players want to restart
    if (room.restartRequests.size === 2) {
      // Reset room state
      room.gameStarted = false;
      room.gameEnded = false;
      room.winner = null;
      room.currentTurn = null;
      room.restartRequests.clear();

      // Generate new boards
      const player1Socket = room.players.find(p => p.playerIndex === 1);
      const player2Socket = room.players.find(p => p.playerIndex === 2);
      
      room.boards[player1Socket.id] = generateBoard();
      room.boards[player2Socket.id] = generateBoard();

      // Randomly decide starting player
      const startingPlayer = Math.random() < 0.5 ? 1 : 2;
      room.currentTurn = startingPlayer;
      room.gameStarted = true;

      // Send new game data to both players
      io.to(roomId).emit("gameRestarted", {
        player1Board: room.boards[player1Socket.id],
        player2Board: room.boards[player2Socket.id],
        startingPlayer
      });

      console.log(`Game restarted in room ${roomId}, Player ${startingPlayer} starts`);
    } else {
      // Notify the requesting player that we're waiting for the other player
      socket.emit("waitingForRestart");
    }
  });

  // Disconnect handling
  socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${socket.id}`);
    for (const [roomId, room] of Object.entries(rooms)) {
      const idx = room.players.findIndex((p) => p.id === socket.id);
      if (idx !== -1) {
        room.players.splice(idx, 1);
        delete room.boards[socket.id];
        room.gameStarted = false;

        io.to(roomId).emit("playerLeft");
        if (room.players.length === 0) {
          delete rooms[roomId];
          console.log(`Room ${roomId} deleted`);
        }
        break;
      }
    }
  });
});

// Internal function: start game and decide toss
function startGame(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  room.gameStarted = true;
  // Toss logic to randomly select starting player
  room.currentTurn = Math.random() < 0.5 ? 1 : 2;

  // Send boards and starting player to each player individually
  const player1Socket = room.players.find(p => p.playerIndex === 1);
  const player2Socket = room.players.find(p => p.playerIndex === 2);
  
  room.players.forEach(player => {
    io.to(player.id).emit("bothPlayersReady", {
      player1Board: room.boards[player1Socket.id],
      player2Board: room.boards[player2Socket.id],
      startingPlayer: room.currentTurn
    });
  });

  // Emit toss result event to all players in the room
  io.to(roomId).emit("tossResult", room.currentTurn);

  console.log(`Game started in room ${roomId}, player ${room.currentTurn} starts.`);
}

app.use(express.static("public"));
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
