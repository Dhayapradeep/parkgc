import {
    ref,
    set,
    get,
    update,
    remove,
    onValue
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
   CONFIG
========================================================= */

const auth = getAuth(app);

const MIN_PLAYERS = 2;

const MAX_PLAYERS = 15;

const ROOM_PATH = "unoParkRooms";

const SAVED_ROOM_KEY = "unoParkRoomCode";


/* =========================================================
   DOM
========================================================= */

const setupCard =
    document.getElementById("setupCard");

const roomCard =
    document.getElementById("roomCard");

const backButton =
    document.getElementById("backButton");

const createRoomButton =
    document.getElementById("createRoomButton");

const joinRoomButton =
    document.getElementById("joinRoomButton");

const roomCodeInput =
    document.getElementById("roomCodeInput");

const setupStatus =
    document.getElementById("setupStatus");

const roomCodeDisplay =
    document.getElementById("roomCodeDisplay");

const copyRoomButton =
    document.getElementById("copyRoomButton");

const roomStatus =
    document.getElementById("roomStatus");

const playerList =
    document.getElementById("playerList");

const playerCount =
    document.getElementById("playerCount");

const hostControls =
    document.getElementById("hostControls");

const startGameButton =
    document.getElementById("startGameButton");

const waitingMessage =
    document.getElementById("waitingMessage");

const leaveRoomButton =
    document.getElementById("leaveRoomButton");


/* =========================================================
   STATE
========================================================= */

let currentUser = null;

let currentUsername = "PLAYER";

let currentRoomCode = null;

let currentRoomData = null;

let roomUnsubscribe = null;

let authReady = false;


/* =========================================================
   AUTH
========================================================= */

onAuthStateChanged(auth, async (user) => {

    currentUser = user;

    if (!user) {

        window.location.href =
            "../index.html";

        return;
    }


    authReady = true;


    await loadUserProfile();

    await checkSavedRoom();

});


/* =========================================================
   LOAD USER
========================================================= */

async function loadUserProfile() {

    if (!currentUser) {
        return;
    }


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
                data.displayName ||
                currentUser.displayName ||
                currentUser.email?.split("@")[0] ||
                "PLAYER";

        } else {

            currentUsername =
                currentUser.displayName ||
                currentUser.email?.split("@")[0] ||
                "PLAYER";

        }

    } catch (error) {

        console.error(
            "UNABLE TO LOAD USER:",
            error
        );


        currentUsername =
            currentUser.displayName ||
            currentUser.email?.split("@")[0] ||
            "PLAYER";
    }

}


/* =========================================================
   CHECK SAVED ROOM
========================================================= */

async function checkSavedRoom() {

    const savedRoom =
        localStorage.getItem(
            SAVED_ROOM_KEY
        );


    if (!savedRoom || !currentUser) {
        return;
    }


    try {

        const roomRef =
            ref(
                database,
                `${ROOM_PATH}/${savedRoom}`
            );


        const snapshot =
            await get(roomRef);


        if (!snapshot.exists()) {

            localStorage.removeItem(
                SAVED_ROOM_KEY
            );

            return;
        }


        const room =
            snapshot.val();


        const savedPlayer =
            room.players?.[currentUser.uid];


        if (!savedPlayer) {

            localStorage.removeItem(
                SAVED_ROOM_KEY
            );

            return;
        }


        currentRoomCode =
            savedRoom;


        /*
         * Game already started.
         */

        if (
            room.status === "starting" ||
            room.status === "playing"
        ) {

            window.location.href =
                `ugame.html?room=${savedRoom}`;

            return;
        }


        /*
         * Restore lobby.
         */

        setupCard.classList.add(
            "hidden"
        );

        roomCard.classList.remove(
            "hidden"
        );


        listenToRoom();


    } catch (error) {

        console.error(
            "CHECK SAVED ROOM ERROR:",
            error
        );


        localStorage.removeItem(
            SAVED_ROOM_KEY
        );
    }

}


/* =========================================================
   CREATE ROOM
========================================================= */

createRoomButton.addEventListener(
    "click",
    createRoom
);


