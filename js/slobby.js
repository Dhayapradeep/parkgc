import {
    ref,
    set,
    get,
    update,
    onValue,
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

/* =========================
   FIREBASE AUTH
========================= */
const auth = getAuth(app);

/* =========================
   CONSTANTS & STORAGE KEYS
========================= */
const SAVED_ROOM_KEY = "chaosScribbleRoomCode";
const MAX_PLAYERS = 12;

/* =========================
   ELEMENT REFERENCES
========================= */
const backButton = document.getElementById("backButton");
const setupCard = document.getElementById("setupCard");
const roomCard = document.getElementById("roomCard");
const createRoomButton = document.getElementById("createRoomButton");
const joinRoomButton = document.getElementById("joinRoomButton");
const roomCodeInput = document.getElementById("roomCodeInput");
const setupStatus = document.getElementById("setupStatus");

const roomCodeDisplay = document.getElementById("roomCodeDisplay");
const copyRoomButton = document.getElementById("copyRoomButton");
const roomStatus = document.getElementById("roomStatus");
const roomStatusText = document.getElementById("roomStatusText");
const settingsSection = document.getElementById("settingsSection");
const roundsSelect = document.getElementById("roundsSelect");
const drawTimeSelect = document.getElementById("drawTimeSelect");
const playersList = document.getElementById("playersList");
const playerCount = document.getElementById("playerCount");
const hostControls = document.getElementById("hostControls");
const startGameButton = document.getElementById("startGameButton");
const leaveRoomButton = document.getElementById("leaveRoomButton");

/* =========================
   STATE VARIABLES
========================= */
let currentUser = null;
let currentUsername = "Artist";
let currentRoomCode = null;
let currentRoomData = null;
let roomUnsubscribe = null;

/* =========================
   NAVIGATION & UI HELPERS
========================= */
if (backButton) {
    backButton.addEventListener("click", () => {
        window.location.href = "dashboard.html";
    });
}

function showStatus(text, isError = true) {
    if (setupStatus) {
        setupStatus.textContent = text;
        setupStatus.style.color = isError ? "#ff5252" : "#81c784";
    }
}

function generateRoomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

/* =========================
   AUTH LISTENER
========================= */
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }

    currentUser = user;
    await loadUserProfile();

    // Check URL parameter first, then localStorage
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get("room");

    if (roomParam) {
        await joinRoomByCode(roomParam.trim().toUpperCase());
    } else {
        await checkSavedRoom();
    }
});

async function loadUserProfile() {
    try {
        const userRef = ref(database, `users/${currentUser.uid}`);
        const snapshot = await get(userRef);
        if (snapshot.exists()) {
            const data = snapshot.val();
            currentUsername = data.username || data.displayName || "Artist";
        }
    } catch (err) {
        console.error("Failed to load user profile:", err);
    }
}

async function checkSavedRoom() {
    const saved = localStorage.getItem(SAVED_ROOM_KEY);
    if (!saved) return;

    try {
        const roomRef = ref(database, `scribbleRooms/${saved}`);
        const snapshot = await get(roomRef);
        if (snapshot.exists()) {
            const room = snapshot.val();
            if (room.players && room.players[currentUser.uid]) {
                currentRoomCode = saved;
                enterRoomView(saved);
                listenToRoom(saved);
                return;
            }
        }
        localStorage.removeItem(SAVED_ROOM_KEY);
    } catch (err) {
        console.error("Failed to restore room:", err);
    }
}

/* =========================
   ROOM CREATION
========================= */
if (createRoomButton) {
    createRoomButton.addEventListener("click", async () => {
        if (!currentUser) return;
        createRoomButton.disabled = true;
        createRoomButton.textContent = "CREATING...";

        try {
            const roomCode = generateRoomCode();
            const rounds = parseInt(roundsSelect?.value) || 3;
            const drawTime = parseInt(drawTimeSelect?.value) || 60;

            const roomRef = ref(database, `scribbleRooms/${roomCode}`);
            const initialData = {
                code: roomCode,
                hostId: currentUser.uid,
                createdAt: Date.now(),
                state: "waiting",
                settings: {
                    rounds: rounds,
                    drawTime: drawTime
                },
                players: {
                    [currentUser.uid]: {
                        id: currentUser.uid,
                        name: currentUsername,
                        score: 0,
                        isHost: true,
                        joinedAt: Date.now()
                    }
                }
            };

            await set(roomRef, initialData);

            currentRoomCode = roomCode;
            localStorage.setItem(SAVED_ROOM_KEY, roomCode);

            enterRoomView(roomCode);
            listenToRoom(roomCode);
        } catch (err) {
            console.error("Error creating room:", err);
            showStatus("Failed to create room. Please try again.");
        } finally {
            createRoomButton.disabled = false;
            createRoomButton.textContent = "CREATE ROOM";
        }
    });
}

