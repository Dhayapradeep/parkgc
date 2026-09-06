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

const MIN_PLAYERS = 2;

const MAX_PLAYERS = 15;

const TOTAL_ROUNDS = 5;

const ROUND_DURATION = 60 * 1000;

const CLUE_INTERVAL = 10 * 1000;



/* =========================
   LOCAL STORAGE
========================= */

const SAVED_ROOM_KEY =
    "chaosCodeRoomCode";



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

const startHint =
    document.getElementById("startHint");

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


        currentUser =
            user;


        await loadUserProfile();


        /*
           Check whether this player
           already has a Chaos Code room.
        */

        await checkSavedRoom();

    }
);



/* =========================
   LOAD USER PROFILE
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
                data.username ||
                "Player";

        }

    }

    catch (error) {

        console.error(
            "UNABLE TO LOAD USER:",
            error
        );

    }

}



/* =========================
   CHECK SAVED ROOM
========================= */

async function checkSavedRoom() {

    const savedRoomCode =
        localStorage.getItem(
            SAVED_ROOM_KEY
        );


    if (!savedRoomCode) {

        return;

    }


    const roomCode =
        savedRoomCode
            .trim()
            .toUpperCase();


    try {

        const roomRef =
            ref(
                database,
                `chaosCodeRooms/${roomCode}`
            );


        const snapshot =
            await get(roomRef);


        /*
           Saved room no longer exists.
        */

        if (!snapshot.exists()) {

            localStorage.removeItem(
                SAVED_ROOM_KEY
            );

            return;

        }


        const room =
            snapshot.val();


        const player =
            room.players?.[
                currentUser.uid
            ];


        /*
           Player is not part of room anymore.
        */

        if (!player) {

            localStorage.removeItem(
                SAVED_ROOM_KEY
            );

            return;

        }


        /*
           Game already finished.
        */

        if (
            room.status ===
            "finished"
        ) {

            localStorage.removeItem(
                SAVED_ROOM_KEY
            );

            return;

        }


        /*
           Restore the player.

           We only change leftGame.

           We do NOT reset score
           or any other game data.
        */

        if (
            player.leftGame === true
        ) {

            const playerRef =
                ref(
                    database,
                    `chaosCodeRooms/${roomCode}/players/${currentUser.uid}`
                );


            await update(
                playerRef,
                {
                    leftGame: false
                }
            );

        }


        /*
           Remember room.
        */

        localStorage.setItem(
            SAVED_ROOM_KEY,
            roomCode
        );


        currentRoomCode =
            roomCode;


        /*
           If game is already running,
           continue directly.
        */

        if (
            room.status === "starting" ||
            room.status === "playing" ||
            room.status === "roundResult"
        ) {

            window.location.href =
                `code.html?room=${encodeURIComponent(roomCode)}`;

            return;

        }


        /*
           Waiting room.
        */

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
            "CHECK SAVED ROOM ERROR:",
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


    createRoomButton.disabled =
        true;


    joinRoomButton.disabled =
        true;


    setupStatus.textContent =
        "CREATING ROOM...";


    try {

        let roomCode;

        let exists = true;


        while (exists) {

            roomCode =
                generateRoomCode();


            const roomCheckRef =
                ref(
                    database,
                    `chaosCodeRooms/${roomCode}`
                );


            const snapshot =
                await get(
                    roomCheckRef
                );


            exists =
                snapshot.exists();

        }


        const roomRef =
            ref(
                database,
                `chaosCodeRooms/${roomCode}`
            );


        const now =
            Date.now();


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

                clueInterval:
                    CLUE_INTERVAL,

                totalRounds:
                    TOTAL_ROUNDS,

                rounds:
                    {},

                currentCode:
                    null,

                currentClues:
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

                        currentRoundScore:
                            0,

                        lastAnswer:
                            null,

                        lastAnsweredRound:
                            null,

                        submittedAt:
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


        /*
           SAVE ROOM CODE
        */

        localStorage.setItem(
            SAVED_ROOM_KEY,
            roomCode
        );


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

        joinRoomButton.disabled =
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


    createRoomButton.disabled =
        true;


    setupStatus.textContent =
        "JOINING ROOM...";


    try {

        const roomRef =
            ref(
                database,
                `chaosCodeRooms/${roomCode}`
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
           EXISTING PLAYER REJOIN
        */

        const existingPlayer =
            players[
                currentUser.uid
            ];


        if (existingPlayer) {

            /*
               Game finished.
            */

            if (
                room.status ===
                "finished"
            ) {

                setupStatus.textContent =
                    "GAME HAS ALREADY FINISHED.";

                return;

            }


            const playerRef =
                ref(
                    database,
                    `chaosCodeRooms/${roomCode}/players/${currentUser.uid}`
                );


            /*
               Restore player connection.

               Do NOT reset anything.
            */

            await update(
                playerRef,
                {
                    leftGame: false
                }
            );


            currentRoomCode =
                roomCode;


            localStorage.setItem(
                SAVED_ROOM_KEY,
                roomCode
            );


            /*
               Continue existing game.
            */

            if (
                room.status === "starting" ||
                room.status === "playing" ||
                room.status === "roundResult"
            ) {

                window.location.href =
                    `code.html?room=${encodeURIComponent(roomCode)}`;

                return;

            }


            /*
               Waiting lobby.
            */

            setupCard.classList.add(
                "hidden"
            );

            roomCard.classList.remove(
                "hidden"
            );


            listenToRoom();

            return;

        }


        /*
           NEW PLAYER

           New players can only join while
           the room is waiting.
        */

        if (
            room.status !==
            "waiting"
        ) {

            setupStatus.textContent =
                "GAME HAS ALREADY STARTED. THIS ROOM IS NOT ACCEPTING NEW PLAYERS.";

            return;

        }


        if (
            Object.keys(players).length >=
            MAX_PLAYERS
        ) {

            setupStatus.textContent =
                "ROOM IS FULL.";

            return;

        }


        const now =
            Date.now();


        const playerRef =
            ref(
                database,
                `chaosCodeRooms/${roomCode}/players/${currentUser.uid}`
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

                currentRoundScore:
                    0,

                lastAnswer:
                    null,

                lastAnsweredRound:
                    null,

                submittedAt:
                    null,

                finalRank:
                    null,

                finalReward:
                    0

            }
        );


        currentRoomCode =
            roomCode;


        localStorage.setItem(
            SAVED_ROOM_KEY,
            roomCode
        );


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

        createRoomButton.disabled =
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


    const roomRef =
        ref(
            database,
            `chaosCodeRooms/${currentRoomCode}`
        );


    onValue(
        roomRef,
        function (snapshot) {

            if (!snapshot.exists()) {

                localStorage.removeItem(
                    SAVED_ROOM_KEY
                );


                roomStatusText.textContent =
                    "ROOM NO LONGER EXISTS.";

                return;

            }


            currentRoomData =
                snapshot.val();


            /*
               Make sure player still exists.
            */

            const player =
                currentRoomData.players?.[
                    currentUser.uid
                ];


            if (!player) {

                return;

            }


            /*
               If this player was marked as
               temporarily left, don't remove
               their data.
            */

            renderRoom(
                currentRoomData
            );


            /*
               Everyone enters the same game
               when the host starts it.
            */

            if (
                currentRoomData.status ===
                    "starting" ||
                currentRoomData.status ===
                    "playing" ||
                currentRoomData.status ===
                    "roundResult"
            ) {

                window.location.href =
                    `code.html?room=${encodeURIComponent(currentRoomCode)}`;

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


    /*
       Only show players who haven't
       intentionally left the game.
    */

    const playerEntries =
        Object.entries(players)
            .filter(
                function ([, player]) {

                    return !player.leftGame;

                }
            );


    roomCodeDisplay.textContent =
        currentRoomCode;


    playerCount.textContent =
        `${playerEntries.length} / ${MAX_PLAYERS}`;


    /*
       ROOM STATUS
    */

    if (
        room.status ===
        "waiting"
    ) {

        roomStatus.textContent =
            "WAITING FOR PLAYERS";

        roomStatusText.textContent =
            "WAITING FOR PLAYERS";

    }

    else {

        roomStatus.textContent =
            "GAME IN PROGRESS";

        roomStatusText.textContent =
            "GAME IN PROGRESS...";

    }


    /*
       PLAYERS
    */

    playersList.innerHTML =
        "";


    if (
        playerEntries.length === 0
    ) {

        playersList.innerHTML = `
            <div class="empty-player">
                Waiting for players...
            </div>
        `;

    }


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


            const playerLeft =
                document.createElement(
                    "div"
                );


            playerLeft.className =
                "player-left";


            const avatar =
                document.createElement(
                    "div"
                );


            avatar.className =
                "player-avatar";


            avatar.textContent =
                "👤";


            const name =
                document.createElement(
                    "span"
                );


            name.className =
                "player-name";


            name.textContent =
                player.username ||
                "Player";


            playerLeft.appendChild(
                avatar
            );


            playerLeft.appendChild(
                name
            );


            /*
               YOU badge
            */

            if (
                currentUser &&
                uid === currentUser.uid
            ) {

                const youBadge =
                    document.createElement(
                        "span"
                    );


                youBadge.className =
                    "you-badge";


                youBadge.textContent =
                    "YOU";


                name.appendChild(
                    youBadge
                );

            }


            /*
               Right-side badges
            */

            const playerRight =
                document.createElement(
                    "div"
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


                playerRight.appendChild(
                    hostBadge
                );

            }


            playerElement.appendChild(
                playerLeft
            );


            playerElement.appendChild(
                playerRight
            );


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


        /*
           Game already started.
        */

        if (
            room.status !==
            "waiting"
        ) {

            startGameButton.disabled =
                true;

            startGameButton.textContent =
                "GAME IN PROGRESS";

            startHint.textContent =
                "The game has already started.";

            return;

        }


        /*
           Minimum players check.
        */

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
                `🧠 NEED ${needed} MORE PLAYER${needed === 1 ? "" : "S"}`;


            startHint.textContent =
                `Minimum ${MIN_PLAYERS} players required.`;

        }

        else {

            startGameButton.disabled =
                false;


            startGameButton.textContent =
                "🧠 START GAME";


            startHint.textContent =
                `${playerEntries.length} players ready.`;

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


    /*
       Only host can start.
    */

    if (
        currentRoomData.hostUid !==
        currentUser.uid
    ) {

        return;

    }


    /*
       Don't start an already-running game.
    */

    if (
        currentRoomData.status !==
        "waiting"
    ) {

        return;

    }


    const players =
        currentRoomData.players ||
        {};


    const playerIds =
        Object.entries(players)
            .filter(
                function ([, player]) {

                    return !player.leftGame;

                }
            )
            .map(
                function ([uid]) {

                    return uid;

                }
            );


    if (
        playerIds.length <
        MIN_PLAYERS
    ) {

        roomStatusText.textContent =
            `MINIMUM ${MIN_PLAYERS} PLAYERS REQUIRED.`;

        return;

    }


    startGameButton.disabled =
        true;


    roomStatusText.textContent =
        "STARTING CHAOS CODE...";


    try {

        const updates = {};


        /*
           Reset player game state
           for this NEW game.
        */

        playerIds.forEach(
            function (uid) {

                updates[
                    `players/${uid}/score`
                ] = 0;


                updates[
                    `players/${uid}/currentRoundScore`
                ] = 0;


                updates[
                    `players/${uid}/lastAnswer`
                ] = null;


                updates[
                    `players/${uid}/lastAnsweredRound`
                ] = null;


                updates[
                    `players/${uid}/submittedAt`
                ] = null;


                updates[
                    `players/${uid}/finalRank`
                ] = null;


                updates[
                    `players/${uid}/finalReward`
                ] = 0;


                updates[
                    `players/${uid}/leftGame`
                ] = false;

            }
        );


        const now =
            Date.now();


        const roomRef =
            ref(
                database,
                `chaosCodeRooms/${currentRoomCode}`
            );


        /*
           Save game state BEFORE
           everyone enters code.html.
        */

        await update(
            roomRef,
            {

                ...updates,

                status:
                    "starting",

                gameStartAt:
                    now,

                currentRound:
                    1,

                roundStartAt:
                    now,

                roundDuration:
                    ROUND_DURATION,

                clueInterval:
                    CLUE_INTERVAL,

                totalRounds:
                    TOTAL_ROUNDS,

                rounds:
                    {},

                currentCode:
                    null,

                currentClues:
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


        /*
           The realtime listener will redirect
           everyone to code.html.
        */

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

        localStorage.removeItem(
            SAVED_ROOM_KEY
        );


        window.location.href =
            "dashboard.html";

        return;

    }


    try {

        const roomRef =
            ref(
                database,
                `chaosCodeRooms/${currentRoomCode}`
            );


        const snapshot =
            await get(roomRef);


        if (!snapshot.exists()) {

            localStorage.removeItem(
                SAVED_ROOM_KEY
            );


            window.location.href =
                "dashboard.html";

            return;

        }


        const room =
            snapshot.val();


        const playerRef =
            ref(
                database,
                `chaosCodeRooms/${currentRoomCode}/players/${currentUser.uid}`
            );


        /*
           GAME ALREADY STARTED

           Preserve all player information.

           Only mark them as left.
        */

        if (
            room.status === "starting" ||
            room.status === "playing" ||
            room.status === "roundResult"
        ) {

            await update(
                playerRef,
                {
                    leftGame: true
                }
            );


            localStorage.setItem(
                SAVED_ROOM_KEY,
                currentRoomCode
            );

        }

        else {

            /*
               WAITING ROOM

               Remove the player completely.
            */

            await remove(
                playerRef
            );


            /*
               Check whether room is empty.
            */

            const updatedSnapshot =
                await get(
                    roomRef
                );


            if (
                updatedSnapshot.exists()
            ) {

                const updatedRoom =
                    updatedSnapshot.val();


                const updatedPlayers =
                    updatedRoom.players ||
                    {};


                const remainingPlayerIds =
                    Object.keys(
                        updatedPlayers
                    );


                /*
                   Room empty.
                */

                if (
                    remainingPlayerIds.length === 0
                ) {

                    await remove(
                        roomRef
                    );

                }

                else if (
                    room.hostUid ===
                    currentUser.uid
                ) {

                    /*
                       Host left.

                       Give host position to
                       the first remaining player.
                    */

                    const newHostUid =
                        remainingPlayerIds[0];


                    const promotionUpdates = {

                        hostUid:
                            newHostUid

                    };


                    promotionUpdates[
                        `players/${newHostUid}/isHost`
                    ] = true;


                    await update(
                        roomRef,
                        promotionUpdates
                    );

                }

            }


            localStorage.removeItem(
                SAVED_ROOM_KEY
            );

        }


        currentRoomCode =
            null;


        currentRoomData =
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