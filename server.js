require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/bingo', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('MongoDB Connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Define Game Schema
const gameSchema = new mongoose.Schema({
  player1Board: [Number],
  player2Board: [Number],
  winner: String,
  createdAt: { type: Date, default: Date.now }
});

const Game = mongoose.model('Game', gameSchema);

// Serve static files from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// API to save game data
app.post('/save-game', async (req, res) => {
  try {
    const { player1Board, player2Board, winner } = req.body;
    const newGame = new Game({ player1Board, player2Board, winner });
    await newGame.save();
    res.status(201).json({ message: 'Game saved successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save game' });
  }
});

// API to get all saved games
app.get('/games', async (req, res) => {
  try {
    const games = await Game.find().sort({ createdAt: -1 });
    res.json(games);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch games' });
  }
});

// Start the server
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