/* =========================
   JOIN ROOM
========================= */
if (joinRoomButton) {
    joinRoomButton.addEventListener("click", async () => {
        const code = roomCodeInput.value.trim().toUpperCase();
        if (!code || code.length < 4) {
            showStatus("Please enter a valid room code.");
            return;
        }
        await joinRoomByCode(code);
    });
}

if (roomCodeInput) {
    roomCodeInput.addEventListener("keydown", async (e) => {
        if (e.key === "Enter") {
            const code = roomCodeInput.value.trim().toUpperCase();
            if (code) await joinRoomByCode(code);
        }
    });
}

async function joinRoomByCode(code) {
    if (!currentUser) return;
    showStatus("");
    joinRoomButton.disabled = true;
    joinRoomButton.textContent = "JOINING...";

    try {
        const roomRef = ref(database, `scribbleRooms/${code}`);
        const snapshot = await get(roomRef);

        if (!snapshot.exists()) {
            showStatus("Room not found. Check code and try again.");
            return;
        }

        const room = snapshot.val();
        if (room.state === "in_game" && (!room.players || !room.players[currentUser.uid])) {
            showStatus("Game already in progress. Wait for next round.");
            return;
        }

        const currentPlayers = room.players ? Object.keys(room.players).length : 0;
        if (currentPlayers >= MAX_PLAYERS && (!room.players || !room.players[currentUser.uid])) {
            showStatus("Room is full (max 12 players).");
            return;
        }

        // Add player to room
        const playerRef = ref(database, `scribbleRooms/${code}/players/${currentUser.uid}`);
        await update(playerRef, {
            id: currentUser.uid,
            name: currentUsername,
            score: room.players?.[currentUser.uid]?.score || 0,
            isHost: room.hostId === currentUser.uid,
            joinedAt: Date.now()
        });

        currentRoomCode = code;
        localStorage.setItem(SAVED_ROOM_KEY, code);

        enterRoomView(code);
        listenToRoom(code);
    } catch (err) {
        console.error("Error joining room:", err);
        showStatus("Could not join room. Try again.");
    } finally {
        joinRoomButton.disabled = false;
        joinRoomButton.textContent = "JOIN ROOM";
    }
}

/* =========================
   ROOM VIEW TRANSITION
========================= */
function enterRoomView(code) {
    setupCard.classList.add("hidden");
    roomCard.classList.remove("hidden");
    roomCodeDisplay.textContent = code;
}

function leaveRoomView() {
    roomCard.classList.add("hidden");
    setupCard.classList.remove("hidden");
    if (roomCodeInput) roomCodeInput.value = "";
    if (setupStatus) setupStatus.textContent = "";
}

/* =========================
   REALTIME ROOM LISTENER
========================= */
function listenToRoom(code) {
    if (roomUnsubscribe) {
        roomUnsubscribe();
        roomUnsubscribe = null;
    }

    const roomRef = ref(database, `scribbleRooms/${code}`);
    roomUnsubscribe = onValue(roomRef, (snapshot) => {
        if (!snapshot.exists()) {
            // Room was disbanded or removed
            localStorage.removeItem(SAVED_ROOM_KEY);
            currentRoomCode = null;
            leaveRoomView();
            showStatus("The room was closed.");
            return;
        }

        currentRoomData = snapshot.val();

        // Redirect to game if started
        if (currentRoomData.state === "in_game") {
            window.location.href = `scribble.html?room=${encodeURIComponent(code)}`;
            return;
        }

        updateLobbyUI(currentRoomData);
    });
}

function updateLobbyUI(room) {
    const isHost = room.hostId === currentUser.uid;
    const players = room.players ? Object.values(room.players) : [];

    // Player Count
    playerCount.textContent = `${players.length} / ${MAX_PLAYERS}`;

    // Render Players
    playersList.innerHTML = "";
    if (players.length === 0) {
        playersList.innerHTML = `<div class="empty-player">Waiting for players to join...</div>`;
    } else {
        // Sort host first, then by joinedAt
        players.sort((a, b) => {
            if (a.id === room.hostId) return -1;
            if (b.id === room.hostId) return 1;
            return (a.joinedAt || 0) - (b.joinedAt || 0);
        });

        players.forEach((p) => {
            const item = document.createElement("div");
            item.className = "player-item" + (p.id === currentUser.uid ? " is-self" : "");

            const initial = (p.name || "A").charAt(0).toUpperCase();
            const isPlayerHost = p.id === room.hostId;
            const isSelf = p.id === currentUser.uid;

            item.innerHTML = `
                <div class="player-name-wrap">
                    <div class="player-avatar">${initial}</div>
                    <span>${escapeHtml(p.name || "Artist")}</span>
                </div>
                <div class="player-badges">
                    ${isPlayerHost ? '<span class="badge-host">👑 HOST</span>' : ""}
                    ${isSelf ? '<span class="badge-you">YOU</span>' : ""}
                </div>
            `;
            playersList.appendChild(item);
        });
    }

    // Host Controls and Settings
    if (isHost) {
        hostControls.classList.remove("hidden");
        settingsSection.classList.remove("hidden");
        roomStatusText.textContent = "You are the host. Configure settings and start whenever ready.";
        
        // Update select values to match room
        if (room.settings) {
            if (roundsSelect) roundsSelect.value = room.settings.rounds || 3;
            if (drawTimeSelect) drawTimeSelect.value = room.settings.drawTime || 60;
        }
    } else {
        hostControls.classList.add("hidden");
        settingsSection.classList.add("hidden");
        roomStatusText.textContent = "Waiting for host to start the game...";
    }
}

