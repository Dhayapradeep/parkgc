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

const auth =
    getAuth(app);



/* =========================
   GAME SETTINGS
========================= */

const MAX_PLAYERS = 2;

const BOARD_SIZE = 8;

const EMPTY = 0;

const BLACK = 1;

const WHITE = 2;



/* =========================
   ELEMENTS
========================= */

const backButton =
    document.getElementById(
        "backButton"
    );


const createRoomButton =
    document.getElementById(
        "createRoomButton"
    );


const joinRoomButton =
    document.getElementById(
        "joinRoomButton"
    );


const roomCodeInput =
    document.getElementById(
        "roomCodeInput"
    );


const setupCard =
    document.getElementById(
        "setupCard"
    );


const roomCard =
    document.getElementById(
        "roomCard"
    );


const setupStatus =
    document.getElementById(
        "setupStatus"
    );


const roomCodeDisplay =
    document.getElementById(
        "roomCodeDisplay"
    );


const copyRoomButton =
    document.getElementById(
        "copyRoomButton"
    );


const roomStatus =
    document.getElementById(
        "roomStatus"
    );


const roomStatusText =
    document.getElementById(
        "roomStatusText"
    );


const playersList =
    document.getElementById(
        "playersList"
    );


const playerCount =
    document.getElementById(
        "playerCount"
    );


const hostControls =
    document.getElementById(
        "hostControls"
    );


const startGameButton =
    document.getElementById(
        "startGameButton"
    );


const hostHint =
    document.getElementById(
        "hostHint"
    );


const leaveRoomButton =
    document.getElementById(
        "leaveRoomButton"
    );



/* =========================
   VARIABLES
========================= */

let currentUser =
    null;


let currentUsername =
    "Player";


let currentRoomCode =
    null;


let currentRoomData =
    null;


let roomListenerStarted =
    false;


