// ===== GET ELEMENTS =====
const board1 = document.getElementById("board1");
const board2 = document.getElementById("board2");
const resetButton = document.getElementById("reset-game");
const turnInfo = document.getElementById("turn-info");
const winnerInfo = document.getElementById("winner-info");
const currentNumberDisplay = document.getElementById("current-number");

// Promo screen elements
const promoOverlay = document.getElementById("promo-overlay");
const promoStartBtn = document.getElementById("promo-start");

// Mode Selection overlay elements
const modeSelectionOverlay = document.getElementById("mode-selection-overlay");
const vsComputerBtn = document.getElementById("vs-computer-btn");
const multiplayerBtn = document.getElementById("multiplayer-btn");

// Toss overlay elements
const tossOverlay = document.getElementById("toss-overlay");
const tossButtons = document.querySelectorAll(".toss-choice");
const tossResult = document.getElementById("toss-result");
const modeBackBtn = document.getElementById("mode-back-btn");

modeBackBtn.addEventListener("click", () => {
  hideModeSelection();
  showPromoOverlay();
});

// ===== GAME STATE =====
let vsComputer = true;
let isMultiplayer = false;
let socket = null;  // global socket declaration
let multiplayerGameId = null;    // Will be set by mode selection
let currentPlayer = 1;
let player1Board = [];
let player2Board = [];
let player1StruckLines = new Set();
let player2StruckLines = new Set();
let gameOver = false;

// Multiplayer-specific state
let playerName = "";
let playerIndex = null;  // 1 or 2 inside room (for identifying player)
let roomId = null;

// ===== OVERLAY CONTROLS =====
function showPromoOverlay() {
  promoOverlay.classList.remove("hidden");
}
function hidePromoOverlay() {
  promoOverlay.classList.add("hidden");
}
function showModeSelection() {
  modeSelectionOverlay.classList.remove("hidden");
}
function hideModeSelection() {
  modeSelectionOverlay.classList.add("hidden");
}
function showToss(allowChoice = false) {
  tossOverlay.classList.remove("hidden");
  if (!isMultiplayer) {
    tossResult.textContent = "";  // Clear previous toss message
    tossButtons.forEach(b => b.disabled = false);
  } else {
    if (allowChoice) {
      tossResult.textContent = "Choose Head or Tail";
      tossButtons.forEach(b => b.disabled = false);  // Enable only for tossing player
    } else {
      tossResult.textContent = "Waiting for toss result from server...";
      tossButtons.forEach(b => b.disabled = true);   // Disable for waiting player
    }
  }
}
function hideToss() {
  tossOverlay.classList.add("hidden");
}

