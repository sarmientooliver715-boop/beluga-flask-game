// =============================
// DOM ELEMENTS
const playBtn = document.getElementById("playBtn");
const mainScreen = document.getElementById("main-screen");
const gameContainer = document.getElementById("game-container");
const catcher = document.getElementById("catcher");
const bgm = document.getElementById("bgm");
const noteContainer = document.getElementById("note-container");

// Pause button and screens
const pauseBtn = document.getElementById("pause-btn");
const manualPauseScreen = document.getElementById("manual-pause-screen");
const resumeBtn = document.getElementById("resumeBtn");
const pauseMainMenuBtn = document.getElementById("pauseMainMenuBtn");

const pauseScreen = document.getElementById("pause-screen");
const lifeDisplay = document.getElementById("lifeDisplay");
const lifeCountEl = document.getElementById("lifeCount");

const gameoverScreen = document.getElementById("gameover-screen");
const finalScoreEl = document.getElementById("finalScore");
const retryBtn = document.getElementById("retryBtn");
const mainMenuBtn = document.getElementById("mainMenuBtn");

// Cooldown indicator
const cooldownIndicator = document.getElementById("cooldown-indicator");

// create countdown element (global)
const countdownDiv = document.createElement("div");
countdownDiv.id = "countdown";
document.body.appendChild(countdownDiv);

// FIXED: Gamitin ang Flask url_for para sa images
const basePath = window.location.origin + '/static/';

// Default catcher image - FIXED PATH
catcher.style.backgroundImage = `url('${basePath}dino_closed.png')`;

// =============================
// ASSETS + BEATMAP - FIXED PATHS
const foodImages = [
  `${basePath}cute_mochi.png`,
  `${basePath}cute_cake.png`,
  `${basePath}cute_sushi.png`,
  `${basePath}cute_sandwich.png`
];

const beatmap = [
  1920,2720,2935,3759,3981,4327,4511,4830,5895,6772,6968,
  7755,7960,8313,8503,8832,9846,10750,10958,11770,11969,
  12338,12511,12794,13881,14291,14507,14833,15041,15377,
  15558,15897,16073,16920,18855,19747,19943,20744,20965,
  21329,21501,21787,22922,23733,23950,24782,24977,25324,
  25530,25814,26902,27731,27948,28742,28954,29325,29495,
  29782,30905,31386,31557,31924,32080,32426,32556,32854,
  33039,33901,35326,35812,36275,36844,37311,37478,37779,
  37980,38504,38980,40917,41239,41449,41768,41951,42369,
  42905,47663,48120,48342,48933,49443,49803,52901,53753,
  53931,54735,54945,55287,55458,55773,56897,57711,57930,
  58777,58953,59299,59463,59772,60869,61684,61926,62743,
  62935,63297,63479,63784,64796,65238,65439,65761,65904,
  66292,66443,66758,66915,67495,67859,68365,68911,69461,
  69712,70382,70802,70976,71449,71908,72304,72525,72834,
  73451,73872,74012,74447,74888,75007,75437,75902,76262,
  76425,76813,76954,77881,78410,78802,78941,79696,79897,
  80441,80941,81704,81883,82281,82429,82782,82943,83401,
  83718,83887,84391,84898,85968
];

let FALL_TIME = 900;
const LANES = [-120, 0, 120];

// game variables
let score = 0;
let combo = 0;
let lives = 3;
let isPaused = false;
let currentLoop = 1;
let gameSpeed = 1.0;
let bestScore = localStorage.getItem('dinoBestScore') || 0;

// Initialize UI
lifeCountEl && (lifeCountEl.textContent = lives);
lifeDisplay && (lifeDisplay.textContent = lives);

// beat loop state
let nextBeatIndex = 0;
let beatLoopRAF = null;

// active notes storage
const activeNotes = new Set();

// COOLDOWN SYSTEM - FOR BOTH MANUAL AND AUTO PAUSE
const MANUAL_COOLDOWN_MS = 2000; // 2 seconds for manual pause
const AUTO_COOLDOWN_MS = 1500;   // 1.5 seconds for auto pause
let invulnerableUntil = 0;
let cooldownInterval = null;
let isInCooldown = false;

// Store audio time when paused
let audioPauseTime = 0;

// =============================
// START GAME
playBtn.addEventListener("click", startGame);

