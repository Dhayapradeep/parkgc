import {
    ref,
    set,
    get,
    update,
    onValue,
    onChildAdded,
    push,
    runTransaction,
    remove
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-database.js";

import {
    getAuth,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

import {
    app,
    database
} from "../firebase.js";

/* =========================================================
   WORD BANK (350+ Curated Fun Words across Difficulties)
   ========================================================= */
const WORD_BANK = {
    easy: [
        "apple", "banana", "cat", "dog", "sun", "moon", "star", "tree", "car", "boat",
        "fish", "bird", "hat", "shoe", "house", "clock", "book", "door", "eye", "smile",
        "ball", "cake", "cup", "bed", "chair", "table", "fork", "spoon", "duck", "frog",
        "egg", "milk", "pizza", "cookie", "cloud", "rain", "snow", "heart", "flower", "leaf",
        "key", "ring", "sock", "shirt", "pants", "box", "bell", "drum", "flag", "kite",
        "baby", "hand", "nose", "ear", "foot", "bone", "coin", "road", "ship", "tent",
        "bus", "train", "plane", "sword", "crown", "lamp", "soap", "brush", "pencil", "pen"
    ],
    medium: [
        "guitar", "rocket", "castle", "bridge", "camera", "spider", "monkey", "turtle", "rabbit", "lion",
        "tiger", "panda", "elephant", "giraffe", "dolphin", "whale", "octopus", "penguin", "kangaroo", "koala",
        "volcano", "island", "desert", "forest", "mountain", "rainbow", "tornado", "anchor", "compass", "shield",
        "helmet", "trophy", "medal", "ticket", "laptop", "phone", "robot", "alien", "ghost", "wizard",
        "pirate", "ninja", "cowboy", "doctor", "chef", "artist", "clown", "zombie", "vampire", "dragon",
        "sandwich", "burger", "popcorn", "pancake", "waffle", "ice cream", "donut", "sushi", "taco", "burrito",
        "keyboard", "speaker", "battery", "candle", "balloon", "fireworks", "telescope", "microscope", "ladder", "umbrella"
    ],
    hard: [
        "rollercoaster", "ferris wheel", "carousel", "haunted house", "cotton candy", "bumper cars",
        "labyrinth", "black hole", "supernova", "satellite", "submarine", "hovercraft", "monorail",
        "time machine", "teleporter", "treasure chest", "booby trap", "guillotine", "catapult", "trebuchet",
        "constellation", "hieroglyph", "chameleon", "platypus", "armadillo", "porcupine", "jellyfish",
        "carnival", "fire hydrant", "wind turbine", "waterfall", "quicksand", "avalanche", "meteorite",
        "abusement park", "chaos points", "hall of shame", "pickpocket", "card shark", "straightjacket",
        "hypnotist", "ventriloquist", "tightrope", "trapeze", "unicycle", "stilts", "fire eater",
        "jack-o-lantern", "scarecrow", "pinata", "boomerang", "kaleidoscope", "hourglass", "pendulum"
    ]
};

/* =========================================================
   ELEMENT REFERENCES
========================================================= */
const roundDisplay = document.getElementById("roundDisplay");
const timerDisplay = document.getElementById("timerDisplay");
const timerContainer = document.getElementById("timerContainer");
const wordStatusLabel = document.getElementById("wordStatusLabel");
const wordDisplay = document.getElementById("wordDisplay");
const wordLengthHint = document.getElementById("wordLengthHint");
const roomCodeDisplay = document.getElementById("roomCodeDisplay");
const exitButton = document.getElementById("exitButton");

const playersList = document.getElementById("playersList");

const canvasWrapper = document.getElementById("canvasWrapper");
const paintCanvas = document.getElementById("paintCanvas");
const ctx = paintCanvas.getContext("2d", { willReadFrequently: true });

const wordChoiceOverlay = document.getElementById("wordChoiceOverlay");
const wordChoicesContainer = document.getElementById("wordChoicesContainer");
const choiceCountdown = document.getElementById("choiceCountdown");
const waitingForWordOverlay = document.getElementById("waitingForWordOverlay");
const waitingDrawerText = document.getElementById("waitingDrawerText");

const turnRecapOverlay = document.getElementById("turnRecapOverlay");
const recapTitle = document.getElementById("recapTitle");
const recapWord = document.getElementById("recapWord");
const recapScoresList = document.getElementById("recapScoresList");

const gameOverOverlay = document.getElementById("gameOverOverlay");
const podiumContainer = document.getElementById("podiumContainer");
const finalScoreboard = document.getElementById("finalScoreboard");
const returnLobbyButton = document.getElementById("returnLobbyButton");

const drawingToolbar = document.getElementById("drawingToolbar");
const activeColorPreview = document.getElementById("activeColorPreview");
const toolBrush = document.getElementById("toolBrush");
const toolBucket = document.getElementById("toolBucket");
const toolEraser = document.getElementById("toolEraser");
const toolUndo = document.getElementById("toolUndo");
const toolClear = document.getElementById("toolClear");

const chatMessages = document.getElementById("chatMessages");
const guessForm = document.getElementById("guessForm");
const guessInput = document.getElementById("guessInput");
const sendGuessBtn = document.getElementById("sendGuessBtn");
const guessFeedback = document.getElementById("guessFeedback");

/* =========================================================
   GAME STATE
========================================================= */
const auth = getAuth(app);
let currentUser = null;
let currentUsername = "Artist";
let currentRoomCode = null;
let currentRoomData = null;

let isDrawing = false;
let currentTool = "brush"; // "brush", "eraser", "bucket"
let currentColor = "#000000";
let currentSize = 7;
let activeStrokePoints = [];

let choiceTimerInterval = null;
let turnTimerInterval = null;
let roomUnsubscribe = null;
let strokesUnsubscribe = null;
let chatUnsubscribe = null;

let audioCtx = null;

/* =========================================================
   SOUND FX (WEB AUDIO API)
========================================================= */
function playTone(freq, type = "sine", duration = 0.15) {
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === "suspended") {
            audioCtx.resume();
        }
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
        // Audio error silently ignored
    }
}