async function createRoom() {

    if (!authReady || !currentUser) {

        setupStatus.textContent =
            "PLEASE WAIT FOR LOGIN.";

        return;
    }


    createRoomButton.disabled = true;

    joinRoomButton.disabled = true;


    setupStatus.textContent =
        "CREATING ROOM...";


    try {

        let roomCode;

        let exists = true;


        /*
         * Generate unique room code.
         */

        while (exists) {

            roomCode =
                generateRoomCode();


            const roomCheckRef =
                ref(
                    database,
                    `${ROOM_PATH}/${roomCode}`
                );


            const snapshot =
                await get(roomCheckRef);


            exists =
                snapshot.exists();
        }


        const roomRef =
            ref(
                database,
                `${ROOM_PATH}/${roomCode}`
            );


        const now =
            Date.now();


        const roomData = {

            hostUid:
                currentUser.uid,

            status:
                "waiting",

            createdAt:
                now,

            gameStartAt:
                null,

            players: {

                [currentUser.uid]: {

                    username:
                        currentUsername,

                    joinedAt:
                        now,

                    isHost:
                        true,

                    leftGame:
                        false
                }

            }

        };


        await set(
            roomRef,
            roomData
        );


        currentRoomCode =
            roomCode;


        localStorage.setItem(
            SAVED_ROOM_KEY,
            roomCode
        );


        setupStatus.textContent = "";


        setupCard.classList.add(
            "hidden"
        );

        roomCard.classList.remove(
            "hidden"
        );


        listenToRoom();


    } catch (error) {

        console.error(
            "CREATE ROOM ERROR:",
            error
        );


        setupStatus.textContent =
            `FAILED: ${
                error.code ||
                error.message ||
                "Unknown error"
            }`;


        createRoomButton.disabled =
            false;

        joinRoomButton.disabled =
            false;
    }

}


/* =========================================================
   JOIN ROOM
========================================================= */

joinRoomButton.addEventListener(
    "click",
    joinRoom
);


roomCodeInput.addEventListener(
    "keydown",
    (event) => {

        if (event.key === "Enter") {

            joinRoom();

        }

    }
);


roomCodeInput.addEventListener(
    "input",
    () => {

        roomCodeInput.value =
            roomCodeInput.value
                .toUpperCase()
                .replace(
                    /[^A-Z0-9]/g,
                    ""
                )
                .slice(0, 6);

    }
);