function startGame() {
  console.log("Starting game...");
  mainScreen.style.display = "none";
  gameoverScreen.style.display = "none";
  manualPauseScreen.style.display = "none";
  gameContainer.style.display = "block";
  
  // Show pause button
  pauseBtn.style.display = "block";

  resetGameStateForNewRun();

  // Ensure audio loads properly
  bgm.load();
  bgm.currentTime = 0;
  
  // Try to play audio with error handling
  const playAudio = () => {
    bgm.play().catch(e => {
      console.log("Audio play failed, will retry on user interaction:", e);
      // Add a click handler to start audio on user interaction
      document.addEventListener('click', playAudioOnce, { once: true });
    });
  };

  const playAudioOnce = () => {
    bgm.play().catch(e => console.log("Audio play error:", e));
  };

  playAudio();

  nextBeatIndex = 0;
  if (beatLoopRAF) cancelAnimationFrame(beatLoopRAF);
  beatLoop();
}

// =============================
// MANUAL PAUSE SYSTEM
pauseBtn.addEventListener("click", toggleManualPause);

function toggleManualPause() {
  if (isPaused || isInCooldown) return; // Don't allow pause during cooldown
  
  isPaused = true;
  
  // Store current audio time
  audioPauseTime = bgm.currentTime;
  
  // Pause audio
  try { bgm.pause(); } catch (e) {}
  
  // Freeze all active notes
  freezeActiveNotes();
  
  // Show manual pause screen
  manualPauseScreen.style.display = "flex";
  pauseBtn.style.display = "none"; // Hide pause button when paused
  
  console.log("Game manually paused - music and notes stopped");
}

// Resume from manual pause WITH COOLDOWN BEFORE RESUMING
resumeBtn.addEventListener("click", startResumeWithCooldown);

function startResumeWithCooldown() {
  if (!isPaused) return;
  
  manualPauseScreen.style.display = "none";
  
  // Start cooldown before resuming game
  startCooldownBeforeResume(MANUAL_COOLDOWN_MS, "manual");
}

// Main menu from manual pause
pauseMainMenuBtn.addEventListener("click", () => {
  manualPauseScreen.style.display = "none";
  mainScreen.style.display = "flex";
  gameContainer.style.display = "none";
  pauseBtn.style.display = "none";
  
  resetGameStateForNewRun();
});

// =============================
// COOLDOWN SYSTEM (BEFORE RESUME)
function startCooldownBeforeResume(duration, type) {
  isInCooldown = true;
  
  // Show cooldown indicator
  cooldownIndicator.style.display = 'block';
  cooldownIndicator.textContent = `Ready in: ${(duration/1000).toFixed(1)}s`;
  
  let remaining = duration;
  
  // Update cooldown indicator every 100ms
  cooldownInterval = setInterval(() => {
    remaining -= 100;
    const seconds = (remaining / 1000).toFixed(1);
    
    if (remaining > 0) {
      cooldownIndicator.textContent = `Ready in: ${seconds}s`;
    } else {
      // Cooldown finished - NOW RESUME THE GAME
      clearInterval(cooldownInterval);
      cooldownIndicator.style.display = 'none';
      isInCooldown = false;
      
      // Actually resume the game now
      resumeAfterCooldown(type);
    }
  }, 100);
}

function resumeAfterCooldown(type) {
  isPaused = false;
  pauseBtn.style.display = "block"; // Show pause button again
  
  // Set invulnerability period
  invulnerableUntil = performance.now() + (type === "manual" ? MANUAL_COOLDOWN_MS : AUTO_COOLDOWN_MS);
  
  // Add visual effect to catcher
  catcher.classList.add('invulnerable');
  
  // Resume audio from where it was paused
  bgm.currentTime = audioPauseTime;
  try { 
    bgm.play().catch(e => console.log("Resume audio error:", e));
  } catch (e) {}

  // RESUME ALL NOTES
  activeNotes.forEach(note => {
    note._pausedElapsed = note._pausedElapsed || 0;
    const fall = note._fall;
    if (typeof fall === "function") {
      requestAnimationFrame(fall);
    }
    activeNotes.delete(note);
  });
  
  console.log(`Game resumed after ${type} cooldown - music and notes started`);
  
  // Remove invulnerability after cooldown period
  setTimeout(() => {
    catcher.classList.remove('invulnerable');
    console.log("Invulnerability ended");
  }, type === "manual" ? MANUAL_COOLDOWN_MS : AUTO_COOLDOWN_MS);
}

// =============================
// BEAT LOOP - spawn using bgm.currentTime
function beatLoop() {
  if (!isPaused && !isInCooldown) {
    const currentMs = bgm.currentTime * 1000;
    
    // Check if song finished and should loop with increased speed
    if (nextBeatIndex >= beatmap.length && currentMs >= beatmap[beatmap.length - 1] + 1000) {
      loopWithIncreasedSpeed();
      return;
    }
    
    while (nextBeatIndex < beatmap.length) {
      const hitTime = beatmap[nextBeatIndex];
      const spawnTime = hitTime - FALL_TIME;
      if (currentMs + 24 >= spawnTime) {
        spawnNoteForBeat();
        nextBeatIndex++;
      } else {
        break;
      }
    }
  }
  beatLoopRAF = requestAnimationFrame(beatLoop);
}

