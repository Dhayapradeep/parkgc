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
   FIREBASE
========================= */

const auth = getAuth(app);


/* =========================
   GAME SETTINGS
========================= */

const MAX_PLAYERS = 2;


/* =========================
   ELEMENTS
========================= */

const backButton =
    document.getElementById("backButton");

const createRoomButton =
    document.getElementById("createRoomButton");

const joinRoomButton =
    document.getElementById("joinRoomButton");

const roomCodeInput =
    document.getElementById("roomCodeInput");

const setupCard =
    document.getElementById("setupCard");

const roomCard =
    document.getElementById("roomCard");

const setupStatus =
    document.getElementById("setupStatus");

const roomCodeDisplay =
    document.getElementById("roomCodeDisplay");

const copyRoomButton =
    document.getElementById("copyRoomButton");

const roomStatus =
    document.getElementById("roomStatus");

const roomStatusText =
    document.getElementById("roomStatusText");

const playersList =
    document.getElementById("playersList");

const playerCount =
    document.getElementById("playerCount");

const hostControls =
    document.getElementById("hostControls");

const startGameButton =
    document.getElementById("startGameButton");

const leaveRoomButton =
    document.getElementById("leaveRoomButton");


/* =========================
   VARIABLES
========================= */

let currentUser = null;
let currentUsername = "Player";
let currentRoomCode = null;
let currentRoomData = null;
let roomListenerStarted = false;


/* =========================
   AUTH
========================= */

onAuthStateChanged(
    auth,
    async function (user) {

        if (!user) {

            window.location.href =
                "login.html";

            return;

        }

        currentUser = user;

        await loadUserProfile();

    }
);


/* =========================
   LOAD USER
========================= */

async function loadUserProfile() {

    try {

        const userRef =
            ref(
                database,
                `users/${currentUser.uid}`
            );

        const snapshot =
            await get(userRef);

        if (snapshot.exists()) {

            const data =
                snapshot.val();

            currentUsername =
                data.username || "Player";

        }

    }
    catch (error) {

        console.error(
            "Unable to load user:",
            error
        );

    }

}


/* =========================
   BACK
========================= */

if (backButton) {

    backButton.addEventListener(
        "click",
        async function () {

            if (currentRoomCode) {

                await leaveLobby();

            }
            else {

                window.location.href =
                    "dashboard.html";

            }

        }
    );

}


/* =========================
   CREATE ROOM
========================= */

if (createRoomButton) {

    createRoomButton.addEventListener(
        "click",
        createRoom
    );

}


async function createRoom() {

    if (!currentUser) {
        return;
    }

    createRoomButton.disabled = true;

    setupStatus.textContent =
        "CREATING ROOM...";

    try {

        let roomCode;
        let exists = true;

        while (exists) {

            roomCode =
                generateRoomCode();

            const testRef =
                ref(
                    database,
                    `othelloRooms/${roomCode}`
                );

            const snapshot =
                await get(testRef);

            exists =
                snapshot.exists();

        }


        const now = Date.now();

        const roomRef =
            ref(
                database,
                `othelloRooms/${roomCode}`
            );


        /*
         * IMPORTANT:
         * Othello now consistently uses
         * black / white.
         */

        await set(
            roomRef,
            {

                hostUid:
                    currentUser.uid,

                status:
                    "waiting",

                createdAt:
                    now,

                startedAt:
                    null,

                finishedAt:
                    null,

                winnerUid:
                    null,

                rewardGiven:
                    false,

                players: {

                    [currentUser.uid]: {

                        username:
                            currentUsername,

                        joinedAt:
                            now,

                        isHost:
                            true,

                        color:
                            "black",

                        connected:
                            true

                    }

                }

            }
        );


        currentRoomCode =
            roomCode;


        showRoom();

        listenToRoom();

    }
    catch (error) {

        console.error(
            "Create room error:",
            error
        );

        setupStatus.textContent =
            "FAILED TO CREATE ROOM.";

        createRoomButton.disabled =
            false;

    }

}


/* =========================
   JOIN ROOM
========================= */

if (joinRoomButton) {

    joinRoomButton.addEventListener(
        "click",
        joinRoom
    );

}


