const board1 = document.getElementById("board1");
const board2 = document.getElementById("board2");
const nextTurnButton = document.getElementById("next-turn");
const resetButton = document.getElementById("reset-game");
const currentNumberDisplay = document.getElementById("current-number");
const turnInfo = document.getElementById("turn-info");

let currentPlayer = 1;
let drawnNumbers = [];
let player1Board = [];
let player2Board = [];
let allNumbers = Array.from({ length: 75 }, (_, i) => i + 1);

// Function to generate a Bingo board with random numbers
function generateBoard() {
  let numbers = [];
  while (numbers.length < 25) {
    let num = Math.floor(Math.random() * 75) + 1;
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
  if (!cell.classList.contains("strike")) {
    cell.classList.add("strike");
    if (player === 1) {
      player1Board.splice(player1Board.indexOf(number), 1);
    } else {
      player2Board.splice(player2Board.indexOf(number), 1);
    }

    // Check if the player has won (here we are not checking Bingo completion logic yet)
    // if (player1Board.length === 0 || player2Board.length === 0) {
    //   alert(`Player ${player} wins!`);
    // }
  }
}

// Function to get the next random number
function getNextNumber() {
  let randomNum;
  do {
    randomNum = Math.floor(Math.random() * 75) + 1;
  } while (drawnNumbers.includes(randomNum));
  drawnNumbers.push(randomNum);
  return randomNum;
}

// Function to start the game
function startGame() {
  player1Board = generateBoard();
  player2Board = generateBoard();
  createBoard(board1, player1Board, 1);
  createBoard(board2, player2Board, 2);
  drawnNumbers = [];
  currentPlayer = 1;
  turnInfo.textContent = "Player 1's turn";
  currentNumberDisplay.textContent = "";
  nextTurnButton.disabled = false;
}

// Function to handle the turn change
function onNextTurn() {
  const number = getNextNumber();
  currentNumberDisplay.textContent = `Number Drawn: ${number}`;
  turnInfo.textContent = `Player ${currentPlayer === 1 ? 2 : 1}'s turn`;
  
  // Mark the number if it's on the player's board
  markNumberOnBoard(number, currentPlayer);

  currentPlayer = currentPlayer === 1 ? 2 : 1;
}

// Function to mark the drawn number on the player's board
function markNumberOnBoard(number, player) {
  const board = player === 1 ? board1 : board2;
  const cells = board.querySelectorAll('div');
  cells.forEach(cell => {
    if (parseInt(cell.textContent) === number && !cell.classList.contains("strike")) {
      cell.classList.add("strike");
      if (player === 1) {
        player1Board.splice(player1Board.indexOf(number), 1);
      } else {
        player2Board.splice(player2Board.indexOf(number), 1);
      }
    }
  });
}

// Function to reset the game
function resetGame() {
  startGame(); // Calls startGame to reset everything
}

// Start the game when the page loads
startGame();

// Event listeners
nextTurnButton.addEventListener("click", onNextTurn);
resetButton.addEventListener("click", resetGame);