function loopWithIncreasedSpeed() {
  currentLoop++;
  gameSpeed = 1.0 + (currentLoop - 1) * 0.2;
  FALL_TIME = Math.floor(900 / gameSpeed);
  
  console.log(`Loop ${currentLoop}: Speed x${gameSpeed.toFixed(1)}, Fall Time: ${FALL_TIME}ms`);
  
  nextBeatIndex = 0;
  bgm.currentTime = 0;
  bgm.playbackRate = gameSpeed;
  
  // Try to play with error handling
  bgm.play().catch(e => console.log("Loop audio play error:", e));
  
  showSpeedIncreaseMessage();
  beatLoopRAF = requestAnimationFrame(beatLoop);
}

function showSpeedIncreaseMessage() {
  const speedMsg = document.createElement("div");
  speedMsg.id = "speed-message";
  speedMsg.textContent = `SPEED x${gameSpeed.toFixed(1)}!`;
  document.body.appendChild(speedMsg);
  
  setTimeout(() => {
    if (speedMsg.parentElement) speedMsg.remove();
  }, 2000);
}

function spawnNoteForBeat() {
  const note = document.createElement("div");
  note.className = "note";

  const img = foodImages[Math.floor(Math.random() * foodImages.length)];
  note.style.backgroundImage = `url('${img}')`;

  const lane = LANES[Math.floor(Math.random() * LANES.length)];
  note.dataset.lane = lane;
  note.style.left = `calc(50% + ${lane}px)`;
  note.style.top = "-100px";

  noteContainer.appendChild(note);

  let start = null;
  let stopped = false;

  function fall(ts) {
    if (stopped) return;

    if (isPaused || isInCooldown) {
      const totalTravel = (window.innerHeight - 200);
      let topPx = parseFloat(note.style.top);
      if (isNaN(topPx)) {
        const cs = getComputedStyle(note);
        topPx = parseFloat(cs.top) || 0;
      }
      topPx = Math.min(Math.max(0, topPx), totalTravel);
      const progress = (totalTravel === 0) ? 0 : (topPx / totalTravel);
      note._pausedElapsed = progress * FALL_TIME;
      note._fall = fall;
      activeNotes.add(note);
      return;
    }

    if (!start) start = ts - (note._pausedElapsed || 0);
    const progress = (ts - start) / FALL_TIME;
    note.style.top = (progress * (window.innerHeight - 200)) + "px";

    if (progress < 1) {
      note._fall = fall;
      requestAnimationFrame(fall);
    } else {
      activeNotes.delete(note);
      finishNote(note, lane);
    }
  }

  requestAnimationFrame(fall);
  note._fall = fall;
}

// =============================
// CATCH SYSTEM
let catcherOffset = 0;

function checkCatch(note, lane) {
  const dx = Math.abs(lane - catcherOffset);
  const noteY = parseFloat(note.style.top);
  const catcherY = window.innerHeight - 200;
  const dy = Math.abs(noteY - catcherY);

  // COMPLETELY DISABLE MISS DETECTION during invulnerability period
  if (performance.now() < invulnerableUntil) {
    if (dy < 100 && dx < 120) {
      return "good";
    }
    return "ignore";
  }

  // Normal collision detection after invulnerability period
  if (dy < 40) {
    if (dx < 60) return "perfect";
    if (dx < 90) return "good";
  }
  return "miss";
}

function showMissEffect(x, y) {
  const miss = document.createElement("div");
  miss.className = "miss-effect";
  miss.style.left = x + "px";
  miss.style.top = y + "px";
  noteContainer.appendChild(miss);

  requestAnimationFrame(() => miss.classList.add("show"));
  setTimeout(() => {
    miss.classList.remove("show");
    miss.classList.add("hide");
  }, 450);
  setTimeout(() => miss.remove(), 900);
}