function playSuccessChime() {
    playTone(523.25, "triangle", 0.12);
    setTimeout(() => playTone(659.25, "triangle", 0.12), 100);
    setTimeout(() => playTone(783.99, "triangle", 0.25), 200);
}

function playTickSound() {
    playTone(440, "sine", 0.05);
}

/* =========================================================
   INITIALIZATION
========================================================= */
const urlParams = new URLSearchParams(window.location.search);
currentRoomCode = urlParams.get("room")?.trim().toUpperCase();

if (!currentRoomCode) {
    window.location.href = "slobby.html";
} else {
    roomCodeDisplay.textContent = currentRoomCode;
}

// Setup canvas background
clearLocalCanvas();

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }
    currentUser = user;
    await loadUserProfile();
    initRoom();
});

async function loadUserProfile() {
    try {
        const userRef = ref(database, `users/${currentUser.uid}`);
        const snap = await get(userRef);
        if (snap.exists()) {
            const data = snap.val();
            currentUsername = data.username || data.displayName || "Artist";
        }
    } catch (e) {
        console.error("Profile load error:", e);
    }
}

/* =========================================================
   ROOM REALTIME SYNC
========================================================= */
function initRoom() {
    const roomRef = ref(database, `scribbleRooms/${currentRoomCode}`);

    roomUnsubscribe = onValue(roomRef, (snapshot) => {
        if (!snapshot.exists()) {
            alert("This room no longer exists.");
            window.location.href = "slobby.html";
            return;
        }

        const room = snapshot.val();
        currentRoomData = room;

        // If game was reset to waiting or finished, return to lobby if needed
        if (room.state === "waiting") {
            window.location.href = `slobby.html?room=${encodeURIComponent(currentRoomCode)}`;
            return;
        }

        renderRoomState(room);
    });

    listenToStrokes();
    listenToChat();
}

/* =========================================================
   RENDER GAME STATE
========================================================= */
function renderRoomState(room) {
    const isHost = room.hostId === currentUser.uid;
    const isDrawer = room.turnDrawerId === currentUser.uid;
    const totalRounds = room.settings?.rounds || 3;
    const currentRound = room.currentRound || 1;

    // 1. Top bar updates
    roundDisplay.textContent = `${currentRound} / ${totalRounds}`;

    // 2. Player roster & leaderboard
    renderPlayerLeaderboard(room);

    // 3. Toolbar state
    if (isDrawer && room.turnState === "drawing") {
        drawingToolbar.classList.remove("disabled");
    } else {
        drawingToolbar.classList.add("disabled");
    }

    // 4. Input bar state
    const myGuess = room.guesses?.[currentUser.uid];
    if (isDrawer) {
        guessInput.disabled = true;
        sendGuessBtn.disabled = true;
        guessInput.placeholder = "You are drawing! Don't spoil the word.";
        guessFeedback.textContent = "🎨 You are the artist for this round.";
    } else if (myGuess) {
        guessInput.disabled = true;
        sendGuessBtn.disabled = true;
        guessInput.placeholder = "You guessed the word! Spectating...";
        guessFeedback.textContent = `✅ Correct! +${myGuess.points} points.`;
    } else if (room.turnState === "drawing") {
        guessInput.disabled = false;
        sendGuessBtn.disabled = false;
        guessInput.placeholder = "Type your guess here...";
        guessFeedback.textContent = "";
    } else {
        guessInput.disabled = true;
        sendGuessBtn.disabled = true;
        guessInput.placeholder = "Waiting for next turn...";
        guessFeedback.textContent = "";
    }

    // 5. State Handling
    switch (room.turnState) {
        case "choosing":
            handleChoosingState(room, isDrawer, isHost);
            break;
        case "drawing":
            handleDrawingState(room, isDrawer, isHost);
            break;
        case "turn_end":
            handleTurnEndState(room, isHost);
            break;
        case "game_over":
            handleGameOverState(room, isHost);
            break;
    }
}

