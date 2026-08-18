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

import {
    questions
} from "./lwq.js";


/* =========================
   FIREBASE
========================= */

const auth = getAuth(app);


/* =========================
   GAME SETTINGS
========================= */

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 15;
const TOTAL_ROUNDS = 30;
const ROUND_DURATION = 15 * 1000;


/* =========================
   ELEMENTS
========================= */

const backButton = document.getElementById("backButton");
const createRoomButton = document.getElementById("createRoomButton");
const joinRoomButton = document.getElementById("joinRoomButton");
const roomCodeInput = document.getElementById("roomCodeInput");

const setupCard = document.getElementById("setupCard");
const roomCard = document.getElementById("roomCard");

const setupStatus = document.getElementById("setupStatus");

const roomCodeDisplay = document.getElementById("roomCodeDisplay");
const copyRoomButton = document.getElementById("copyRoomButton");

const roomStatus = document.getElementById("roomStatus");
const roomStatusText = document.getElementById("roomStatusText");

const playersList = document.getElementById("playersList");
const playerCount = document.getElementById("playerCount");

const hostControls = document.getElementById("hostControls");
const startGameButton = document.getElementById("startGameButton");

const leaveRoomButton = document.getElementById("leaveRoomButton");


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

onAuthStateChanged(auth, async function (user) {

    if (!user) {

        window.location.href = "login.html";
        return;

    }

    currentUser = user;

    await loadUserProfile();

});


/* =========================
   LOAD USER PROFILE
========================= */

