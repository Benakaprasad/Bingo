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

// NEW: Helper function to get player by index
function getPlayerByIndex(room, playerIndex) {
  return room.players.find(p => p.playerIndex === playerIndex);
}

// NEW: Helper function to get opponent info
function getOpponentInfo(room, currentPlayerId) {
  return room.players.find(p => p.id !== currentPlayerId);
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

    rooms[roomId].players.push({ id: socket.id, name: name.trim(), playerIndex: 1 });
    rooms[roomId].boards[socket.id] = generateBoard();

    socket.join(roomId);
    socket.emit("roomCreated", { roomId });
    console.log(`Room ${roomId} created by ${name} (${socket.id})`);
  });
  
  // MODIFIED: Enhanced joinRoom with opponent name sharing
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

    // Get opponent info before adding new player
    const opponentPlayer = room.players.length > 0 ? room.players[0] : null;

    room.players.push({ id: socket.id, name: name.trim(), playerIndex });
    room.boards[socket.id] = generateBoard();

    socket.join(roomId);
    
    // Send room joined confirmation with opponent name if available
    socket.emit("roomJoined", { 
      roomId, 
      playerIndex,
      opponentName: opponentPlayer ? opponentPlayer.name : null
    });

    // Send opponent info to the existing player
    if (opponentPlayer) {
      io.to(opponentPlayer.id).emit("opponentInfo", { opponentName: name.trim() });
      io.to(opponentPlayer.id).emit("playerJoined", { name: name.trim(), roomId });
    }

    console.log(`${name} (${socket.id}) joined room ${roomId} as Player ${playerIndex}`);

    // Start game logic once both players are present
    if (room.players.length === 2) {
      // Randomly select who calls toss
      const callerIndex = Math.random() < 0.5 ? 1 : 2;
      const callerPlayer = getPlayerByIndex(room, callerIndex);
      
      console.log(`${callerPlayer.name} (Player ${callerIndex}) chosen to call toss in room ${roomId}`);
      
      io.to(roomId).emit("chooseTossCaller", { 
        caller: callerIndex,
        callerName: callerPlayer.name 
      });
    }
  });

  // MODIFIED: Enhanced playerTossChoice handler with names
  socket.on("playerTossChoice", ({ roomId, player, choice }) => {
    const room = rooms[roomId];
    if (!room || room.gameStarted) return;

    const serverChoice = Math.random() < 0.5 ? "head" : "tails";
    const tossWinner = (choice === serverChoice) ? player : (player === 1 ? 2 : 1);
    const startingPlayer = tossWinner;

    // Get player names
    const tossWinnerPlayer = getPlayerByIndex(room, tossWinner);
    const callingPlayer = getPlayerByIndex(room, player);

    room.gameStarted = true;
    room.currentTurn = startingPlayer;

    // Send boards to both players with proper player mapping
    const player1Socket = room.players.find(p => p.playerIndex === 1);
    const player2Socket = room.players.find(p => p.playerIndex === 2);

    io.to(roomId).emit("bothPlayersReady", {
      player1Board: room.boards[player1Socket.id],
      player2Board: room.boards[player2Socket.id],
      startingPlayer: room.currentTurn,
      player1Name: player1Socket.name,
      player2Name: player2Socket.name
    });

    // Emit enhanced toss result with clear winner info and names
    io.to(roomId).emit("tossResult", { 
      serverChoice,        // "head"/"tails"
      playerChoice: choice,
      startingPlayer,      // 1 or 2
      tossWinner,          // 1 or 2
      tossWinnerName: tossWinnerPlayer.name,
      callingPlayerName: callingPlayer.name
    });

    console.log(`Coin toss in room ${roomId}: server chose ${serverChoice}, ${callingPlayer.name} chose ${choice}. ${tossWinnerPlayer.name} wins and starts.`);
  });

  // MODIFIED: Enhanced chooseNumber handler with player names
  socket.on("chooseNumber", ({ roomId, player, number }) => {
    const room = rooms[roomId];
    if (!room || !room.gameStarted || room.gameEnded) return;

    const currentPlayer = getPlayerByIndex(room, player);
    if (!currentPlayer || socket.id !== currentPlayer.id) {
      socket.emit("errorMessage", "Not your turn.");
      return;
    }
    if (room.currentTurn !== player) {
      socket.emit("errorMessage", "Not your turn.");
      return;
    }

    // Broadcast chosen number to both players with player name
    io.to(roomId).emit("playerMove", { 
      player, 
      number,
      playerName: currentPlayer.name
    });

    console.log(`${currentPlayer.name} chose number ${number} in room ${roomId}`);

    // Change turn and notify only if game hasn't ended
    if (!room.gameEnded) {
      room.currentTurn = player === 1 ? 2 : 1;
      const nextPlayer = getPlayerByIndex(room, room.currentTurn);
      
      io.to(roomId).emit("turnChanged", { 
        currentPlayer: room.currentTurn,
        currentPlayerName: nextPlayer.name
      });
    }
  });

  // MODIFIED: Enhanced playerWon handler with player names
  socket.on("playerWon", ({ roomId, winner }) => {
    const room = rooms[roomId];
    if (!room || !room.gameStarted || room.gameEnded) return;

    // Mark game as ended
    room.gameEnded = true;
    room.winner = winner;

    const winnerPlayer = getPlayerByIndex(room, winner);

    // Broadcast winner to both players with name
    io.to(roomId).emit("gameWinner", { 
      winner,
      winnerName: winnerPlayer.name
    });

    console.log(`Game in room ${roomId} ended. ${winnerPlayer.name} (Player ${winner}) won!`);
  });

  // MODIFIED: Enhanced restart request with player names
  socket.on("requestRestart", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || !room.gameEnded) return;

    const currentPlayer = room.players.find(p => p.id === socket.id);
    if (!currentPlayer) return;

    const playerIndex = currentPlayer.playerIndex;
    
    // Mark this player as ready for restart
    if (!room.restartRequests) {
      room.restartRequests = new Set();
    }
    room.restartRequests.add(playerIndex);

    console.log(`${currentPlayer.name} (Player ${playerIndex}) requested restart in room ${roomId}`);

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
      const startingPlayerObj = getPlayerByIndex(room, startingPlayer);
      
      room.currentTurn = startingPlayer;
      room.gameStarted = true;

      // Send new game data to both players with names
      io.to(roomId).emit("gameRestarted", {
        player1Board: room.boards[player1Socket.id],
        player2Board: room.boards[player2Socket.id],
        startingPlayer,
        startingPlayerName: startingPlayerObj.name,
        player1Name: player1Socket.name,
        player2Name: player2Socket.name
      });

      console.log(`Game restarted in room ${roomId}, ${startingPlayerObj.name} (Player ${startingPlayer}) starts`);
    } else {
      // Notify the requesting player that we're waiting for the other player
      const otherPlayer = room.players.find(p => p.id !== socket.id);
      socket.emit("waitingForRestart", {
        waitingFor: otherPlayer ? otherPlayer.name : "other player"
      });
    }
  });

  // MODIFIED: Enhanced disconnect handling with player names
  socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${socket.id}`);
    for (const [roomId, room] of Object.entries(rooms)) {
      const playerIndex = room.players.findIndex((p) => p.id === socket.id);
      if (playerIndex !== -1) {
        const disconnectedPlayer = room.players[playerIndex];
        console.log(`${disconnectedPlayer.name} left room ${roomId}`);
        
        room.players.splice(playerIndex, 1);
        delete room.boards[socket.id];
        room.gameStarted = false;

        // Notify remaining players with the name of who left
        io.to(roomId).emit("playerLeft", { 
          playerName: disconnectedPlayer.name 
        });
        
        if (room.players.length === 0) {
          delete rooms[roomId];
          console.log(`Room ${roomId} deleted`);
        }
        break;
      }
    }
  });
});

// MODIFIED: Enhanced internal startGame function with names
function startGame(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  room.gameStarted = true;
  // Toss logic to randomly select starting player
  room.currentTurn = Math.random() < 0.5 ? 1 : 2;
  const startingPlayer = getPlayerByIndex(room, room.currentTurn);

  // Send boards and starting player to each player individually
  const player1Socket = room.players.find(p => p.playerIndex === 1);
  const player2Socket = room.players.find(p => p.playerIndex === 2);
  
  room.players.forEach(player => {
    io.to(player.id).emit("bothPlayersReady", {
      player1Board: room.boards[player1Socket.id],
      player2Board: room.boards[player2Socket.id],
      startingPlayer: room.currentTurn,
      startingPlayerName: startingPlayer.name,
      player1Name: player1Socket.name,
      player2Name: player2Socket.name
    });
  });

  // Emit toss result event to all players in the room with names
  io.to(roomId).emit("tossResult", {
    startingPlayer: room.currentTurn,
    startingPlayerName: startingPlayer.name
  });

  console.log(`Game started in room ${roomId}, ${startingPlayer.name} (player ${room.currentTurn}) starts.`);
}

app.use(express.static("public"));
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