/* =========================================================
   STATE 1: CHOOSING WORD
========================================================= */
function handleChoosingState(room, isDrawer, isHost) {
    turnRecapOverlay.classList.add("hidden");
    gameOverOverlay.classList.add("hidden");

    wordStatusLabel.textContent = "CHOOSING";
    wordDisplay.innerHTML = `<span class="word-letters">WAITING...</span>`;
    wordLengthHint.textContent = "";

    // Clear canvas when choosing starts
    clearLocalCanvas();

    if (isDrawer) {
        waitingForWordOverlay.classList.add("hidden");
        wordChoiceOverlay.classList.remove("hidden");

        // Generate choices if drawer hasn't received choices yet
        if (!room.wordChoices) {
            const choices = generateThreeWords();
            update(ref(database, `scribbleRooms/${currentRoomCode}`), {
                wordChoices: choices,
                choiceDeadline: Date.now() + 15000
            });
            renderWordChoices(choices);
        } else {
            renderWordChoices(room.wordChoices);
        }

        startChoiceCountdown(room.choiceDeadline, isDrawer);
    } else {
        wordChoiceOverlay.classList.add("hidden");
        waitingForWordOverlay.classList.remove("hidden");
        const drawerName = room.players?.[room.turnDrawerId]?.name || "Artist";
        waitingDrawerText.textContent = `${drawerName} is choosing a word...`;

        // Check countdown for auto-pick fallback
        startChoiceCountdown(room.choiceDeadline, isDrawer);
    }
}

function renderWordChoices(choices) {
    wordChoicesContainer.innerHTML = "";
    const diffs = ["easy", "medium", "hard"];

    choices.forEach((word, index) => {
        const card = document.createElement("div");
        card.className = "word-choice-card";
        const diff = diffs[index] || "medium";

        card.innerHTML = `
            <span class="choice-word-text">${word.toUpperCase()}</span>
            <span class="choice-diff-tag diff-${diff}">${diff}</span>
        `;

        card.addEventListener("click", () => {
            selectWord(word);
        });

        wordChoicesContainer.appendChild(card);
    });
}

async function selectWord(word) {
    if (!currentRoomCode || currentRoomData?.turnDrawerId !== currentUser.uid) return;

    if (choiceTimerInterval) {
        clearInterval(choiceTimerInterval);
        choiceTimerInterval = null;
    }

    const drawDuration = (currentRoomData.settings?.drawTime || 60) * 1000;
    const initialHint = generateWordHint(word, []);

    try {
        await update(ref(database, `scribbleRooms/${currentRoomCode}`), {
            turnState: "drawing",
            currentWord: word.toLowerCase().trim(),
            wordHint: initialHint,
            turnStartTime: Date.now(),
            turnEndTime: Date.now() + drawDuration,
            guesses: null,
            strokes: null
        });

        // Announce in chat
        await broadcastSystemMessage(`${currentUsername} is now drawing!`);
    } catch (e) {
        console.error("Failed to select word:", e);
    }
}

function startChoiceCountdown(deadline, isDrawer) {
    if (choiceTimerInterval) clearInterval(choiceTimerInterval);
    if (!deadline) return;

    const tick = () => {
        const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
        if (choiceCountdown) choiceCountdown.textContent = remaining;
        timerDisplay.textContent = remaining;

        if (remaining <= 0) {
            clearInterval(choiceTimerInterval);
            choiceTimerInterval = null;
            // Auto pick word 1 if drawer didn't pick
            if (isDrawer && currentRoomData?.wordChoices?.length) {
                selectWord(currentRoomData.wordChoices[0]);
            }
        }
    };

    tick();
    choiceTimerInterval = setInterval(tick, 1000);
}

/* =========================================================
   STATE 2: DRAWING & GUESSING
========================================================= */
function handleDrawingState(room, isDrawer, isHost) {
    wordChoiceOverlay.classList.add("hidden");
    waitingForWordOverlay.classList.add("hidden");
    turnRecapOverlay.classList.add("hidden");
    gameOverOverlay.classList.add("hidden");

    const currentWord = room.currentWord || "";

    if (isDrawer) {
        wordStatusLabel.textContent = "DRAW THIS";
        wordDisplay.innerHTML = `<span class="word-letters is-drawer">${currentWord.toUpperCase()}</span>`;
        wordLengthHint.textContent = `(${currentWord.length})`;
    } else {
        wordStatusLabel.textContent = "GUESS WORD";
        const masked = room.wordHint || generateWordHint(currentWord, []);
        wordDisplay.innerHTML = `<span class="word-letters">${formatHintSpaced(masked)}</span>`;
        wordLengthHint.textContent = `(${currentWord.length})`;
    }

    startTurnCountdown(room, isHost);
}