// ===== POPUP MESSAGE FUNCTION =====
function showPopupMessage(message, duration = 3000) {
  // Create popup element
  const popup = document.createElement('div');
  popup.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 20px 30px;
    border-radius: 10px;
    font-size: 18px;
    font-weight: bold;
    text-align: center;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    z-index: 10000;
    animation: popupSlideIn 0.3s ease-out;
  `;
  
  // Add animation keyframes to document if not already added
  if (!document.getElementById('popup-styles')) {
    const style = document.createElement('style');
    style.id = 'popup-styles';
    style.textContent = `
      @keyframes popupSlideIn {
        from {
          opacity: 0;
          transform: translate(-50%, -50%) scale(0.8);
        }
        to {
          opacity: 1;
          transform: translate(-50%, -50%) scale(1);
        }
      }
      @keyframes popupSlideOut {
        from {
          opacity: 1;
          transform: translate(-50%, -50%) scale(1);
        }
        to {
          opacity: 0;
          transform: translate(-50%, -50%) scale(0.8);
        }
      }
    `;
    document.head.appendChild(style);
  }
  
  popup.textContent = message;
  document.body.appendChild(popup);
  
  // Remove popup after specified duration
  setTimeout(() => {
    popup.style.animation = 'popupSlideOut 0.3s ease-out';
    setTimeout(() => {
      if (popup.parentNode) {
        popup.parentNode.removeChild(popup);
      }
    }, 300);
  }, duration);
}

// ===== VS COMPUTER HELPERS =====
function getUnstruckNumbers(boardEl) {
  return Array.from(boardEl.querySelectorAll("div"))
    .filter(c => !c.classList.contains("strike"))
    .map(c => parseInt(c.textContent, 10));
}
function pickComputerNumber() {
  const boardEl = board2;
  const cells = Array.from(boardEl.querySelectorAll("div"));
  const lines = [
    [0,1,2,3,4],[5,6,7,8,9],[10,11,12,13,14],[15,16,17,18,19],[20,21,22,23,24],
    [0,5,10,15,20],[1,6,11,16,21],[2,7,12,17,22],[3,8,13,18,23],[4,9,14,19,24],
    [0,6,12,18,24],[4,8,12,16,20]
  ];
  const scores = new Map();
  lines.forEach(line => {
    const struckCount = line.filter(i => cells[i].classList.contains("strike")).length;
    if (struckCount >= 4) {
      line.forEach(i => {
        if (!cells[i].classList.contains("strike")) {
          const n = parseInt(cells[i].textContent, 10);
          scores.set(n, (scores.get(n) || 0) + 2);
        }
      });
    } else if (struckCount >= 2) {
      line.forEach(i => {
        if (!cells[i].classList.contains("strike")) {
          const n = parseInt(cells[i].textContent, 10);
          scores.set(n, (scores.get(n) || 0) + 1);
        }
      });
    }
  });
  const remaining = getUnstruckNumbers(boardEl);
  if (remaining.length === 0) return null;
  if (scores.size > 0) {
    let best = null, bestScore = -Infinity;
    remaining.forEach(n => {
      const s = scores.get(n) || 0;
      if (s > bestScore) {
        bestScore = s;
        best = n;
      }
    });
    return best ?? remaining[Math.floor(Math.random() * remaining.length)];
  } else {
    return remaining[Math.floor(Math.random() * remaining.length)];
  }
}
function computerTurn() {
  if (!vsComputer || gameOver || currentPlayer !== 2) return;
  const choice = pickComputerNumber();
  if (choice == null) return;
  const target = Array.from(board2.querySelectorAll("div"))
    .find(c => parseInt(c.textContent, 10) === choice && !c.classList.contains("strike"));
  if (target) strikeNumber(target, choice, 2);
}

// ===== GENERATE UNIQUE RANDOM BOARD =====
function generateBoard() {
  let numbers = [];
  while (numbers.length < 25) {
    let num = Math.floor(Math.random() * 25) + 1;
    if (!numbers.includes(num)) numbers.push(num);
  }
  return numbers;
}

// ===== CREATE BOARD =====
function createBoard(boardElement, boardArray, player) {
  boardElement.innerHTML = "";
  for (let i = 0; i < 25; i++) {
    let cell = document.createElement("div");
    cell.textContent = boardArray[i];
    cell.addEventListener("click", () => {
      if (currentPlayer === player && !gameOver) {
        strikeNumber(cell, boardArray[i], player);
      }
    });
    boardElement.appendChild(cell);
  }
}

// ===== STRIKE NUMBER =====
function strikeNumber(cell, number, player, isRemote = false) {
  if (cell.classList.contains("strike") || gameOver) return;

  cell.classList.add("strike");

  // Multiplayer: emit move to server only if local move and game not over
  if (!isRemote && isMultiplayer && socket && !gameOver) {
    socket.emit("chooseNumber", { roomId, player, number });
  }

  // Strike same number on opponent's board
  let opponentBoardEl = player === 1 ? board2 : board1;
  Array.from(opponentBoardEl.querySelectorAll("div")).forEach(c => {
    if (parseInt(c.textContent, 10) === number && !c.classList.contains("strike")) {
      c.classList.add("strike");
    }
  });

  currentNumberDisplay.textContent = `Player ${player} chose number ${number}`;

  checkForBingo(player);
  checkForBingo(player === 1 ? 2 : 1);

  if (!gameOver) {
    updateTurn();
  }
}

// ===== CHECK FOR BINGO =====
function checkForBingo(player) {
  const boardEl = player === 1 ? board1 : board2;
  const struckLinesSet = player === 1 ? player1StruckLines : player2StruckLines;
  const cells = boardEl.querySelectorAll("div");
  const winningLines = [
    [0,1,2,3,4],[5,6,7,8,9],[10,11,12,13,14],[15,16,17,18,19],[20,21,22,23,24],
    [0,5,10,15,20],[1,6,11,16,21],[2,7,12,17,22],[3,8,13,18,23],[4,9,14,19,24],
    [0,6,12,18,24],[4,8,12,16,20]
  ];
  for (let i = 0; i < winningLines.length; i++) {
    const line = winningLines[i];
    if (line.every(idx => cells[idx].classList.contains("strike"))) {
      if (!struckLinesSet.has(i)) {
        struckLinesSet.add(i);
        line.forEach(idx => (cells[idx].style.backgroundColor = "#66ff66"));
      }
    }
  }
  if (struckLinesSet.size >= 5 && !gameOver) {
    winnerInfo.textContent = `🎉 Player ${player} wins with ${struckLinesSet.size} lines!`;
    gameOver = true;
    
    // Emit winner to server in multiplayer mode
    if (isMultiplayer && socket) {
      socket.emit("playerWon", { roomId, winner: player });
    } else {
      // For vs computer mode, show play again button immediately
      showPlayAgainButton();
    }
    
    // Show popup message for winner
    const winnerMessage = player === playerIndex 
      ? `🎉 Congratulations! You won the game!` 
      : `Player ${player} won the game! Better luck next time!`;
    showPopupMessage(winnerMessage, 5000);
  }
}

// ===== UPDATE TURN =====
function updateTurn() {
  if (!gameOver) {
    currentPlayer = currentPlayer === 1 ? 2 : 1;
    turnInfo.textContent = `Player ${currentPlayer}'s turn`;

    if (vsComputer) {
      if (currentPlayer === 1) {
        board1.parentElement.classList.remove("hidden-board");
        board2.parentElement.classList.add("hidden-board");
      } else {
        board1.parentElement.classList.remove("hidden-board");
        board2.parentElement.classList.add("hidden-board");
        setTimeout(computerTurn, 500);
      }
    } else {
      showOnlyYourBoard();
    }
  }
}

