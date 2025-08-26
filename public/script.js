// ======== ELEMENTS ========
const board1 = document.getElementById("board1");
const board2 = document.getElementById("board2");
const resetButton = document.getElementById("reset-game");
const turnInfo = document.getElementById("turn-info");
const winnerInfo = document.getElementById("winner-info");
const currentNumberDisplay = document.getElementById("current-number");
const playAgainButton = document.getElementById("play-again-btn");

const promoOverlay = document.getElementById("promo-overlay");
const promoStartBtn = document.getElementById("promo-start");

const modeSelectionOverlay = document.getElementById("mode-selection-overlay");
const vsComputerBtn = document.getElementById("vs-computer-btn");
const multiplayerBtn = document.getElementById("multiplayer-btn");

const tossOverlay = document.getElementById("toss-overlay");
const tossButtons = document.querySelectorAll(".toss-choice");
const tossResult = document.getElementById("toss-result");
const modeBackBtn = document.getElementById("mode-back-btn");

modeBackBtn.addEventListener("click", () => {
  hideModeSelection();
  showPromoOverlay();
});

// ======== GAME STATE ========
let vsComputer = true;
let isMultiplayer = false;
let socket = null;
let currentPlayer = 1;
let player1Board = [];
let player2Board = [];
let player1StruckLines = new Set();
let player2StruckLines = new Set();
let gameOver = false;
let playerName = "";
let playerIndex = null;
let roomId = null;

// ======== OVERLAY CONTROLS ========
function showPromoOverlay() { promoOverlay.classList.remove("hidden"); }
function hidePromoOverlay() { promoOverlay.classList.add("hidden"); }
function showModeSelection() { modeSelectionOverlay.classList.remove("hidden"); }
function hideModeSelection() { modeSelectionOverlay.classList.add("hidden"); }
function showToss(allowChoice = false) {
  tossOverlay.classList.remove("hidden");
  if (isMultiplayer) {
    tossResult.textContent = allowChoice ? "Choose Head or Tail" : "Waiting for toss result from server...";
    tossButtons.forEach(b => b.disabled = !allowChoice);
  } else {
    tossResult.textContent = "";
    tossButtons.forEach(b => b.disabled = false);
  }
}
function hideToss() { tossOverlay.classList.add("hidden"); }

function showPlayAgainButton() { playAgainButton.classList.remove("hidden"); }
function hidePlayAgainButton() { playAgainButton.classList.add("hidden"); }

// ======== POPUP MESSAGE ========
function showPopupMessage(message, duration = 3000) {
  const popup = document.createElement("div");
  popup.style.cssText = `
    position: fixed; top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white; padding: 20px 30px;
    border-radius: 10px; font-size: 18px;
    font-weight: bold; text-align: center;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    z-index: 10000; animation: popupSlideIn 0.3s ease-out;
  `;
  if (!document.getElementById('popup-styles')) {
    const style = document.createElement('style');
    style.id = 'popup-styles';
    style.textContent = `
      @keyframes popupSlideIn {
        from {opacity: 0; transform: translate(-50%, -50%) scale(0.8);}
        to {opacity: 1; transform: translate(-50%, -50%) scale(1);}
      }
      @keyframes popupSlideOut {
        from {opacity: 1; transform: translate(-50%, -50%) scale(1);}
        to {opacity: 0; transform: translate(-50%, -50%) scale(0.8);}
      }
    `;
    document.head.appendChild(style);
  }
  popup.textContent = message;
  document.body.appendChild(popup);
  setTimeout(() => {
    popup.style.animation = 'popupSlideOut 0.3s ease-out';
    setTimeout(() => popup.remove(), 300);
  }, duration);
}

// ======== PLAYER–VERSUS–COMPUTER HELPERS ========
function getPlayerDisplayName(player) {
  return vsComputer
    ? (player === 1 ? playerName : "Jimmy")
    : (player === 1 ? "Player 1" : "Player 2");
}

