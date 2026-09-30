import { ref, get, update, onValue, remove } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-database.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { app, database } from "../firebase.js";

const auth = getAuth(app);

const roomCode = new URLSearchParams(window.location.search)
    .get("room")
    ?.trim()
    .toUpperCase();

const roomCodeDisplay = document.getElementById("roomCodeDisplay");
const podiumContainer = document.getElementById("podiumContainer");
const finalScoreboard = document.getElementById("finalScoreboard");
const viewLeaderboardBtn = document.getElementById("viewLeaderboardBtn");
const returnLobbyButton = document.getElementById("returnLobbyButton");
const exitToNewRoomBtn = document.getElementById("exitToNewRoomBtn");
const exitButton = document.getElementById("exitButton");

let currentUser = null;


// =========================================================
// INITIALIZATION
// =========================================================

if (!roomCode) {
    window.location.replace("slobby.html");
} else {
    roomCodeDisplay.textContent = roomCode;
}


// =========================================================
// AUTHENTICATION
// =========================================================

onAuthStateChanged(auth, (user) => {

    if (!user) {
        window.location.replace("login.html");
        return;
    }

    currentUser = user;

    listenForResults();
});


// =========================================================
// LISTEN FOR FINAL RESULTS
// =========================================================

function listenForResults() {

    const resultsRef = ref(
        database,
        `scribbleRooms/${roomCode}/finalResults`
    );

    onValue(resultsRef, (snapshot) => {

        if (!snapshot.exists()) {

            console.warn(
                "Final results not found. Falling back to live players."
            );

            // Fallback so the page doesn't become empty
            listenToLivePlayers();

            return;
        }

        const finalResults = snapshot.val();

        renderResults(finalResults);
    });
}


// =========================================================
// FALLBACK — LIVE PLAYERS
// =========================================================

function listenToLivePlayers() {

    const playersRef = ref(
        database,
        `scribbleRooms/${roomCode}/players`
    );

    onValue(playersRef, (snapshot) => {

        if (!snapshot.exists()) {
            console.warn("No players found.");
            return;
        }

        const players = Object.values(snapshot.val());

        renderResults(players);
    });
}


// =========================================================
// RENDER RESULTS
// =========================================================

function renderResults(results) {

    let players = [];

    /*
     * finalResults is stored as an object:
     *
     * finalResults
     *   user1
     *   user2
     *   user3
     *
     * Convert it to an array.
     */

    if (Array.isArray(results)) {

        players = results;

    } else if (results && typeof results === "object") {

        players = Object.values(results);
    }


    // Remove invalid entries
    players = players.filter(Boolean);


    // Sort highest score first
    players.sort(
        (a, b) =>
            Number(b.score || 0) -
            Number(a.score || 0)
    );


    // =====================================================
    // PODIUM
    // =====================================================

    podiumContainer.innerHTML = "";

    const medals = [
        "🥇",
        "🥈",
        "🥉"
    ];

    const cpTags = [
        "+1000 CP",
        "+700 CP",
        "+500 CP"
    ];


    for (
        let i = 0;
        i < Math.min(3, players.length);
        i++
    ) {

        const p = players[i];

        const slot = document.createElement("div");

        slot.className = `podium-slot rank-${i + 1}`;


        const playerName =
            p.name ||
            p.username ||
            p.displayName ||
            "Player";


        const score =
            Number(p.score) || 0;


        slot.innerHTML = `
            <div class="podium-avatar">
                ${escapeHtml(
                    playerName
                        .charAt(0)
                        .toUpperCase()
                )}
            </div>

            <div class="podium-name">
                ${escapeHtml(playerName)}
            </div>

            <div class="podium-pillar">

                <span class="podium-medal">
                    ${medals[i]}
                </span>

                <span class="podium-pts">
                    ${score} pts
                </span>

                <span class="podium-cp-badge">
                    ${cpTags[i]}
                </span>

            </div>
        `;

        podiumContainer.appendChild(slot);
    }


    // =====================================================
    // FULL SCOREBOARD
    // =====================================================

    finalScoreboard.innerHTML = "";


    players.forEach((p, i) => {

        const playerName =
            p.name ||
            p.username ||
            p.displayName ||
            "Player";


        const score =
            Number(p.score) || 0;


        const row = document.createElement("div");

        row.className = "score-row";


        row.innerHTML = `
            <span>
                #${i + 1}
                ${escapeHtml(playerName)}
            </span>

            <strong>
                ${score} pts
            </strong>
        `;


        finalScoreboard.appendChild(row);
    });
}


// =========================================================
// VIEW LEADERBOARD
// =========================================================

viewLeaderboardBtn?.addEventListener(
    "click",
    () => {
        window.location.href = "hos.html";
    }
);


// =========================================================
// REMATCH
// =========================================================

returnLobbyButton?.addEventListener(
    "click",
    async () => {

        if (!roomCode) return;

        returnLobbyButton.disabled = true;
        returnLobbyButton.textContent = "RESETTING...";


        try {

            const snap = await get(
                ref(
                    database,
                    `scribbleRooms/${roomCode}`
                )
            );


            if (snap.exists()) {

                const room = snap.val();

                const players =
                    room.players
                        ? Object.values(room.players)
                        : [];


                // Reset room state
                await update(
                    ref(
                        database,
                        `scribbleRooms/${roomCode}`
                    ),
                    {
                        state: "waiting",
                        turnState: "waiting",
                        currentRound: 1,
                        turnIndex: 0,
                        currentWord: null,
                        wordHint: null,
                        wordChoices: null,
                        choiceDeadline: null,
                        strokes: null,
                        guesses: null,
                        rewardsAwarded: false,
                        turnDrawerId: null,
                        finalResults: null
                    }
                );


                // Reset scores
                for (const p of players) {

                    if (!p.id) continue;

                    await update(
                        ref(
                            database,
                            `scribbleRooms/${roomCode}/players/${p.id}`
                        ),
                        {
                            score: 0
                        }
                    );
                }
            }


        } catch (e) {

            console.error(
                "Error resetting room for lobby:",
                e
            );

            returnLobbyButton.disabled = false;

            returnLobbyButton.textContent =
                "🔄 PLAY AGAIN (REMATCH)";

            return;
        }


        window.location.href =
            `slobby.html?room=${encodeURIComponent(roomCode)}`;
    }
);


// =========================================================
// LEAVE ROOM
// =========================================================

async function leaveToLobby() {

    localStorage.removeItem(
        "chaosScribbleRoomCode"
    );


    if (roomCode && currentUser) {

        try {

            await remove(
                ref(
                    database,
                    `scribbleRooms/${roomCode}/players/${currentUser.uid}`
                )
            );

        } catch (e) {

            console.error(
                "Error removing player:",
                e
            );
        }
    }


    window.location.href = "slobby.html";
}


exitToNewRoomBtn?.addEventListener(
    "click",
    leaveToLobby
);


exitButton?.addEventListener(
    "click",
    async () => {

        if (
            confirm(
                "Are you sure you want to leave the studio?"
            )
        ) {
            await leaveToLobby();
        }
    }
);


// =========================================================
// HTML ESCAPE
// =========================================================

function escapeHtml(text) {

    const div =
        document.createElement("div");

    div.textContent = text;

    return div.innerHTML;
}