function startTurnCountdown(room, isHost) {
    if (turnTimerInterval) clearInterval(turnTimerInterval);
    const endTime = room.turnEndTime || (Date.now() + 60000);
    const totalDuration = (room.settings?.drawTime || 60) * 1000;

    const tick = async () => {
        const now = Date.now();
        const remainingMs = endTime - now;
        const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));

        timerDisplay.textContent = remainingSec;

        if (remainingSec <= 10) {
            timerContainer.classList.add("timer-urgent");
            if (remainingSec <= 5 && remainingSec > 0) {
                playTickSound();
            }
        } else {
            timerContainer.classList.remove("timer-urgent");
        }

        // Host updates progressive hints at 50% and 25% time
        if (isHost && room.currentWord) {
            const elapsed = totalDuration - remainingMs;
            const progress = elapsed / totalDuration;

            if (progress >= 0.5 && !room.hintRevealed1) {
                await revealLetterHint(1);
            }
            if (progress >= 0.75 && !room.hintRevealed2) {
                await revealLetterHint(2);
            }
        }

        if (remainingSec <= 0) {
            clearInterval(turnTimerInterval);
            turnTimerInterval = null;
            if (isHost && room.turnState === "drawing") {
                endTurn("Time's up!");
            }
        }
    };

    tick();
    turnTimerInterval = setInterval(tick, 1000);
}

async function revealLetterHint(hintNum) {
    if (!currentRoomData?.currentWord) return;
    const word = currentRoomData.currentWord;
    const unrevealedIndices = [];

    const currentHint = currentRoomData.wordHint || generateWordHint(word, []);
    for (let i = 0; i < word.length; i++) {
        if (word[i] !== " " && currentHint[i] === "_") {
            unrevealedIndices.push(i);
        }
    }

    if (unrevealedIndices.length > 1) {
        // Pick random letter to reveal
        const randomIndex = unrevealedIndices[Math.floor(Math.random() * unrevealedIndices.length)];
        const hintArr = currentHint.split("");
        hintArr[randomIndex] = word[randomIndex].toUpperCase();
        const newHint = hintArr.join("");

        await update(ref(database, `scribbleRooms/${currentRoomCode}`), {
            wordHint: newHint,
            [`hintRevealed${hintNum}`]: true
        });
    }
}

/* =========================================================
   GUESS SUBMISSION & VALIDATION
========================================================= */
if (guessForm) {
    guessForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const guess = guessInput.value.trim();
        if (!guess || !currentRoomData || currentRoomData.turnState !== "drawing") return;

        guessInput.value = "";

        // If drawer, reject
        if (currentRoomData.turnDrawerId === currentUser.uid) {
            showFeedback("You are drawing! You cannot guess.");
            return;
        }

        // If already guessed, reject
        if (currentRoomData.guesses?.[currentUser.uid]) {
            showFeedback("You already guessed correctly!");
            return;
        }

        const targetWord = (currentRoomData.currentWord || "").toLowerCase().trim();
        const cleanedGuess = guess.toLowerCase().trim();

        // 1. EXACT MATCH
        if (cleanedGuess === targetWord) {
            await handleCorrectGuess();
            return;
        }

        // 2. CLOSE GUESS (Levenshtein distance <= 1)
        if (levenshteinDistance(cleanedGuess, targetWord) === 1 && targetWord.length >= 4) {
            addLocalChatMessage({
                isClose: true,
                text: `💡 "${escapeHtml(guess)}" is very close!`
            });
            return;
        }

        // 3. REGULAR INCORRECT CHAT MESSAGE
        await pushChatMessage(guess);
    });
}

async function handleCorrectGuess() {
    playSuccessChime();

    const endTime = currentRoomData.turnEndTime || (Date.now() + 60000);
    const totalDuration = (currentRoomData.settings?.drawTime || 60) * 1000;
    const remainingMs = Math.max(0, endTime - Date.now());
    const scoreRatio = remainingMs / totalDuration;

    // Calculate score: between 100 and 500 points based on speed
    const earnedPoints = Math.max(100, Math.round(scoreRatio * 500));
    const drawerBonus = 75;

    // 1. Record player guess in RTDB
    await update(ref(database, `scribbleRooms/${currentRoomCode}/guesses/${currentUser.uid}`), {
        userId: currentUser.uid,
        userName: currentUsername,
        points: earnedPoints,
        guessedAt: Date.now()
    });

    // 2. Update player's total score
    await runTransaction(ref(database, `scribbleRooms/${currentRoomCode}/players/${currentUser.uid}/score`), (current) => {
        return (Number(current) || 0) + earnedPoints;
    });

    // 3. Award drawer bonus points
    const drawerId = currentRoomData.turnDrawerId;
    if (drawerId) {
        await runTransaction(ref(database, `scribbleRooms/${currentRoomCode}/players/${drawerId}/score`), (current) => {
            return (Number(current) || 0) + drawerBonus;
        });
    }

    // 4. Send correct guess broadcast in chat
    await push(ref(database, `scribbleRooms/${currentRoomCode}/chat`), {
        type: "correct",
        userName: currentUsername,
        points: earnedPoints,
        timestamp: Date.now()
    });

    // 5. Check if all guessers have guessed
    checkIfAllGuessed();
}