/* =========================
   HOST SETTINGS CHANGE
========================= */
if (roundsSelect) {
    roundsSelect.addEventListener("change", async () => {
        if (!currentRoomCode || currentRoomData?.hostId !== currentUser?.uid) return;
        const val = parseInt(roundsSelect.value) || 3;
        await update(ref(database, `scribbleRooms/${currentRoomCode}/settings`), {
            rounds: val
        });
    });
}

if (drawTimeSelect) {
    drawTimeSelect.addEventListener("change", async () => {
        if (!currentRoomCode || currentRoomData?.hostId !== currentUser?.uid) return;
        const val = parseInt(drawTimeSelect.value) || 60;
        await update(ref(database, `scribbleRooms/${currentRoomCode}/settings`), {
            drawTime: val
        });
    });
}

/* =========================
   START GAME (HOST)
========================= */
if (startGameButton) {
    startGameButton.addEventListener("click", async () => {
        if (!currentRoomCode || currentRoomData?.hostId !== currentUser?.uid) return;

        startGameButton.disabled = true;
        startGameButton.textContent = "STARTING...";

        try {
            const players = currentRoomData.players ? Object.values(currentRoomData.players) : [];
            const playerIds = players.map(p => p.id);

            // Setup initial game state
            const updates = {
                state: "in_game",
                startedAt: Date.now(),
                turnIndex: 0,
                currentRound: 1,
                turnState: "choosing", // "choosing", "drawing", "turn_end", "game_over"
                turnDrawerId: playerIds[0] || currentUser.uid,
                playerOrder: playerIds,
                strokes: null,
                currentWord: null,
                wordChoices: null,
                wordHint: null,
                guesses: null
            };

            await update(ref(database, `scribbleRooms/${currentRoomCode}`), updates);
            // Redirection will happen automatically in the listener
        } catch (err) {
            console.error("Error starting game:", err);
            startGameButton.disabled = false;
            startGameButton.textContent = "🎨 START GAME";
            alert("Could not start game. Please try again.");
        }
    });
}

/* =========================
   LEAVE ROOM
========================= */
if (leaveRoomButton) {
    leaveRoomButton.addEventListener("click", async () => {
        if (!currentRoomCode || !currentUser) return;

        try {
            const roomRef = ref(database, `scribbleRooms/${currentRoomCode}`);
            const snapshot = await get(roomRef);

            if (snapshot.exists()) {
                const room = snapshot.val();
                const players = room.players ? Object.keys(room.players) : [];

                if (players.length <= 1) {
                    // Last player, delete the room
                    await remove(roomRef);
                } else {
                    // Remove current player
                    await remove(ref(database, `scribbleRooms/${currentRoomCode}/players/${currentUser.uid}`));

                    // If host leaves, assign next host
                    if (room.hostId === currentUser.uid) {
                        const remaining = players.filter(id => id !== currentUser.uid);
                        if (remaining.length > 0) {
                            await update(roomRef, {
                                hostId: remaining[0],
                                [`players/${remaining[0]}/isHost`]: true
                            });
                        }
                    }
                }
            }
        } catch (err) {
            console.error("Error leaving room:", err);
        } finally {
            if (roomUnsubscribe) {
                roomUnsubscribe();
                roomUnsubscribe = null;
            }
            localStorage.removeItem(SAVED_ROOM_KEY);
            currentRoomCode = null;
            currentRoomData = null;
            leaveRoomView();
        }
    });
}

/* =========================
   COPY ROOM CODE
========================= */
if (copyRoomButton) {
    copyRoomButton.addEventListener("click", async () => {
        if (!currentRoomCode) return;
        try {
            await navigator.clipboard.writeText(currentRoomCode);
            copyRoomButton.textContent = "✅ COPIED!";
            setTimeout(() => {
                copyRoomButton.textContent = "📋 COPY CODE";
            }, 2000);
        } catch (err) {
            // Fallback
            copyRoomButton.textContent = currentRoomCode;
        }
    });
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}