function getUnstruckNumbers(boardEl) {
  return Array.from(boardEl.querySelectorAll("div"))
    .filter(c => !c.classList.contains("strike"))
    .map(c => parseInt(c.textContent, 10));
}

function pickComputerNumber() {
  const cells = Array.from(board2.querySelectorAll("div"));
  const lines = [
    [0,1,2,3,4],[5,6,7,8,9],[10,11,12,13,14],[15,16,17,18,19],[20,21,22,23,24],
    [0,5,10,15,20],[1,6,11,16,21],[2,7,12,17,22],[3,8,13,18,23],[4,9,14,19,24],
    [0,6,12,18,24],[4,8,12,16,20]
  ];
  const scores = new Map();
  lines.forEach(line => {
    const struckCount = line.filter(i => cells[i].classList.contains("strike")).length;
    if (struckCount >= 4 || struckCount >= 2) {
      const weight = struckCount >= 4 ? 2 : 1;
      line.forEach(i => {
        if (!cells[i].classList.contains("strike")) {
          const num = parseInt(cells[i].textContent, 10);
          scores.set(num, (scores.get(num) || 0) + weight);
        }
      });
    }
  });
  const remaining = getUnstruckNumbers(board2);
  if (!remaining.length) return null;
  if (scores.size) {
    let best = null, bestScore = -Infinity;
    remaining.forEach(n => {
      const s = scores.get(n) || 0;
      if (s > bestScore) {
        bestScore = s;
        best = n;
      }
    });
    return best ?? remaining[Math.floor(Math.random() * remaining.length)];
  }
  return remaining[Math.floor(Math.random() * remaining.length)];
}

function computerTurn() {
  if (!vsComputer || gameOver || currentPlayer !== 2) return;
  const choice = pickComputerNumber();
  if (choice == null) return;
  const target = Array.from(board2.querySelectorAll("div"))
    .find(c => parseInt(c.textContent, 10) === choice && !c.classList.contains("strike"));
  if (target) {
    strikeNumber(target, choice, 2);
    if (!gameOver) updateTurn();
  }
}

// ======== BOARD SETUP & MANAGEMENT ========
function generateBoard() {
  const nums = new Set();
  while (nums.size < 25) nums.add(Math.floor(Math.random() * 25) + 1);
  return Array.from(nums);
}

function createBoard(boardEl, numbers, player) {
  boardEl.innerHTML = "";
  numbers.forEach(number => {
    const cell = document.createElement("div");
    cell.textContent = number;
    cell.dataset.number = number;
    cell.addEventListener("click", () => {
      if (gameOver || (currentPlayer !== player)) {
        if (!isMultiplayer && vsComputer && currentPlayer !== player)
          showPopupMessage("It's not your turn!", 1500);
        return;
      }
      strikeNumber(cell, number, player);
    });
    boardEl.appendChild(cell);
  });
}

function strikeNumber(cell, number, player, isRemote = false) {
  if (cell.classList.contains("strike") || gameOver) return;
  cell.classList.add("strike");
  if (isMultiplayer && !isRemote && socket) {
    socket.emit("chooseNumber", { roomId, player, number });
  }
  const opponentBoard = player === 1 ? board2 : board1;
  Array.from(opponentBoard.querySelectorAll("div")).forEach(c => {
    if (!c.classList.contains("strike") && parseInt(c.textContent, 10) === number) {
      c.classList.add("strike");
    }
  });
  currentNumberDisplay.textContent = `${getPlayerDisplayName(player)} chose number ${number}`;
  checkForBingo(player);
  checkForBingo(player === 1 ? 2 : 1);
  if (!gameOver && !(isMultiplayer && vsComputer && currentPlayer === 2)) {
    updateTurn();
  }
}