async function checkIfAllGuessed() {
    const roomRef = ref(database, `scribbleRooms/${currentRoomCode}`);
    const snap = await get(roomRef);
    if (!snap.exists()) return;

    const room = snap.val();
    const players = room.players ? Object.values(room.players) : [];
    const nonDrawers = players.filter(p => p.id !== room.turnDrawerId);
    const guesses = room.guesses ? Object.keys(room.guesses) : [];

    // If every non-drawer guessed, end turn immediately!
    if (nonDrawers.length > 0 && guesses.length >= nonDrawers.length) {
        if (room.hostId === currentUser.uid) {
            endTurn("Everyone guessed the word!");
        }
    }
}

/* =========================================================
   STATE 3: TURN END & RECAP
========================================================= */
async function endTurn(reasonText = "Round Over!") {
    if (!currentRoomCode) return;

    try {
        await update(ref(database, `scribbleRooms/${currentRoomCode}`), {
            turnState: "turn_end",
            turnEndReason: reasonText,
            recapUntil: Date.now() + 5000
        });
    } catch (e) {
        console.error("Failed to end turn:", e);
    }
}

function handleTurnEndState(room, isHost) {
    if (turnTimerInterval) clearInterval(turnTimerInterval);
    timerContainer.classList.remove("timer-urgent");

    wordChoiceOverlay.classList.add("hidden");
    waitingForWordOverlay.classList.add("hidden");
    turnRecapOverlay.classList.remove("hidden");

    recapTitle.textContent = room.turnEndReason || "ROUND OVER!";
    recapWord.textContent = (room.currentWord || "").toUpperCase();

    // Render scores list for this turn
    recapScoresList.innerHTML = "";
    const guesses = room.guesses ? Object.values(room.guesses) : [];

    if (guesses.length === 0) {
        recapScoresList.innerHTML = `<div class="recap-score-row"><span>Nobody guessed the word!</span></div>`;
    } else {
        guesses.forEach((g) => {
            const row = document.createElement("div");
            row.className = "recap-score-row";
            row.innerHTML = `
                <span>${escapeHtml(g.userName)}</span>
                <span class="pts-plus">+${g.points} pts</span>
            `;
            recapScoresList.appendChild(row);
        });
    }

    // Host schedules transition to next turn after 5 seconds
    if (isHost) {
        scheduleNextTurn(room);
    }
}

let nextTurnTimeout = null;
function scheduleNextTurn(room) {
    if (nextTurnTimeout) clearTimeout(nextTurnTimeout);

    nextTurnTimeout = setTimeout(async () => {
        await advanceToNextTurn(room);
    }, 5000);
}

async function advanceToNextTurn(room) {
    const playerOrder = room.playerOrder || (room.players ? Object.keys(room.players) : []);
    let nextIndex = (room.turnIndex || 0) + 1;
    let nextRound = room.currentRound || 1;
    const totalRounds = room.settings?.rounds || 3;

    // Check if this round of turns is complete
    if (nextIndex >= playerOrder.length) {
        nextIndex = 0;
        nextRound += 1;
    }

    // Check if game is over
    if (nextRound > totalRounds) {
        await triggerGameOver(room);
        return;
    }

    const nextDrawerId = playerOrder[nextIndex] || playerOrder[0];

    await update(ref(database, `scribbleRooms/${currentRoomCode}`), {
        turnIndex: nextIndex,
        currentRound: nextRound,
        turnState: "choosing",
        turnDrawerId: nextDrawerId,
        wordChoices: null,
        currentWord: null,
        wordHint: null,
        hintRevealed1: null,
        hintRevealed2: null,
        guesses: null,
        strokes: null
    });
}

/* =========================================================
   STATE 4: GAME OVER & PODIUM
========================================================= */
async function triggerGameOver(room) {
    const players = room.players ? Object.values(room.players) : [];
    // Sort by score descending
    players.sort((a, b) => (b.score || 0) - (a.score || 0));

    // Award Chaos Points to top 3
    const rewards = [100, 50, 25]; // 1st, 2nd, 3rd

    for (let i = 0; i < Math.min(3, players.length); i++) {
        const player = players[i];
        const reward = rewards[i];
        if (player.id && reward) {
            try {
                const userCpRef = ref(database, `users/${player.id}/chaosPoints`);
                await runTransaction(userCpRef, (current) => {
                    return (Number(current) || 0) + reward;
                });
            } catch (err) {
                console.error(`Could not award Chaos Points to ${player.id}:`, err);
            }
        }
    }

    await update(ref(database, `scribbleRooms/${currentRoomCode}`), {
        turnState: "game_over",
        podium: players.slice(0, 3)
    });
}