function finishNote(note, lane) {
  if (!note || !note.parentElement) return;

  // CHECK IF NOTE WAS ALREADY PROCESSED (during pause)
  if (note._processed) return;
  
  const result = checkCatch(note, lane);

  if (result === "ignore") {
    activeNotes.delete(note);
    setTimeout(() => { if (note.parentElement) note.remove(); }, 150);
    return;
  }

  if (result === "perfect" || result === "good") {
    // FIXED: Use correct image paths
    catcher.style.backgroundImage = `url('${basePath}dino_open.png')`;
    setTimeout(() => {
      catcher.style.backgroundImage = `url('${basePath}dino_closed.png')`;
    }, 120);
  }

  if (result === "perfect" || result === "good") {
    score += 1;
    combo++;
    note.classList.add("hit");
    note._processed = true; // MARK AS PROCESSED
  } else if (result === "miss") {
    // ONLY TRIGGER AUTO-PAUSE IF NOT ALREADY PAUSED MANUALLY
    if (!isPaused && !isInCooldown) {
      combo = 0;
      note.classList.add("miss");
      note._processed = true; // MARK AS PROCESSED

      const catcherRect = catcher.getBoundingClientRect();
      const centerX = catcherRect.left + catcherRect.width / 2;
      showMissEffect(centerX, catcherRect.top);

      lives = Math.max(0, lives - 1);
      lifeCountEl && (lifeCountEl.textContent = lives);
      lifeDisplay && (lifeDisplay.textContent = lives);

      if (lives > 0) {
        triggerPauseScreen();
      } else {
        updateUI();
        const notes = document.querySelectorAll(".note");
        notes.forEach(n => n.remove());
        activeNotes.clear();
        setTimeout(() => gameOver(), 120);
      }
      return;
    }
  }

  updateUI();
  
  if (result === "perfect" || result === "good") {
    setTimeout(() => { 
      if (note.parentElement) {
        note.remove(); 
      }
    }, 150);
  }
}

function updateUI() {
  document.getElementById("score").textContent = "Score: " + score;
  document.getElementById("combo").textContent = "Combo: " + combo;
  
  // Update best score display on main screen
  const bestScoreElement = document.getElementById("best-score");
  if (bestScoreElement) {
    bestScoreElement.textContent = "Best Score: " + bestScore;
  }
  
  // Add speed indicator to UI
  let speedIndicator = document.getElementById("speed-indicator");
  if (!speedIndicator) {
    speedIndicator = document.createElement("div");
    speedIndicator.id = "speed-indicator";
    document.getElementById("ui").appendChild(speedIndicator);
  }
  speedIndicator.textContent = `Speed: x${gameSpeed.toFixed(1)}`;
}

// =============================
// AUTO PAUSE + RESUME SYSTEM (from missed notes)
function triggerPauseScreen() {
  if (isPaused || isInCooldown) return;
  isPaused = true;

  // Store current audio time
  audioPauseTime = bgm.currentTime;
  
  // Hide manual pause button when auto-paused
  pauseBtn.style.display = "none";

  try { bgm.pause(); } catch (e) {}

  freezeActiveNotes();

  pauseScreen.style.display = "flex";
  lifeDisplay.textContent = lives;
  
  console.log("Game auto-paused - music and notes stopped");
}

function freezeActiveNotes() {
  const notes = document.querySelectorAll(".note");
  const totalTravel = (window.innerHeight - 200);
  notes.forEach(note => {
    if (!note.parentElement) return;
    
    let topPx = parseFloat(note.style.top);
    if (isNaN(topPx)) {
      const cs = getComputedStyle(note);
      topPx = parseFloat(cs.top) || 0;
    }
    topPx = Math.min(Math.max(0, topPx), totalTravel);
    const progress = (totalTravel === 0) ? 0 : (topPx / totalTravel);
    note._pausedElapsed = progress * FALL_TIME;
    note._fall = note._fall || function(ts){};
    activeNotes.add(note);
    
    // RESET PROCESSED FLAG WHEN FREEZING
    note._processed = false;
  });
}

function resumeWithCountdown() {
  if (!isPaused) return;

  pauseScreen.style.display = "none";
  
  // Start cooldown before resuming game
  startCooldownBeforeResume(AUTO_COOLDOWN_MS, "auto");
}

// pause overlay handlers
let touchStartY = null;
pauseScreen.addEventListener("touchstart", (e) => {
  touchStartY = e.touches[0].clientY;
});
pauseScreen.addEventListener("touchend", (e) => {
  if (touchStartY === null) return;
  const endY = e.changedTouches[0].clientY;
  if (touchStartY - endY > 50) resumeWithCountdown();
  touchStartY = null;
});
pauseScreen.addEventListener("click", () => resumeWithCountdown());