let leavingRoom =
    false;



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
            "Unable to load user profile:",
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


        const now =
            Date.now();


        const roomRef =
            ref(
                database,
                `othelloRooms/${roomCode}`
            );


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

                board:
                    null,

                turn:
                    null,

                rewardClaimed:
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
                            "black"

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


        if (
            room.status !==
            "waiting"
        ) {

            setupStatus.textContent =
                "THIS GAME HAS ALREADY STARTED.";

            return;

        }


        const players =
            room.players ||
            {};


        const playerIds =
            Object.keys(players);


        /* =========================
           ALREADY IN ROOM
        ========================== */

        if (
            playerIds.includes(
                currentUser.uid
            )
        ) {

            currentRoomCode =
                roomCode;


            setupCard.classList.add(
                "hidden"
            );


            roomCard.classList.remove(
                "hidden"
            );


            listenToRoom();

            return;

        }


        /* =========================
           ROOM FULL
        ========================== */

        if (
            playerIds.length >=
            MAX_PLAYERS
        ) {

            setupStatus.textContent =
                "ROOM IS FULL.";

            return;

        }


        /* =========================
           SECOND PLAYER
        ========================== */

        const playerRef =
            ref(
                database,
                `othelloRooms/${roomCode}/players/${currentUser.uid}`
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

                color:
                    "white"

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
            `othelloRooms/${currentRoomCode}`
        );


    onValue(
        roomRef,
        function (snapshot) {

            if (!snapshot.exists()) {

                if (!leavingRoom) {

                    roomStatusText.textContent =
                        "ROOM NO LONGER EXISTS.";

                }

                return;

            }


            currentRoomData =
                snapshot.val();


            renderRoom(
                currentRoomData
            );


            /* =========================
               GAME STARTED
            ========================== */

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
        room.players ||
        {};


    const playerEntries =
        Object.entries(players);


    roomCodeDisplay.textContent =
        currentRoomCode;


    playerCount.textContent =
        `${playerEntries.length} / ${MAX_PLAYERS}`;


    /* =========================
       ROOM STATUS
    ========================== */

    if (
        room.status ===
        "waiting"
    ) {

        if (
            playerEntries.length <
            MAX_PLAYERS
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



    /* =========================
       PLAYERS LIST
    ========================== */

    playersList.innerHTML =
        "";


    if (
        playerEntries.length ===
        0
    ) {

        playersList.innerHTML = `
            <div class="empty-player">
                Waiting for opponent...
            </div>
        `;

    }

    else {

        playerEntries
            .sort(
                function (a, b) {

                    return (
                        (a[1].joinedAt || 0) -
                        (b[1].joinedAt || 0)
                    );

                }
            )
            .forEach(
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


                    const left =
                        document.createElement(
                            "div"
                        );


                    left.className =
                        "player-left";


                    const disc =
                        document.createElement(
                            "span"
                        );


                    disc.className =
                        "player-disc " +
                        (
                            player.color ===
                            "black"
                                ? "black"
                                : "white"
                        );


                    const name =
                        document.createElement(
                            "span"
                        );


                    name.textContent =
                        player.username ||
                        "Player";


                    left.appendChild(
                        disc
                    );


                    left.appendChild(
                        name
                    );


                    playerElement.appendChild(
                        left
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

    }



    /* =========================
       HOST CONTROLS
    ========================== */

    if (
        currentUser &&
        room.hostUid ===
        currentUser.uid &&
        room.status ===
        "waiting"
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


            hostHint.textContent =
                "Waiting for another player to join.";

        }

        else {

            startGameButton.disabled =
                false;


            startGameButton.textContent =
                "⚫ START GAME";


            hostHint.textContent =
                "Both players are ready.";

        }

    }

    else {

        hostControls.classList.add(
            "hidden"
        );

    }

}



/* =========================
   START GAME BUTTON
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
        currentRoomData.players ||
        {};


    const playerIds =
        Object.keys(players);


    if (
        playerIds.length !==
        MAX_PLAYERS
    ) {

        return;

    }


    startGameButton.disabled =
        true;


    roomStatusText.textContent =
        "STARTING GAME...";


    try {

        const board =
            createInitialBoard();


        const now =
            Date.now();


        const updates = {

            status:
                "starting",

            startedAt:
                now,

            finishedAt:
                null,

            board:
                board,

            turn:
                BLACK,

            rewardClaimed:
                false,

            lastAction:
                "game_started"

        };


        await update(
            ref(
                database,
                `othelloRooms/${currentRoomCode}`
            ),
            updates
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
   CREATE INITIAL BOARD
========================= */

function createInitialBoard() {

    const board =
        Array.from(
            {
                length:
                    BOARD_SIZE
            },
            function () {

                return Array(
                    BOARD_SIZE
                ).fill(
                    EMPTY
                );

            }
        );


    board[3][3] =
        WHITE;


    board[3][4] =
        BLACK;


    board[4][3] =
        BLACK;


    board[4][4] =
        WHITE;


    return board;

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
        leavingRoom
    ) {

        return;

    }


    leavingRoom =
        true;


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

            currentRoomCode =
                null;


            window.location.href =
                "dashboard.html";


            return;

        }


        const room =
            snapshot.val();


        /* =========================
           DON'T LEAVE A STARTED GAME
           THROUGH LOBBY
        ========================== */

        if (
            room.status !==
            "waiting"
        ) {

            window.location.href =
                "dashboard.html";

            return;

        }


        const playerRef =
            ref(
                database,
                `othelloRooms/${currentRoomCode}/players/${currentUser.uid}`
            );


        await remove(
            playerRef
        );


        const updatedSnapshot =
            await get(roomRef);


        if (
            !updatedSnapshot.exists()
        ) {

            currentRoomCode =
                null;


            window.location.href =
                "dashboard.html";


            return;

        }


        const updatedRoom =
            updatedSnapshot.val();


        const remainingPlayers =
            Object.entries(
                updatedRoom.players || {}
            );


        /* =========================
           NO PLAYERS LEFT
        ========================== */

        if (
            remainingPlayers.length ===
            0
        ) {

            await remove(
                roomRef
            );

        }


        /* =========================
           HOST LEFT
           TRANSFER HOST
        ========================== */

        else if (
            updatedRoom.hostUid ===
            currentUser.uid
        ) {

            const [
                newHostUid
            ] =
                remainingPlayers[0];


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


        leavingRoom =
            false;


        roomStatusText.textContent =
            "FAILED TO LEAVE ROOM.";

    }

}



/* =========================
   ROOM CODE GENERATOR
========================= */

function generateRoomCode() {

    const characters =
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";


    let code =
        "";


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