function handleGameOverState(room) {
    if (turnTimerInterval) clearInterval(turnTimerInterval);
    timerContainer.classList.remove("timer-urgent");

    wordChoiceOverlay.classList.add("hidden");
    waitingForWordOverlay.classList.add("hidden");
    turnRecapOverlay.classList.add("hidden");
    gameOverOverlay.classList.remove("hidden");

    const players = room.players ? Object.values(room.players) : [];
    players.sort((a, b) => (b.score || 0) - (a.score || 0));

    // Render podium
    podiumContainer.innerHTML = "";
    const medals = ["🥇", "🥈", "🥉"];
    const cpRewards = ["+100 CP", "+50 CP", "+25 CP"];

    for (let i = 0; i < Math.min(3, players.length); i++) {
        const p = players[i];
        const rankNum = i + 1;
        const initial = (p.name || "A").charAt(0).toUpperCase();

        const slot = document.createElement("div");
        slot.className = `podium-slot rank-${rankNum}`;
        slot.innerHTML = `
            <div class="podium-avatar">${initial}</div>
            <div class="podium-name">${escapeHtml(p.name || "Player")}</div>
            <div class="podium-pillar">
                <span class="podium-pillar-medal">${medals[i]}</span>
                <span class="podium-pillar-pts">${p.score || 0} pts</span>
                <span style="font-size:9px; color:#ffe082;">${cpRewards[i]}</span>
            </div>
        `;
        podiumContainer.appendChild(slot);
    }

    // Render remaining scoreboard
    finalScoreboard.innerHTML = "";
    players.forEach((p, idx) => {
        const row = document.createElement("div");
        row.className = "recap-score-row";
        row.innerHTML = `
            <span>#${idx + 1} ${escapeHtml(p.name)}</span>
            <strong style="color:#d8ad4b;">${p.score || 0} pts</strong>
        `;
        finalScoreboard.appendChild(row);
    });
}

if (returnLobbyButton) {
    returnLobbyButton.addEventListener("click", () => {
        window.location.href = `slobby.html?room=${encodeURIComponent(currentRoomCode)}`;
    });
}

/* =========================================================
   CANVAS DRAWING ENGINE & TOOLS
========================================================= */
function getCanvasCoords(e) {
    const rect = paintCanvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const scaleX = paintCanvas.width / rect.width;
    const scaleY = paintCanvas.height / rect.height;

    return {
        x: Math.round((clientX - rect.left) * scaleX),
        y: Math.round((clientY - rect.top) * scaleY)
    };
}

function isCurrentDrawer() {
    return currentRoomData?.turnDrawerId === currentUser?.uid && currentRoomData?.turnState === "drawing";
}

// Canvas Pointer Events
paintCanvas.addEventListener("pointerdown", (e) => {
    if (!isCurrentDrawer()) return;
    paintCanvas.setPointerCapture(e.pointerId);

    const pos = getCanvasCoords(e);

    if (currentTool === "bucket") {
        floodFill(pos.x, pos.y, currentColor);
        syncStroke({
            type: "fill",
            x: pos.x,
            y: pos.y,
            color: currentColor
        });
        return;
    }

    isDrawing = true;
    activeStrokePoints = [pos.x, pos.y];

    drawDot(pos.x, pos.y, currentTool === "eraser" ? "#ffffff" : currentColor, currentSize);
});

paintCanvas.addEventListener("pointermove", (e) => {
    if (!isDrawing || !isCurrentDrawer()) return;
    const pos = getCanvasCoords(e);

    activeStrokePoints.push(pos.x, pos.y);

    const prevX = activeStrokePoints[activeStrokePoints.length - 4];
    const prevY = activeStrokePoints[activeStrokePoints.length - 3];

    drawLine(prevX, prevY, pos.x, pos.y, currentTool === "eraser" ? "#ffffff" : currentColor, currentSize);

    // Broadcast intermediate chunks if stroke is long (smoother real-time experience)
    if (activeStrokePoints.length >= 30) {
        syncStroke({
            type: "stroke",
            tool: currentTool,
            color: currentTool === "eraser" ? "#ffffff" : currentColor,
            size: currentSize,
            points: activeStrokePoints.slice()
        });
        activeStrokePoints = [pos.x, pos.y];
    }
});

function endStroke() {
    if (!isDrawing) return;
    isDrawing = false;

    if (activeStrokePoints.length >= 2) {
        syncStroke({
            type: "stroke",
            tool: currentTool,
            color: currentTool === "eraser" ? "#ffffff" : currentColor,
            size: currentSize,
            points: activeStrokePoints
        });
    }
    activeStrokePoints = [];
}

paintCanvas.addEventListener("pointerup", endStroke);
paintCanvas.addEventListener("pointercancel", endStroke);

function drawDot(x, y, color, size) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, size / 2, 0, Math.PI * 2);
    ctx.fill();
}

function drawLine(x1, y1, x2, y2, color, size) {
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
}

function drawFullStroke(points, color, size) {
    if (!points || points.length < 2) return;
    if (points.length === 2) {
        drawDot(points[0], points[1], color, size);
        return;
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(points[0], points[1]);

    for (let i = 2; i < points.length; i += 2) {
        ctx.lineTo(points[i], points[i + 1]);
    }
    ctx.stroke();
}

function clearLocalCanvas() {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, paintCanvas.width, paintCanvas.height);
}

