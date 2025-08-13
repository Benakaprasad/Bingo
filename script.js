// ===== GET ELEMENTS =====
const board1 = document.getElementById("board1");
const board2 = document.getElementById("board2");
const resetButton = document.getElementById("reset-game");
const turnInfo = document.getElementById("turn-info");
const winnerInfo = document.getElementById("winner-info");
const modeBackBtn = document.getElementById("mode-back-btn");

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

// ===== GAME STATE =====
let vsComputer = true;
let currentPlayer = 1;
let player1Board = [];
let player2Board = [];
let player1StruckLines = new Set();
let player2StruckLines = new Set();
let gameOver = false;

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

function showToss() {
  tossResult.textContent = ""; // Clear previous toss result
  tossButtons.forEach(b => b.disabled = false); // Re-enable toss buttons
  tossOverlay.classList.remove("hidden");
}

function hideToss() {
  tossOverlay.classList.add("hidden");
}

// ===== COIN TOSS HANDLER =====
tossButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    tossButtons.forEach(b => b.disabled = true);

    let player1Choice = btn.dataset.choice;
    let tossOutcome = Math.random() < 0.5 ? "heads" : "tails";
    tossResult.textContent = `Coin landed on ${tossOutcome.toUpperCase()}!`;

    setTimeout(() => {
      if (player1Choice === tossOutcome) {
        tossResult.textContent += " Player 1 wins toss!";
        currentPlayer = 1;
      } else {
        tossResult.textContent += " Player 2 wins toss!";
        currentPlayer = 2;
      }

      setTimeout(() => {
        hideToss();
        startGame();
        turnInfo.textContent = `Player ${currentPlayer}'s turn`;

        if (currentPlayer === 1) {
          board1.parentElement.classList.remove("hidden-board");
          board2.parentElement.classList.add("hidden-board");
        } else {
          board2.parentElement.classList.remove("hidden-board");
          board1.parentElement.classList.add("hidden-board");

          if (vsComputer && currentPlayer === 2) {
            setTimeout(computerTurn, 600);
          }
        }

        tossButtons.forEach(b => b.disabled = false);
      }, 1500);
    }, 1000);
  });
});

// ===== VS COMPUTER HELPERS =====
function getUnstruckNumbers(boardEl) {
  return Array.from(boardEl.querySelectorAll("div"))
    .filter(c => !c.classList.contains("strike"))
    .map(c => parseInt(c.textContent));
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
          const n = parseInt(cells[i].textContent);
          scores.set(n, (scores.get(n) || 0) + 2);
        }
      });
    } else if (struckCount >= 2) {
      line.forEach(i => {
        if (!cells[i].classList.contains("strike")) {
          const n = parseInt(cells[i].textContent);
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
    .find(c => parseInt(c.textContent) === choice && !c.classList.contains("strike"));
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
function strikeNumber(cell, number, player) {
  if (cell.classList.contains("strike") || gameOver) return;

  cell.classList.add("strike");

  let opponentBoardEl = player === 1 ? board2 : board1;
  Array.from(opponentBoardEl.querySelectorAll("div")).forEach(c => {
    if (parseInt(c.textContent) === number && !c.classList.contains("strike")) {
      c.classList.add("strike");
    }
  });

  document.getElementById("current-number").textContent =
    `Player ${player} chose number ${number}`;

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
        board1.parentElement.classList.add("hidden-board");
        board2.parentElement.classList.add("hidden-board");
        setTimeout(computerTurn, 500);
      }
    } else {
      if (currentPlayer === 1) {
        board1.parentElement.classList.remove("hidden-board");
        board2.parentElement.classList.add("hidden-board");
      } else {
        board2.parentElement.classList.remove("hidden-board");
        board1.parentElement.classList.add("hidden-board");
      }
    }
  }
}

// ===== START GAME =====
function startGame() {
  player1Board = generateBoard();
  player2Board = generateBoard();
  createBoard(board1, player1Board, 1);
  createBoard(board2, player2Board, 2);
  player1StruckLines.clear();
  player2StruckLines.clear();
  winnerInfo.textContent = "";
  turnInfo.textContent = "";
  document.getElementById("current-number").textContent = "";
  gameOver = false;

  if (vsComputer) {
    board1.parentElement.classList.remove("hidden-board");
    board2.parentElement.classList.add("hidden-board");
  } else {
    if (currentPlayer === 1) {
      board1.parentElement.classList.remove("hidden-board");
      board2.parentElement.classList.add("hidden-board");
    } else {
      board2.parentElement.classList.remove("hidden-board");
      board1.parentElement.classList.add("hidden-board");
    }
  }
}

// ===== EVENT LISTENERS =====
promoStartBtn.addEventListener("click", () => {
  hidePromoOverlay();
  showModeSelection();
});

vsComputerBtn.addEventListener("click", () => {
  vsComputer = true;
  hideModeSelection();
  currentPlayer = 1;
  startGame();
  turnInfo.textContent = `Player ${currentPlayer}'s turn`;
  board1.parentElement.classList.remove("hidden-board");
  board2.parentElement.classList.add("hidden-board");
});

multiplayerBtn.addEventListener("click", () => {
  vsComputer = false;
  hideModeSelection();
  showToss();
});

resetButton.addEventListener("click", () => {
  hideToss();
  showPromoOverlay();
  winnerInfo.textContent = "";
  turnInfo.textContent = "";
  document.getElementById("current-number").textContent = "";
  gameOver = false;
  player1StruckLines.clear();
  player2StruckLines.clear();
  board1.parentElement.classList.add("hidden-board");
  board2.parentElement.classList.add("hidden-board");
});

document.addEventListener("DOMContentLoaded", () => {
  showPromoOverlay();
  modeSelectionOverlay.classList.add("hidden");
});

modeBackBtn.addEventListener("click", () => {
  hideModeSelection();
  showPromoOverlay();
});