async function loadUserProfile() {

    try {

        const userRef = ref(
            database,
            `users/${currentUser.uid}`
        );

        const snapshot = await get(userRef);

        if (snapshot.exists()) {

            const data = snapshot.val();

            currentUsername =
                data.username ||
                "Player";

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
   BACK BUTTON
========================= */

if (backButton) {

    backButton.addEventListener(
        "click",
        async function () {

            if (currentRoomCode) {

                await leaveRoom();

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

        setupStatus.textContent =
            "PLEASE WAIT FOR LOGIN.";

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

            const roomCheckRef = ref(
                database,
                `lastWordRooms/${roomCode}`
            );

            const snapshot =
                await get(roomCheckRef);

            exists =
                snapshot.exists();

        }


        const roomRef = ref(
            database,
            `lastWordRooms/${roomCode}`
        );


        const now = Date.now();


        await set(
            roomRef,
            {

                hostUid:
                    currentUser.uid,


                status:
                    "waiting",


                createdAt:
                    now,


                gameStartAt:
                    null,


                currentRound:
                    0,


                roundStartAt:
                    null,


                roundDuration:
                    ROUND_DURATION,


                totalRounds:
                    TOTAL_ROUNDS,


                questions:
                    [],


                usedAnswers:
                    {},


                roundResultAt:
                    null,


                finishedAt:
                    null,


                rewardsCalculated:
                    false,


                rewardsDistributed:
                    false,


                players: {

                    [currentUser.uid]: {

                        username:
                            currentUsername,

                        joinedAt:
                            now,

                        isHost:
                            true,

                        leftGame:
                            false,

                        score:
                            0,

                        lastAnsweredRound:
                            null,

                        lastAnswer:
                            null,

                        finalRank:
                            null,

                        finalReward:
                            0

                    }

                }

            }
        );


        currentRoomCode =
            roomCode;


        setupCard.classList.add(
            "hidden"
        );

        roomCard.classList.remove(
            "hidden"
        );


        listenToRoom();


    }
    catch (error) {

        console.error(
            "CREATE ROOM ERROR:",
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

        setupStatus.textContent =
            "PLEASE WAIT FOR LOGIN.";

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


    joinRoomButton.disabled =
        true;

    setupStatus.textContent =
        "JOINING ROOM...";


    try {

        const roomRef = ref(
            database,
            `lastWordRooms/${roomCode}`
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


        if (
            room.status !== "waiting"
        ) {

            setupStatus.textContent =
                "GAME HAS ALREADY STARTED.";

            return;

        }


        const players =
            room.players || {};


        if (
            Object.keys(players).length >=
            MAX_PLAYERS
        ) {

            setupStatus.textContent =
                "ROOM IS FULL.";

            return;

        }


        const now = Date.now();


        const playerRef = ref(
            database,
            `lastWordRooms/${roomCode}/players/${currentUser.uid}`
        );


        await set(
            playerRef,
            {

                username:
                    currentUsername,

                joinedAt:
                    now,

                isHost:
                    false,

                leftGame:
                    false,

                score:
                    0,

                lastAnsweredRound:
                    null,

                lastAnswer:
                    null,

                finalRank:
                    null,

                finalReward:
                    0

            }
        );


        currentRoomCode =
            roomCode;


        setupCard.classList.add(
            "hidden"
        );

        roomCard.classList.remove(
            "hidden"
        );


        listenToRoom();


    }
    catch (error) {

        console.error(
            "JOIN ROOM ERROR:",
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
   ROOM LISTENER
========================= */

function listenToRoom() {

    if (
        !currentRoomCode ||
        roomListenerStarted
    ) {

        return;

    }


    roomListenerStarted =
        true;


    const roomRef = ref(
        database,
        `lastWordRooms/${currentRoomCode}`
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
               IMPORTANT:
               BOTH HOST AND PLAYERS
               GO TO GAME PAGE
            */

            if (
                currentRoomData.status ===
                "playing"
            ) {

                window.location.href =
                    `lw.html?room=${encodeURIComponent(currentRoomCode)}`;

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
        playerEntries.length;


    if (
        room.status === "waiting"
    ) {

        roomStatus.textContent =
            "WAITING FOR PLAYERS";

        roomStatusText.textContent =
            "WAITING FOR PLAYERS";

    }
    else {

        roomStatus.textContent =
            "GAME STARTING";

        roomStatusText.textContent =
            "GAME STARTING...";

    }


    playersList.innerHTML =
        "";


    playerEntries.forEach(
        function ([uid, player]) {

            const playerElement =
                document.createElement("div");


            playerElement.className =
                "player";


            const name =
                document.createElement("span");


            name.textContent =
                player.username ||
                "Player";


            playerElement.appendChild(
                name
            );


            if (
                uid === room.hostUid
            ) {

                const hostBadge =
                    document.createElement("span");


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


    /*
       HOST CONTROLS
    */

    if (
        currentUser &&
        room.hostUid === currentUser.uid
    ) {

        hostControls.classList.remove(
            "hidden"
        );


        if (
            playerEntries.length <
            MIN_PLAYERS
        ) {

            const needed =
                MIN_PLAYERS -
                playerEntries.length;


            startGameButton.disabled =
                true;


            startGameButton.textContent =
                `📝 NEED ${needed} MORE PLAYER${needed === 1 ? "" : "S"}`;

        }
        else {

            startGameButton.disabled =
                false;


            startGameButton.textContent =
                "📝 START GAME";

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
        playerIds.length <
        MIN_PLAYERS
    ) {

        return;

    }


    if (
        questions.length <
        TOTAL_ROUNDS
    ) {

        roomStatusText.textContent =
            "NOT ENOUGH QUESTIONS.";

        return;

    }


    startGameButton.disabled =
        true;


    roomStatusText.textContent =
        "STARTING GAME...";


    try {

        /*
           RANDOMLY PICK
           30 QUESTIONS
        */

        const shuffled =
            [...questions]
                .sort(
                    () =>
                        Math.random() - 0.5
                );


        const selectedQuestions =
            shuffled.slice(
                0,
                TOTAL_ROUNDS
            );


        const updates = {};


        playerIds.forEach(
            function (uid) {

                updates[
                    `players/${uid}/score`
                ] = 0;


                updates[
                    `players/${uid}/lastAnsweredRound`
                ] = null;


                updates[
                    `players/${uid}/lastAnswer`
                ] = null;


                updates[
                    `players/${uid}/finalRank`
                ] = null;


                updates[
                    `players/${uid}/finalReward`
                ] = 0;

            }
        );


        const now =
            Date.now();


        const roomRef =
            ref(
                database,
                `lastWordRooms/${currentRoomCode}`
            );


        /*
           EVERYTHING IS SAVED
           BEFORE REDIRECTING
        */

        await update(
            roomRef,
            {

                ...updates,


                status:
                    "playing",


                gameStartAt:
                    now,


                currentRound:
                    0,


                /*
                   START IMMEDIATELY
                */

                roundStartAt:
                    now,


                roundDuration:
                    ROUND_DURATION,


                totalRounds:
                    TOTAL_ROUNDS,


                questions:
                    selectedQuestions,


                currentQuestion:
                    selectedQuestions[0],


                usedAnswers:
                    {},


                roundResultAt:
                    null,


                finishedAt:
                    null,


                rewardsCalculated:
                    false,


                rewardsDistributed:
                    false

            }
        );

    }
    catch (error) {

        console.error(
            "START GAME ERROR:",
            error
        );

        roomStatusText.textContent =
            "FAILED TO START GAME.";

        startGameButton.disabled =
            false;

    }

}


/* =========================
   COPY ROOM CODE
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
                    "COPY ERROR:",
                    error
                );

            }

        }
    );

}


/* =========================
   LEAVE ROOM
========================= */

if (leaveRoomButton) {

    leaveRoomButton.addEventListener(
        "click",
        leaveRoom
    );

}


async function leaveRoom() {

    if (
        !currentUser ||
        !currentRoomCode
    ) {

        window.location.href =
            "dashboard.html";

        return;

    }


    try {

        const playerRef = ref(
            database,
            `lastWordRooms/${currentRoomCode}/players/${currentUser.uid}`
        );


        await remove(playerRef);


        const roomRef = ref(
            database,
            `lastWordRooms/${currentRoomCode}`
        );


        const snapshot =
            await get(roomRef);


        if (snapshot.exists()) {

            const room =
                snapshot.val();


            const players =
                room.players || {};


            if (
                Object.keys(players).length === 0
            ) {

                await remove(roomRef);

            }

        }


        currentRoomCode =
            null;


        window.location.href =
            "dashboard.html";

    }
    catch (error) {

        console.error(
            "LEAVE ROOM ERROR:",
            error
        );

    }

}


/* =========================
   GENERATE ROOM CODE
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