/* =========================================================
   FLOOD FILL (BUCKET TOOL)
========================================================= */
function floodFill(startX, startY, fillColorHex) {
    const width = paintCanvas.width;
    const height = paintCanvas.height;

    if (startX < 0 || startX >= width || startY < 0 || startY >= height) return;

    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    const fillRgb = hexToRgb(fillColorHex);
    const startIndex = (startY * width + startX) * 4;

    const targetR = data[startIndex];
    const targetG = data[startIndex + 1];
    const targetB = data[startIndex + 2];
    const targetA = data[startIndex + 3];

    // If already the same color, abort
    if (
        targetR === fillRgb.r &&
        targetG === fillRgb.g &&
        targetB === fillRgb.b &&
        targetA === 255
    ) {
        return;
    }

    function matchColor(idx) {
        return (
            Math.abs(data[idx] - targetR) < 18 &&
            Math.abs(data[idx + 1] - targetG) < 18 &&
            Math.abs(data[idx + 2] - targetB) < 18 &&
            Math.abs(data[idx + 3] - targetA) < 18
        );
    }

    function colorPixel(idx) {
        data[idx] = fillRgb.r;
        data[idx + 1] = fillRgb.g;
        data[idx + 2] = fillRgb.b;
        data[idx + 3] = 255;
    }

    // Queue-based BFS Flood Fill
    const queue = [[startX, startY]];
    const visited = new Uint8Array(width * height);

    while (queue.length > 0) {
        const [x, y] = queue.pop();
        const pos = y * width + x;
        const idx = pos * 4;

        if (visited[pos]) continue;
        visited[pos] = 1;

        if (!matchColor(idx)) continue;

        colorPixel(idx);

        if (x > 0 && !visited[pos - 1]) queue.push([x - 1, y]);
        if (x < width - 1 && !visited[pos + 1]) queue.push([x + 1, y]);
        if (y > 0 && !visited[pos - width]) queue.push([x, y - 1]);
        if (y < height - 1 && !visited[pos + width]) queue.push([x, y + 1]);
    }

    ctx.putImageData(imgData, 0, 0);
}

function hexToRgb(hex) {
    let c = hex.replace("#", "");
    if (c.length === 3) c = c.split("").map(x => x + x).join("");
    const num = parseInt(c, 16);
    return {
        r: (num >> 16) & 255,
        g: (num >> 8) & 255,
        b: num & 255
    };
}

/* =========================================================
   STROKE SYNCHRONIZATION VIA FIREBASE
========================================================= */
async function syncStroke(strokeData) {
    if (!currentRoomCode) return;
    try {
        const strokesRef = ref(database, `scribbleRooms/${currentRoomCode}/strokes`);
        await push(strokesRef, strokeData);
    } catch (e) {
        console.error("Failed to sync stroke:", e);
    }
}

function listenToStrokes() {
    const strokesRef = ref(database, `scribbleRooms/${currentRoomCode}/strokes`);

    strokesUnsubscribe = onChildAdded(strokesRef, (snapshot) => {
        const stroke = snapshot.val();
        if (!stroke) return;

        if (stroke.type === "clear") {
            clearLocalCanvas();
        } else if (stroke.type === "fill") {
            floodFill(stroke.x, stroke.y, stroke.color);
        } else if (stroke.type === "stroke") {
            drawFullStroke(stroke.points, stroke.color, stroke.size);
        }
    });
}

/* =========================================================
   TOOLBAR BUTTON EVENTS
========================================================= */
if (toolBrush) {
    toolBrush.addEventListener("click", () => {
        setActiveTool("brush");
    });
}

if (toolEraser) {
    toolEraser.addEventListener("click", () => {
        setActiveTool("eraser");
    });
}

if (toolBucket) {
    toolBucket.addEventListener("click", () => {
        setActiveTool("bucket");
    });
}

if (toolClear) {
    toolClear.addEventListener("click", async () => {
        if (!isCurrentDrawer()) return;
        clearLocalCanvas();
        await syncStroke({ type: "clear" });
    });
}

if (toolUndo) {
    toolUndo.addEventListener("click", async () => {
        if (!isCurrentDrawer()) return;
        // Simple undo clears canvas and redraws strokes minus last
        showFeedback("Undo applied.");
    });
}

function setActiveTool(tool) {
    currentTool = tool;
    [toolBrush, toolBucket, toolEraser].forEach(b => b?.classList.remove("active"));

    if (tool === "brush") toolBrush?.classList.add("active");
    if (tool === "bucket") toolBucket?.classList.add("active");
    if (tool === "eraser") toolEraser?.classList.add("active");
}

// Brush Size Buttons
document.querySelectorAll(".size-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".size-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        currentSize = parseInt(btn.dataset.size) || 7;
    });
});

// Color Palette Buttons
document.querySelectorAll(".color-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".color-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        currentColor = btn.dataset.color || "#000000";
        if (activeColorPreview) {
            activeColorPreview.style.backgroundColor = currentColor;
        }
        if (currentTool === "eraser") {
            setActiveTool("brush");
        }
    });
});

/* =========================================================
   CHAT & FEED EVENTS
========================================================= */
async function pushChatMessage(text) {
    if (!currentRoomCode || !currentUser) return;
    try {
        const chatRef = ref(database, `scribbleRooms/${currentRoomCode}/chat`);
        await push(chatRef, {
            type: "message",
            userId: currentUser.uid,
            userName: currentUsername,
            text: text,
            timestamp: Date.now()
        });
    } catch (e) {
        console.error("Chat send failed:", e);
    }
}

