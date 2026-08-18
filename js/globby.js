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

const MIN_PLAYERS = 5;
const MAX_PLAYERS = 15;

const GAME_DURATION = 10 * 60 * 1000;

const ROLE_REWARD = 500;


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
                    `ghostRooms/${roomCode}`
                );

            const snapshot =
                await get(testRef);

            exists =
                snapshot.exists();

        }


        const roomRef =
            ref(
                database,
                `ghostRooms/${roomCode}`
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

                votingStartAt:
                    null,

                finishedAt:
                    null,

                winnerRole:
                    null,

                winningRole:
                    null,

                winningUid:
                    null,

                players: {

                    [currentUser.uid]: {

                        username:
                            currentUsername,

                        joinedAt:
                            now,

                        isHost:
                            true,

                        connected:
                            true,

                        leftGame:
                            false,

                        voted:
                            false,

                        vote:
                            null,

                        role:
                            null,

                        anonymousName:
                            null

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


    joinRoomButton.disabled =
        true;

    setupStatus.textContent =
        "CHECKING ROOM...";


    try {

        const roomRef =
            ref(
                database,
                `ghostRooms/${roomCode}`
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
            room.status !==
            "waiting"
        ) {

            setupStatus.textContent =
                "THIS GAME HAS ALREADY STARTED.";

            return;

        }


        const players =
            room.players || {};


        const playerIds =
            Object.keys(players);


        if (
            playerIds.length >=
            MAX_PLAYERS
        ) {

            setupStatus.textContent =
                "ROOM IS FULL.";

            return;

        }


        const playerRef =
            ref(
                database,
                `ghostRooms/${roomCode}/players/${currentUser.uid}`
            );


        const now =
            Date.now();


        await set(
            playerRef,
            {

                username:
                    currentUsername,

                joinedAt:
                    now,

                isHost:
                    false,

                connected:
                    true,

                leftGame:
                    false,

                voted:
                    false,

                vote:
                    null,

                role:
                    null,

                anonymousName:
                    null

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
            `ghostRooms/${currentRoomCode}`
        );


    onValue(
        roomRef,
        function (snapshot) {

            if (!snapshot.exists()) {

                roomStatusText.textContent =
                    "ROOM NO LONGER EXISTS.";

                setTimeout(
                    function () {

                        window.location.href =
                            "dashboard.html";

                    },
                    1200
                );

                return;

            }


            currentRoomData =
                snapshot.val();


            renderRoom(
                currentRoomData
            );


            if (
                currentRoomData.status ===
                "starting"
            ) {

                window.location.href =
                    `ghost.html?room=${currentRoomCode}`;

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
        room.status ===
        "waiting"
    ) {

        roomStatus.textContent =
            "WAITING FOR PLAYERS";

    }

    else {

        roomStatus.textContent =
            "GAME STARTING";

    }


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

        return;

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
                uid ===
                room.hostUid
            ) {

                playerElement.classList.add(
                    "host"
                );

            }


            const name =
                document.createElement(
                    "span"
                );


            name.textContent =
                player.username ||
                "Player";


            playerElement.appendChild(
                name
            );


            if (
                uid ===
                room.hostUid
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


    /* =========================
       HOST CONTROLS
    ========================= */

    if (
        currentUser &&
        room.hostUid ===
        currentUser.uid
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
                `👻 NEED ${needed} MORE PLAYER${
                    needed === 1
                        ? ""
                        : "S"
                }`;

        }

        else {

            startGameButton.disabled =
                false;

            startGameButton.textContent =
                "👻 START GAME";

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


    startGameButton.disabled =
        true;


    roomStatusText.textContent =
        "PREPARING ROLES...";


    try {

        const assignments =
            createRoleAssignments(
                playerIds
            );


        const updates = {};


        playerIds.forEach(
            function (uid, index) {

                updates[
                    `players/${uid}/role`
                ] =
                    assignments[index].role;


                updates[
                    `players/${uid}/anonymousName`
                ] =
                    `Player ${String(
                        index + 1
                    ).padStart(
                        2,
                        "0"
                    )}`;


                updates[
                    `players/${uid}/voted`
                ] =
                    false;


                updates[
                    `players/${uid}/vote`
                ] =
                    null;


                updates[
                    `players/${uid}/leftGame`
                ] =
                    false;

            }
        );


        const now =
            Date.now();


        const roomRef =
            ref(
                database,
                `ghostRooms/${currentRoomCode}`
            );


        await update(
            roomRef,
            {

                ...updates,

                status:
                    "starting",

                gameStartAt:
                    now + 3000,

                votingStartAt:
                    now +
                    3000 +
                    GAME_DURATION,

                finishedAt:
                    null,

                winnerRole:
                    null,

                winningRole:
                    null,

                winningUid:
                    null

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
   ROLE ASSIGNMENT
========================= */

function createRoleAssignments(
    playerIds
) {

    const shuffled =
        [...playerIds];


    shuffle(
        shuffled
    );


    const assignments =
        [];


    shuffled.forEach(
        function (uid, index) {

            let role;


            if (
                index === 0
            ) {

                role =
                    "ghost";

            }

            else if (
                index === 1 ||
                index === 2
            ) {

                role =
                    "joker";

            }

            else {

                role =
                    "fighter";

            }


            assignments.push(
                {
                    uid,
                    role
                }
            );

        }
    );


    return assignments;

}


/* =========================
   SHUFFLE
========================= */

function shuffle(array) {

    for (
        let i =
            array.length - 1;

        i > 0;

        i--
    ) {

        const j =
            Math.floor(
                Math.random() *
                (i + 1)
            );


        [
            array[i],
            array[j]
        ] =
        [
            array[j],
            array[i]
        ];

    }


    return array;

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
                    "Copy failed:",
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

        const playerRef =
            ref(
                database,
                `ghostRooms/${currentRoomCode}/players/${currentUser.uid}`
            );


        await remove(
            playerRef
        );


        const roomRef =
            ref(
                database,
                `ghostRooms/${currentRoomCode}`
            );


        const snapshot =
            await get(roomRef);


        if (
            snapshot.exists()
        ) {

            const room =
                snapshot.val();


            const players =
                room.players || {};


            if (
                Object.keys(players).length ===
                0
            ) {

                await remove(
                    roomRef
                );

            }

        }


        currentRoomCode =
            null;


        window.location.href =
            "dashboard.html";

    }

    catch (error) {

        console.error(
            "Leave room error:",
            error
        );

    }

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