async function joinRoom() {

    if (!currentUser) {
        return;
    }


    const roomCode =
        roomCodeInput.value
            .trim()
            .toUpperCase();


    if (!roomCode) {

        setupStatus.textContent =
            "ENTER A ROOM CODE.";

        return;

    }


    joinRoomButton.disabled = true;

    setupStatus.textContent =
        "CHECKING ROOM...";


    try {

        const roomRef =
            ref(
                database,
                `othelloRooms/${roomCode}`
            );


        const snapshot =
            await get(roomRef);


        if (!snapshot.exists()) {

            setupStatus.textContent =
                "ROOM DOES NOT EXIST.";

            return;

        }


        const room =
            snapshot.val();


        const players =
            room.players || {};


        /*
         * Existing player:
         *
         * This allows a player to reconnect
         * to an existing game.
         */

        if (
            players[currentUser.uid]
        ) {

            currentRoomCode =
                roomCode;


            await update(
                ref(
                    database,
                    `othelloRooms/${roomCode}/players/${currentUser.uid}`
                ),
                {
                    connected: true
                }
            );


            showRoom();

            listenToRoom();

            return;

        }


        /*
         * New player can only enter
         * a waiting room.
         */

        if (
            room.status !== "waiting"
        ) {

            setupStatus.textContent =
                "THIS GAME HAS ALREADY STARTED.";

            return;

        }


        const playerIds =
            Object.keys(players);


        if (
            playerIds.length >= MAX_PLAYERS
        ) {

            setupStatus.textContent =
                "ROOM IS FULL.";

            return;

        }


        /*
         * Second player is WHITE.
         */

        const playerRef =
            ref(
                database,
                `othelloRooms/${roomCode}/players/${currentUser.uid}`
            );


        await set(
            playerRef,
            {

                username:
                    currentUsername,

                joinedAt:
                    Date.now(),

                isHost:
                    false,

                color:
                    "white",

                connected:
                    true

            }
        );


        currentRoomCode =
            roomCode;


        showRoom();

        listenToRoom();

    }
    catch (error) {

        console.error(
            "Join room error:",
            error
        );

        setupStatus.textContent =
            "FAILED TO JOIN ROOM.";

    }
    finally {

        joinRoomButton.disabled =
            false;

    }

}


/* =========================
   SHOW ROOM
========================= */

function showRoom() {

    setupCard.classList.add(
        "hidden"
    );

    roomCard.classList.remove(
        "hidden"
    );

}


/* =========================
   ROOM LISTENER
========================= */

function listenToRoom() {

    if (
        !currentRoomCode ||
        roomListenerStarted
    ) {

        return;

    }


    roomListenerStarted = true;


    const roomRef =
        ref(
            database,
            `othelloRooms/${currentRoomCode}`
        );


    onValue(
        roomRef,
        function (snapshot) {

            if (!snapshot.exists()) {

                roomStatusText.textContent =
                    "ROOM NO LONGER EXISTS.";

                return;

            }


            currentRoomData =
                snapshot.val();


            renderRoom(
                currentRoomData
            );


            /*
             * Once the host starts,
             * everyone goes to ogame.html.
             */

            if (
                currentRoomData.status ===
                "starting"
            ) {

                window.location.href =
                    `ogame.html?room=${currentRoomCode}`;

            }

        }
    );

}


/* =========================
   RENDER ROOM
========================= */

function renderRoom(room) {

    const players =
        room.players || {};

    const playerEntries =
        Object.entries(players);


    roomCodeDisplay.textContent =
        currentRoomCode;


    playerCount.textContent =
        `${playerEntries.length} / ${MAX_PLAYERS}`;


    /*
     * ROOM STATUS
     */

    if (
        room.status === "waiting"
    ) {

        if (
            playerEntries.length < MAX_PLAYERS
        ) {

            roomStatus.textContent =
                "WAITING FOR OPPONENT";

        }
        else {

            roomStatus.textContent =
                "READY TO START";

        }

    }
    else {

        roomStatus.textContent =
            "GAME STARTING";

    }


    /*
     * PLAYERS
     */

    playersList.innerHTML = "";


    if (
        playerEntries.length === 0
    ) {

        playersList.innerHTML = `
            <div class="empty-player">
                Waiting for opponent...
            </div>
        `;

    }
    else {

        playerEntries.forEach(
            function ([uid, player]) {

                const playerElement =
                    document.createElement(
                        "div"
                    );

                playerElement.className =
                    "player";


                if (
                    uid === room.hostUid
                ) {

                    playerElement.classList.add(
                        "host"
                    );

                }


                const left =
                    document.createElement(
                        "span"
                    );


                const symbol =
                    document.createElement(
                        "span"
                    );


                symbol.className =
                    "player-symbol";


                symbol.textContent =
                    player.color === "black"
                        ? "⚫"
                        : "⚪";


                left.appendChild(
                    symbol
                );


                const name =
                    document.createElement(
                        "span"
                    );


                name.textContent =
                    player.username ||
                    "Player";


                left.appendChild(
                    name
                );


                playerElement.appendChild(
                    left
                );


                if (
                    uid === room.hostUid
                ) {

                    const hostBadge =
                        document.createElement(
                            "span"
                        );

                    hostBadge.className =
                        "host-badge";

                    hostBadge.textContent =
                        "👑 HOST";

                    playerElement.appendChild(
                        hostBadge
                    );

                }


                playersList.appendChild(
                    playerElement
                );

            }
        );

    }


    /*
     * HOST CONTROLS
     */

    if (
        currentUser &&
        room.hostUid === currentUser.uid &&
        room.status === "waiting"
    ) {

        hostControls.classList.remove(
            "hidden"
        );


        if (
            playerEntries.length <
            MAX_PLAYERS
        ) {

            startGameButton.disabled =
                true;

            startGameButton.textContent =
                "⚫ WAITING FOR OPPONENT";

        }
        else {

            startGameButton.disabled =
                false;

            startGameButton.textContent =
                "⚫ START GAME";

        }

    }
    else {

        hostControls.classList.add(
            "hidden"
        );

    }

}