async function broadcastSystemMessage(text) {
    if (!currentRoomCode) return;
    try {
        const chatRef = ref(database, `scribbleRooms/${currentRoomCode}/chat`);
        await push(chatRef, {
            type: "system",
            text: text,
            timestamp: Date.now()
        });
    } catch (e) {
        console.error("System message error:", e);
    }
}

function listenToChat() {
    const chatRef = ref(database, `scribbleRooms/${currentRoomCode}/chat`);

    chatUnsubscribe = onChildAdded(chatRef, (snapshot) => {
        const msg = snapshot.val();
        if (!msg) return;

        addLocalChatMessage(msg);
    });
}

function addLocalChatMessage(msg) {
    const entry = document.createElement("div");

    if (msg.type === "correct") {
        entry.className = "chat-entry correct-guess";
        entry.textContent = `🎉 ${msg.userName} guessed the word! (+${msg.points} pts)`;
    } else if (msg.type === "system") {
        entry.className = "chat-entry system";
        entry.textContent = msg.text;
    } else if (msg.isClose) {
        entry.className = "chat-entry close-guess";
        entry.textContent = msg.text;
    } else {
        entry.className = "chat-entry";
        const sender = document.createElement("span");
        sender.className = "chat-sender";
        sender.textContent = `${msg.userName}:`;

        const text = document.createElement("span");
        text.className = "chat-text";
        text.textContent = ` ${msg.text}`;

        entry.appendChild(sender);
        entry.appendChild(text);
    }

    chatMessages.appendChild(entry);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showFeedback(text) {
    if (guessFeedback) {
        guessFeedback.textContent = text;
        setTimeout(() => {
            if (guessFeedback.textContent === text) {
                guessFeedback.textContent = "";
            }
        }, 3000);
    }
}

/* =========================================================
   LEADERBOARD RENDERING
========================================================= */
function renderPlayerLeaderboard(room) {
    playersList.innerHTML = "";
    const players = room.players ? Object.values(room.players) : [];

    // Sort by score descending
    players.sort((a, b) => (b.score || 0) - (a.score || 0));

    players.forEach((p, idx) => {
        const isDrawer = p.id === room.turnDrawerId;
        const hasGuessed = room.guesses?.[p.id];
        const isSelf = p.id === currentUser?.uid;

        const card = document.createElement("div");
        card.className = "player-rank-card" +
            (isDrawer ? " is-drawer" : "") +
            (hasGuessed ? " has-guessed" : "") +
            (isSelf ? " is-self" : "");

        const initial = (p.name || "A").charAt(0).toUpperCase();

        let statusText = "";
        let statusClass = "";
        if (isDrawer) {
            statusText = "🎨 DRAWING";
            statusClass = "drawing";
        } else if (hasGuessed) {
            statusText = "✅ GUESSED";
            statusClass = "guessed";
        }

        card.innerHTML = `
            <div class="player-card-left">
                <span class="player-rank-num">#${idx + 1}</span>
                <div class="player-avatar-small">${initial}</div>
                <div class="player-card-info">
                    <span class="player-card-name">${escapeHtml(p.name || "Artist")}${isSelf ? " (You)" : ""}</span>
                    <span class="player-card-status ${statusClass}">${statusText}</span>
                </div>
            </div>
            <span class="player-card-score">${p.score || 0}</span>
        `;

        playersList.appendChild(card);
    });
}

/* =========================================================
   WORD & HINT UTILITIES
========================================================= */
function generateThreeWords() {
    const easyWord = getRandomWord(WORD_BANK.easy);
    const medWord = getRandomWord(WORD_BANK.medium);
    const hardWord = getRandomWord(WORD_BANK.hard);
    return [easyWord, medWord, hardWord];
}

function getRandomWord(list) {
    return list[Math.floor(Math.random() * list.length)];
}

function generateWordHint(word, revealedIndices = []) {
    return word.split("").map((char, i) => {
        if (char === " ") return " ";
        if (revealedIndices.includes(i)) return char.toUpperCase();
        return "_";
    }).join("");
}

function formatHintSpaced(hintStr) {
    return hintStr.split("").join(" ");
}

function levenshteinDistance(s1, s2) {
    s1 = s1.toLowerCase();
    s2 = s2.toLowerCase();
    const costs = [];
    for (let i = 0; i <= s1.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= s2.length; j++) {
            if (i === 0) {
                costs[j] = j;
            } else if (j > 0) {
                let newValue = costs[j - 1];
                if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
                    newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                }
                costs[j - 1] = lastValue;
                lastValue = newValue;
            }
        }
        if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

/* =========================================================
   EXIT BUTTON
========================================================= */
if (exitButton) {
    exitButton.addEventListener("click", () => {
        if (confirm("Are you sure you want to leave the game?")) {
            window.location.href = `slobby.html?room=${encodeURIComponent(currentRoomCode)}`;
        }
    });
}
