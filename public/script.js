// ===== GET ELEMENTS =====
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

// ===== GAME STATE =====
let vsComputer = true;
let isMultiplayer = false;
let socket = null;
let multiplayerGameId = null;
let currentPlayer = 1;
let player1Board = [];
let player2Board = [];
let player1StruckLines = new Set();
let player2StruckLines = new Set();
let gameOver = false;

let playerName = "";
let playerIndex = null;
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
    tossResult.textContent = "";
    tossButtons.forEach(b => b.disabled = false);
  } else {
    if (allowChoice) {
      tossResult.textContent = "Choose Head or Tail";
      tossButtons.forEach(b => b.disabled = false);
    } else {
      tossResult.textContent = "Waiting for toss result from server...";
      tossButtons.forEach(b => b.disabled = true);
    }
  }
}
function hideToss() {
  tossOverlay.classList.add("hidden");
}

function showPlayAgainButton() {
  playAgainButton.classList.remove("hidden");
}
function hidePlayAgainButton() {
  playAgainButton.classList.add("hidden");
}

// ===== POPUP MESSAGE FUNCTION =====
function showPopupMessage(message, duration = 3000) {
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
function getPlayerDisplayName(playerNumber) {
  if (vsComputer) {
    return playerNumber === 1 ? playerName : "Jimmy";
  } else {
    return playerNumber === 1 ? "Player 1" : "Player 2";
  }
}
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
  if (target) {
    strikeNumber(target, choice, 2);
    if (gameOver) return;
  }
}

// ===== BOARD MANAGEMENT =====
function generateBoard() {
  let numbers = [];
  while (numbers.length < 25) {
    let num = Math.floor(Math.random() * 25) + 1;
    if (!numbers.includes(num)) numbers.push(num);
  }
  return numbers;
}
function createBoard(boardEl, numbers, player) {
  boardEl.innerHTML = '';
  numbers.forEach(number => {
    const cell = document.createElement("div");
    cell.textContent = number;
    cell.dataset.number = number;
    cell.addEventListener("click", () => {
      if (!gameOver && currentPlayer === player) {
        strikeNumber(cell, number, player);
      } else if (!isMultiplayer && vsComputer && currentPlayer !== player) {
        showPopupMessage("It's not your turn!", 1500);
      }
    });
    boardEl.appendChild(cell);
  });
}
function strikeNumber(cell, number, player, isRemote = false) {
  if (cell.classList.contains("strike") || gameOver) return;
  cell.classList.add("strike");
  if (!isRemote && isMultiplayer && socket && !gameOver) {
    socket.emit("chooseNumber", { roomId, player, number });
  }
  let opponentBoardEl = player === 1 ? board2 : board1;
  Array.from(opponentBoardEl.querySelectorAll("div")).forEach(c => {
    if (parseInt(c.textContent, 10) === number && !c.classList.contains("strike")) {
      c.classList.add("strike");
    }
  });

  const displayName = getPlayerDisplayName(player);
  currentNumberDisplay.textContent = `${displayName} chose number ${number}`;
  checkForBingo(player);
  checkForBingo(player === 1 ? 2 : 1);

  if (!gameOver) updateTurn();
}
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
    gameOver = true;
    winnerInfo.textContent = `🎉 Player ${player} wins with ${struckLinesSet.size} lines!`;
    const message = player === 1 ? "🎉 You win!" : "Jimmy wins!";
    showPopupMessage(message, 5000);
    showPlayAgainButton();
  }
}
function updateTurn() {
  currentPlayer = currentPlayer === 1 ? 2 : 1;
  turnInfo.textContent = `Player ${currentPlayer}'s turn`;
  if (vsComputer && currentPlayer === 2 && !gameOver) {
    setTimeout(computerTurn, 800);
  }
}

// ===== GAME START =====
function startGame() {
  player1Board = generateBoard();
  player2Board = generateBoard();
  createBoard(board1, player1Board, 1);
  createBoard(board2, player2Board, 2);
  player1StruckLines.clear();
  player2StruckLines.clear();
  gameOver = false;
  winnerInfo.textContent = "";
  currentNumberDisplay.textContent = "";
  hidePlayAgainButton();
  turnInfo.textContent = `Player ${currentPlayer}'s turn`;
}

// ===== BUTTON EVENTS =====
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
  multiplayerGameId = null;
  isMultiplayer = false;
  vsComputer = true;
  currentPlayer = 1;
});

playAgainButton.addEventListener("click", () => {
  if (vsComputer) {
    currentPlayer = 1;
    startGame();
  }
});

document.addEventListener("DOMContentLoaded", () => {
  showPromoOverlay();
  modeSelectionOverlay.classList.add("hidden");
  hidePlayAgainButton();
});