function checkForBingo(player) {
  const boardEl = player === 1 ? board1 : board2;
  const struckLinesSet = player === 1 ? player1StruckLines : player2StruckLines;
  const cells = boardEl.querySelectorAll("div");
  const lines = [
    [0,1,2,3,4],[5,6,7,8,9],[10,11,12,13,14],[15,16,17,18,19],[20,21,22,23,24],
    [0,5,10,15,20],[1,6,11,16,21],[2,7,12,17,22],[3,8,13,18,23],[4,9,14,19,24],
    [0,6,12,18,24],[4,8,12,16,20]
  ];
  lines.forEach((line, i) => {
    if (line.every(idx => cells[idx].classList.contains("strike")) && !struckLinesSet.has(i)) {
      struckLinesSet.add(i);
      line.forEach(idx => cells[idx].style.backgroundColor = "#66ff66");
    }
  });
  if (!gameOver && struckLinesSet.size >= 5) {
    gameOver = true;
    winnerInfo.textContent = `🎉 Player ${player} wins with ${struckLinesSet.size} lines!`;
    showPopupMessage(player === playerIndex ? "🎉 You win!" : `Player ${player} wins!`, 5000);
    document.querySelectorAll("#board1 div, #board2 div").forEach(cell => {
      cell.style.pointerEvents = "none";
    });
    if (isMultiplayer && socket) {
      socket.emit("playerWon", { roomId, winner: player });
    } else {
      showPlayAgainButton();
    }
  }
}

function updateTurn() {
  if (gameOver) return;
  currentPlayer = currentPlayer === 1 ? 2 : 1;
  turnInfo.textContent = `Player ${currentPlayer}'s turn`;
  if (vsComputer && currentPlayer === 2) setTimeout(computerTurn, 500);
  if (isMultiplayer) socket.emit("turnChanged", { roomId, currentPlayer });
}

// ======== GAME START & RESET ========
function startGame(multiplayerBoards = null) {
  if (multiplayerBoards) {
    player1Board = multiplayerBoards.player1Board;
    player2Board = multiplayerBoards.player2Board;
  } else {
    player1Board = generateBoard();
    player2Board = generateBoard();
  }
  createBoard(board1, player1Board, 1);
  createBoard(board2, player2Board, 2);
  document.querySelectorAll("#board1 div, #board2 div").forEach(cell => {
    cell.style.pointerEvents = "auto";
    cell.style.backgroundColor = "";
  });
  player1StruckLines.clear();
  player2StruckLines.clear();
  gameOver = false;
  winnerInfo.textContent = "";
  currentNumberDisplay.textContent = "";
  hidePlayAgainButton();
  turnInfo.textContent = `Player ${currentPlayer}'s turn`;
  if (vsComputer && currentPlayer === 2) setTimeout(computerTurn, 500);
}

// ======== MULTIPLAYER SOCKET SETUP ========
function initMultiplayer() {
  playerName = prompt("Enter your name:");
  if (!playerName) return alert("Name required!");
  if (!socket) {
    socket = io();
    setupSocketEvents();
  }
  const action = prompt("Type 'C' to Create Game or enter Room ID to Join:");
  if (!action) return;
  if (action.toUpperCase() === "C") {
    socket.emit("createRoom", { name: playerName });
  } else {
    socket.emit("joinRoom", { name: playerName, roomId: action.trim().toUpperCase() });
  }
  showToss();
}

tossButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    if (isMultiplayer && playerIndex !== null && !btn.disabled) {
      socket.emit("playerTossChoice", {
        roomId,
        player: playerIndex,
        choice: btn.dataset.choice
      });
      tossButtons.forEach(b => b.disabled = true);
    }
  });
});