async function joinRoom() {

    if (!authReady || !currentUser) {

        setupStatus.textContent =
            "PLEASE WAIT FOR LOGIN.";

        return;
    }


    const roomCode =
        roomCodeInput.value
            .trim()
            .toUpperCase();


    if (roomCode.length !== 6) {

        setupStatus.textContent =
            "ENTER A VALID 6-CHARACTER ROOM CODE.";

        return;
    }


    createRoomButton.disabled =
        true;

    joinRoomButton.disabled =
        true;


    setupStatus.textContent =
        "JOINING ROOM...";


    try {

        const roomRef =
            ref(
                database,
                `${ROOM_PATH}/${roomCode}`
            );


        const snapshot =
            await get(roomRef);


        if (!snapshot.exists()) {

            throw new Error(
                "ROOM DOES NOT EXIST."
            );
        }


        const room =
            snapshot.val();


        /*
         * Rejoin existing player.
         */

        if (
            room.players &&
            room.players[currentUser.uid]
        ) {

            currentRoomCode =
                roomCode;


            localStorage.setItem(
                SAVED_ROOM_KEY,
                roomCode
            );


            if (
                room.status === "starting" ||
                room.status === "playing"
            ) {

                window.location.href =
                    `ugame.html?room=${roomCode}`;

                return;
            }


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
         * New players can only join waiting rooms.
         */

        if (room.status !== "waiting") {

            throw new Error(
                "GAME HAS ALREADY STARTED."
            );
        }


        const players =
            room.players || {};


        const activePlayers =
            Object.values(players)
                .filter(
                    player =>
                        player &&
                        player.leftGame !== true
                );


        if (
            activePlayers.length >=
            MAX_PLAYERS
        ) {

            throw new Error(
                "ROOM IS FULL."
            );
        }


        const now =
            Date.now();


        await update(
            roomRef,
            {

                [`players/${currentUser.uid}`]:
                    {

                        username:
                            currentUsername,

                        joinedAt:
                            now,

                        isHost:
                            false,

                        leftGame:
                            false
                    }

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


        setupStatus.textContent = "";


        listenToRoom();


    } catch (error) {

        console.error(
            "JOIN ROOM ERROR:",
            error
        );


        setupStatus.textContent =
            error.message ||
            "FAILED TO JOIN ROOM.";


        createRoomButton.disabled =
            false;

        joinRoomButton.disabled =
            false;
    }

}


/* =========================================================
   ROOM LISTENER
========================================================= */

function listenToRoom() {

    if (!currentRoomCode) {
        return;
    }


    if (roomUnsubscribe) {

        roomUnsubscribe();

        roomUnsubscribe =
            null;
    }


    const roomRef =
        ref(
            database,
            `${ROOM_PATH}/${currentRoomCode}`
        );


    roomUnsubscribe =
        onValue(
            roomRef,

            (snapshot) => {

                if (!snapshot.exists()) {

                    localStorage.removeItem(
                        SAVED_ROOM_KEY
                    );


                    window.location.href =
                        "ulobby.html";


                    return;
                }


                currentRoomData =
                    snapshot.val();


                handleRoomState(
                    currentRoomData
                );

            },

            (error) => {

                console.error(
                    "ROOM LISTENER ERROR:",
                    error
                );

            }
        );

}


/* =========================================================
   HANDLE ROOM STATE
========================================================= */

function handleRoomState(room) {

    if (!room) {
        return;
    }


    if (
        room.status === "starting" ||
        room.status === "playing"
    ) {

        window.location.href =
            `ugame.html?room=${currentRoomCode}`;

        return;
    }


    renderRoom(room);

}


/* =========================================================
   RENDER ROOM
========================================================= */

function renderRoom(room) {

    roomCodeDisplay.textContent =
        currentRoomCode ||
        "------";


    const players =
        room.players || {};


    const playerEntries =
        Object.entries(players)
            .filter(
                ([, player]) =>
                    player &&
                    player.leftGame !== true
            );


    playerCount.textContent =
        `${playerEntries.length} / ${MAX_PLAYERS}`;


    roomStatus.textContent =
        playerEntries.length >= MIN_PLAYERS
            ? "READY TO START"
            : "WAITING FOR PLAYERS";


    playerList.innerHTML = "";


    /*
     * Host first, then join order.
     */

    playerEntries.sort(
        ([, playerA], [, playerB]) => {

            if (
                playerA.isHost &&
                !playerB.isHost
            ) {

                return -1;
            }


            if (
                !playerA.isHost &&
                playerB.isHost
            ) {

                return 1;
            }


            return (
                (playerA.joinedAt || 0) -
                (playerB.joinedAt || 0)
            );

        }
    );


    if (playerEntries.length === 0) {

        const empty =
            document.createElement("div");


        empty.className =
            "empty-player";


        empty.textContent =
            "NO PLAYERS";


        playerList.appendChild(
            empty
        );


    } else {

        playerEntries.forEach(
            ([uid, player], index) => {

                const item =
                    document.createElement("div");


                item.className =
                    "player";


                if (player.isHost) {

                    item.classList.add(
                        "host"
                    );

                }


                const left =
                    document.createElement("div");


                left.className =
                    "player-left";


                const number =
                    document.createElement("div");


                number.className =
                    "player-number";


                number.textContent =
                    index + 1;


                const name =
                    document.createElement("div");


                name.className =
                    "player-name";


                name.textContent =
                    player.username ||
                    "PLAYER";


                left.appendChild(
                    number
                );


                left.appendChild(
                    name
                );


                item.appendChild(
                    left
                );


                if (player.isHost) {

                    const hostBadge =
                        document.createElement(
                            "span"
                        );


                    hostBadge.className =
                        "host-badge";


                    hostBadge.textContent =
                        "HOST";


                    item.appendChild(
                        hostBadge
                    );

                }


                /*
                 * Highlight current player.
                 */

                if (
                    uid ===
                    currentUser?.uid
                ) {

                    name.textContent =
                        `${player.username || "PLAYER"} (YOU)`;

                }


                playerList.appendChild(
                    item
                );

            }
        );

    }


    /*
     * Host controls.
     */

    const isHost =
        room.hostUid ===
        currentUser?.uid;


    if (isHost) {

        hostControls.classList.remove(
            "hidden"
        );


        waitingMessage.classList.add(
            "hidden"
        );


        startGameButton.disabled =
            playerEntries.length <
            MIN_PLAYERS;

    } else {

        hostControls.classList.add(
            "hidden"
        );


        waitingMessage.classList.remove(
            "hidden"
        );

    }

}


/* =========================================================
   START GAME
========================================================= */

startGameButton.addEventListener(
    "click",
    startGame
);


async function startGame() {

    if (!currentUser) {
        return;
    }


    if (!currentRoomData) {
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


    const activePlayers =
        Object.values(players)
            .filter(
                player =>
                    player &&
                    player.leftGame !== true
            );


    if (
        activePlayers.length <
        MIN_PLAYERS
    ) {

        return;
    }


    startGameButton.disabled =
        true;


    try {

        const roomRef =
            ref(
                database,
                `${ROOM_PATH}/${currentRoomCode}`
            );


        await update(
            roomRef,
            {

                status:
                    "starting",

                gameStartAt:
                    Date.now()

            }
        );


        window.location.href =
            `ugame.html?room=${currentRoomCode}`;


    } catch (error) {

        console.error(
            "START GAME ERROR:",
            error
        );


        startGameButton.disabled =
            false;
    }

}


/* =========================================================
   COPY ROOM
========================================================= */

copyRoomButton.addEventListener(
    "click",
    async () => {

        if (!currentRoomCode) {
            return;
        }


        try {

            await navigator.clipboard.writeText(
                currentRoomCode
            );


            const original =
                copyRoomButton.textContent;


            copyRoomButton.textContent =
                "COPIED";


            setTimeout(
                () => {

                    copyRoomButton.textContent =
                        original;

                },
                1200
            );


        } catch (error) {

            console.error(
                "COPY ERROR:",
                error
            );

        }

    }
);


/* =========================================================
   LEAVE ROOM
========================================================= */

leaveRoomButton.addEventListener(
    "click",
    leaveRoom
);


async function leaveRoom() {

    if (
        !currentUser ||
        !currentRoomCode
    ) {

        clearRoomAndExit();

        return;
    }


    try {

        const roomRef =
            ref(
                database,
                `${ROOM_PATH}/${currentRoomCode}`
            );


        const snapshot =
            await get(roomRef);


        if (!snapshot.exists()) {

            clearRoomAndExit();

            return;
        }


        const room =
            snapshot.val();


        const players =
            room.players || {};


        const remainingEntries =
            Object.entries(players)
                .filter(
                    ([uid, player]) =>
                        uid !==
                            currentUser.uid &&
                        player &&
                        player.leftGame !== true
                );


        /*
         * Waiting room.
         */

        if (room.status === "waiting") {


            /*
             * Last player.
             */

            if (
                remainingEntries.length === 0
            ) {

                await remove(roomRef);


                clearRoomAndExit();


                return;
            }


            /*
             * Host leaves.
             */

            if (
                room.hostUid ===
                currentUser.uid
            ) {

                const nextHost =
                    chooseNextHost(
                        remainingEntries
                    );


                const updates = {

                    [`players/${currentUser.uid}`]:
                        null,

                    hostUid:
                        nextHost.uid,

                    [`players/${nextHost.uid}/isHost`]:
                        true

                };


                await update(
                    roomRef,
                    updates
                );


            } else {

                await update(
                    roomRef,
                    {

                        [`players/${currentUser.uid}`]:
                            null

                    }
                );

            }


        } else {

            /*
             * Game has started.
             * Keep player for the game record.
             */

            await update(
                roomRef,
                {

                    [`players/${currentUser.uid}/leftGame`]:
                        true

                }
            );

        }


        clearRoomAndExit();


    } catch (error) {

        console.error(
            "LEAVE ROOM ERROR:",
            error
        );


        clearRoomAndExit();
    }

}


/* =========================================================
   BACK
========================================================= */

backButton.addEventListener(
    "click",
    () => {

        clearRoomAndExit();

    }
);


/* =========================================================
   HELPERS
========================================================= */

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


function chooseNextHost(entries) {

    const sorted =
        [...entries].sort(
            ([, playerA], [, playerB]) =>
                (playerA.joinedAt || 0) -
                (playerB.joinedAt || 0)
        );


    return {

        uid:
            sorted[0][0],

        player:
            sorted[0][1]

    };

}


function clearRoomAndExit() {

    if (roomUnsubscribe) {

        roomUnsubscribe();

        roomUnsubscribe =
            null;
    }


    localStorage.removeItem(
        SAVED_ROOM_KEY
    );


    currentRoomCode =
        null;


    currentRoomData =
        null;


    window.location.href =
        "dashboard.html";

}