// =============================
// GAMEOVER
function gameOver() {
  try { bgm.pause(); } catch (e) {}
  const notes = document.querySelectorAll(".note");
  notes.forEach(n => n.remove());
  activeNotes.clear();

  // Clear cooldown if active
  if (cooldownInterval) {
    clearInterval(cooldownInterval);
    cooldownIndicator.style.display = "none";
    catcher.classList.remove("invulnerable");
    isInCooldown = false;
  }

  // Hide pause button on game over
  pauseBtn.style.display = "none";

  // UPDATE BEST SCORE IF CURRENT SCORE IS HIGHER
  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem('dinoBestScore', bestScore);
  }

  finalScoreEl.textContent = "Score: " + score;
  gameoverScreen.style.display = "flex";
  gameContainer.style.display = "none";

  if (beatLoopRAF) { cancelAnimationFrame(beatLoopRAF); beatLoopRAF = null; }
}

// =============================
// BUTTON HANDLERS
mainMenuBtn && mainMenuBtn.addEventListener("click", () => {
  gameoverScreen.style.display = "none";
  mainScreen.style.display = "flex";
  gameContainer.style.display = "none";
  pauseBtn.style.display = "none";

  // Clear cooldown if active
  if (cooldownInterval) {
    clearInterval(cooldownInterval);
    cooldownIndicator.style.display = "none";
    catcher.classList.remove("invulnerable");
    isInCooldown = false;
  }

  resetGameStateForNewRun();
});

retryBtn && retryBtn.addEventListener("click", () => {
  gameoverScreen.style.display = "none";
  mainScreen.style.display = "none";
  gameContainer.style.display = "block";
  pauseBtn.style.display = "block";

  // Clear cooldown if active
  if (cooldownInterval) {
    clearInterval(cooldownInterval);
    cooldownIndicator.style.display = "none";
    catcher.classList.remove("invulnerable");
    isInCooldown = false;
  }

  resetGameStateForNewRun();
  bgm.currentTime = 0;
  bgm.play().catch(e => console.log("Retry audio error:", e));
  nextBeatIndex = 0;
  if (!beatLoopRAF) beatLoop();
});

// =============================
// MOVEMENT + FLIP
let catcherX = window.innerWidth / 2;

document.addEventListener("mousemove", e => {
  catcherX = e.pageX;
  if (e.pageX < window.innerWidth / 2) {
    catcher.classList.add("flip-left");
    catcher.classList.remove("flip-right");
  } else {
    catcher.classList.add("flip-right");
    catcher.classList.remove("flip-left");
  }
});

// Touch support for mobile
document.addEventListener("touchmove", e => {
  e.preventDefault();
  if (e.touches.length > 0) {
    catcherX = e.touches[0].clientX;
    if (catcherX < window.innerWidth / 2) {
      catcher.classList.add("flip-left");
      catcher.classList.remove("flip-right");
    } else {
      catcher.classList.add("flip-right");
      catcher.classList.remove("flip-left");
    }
  }
});

function animateCatcher() {
  catcher.style.left = catcherX + "px";
  catcherOffset = catcherX - window.innerWidth / 2;
  requestAnimationFrame(animateCatcher);
}
animateCatcher();

// =============================
// HELPERS / RESET
function resetGameStateForNewRun() {
  score = 0;
  combo = 0;
  lives = 3;
  isPaused = false;
  isInCooldown = false;
  currentLoop = 1;
  gameSpeed = 1.0;
  FALL_TIME = 900;
  lifeCountEl && (lifeCountEl.textContent = lives);
  lifeDisplay && (lifeDisplay.textContent = lives);
  
  // Reset cooldown
  invulnerableUntil = 0;
  audioPauseTime = 0;
  if (cooldownInterval) {
    clearInterval(cooldownInterval);
    cooldownIndicator.style.display = "none";
    catcher.classList.remove("invulnerable");
  }
  
  // Reset audio speed
  bgm.playbackRate = 1.0;
  
  updateUI();

  // clear notes/effects
  const leftovers = document.querySelectorAll(".note, .miss-effect, #speed-indicator");
  leftovers.forEach(n => n.remove());
  activeNotes.clear();
  nextBeatIndex = 0;
  if (beatLoopRAF) { cancelAnimationFrame(beatLoopRAF); beatLoopRAF = null; }
}

// Update best score display when page loads
document.addEventListener('DOMContentLoaded', function() {
  const bestScoreElement = document.getElementById("best-score");
  if (bestScoreElement) {
    bestScoreElement.textContent = "Best Score: " + bestScore;
  }
  
  // Force main screen to show properly
  mainScreen.style.display = "flex";
  gameContainer.style.display = "none";
  gameoverScreen.style.display = "none";
  pauseScreen.style.display = "none";
  manualPauseScreen.style.display = "none";
  pauseBtn.style.display = "none";
  cooldownIndicator.style.display = "none";
});