// ===== HELPER FUNCTION TO SHOW ONLY PLAYER'S BOARD =====
function showOnlyYourBoard() {
  if (playerIndex === 1) {
    // Player 1 sees only board1 (their own board)
    board1.parentElement.classList.remove("hidden-board");
    board2.parentElement.classList.add("hidden-board");
  } else if (playerIndex === 2) {
    // Player 2 sees only board2 (their own board)
    board1.parentElement.classList.add("hidden-board");
    board2.parentElement.classList.remove("hidden-board");
  }
}

// ===== START GAME =====
function startGame(multiplayerBoards) {
  if (multiplayerBoards && multiplayerBoards.player1Board && multiplayerBoards.player2Board) {
    player1Board = multiplayerBoards.player1Board;
    player2Board = multiplayerBoards.player2Board;
  } else {
    player1Board = generateBoard();
    player2Board = generateBoard();
  }

  createBoard(board1, player1Board, 1);
  createBoard(board2, player2Board, 2);
  player1StruckLines.clear();
  player2StruckLines.clear();
  winnerInfo.textContent = "";
  turnInfo.textContent = "";
  currentNumberDisplay.textContent = "";
  gameOver = false;

  if (vsComputer) {
    board1.parentElement.classList.remove("hidden-board");
    board2.parentElement.classList.add("hidden-board");
  } else {
    // Show both boards before toss result
    board1.parentElement.classList.remove("hidden-board");
    board2.parentElement.classList.remove("hidden-board");
  }
}