/* =========================
   START GAME
========================= */

if (startGameButton) {

    startGameButton.addEventListener(
        "click",
        startGame
    );

}


async function startGame() {

    if (
        !currentUser ||
        !currentRoomCode ||
        !currentRoomData
    ) {

        return;

    }


    if (
        currentRoomData.hostUid !==
        currentUser.uid
    ) {

        return;

    }


    const players =
        currentRoomData.players || {};


    const playerIds =
        Object.keys(players);


    if (
        playerIds.length !== MAX_PLAYERS
    ) {

        return;

    }


    /*
     * Make sure both colors exist.
     */

    const hasBlack =
        playerIds.some(
            uid =>
                players[uid].color === "black"
        );

    const hasWhite =
        playerIds.some(
            uid =>
                players[uid].color === "white"
        );


    if (!hasBlack || !hasWhite) {

        roomStatusText.textContent =
            "PLAYER COLOR ERROR. PLEASE RECREATE THE ROOM.";

        return;

    }


    startGameButton.disabled =
        true;

    roomStatusText.textContent =
        "STARTING GAME...";


    try {

        await update(
            ref(
                database,
                `othelloRooms/${currentRoomCode}`
            ),
            {

                status:
                    "starting",

                startedAt:
                    Date.now(),

                finishedAt:
                    null,

                winnerUid:
                    null,

                rewardGiven:
                    false,

                board:
                    createInitialBoard(),

                turn:
                    1,

                lastAction:
                    "start"

            }
        );

    }
    catch (error) {

        console.error(
            "Start game error:",
            error
        );

        roomStatusText.textContent =
            "FAILED TO START GAME.";

        startGameButton.disabled =
            false;

    }

}


/* =========================
   INITIAL BOARD
========================= */

function createInitialBoard() {

    const board =
        Array.from(
            { length: 8 },
            () =>
                Array(8).fill(0)
        );


    board[3][3] = 2;
    board[3][4] = 1;
    board[4][3] = 1;
    board[4][4] = 2;


    return board;

}


/* =========================
   COPY ROOM
========================= */

if (copyRoomButton) {

    copyRoomButton.addEventListener(
        "click",
        async function () {

            if (!currentRoomCode) {
                return;
            }

            try {

                await navigator.clipboard.writeText(
                    currentRoomCode
                );

                copyRoomButton.textContent =
                    "✓ COPIED";

                setTimeout(
                    function () {

                        copyRoomButton.textContent =
                            "📋 COPY";

                    },
                    1500
                );

            }
            catch (error) {

                console.error(
                    "Copy failed:",
                    error
                );

            }

        }
    );

}


/* =========================
   LEAVE LOBBY
========================= */

async function leaveLobby() {

    if (
        !currentUser ||
        !currentRoomCode
    ) {

        window.location.href =
            "dashboard.html";

        return;

    }


    try {

        const roomRef =
            ref(
                database,
                `othelloRooms/${currentRoomCode}`
            );


        const snapshot =
            await get(roomRef);


        if (!snapshot.exists()) {

            window.location.href =
                "dashboard.html";

            return;

        }


        const room =
            snapshot.val();


        /*
         * Lobby is still waiting.
         * Remove the player normally.
         */

        if (
            room.status === "waiting"
        ) {

            const playerRef =
                ref(
                    database,
                    `othelloRooms/${currentRoomCode}/players/${currentUser.uid}`
                );


            await remove(playerRef);


            const updated =
                await get(roomRef);


            if (
                updated.exists()
            ) {

                const updatedRoom =
                    updated.val();


                const remaining =
                    Object.entries(
                        updatedRoom.players || {}
                    );


                if (
                    remaining.length === 0
                ) {

                    await remove(roomRef);

                }
                else if (
                    updatedRoom.hostUid ===
                    currentUser.uid
                ) {

                    const newHostUid =
                        remaining[0][0];


                    await update(
                        roomRef,
                        {

                            hostUid:
                                newHostUid,

                            [`players/${newHostUid}/isHost`]:
                                true

                        }
                    );

                }

            }

        }
        else {

            /*
             * Game already started.
             * Keep player record so they can
             * reconnect to the game.
             */

            await update(
                ref(
                    database,
                    `othelloRooms/${currentRoomCode}/players/${currentUser.uid}`
                ),
                {
                    connected: false
                }
            );

        }


        currentRoomCode = null;


        window.location.href =
            "dashboard.html";

    }
    catch (error) {

        console.error(
            "Leave error:",
            error
        );

        window.location.href =
            "dashboard.html";

    }

}


if (leaveRoomButton) {

    leaveRoomButton.addEventListener(
        "click",
        leaveLobby
    );

}


/* =========================
   ROOM CODE
========================= */

function generateRoomCode() {

    const characters =
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let code = "";

    for (
        let i = 0;
        i < 6;
        i++
    ) {

        code +=
            characters[
                Math.floor(
                    Math.random() *
                    characters.length
                )
            ];

    }

    return code;

}