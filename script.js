const board1 = document.getElementById("board1");
const board2 = document.getElementById("board2");
const resetButton = document.getElementById("reset-game");
const turnInfo = document.getElementById("turn-info");
const winnerInfo = document.getElementById("winner-info");

let currentPlayer = 1;
let player1Board = [];
let player2Board = [];
let player1StruckLines = [];
let player2StruckLines = [];
let allNumbers = Array.from({ length: 25 }, (_, i) => i + 1); // Numbers between 1 and 25
let gameOver = false; // Track whether the game is over

// Function to generate a Bingo board with numbers between 1 and 25
function generateBoard() {
  let numbers = [];
  while (numbers.length < 25) {
    let num = Math.floor(Math.random() * 25) + 1; // Numbers between 1 and 25
    if (!numbers.includes(num)) {
      numbers.push(num);
    }
  }
  return numbers;
}

// Function to create the 5x5 grid for Bingo
function createBoard(boardElement, boardArray, player) {
  boardElement.innerHTML = "";
  for (let i = 0; i < 25; i++) {
    let cell = document.createElement("div");
    cell.textContent = boardArray[i];
    cell.addEventListener("click", () => strikeNumber(cell, boardArray[i], player));
    boardElement.appendChild(cell);
  }
}

// Function to strike a number on the board
function strikeNumber(cell, number, player) {
  if (gameOver) return; // Stop if the game is over

  if (!cell.classList.contains("strike")) {
    cell.classList.add("strike"); // Turns the struck number red
    if (player === 1) {
      player1Board.splice(player1Board.indexOf(number), 1);
    } else {
      player2Board.splice(player2Board.indexOf(number), 1);
    }

    // Check for Bingo after striking a number
    checkForBingo(player);
  }
}

// Function to check for Bingo (5 full rows, columns, or diagonals)
function checkForBingo(player) {
  const board = player === 1 ? board1 : board2;
  const cells = board.querySelectorAll('div');

  const winningLines = [
    // Rows
    [0, 1, 2, 3, 4],
    [5, 6, 7, 8, 9],
    [10, 11, 12, 13, 14],
    [15, 16, 17, 18, 19],
    [20, 21, 22, 23, 24],
    // Columns
    [0, 5, 10, 15, 20],
    [1, 6, 11, 16, 21],
    [2, 7, 12, 17, 22],
    [3, 8, 13, 18, 23],
    [4, 9, 14, 19, 24],
    // Diagonals
    [0, 6, 12, 18, 24],
    [4, 8, 12, 16, 20],
  ];

  let struckLines = [];

  // Check all lines to see if they're fully struck
  for (let i = 0; i < winningLines.length; i++) {
    const line = winningLines[i];
    if (line.every(index => cells[index].classList.contains("strike"))) {
      struckLines.push(i);
      line.forEach(index => cells[index].style.backgroundColor = '#66ff66'); // Highlight winning line in green
    }
  }

  // Now check if the player has struck at least 5 full lines
  if (struckLines.length >= 5) {
    gameOver = true; // Stop the game after 5 lines
    winnerInfo.textContent = `Player ${player} wins with ${struckLines.length} lines!`;
    if (player === 1) {
      player1StruckLines = struckLines;
    } else {
      player2StruckLines = struckLines;
    }
  }
}

// Function to start the game
function startGame() {
  player1Board = generateBoard();
  player2Board = generateBoard();
  createBoard(board1, player1Board, 1);
  createBoard(board2, player2Board, 2);
  player1StruckLines = [];
  player2StruckLines = [];
  winnerInfo.textContent = ""; // Clear any winner message
  turnInfo.textContent = "Player 1's turn";
  gameOver = false; // Reset the game status
}

// Function to reset the game
function resetGame() {
  startGame(); // Calls startGame to reset everything
}

// Start the game when the page loads
startGame();

// Event listener
resetButton.addEventListener("click", resetGame);

// Start the game when the page loads
startGame();

// Event listener
resetButton.addEventListener("click", resetGame);