// ===== MULTIPLAYER SETUP AND EVENTS =====
function initMultiplayer() {
  playerName = prompt("Enter your name:");
  if (!playerName) {
    alert("Name is required to play multiplayer.");
    return;
  }

  if (!socket) {
    socket = io();
    setupSocketEvents();
  }

  let action;
  while (true) {
    action = prompt("Type 'C' to Create Game or enter Room ID to Join:");
    if (action === null) return;
    action = action.trim();
    if (action.length === 0) {
      alert("Input cannot be empty. Please try again.");
      continue;
    }
    break;
  }

  if (action.toUpperCase() === "C") {
    socket.emit("createRoom", { name: playerName });
  } else {
    socket.emit("joinRoom", { name: playerName, roomId: action.toUpperCase() });
  }

  showToss(); // show toss overlay while waiting
}

function promptTossChoice() {
  const choice = prompt("Choose head or tails (type 'head' or 'tails'):").toLowerCase();
  if (choice !== "head" && choice !== "tails") {
    alert("Invalid choice. Please pick 'head' or 'tails'.");
    return promptTossChoice();
  }
  socket.emit("playerTossChoice", { roomId, player: playerIndex, choice });
}

// Attach event listeners to toss buttons for multiplayer choice
tossButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    if (isMultiplayer && !btn.disabled && playerIndex !== null) {
      const choice = btn.dataset.choice;  // Assume buttons have data-choice="head" or "tail"
      console.log("Toss choice made:", choice);
      socket.emit("playerTossChoice", { roomId, player: playerIndex, choice });
      tossButtons.forEach(b => b.disabled = true); // prevent double choices
    }
  });
});