function setupSocketEvents() {
  socket.on("roomCreated", data => {
    roomId = data.roomId;
    playerIndex = 1;
    alert(`Room created! ID: ${roomId}`);
  });

  socket.on("roomJoined", data => {
    roomId = data.roomId;
    playerIndex = data.playerIndex;
    alert(`Joined Room ${roomId} as Player ${playerIndex}`);
  });

  socket.on("bothPlayersReady", ({ player1Board, player2Board }) => {
    startGame({ player1Board, player2Board });
    playerIndex === 1 ? showToss(true) : showToss(false);
  });

  socket.on("chooseTossCaller", ({ caller }) => {
    showToss(caller === playerIndex);
  });

  socket.on("tossResult", ({ startingPlayer, tossWinner }) => {
    hideToss();
    currentPlayer = startingPlayer;
    turnInfo.textContent = `Player ${startingPlayer}'s turn`;
    showOnlyYourBoard();
    showPopupMessage(
      tossWinner === playerIndex ? "🎉 You won the toss!" : `Player ${tossWinner} won the toss!`,
      4000
    );
  });

  socket.on("playerMove", ({ player, number }) => {
    if (player !== playerIndex) {
      const ownBoard = playerIndex === 1 ? board1 : board2;
      const cell = Array.from(ownBoard.querySelectorAll("div"))
        .find(c => parseInt(c.textContent, 10) === number);
      if (cell) strikeNumber(cell, number, player, true);
    }
  });

  socket.on("turnChanged", ({ currentPlayer: newTurn }) => {
    currentPlayer = newTurn;
    turnInfo.textContent = `Player ${newTurn}'s turn`;
    showOnlyYourBoard();
  });

  socket.on("playerWon", ({ winner }) => {
    gameOver = true;
    showPopupMessage(
      winner === playerIndex ? "🎉 You win!" : `Player ${winner} wins!`,
      5000
    );
    winnerInfo.textContent = `🎉 Player ${winner} wins the game!`;
    showPlayAgainButton();
  });

  socket.on("gameRestarted", ({ player1Board, player2Board, startingPlayer }) => {
    currentPlayer = startingPlayer;
    startGame({ player1Board, player2Board });
    turnInfo.textContent = `Player ${startingPlayer} starts`;
    showOnlyYourBoard();
    showPopupMessage("New game started!", 3000);
  });

  socket.on("playerLeft", () => {
    alert("Opponent left the game.");
    location.reload();
  });

  socket.on("errorMessage", msg => alert(`Error: ${msg}`));
}

function showOnlyYourBoard() {
  if (playerIndex === 1) {
    board1.parentElement.classList.remove("hidden-board");
    board2.parentElement.classList.add("hidden-board");
  } else {
    board1.parentElement.classList.add("hidden-board");
    board2.parentElement.classList.remove("hidden-board");
  }
}

// ======== BUTTON EVENT LISTENERS ========
promoStartBtn.addEventListener("click", () => {
  hidePromoOverlay();
  showModeSelection();
});

vsComputerBtn.addEventListener("click", () => {
  vsComputer = true;
  isMultiplayer = false;
  hideModeSelection();
  playerName = prompt("Enter your name:") || "Player 1";
  document.querySelector("#player1-board h2").textContent = playerName;
  document.querySelector("#player2-board h2").textContent = "Jimmy";
  board1.parentElement.classList.remove("hidden-board");
  board2.parentElement.classList.remove("hidden-board");
  currentPlayer = 1;
  startGame();
});

multiplayerBtn.addEventListener("click", () => {
  vsComputer = false;
  isMultiplayer = true;
  hideModeSelection();
  board1.parentElement.classList.remove("hidden-board");
  board2.parentElement.classList.remove("hidden-board");
  initMultiplayer();
});

resetButton.addEventListener("click", () => {
  hideToss();
  showPromoOverlay();
  winnerInfo.textContent = "";
  turnInfo.textContent = "";
  currentNumberDisplay.textContent = "";
  gameOver = false;
  player1StruckLines.clear();
  player2StruckLines.clear();
  board1.parentElement.classList.add("hidden-board");
  board2.parentElement.classList.add("hidden-board");
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  vsComputer = true;
  isMultiplayer = false;
  currentPlayer = 1;
});

playAgainButton.addEventListener("click", () => {
  if (isMultiplayer && socket) {
    socket.emit("restartGame", { roomId });
  } else {
    currentPlayer = 1;
    startGame();
  }
});

// ======== INIT ========
document.addEventListener("DOMContentLoaded", () => {
  showPromoOverlay();
  hidePlayAgainButton();
  modeSelectionOverlay.classList.add("hidden");
});