// Setup socket event listeners for multiplayer
function setupSocketEvents() {
  if (!socket) return;

  socket.on("roomCreated", (data) => {
    roomId = data.roomId;
    playerIndex = 1;
    alert(`Room created! Your Room ID is: ${roomId}. Share this with your opponent to join.`);
  });

  socket.on("roomJoined", (data) => {
    roomId = data.roomId;
    playerIndex = data.playerIndex;
    alert(`Joined Room ${roomId} as Player ${playerIndex}`);
  });

  socket.on("bothPlayersReady", ({ player1Board, player2Board }) => {
    startGame({ player1Board, player2Board });
    // Show both boards before toss result
    board1.parentElement.classList.remove("hidden-board");
    board2.parentElement.classList.remove("hidden-board");

    if (playerIndex === 1) {
      promptTossChoice();  // Player 1 calls toss first (or change as needed)
    }
  });

  socket.on("chooseTossCaller", ({ caller }) => {
    if (caller === playerIndex) {
      tossResult.textContent = "You are chosen to call Heads or Tails.";
      tossButtons.forEach(b => b.disabled = false);
      tossOverlay.classList.remove("hidden");
    } else {
      tossResult.textContent = `Player ${caller} will call Heads or Tails. Please wait...`;
      tossButtons.forEach(b => b.disabled = true);
      tossOverlay.classList.remove("hidden");
    }
  });

  // MODIFIED: Enhanced toss result handler with popup message
  socket.on("tossResult", ({ serverChoice, playerChoice, startingPlayer, tossWinner }) => {
    hideToss(); // Hide toss overlay immediately
    
    // Show popup message about toss winner
    const winnerMessage = tossWinner === playerIndex 
      ? `🎉 You won the toss! You start the game.` 
      : `Player ${tossWinner} won the toss and will start the game.`;
    
    showPopupMessage(winnerMessage, 4000);
    
    // Update game state
    currentPlayer = startingPlayer;
    turnInfo.textContent = `Player ${startingPlayer} starts the game.`;
    
    // Show only the appropriate board for the current player
    showOnlyYourBoard();
  });

  socket.on("turnChanged", ({ currentPlayer: newTurn }) => {
    currentPlayer = newTurn;
    turnInfo.textContent = `Player ${currentPlayer}'s turn`;
    showOnlyYourBoard();
  });

  socket.on("playerMove", ({ player, number }) => {
    // Update local board if move by opponent
    if (player !== playerIndex) {
      const ownBoardEl = playerIndex === 1 ? board1 : board2;
      const cell = Array.from(ownBoardEl.querySelectorAll("div")).find(c => parseInt(c.textContent, 10) === number);
      if (cell) strikeNumber(cell, number, player, true);
    }
  });

  socket.on("gameWinner", ({ winner }) => {
    gameOver = true;
    const winnerMessage = winner === playerIndex 
      ? `🎉 Congratulations! You won the game!` 
      : `Player ${winner} won the game! Better luck next time!`;
    
    showPopupMessage(winnerMessage, 5000);
    winnerInfo.textContent = `🎉 Player ${winner} wins the game!`;
    turnInfo.textContent = "Game Over - Click 'Play Again' to restart";
    
    // Show play again button
    showPlayAgainButton();
    
    console.log(`Game ended: Player ${winner} won!`);
  });

  socket.on("waitingForRestart", () => {
    showPopupMessage("Waiting for other player to agree to restart...", 3000);
  });

  socket.on("gameRestarted", ({ player1Board, player2Board, startingPlayer }) => {
    // Reset game state
    gameOver = false;
    player1StruckLines.clear();
    player2StruckLines.clear();
    currentPlayer = startingPlayer;
    
    // Restart game with new boards
    startGame({ player1Board, player2Board });
    
    // Hide play again button
    hidePlayAgainButton();
    
    // Show popup about new game
    showPopupMessage("New game started! Good luck!", 3000);
    
    // Update turn info
    turnInfo.textContent = `Player ${startingPlayer} starts the new game.`;
    
    // Show appropriate board
    showOnlyYourBoard();
    
    console.log("Game restarted!");
  });

  socket.on("playerLeft", () => {
    alert("The other player has left the game.");
    location.reload();
  });

  socket.on("errorMessage", (msg) => {
    alert(`Error: ${msg}`);
  });
}

// ===== EVENT LISTENERS =====
promoStartBtn.addEventListener("click", () => {
  hidePromoOverlay();
  showModeSelection();
});

vsComputerBtn.addEventListener("click", () => {
  vsComputer = true;
  isMultiplayer = false;
  hideModeSelection();
  currentPlayer = 1; // Player 1 always starts vs computer
  startGame();
  turnInfo.textContent = `Player ${currentPlayer}'s turn`;
  board1.parentElement.classList.remove("hidden-board"); // Show user board
  board2.parentElement.classList.add("hidden-board");    // Hide computer board
});

multiplayerBtn.addEventListener("click", () => {
  vsComputer = false;
  isMultiplayer = true;
  hideModeSelection();
  initMultiplayer();
});

resetButton.addEventListener("click", () => {
  hideToss();
  showPromoOverlay();
  winnerInfo.textContent = "";
  turnInfo.textContent = "";
  currentNumberDisplay.textContent = "";
  tossResult.textContent = "";
  gameOver = false;
  player1StruckLines.clear();
  player2StruckLines.clear();
  board1.parentElement.classList.add("hidden-board");
  board2.parentElement.classList.add("hidden-board");

  if (socket) {
    socket.disconnect();
    socket = null;
  }
  multiplayerGameId = null;
  isMultiplayer = false;
  vsComputer = true;
  currentPlayer = 1;
});

// Show promo overlay on page load and hide mode selection
document.addEventListener("DOMContentLoaded", () => {
  showPromoOverlay();
  modeSelectionOverlay.classList.add("hidden");
});
