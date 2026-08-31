import {
    ref,
    get,
    set,
    onValue,
    update,
    remove,
    onDisconnect
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
   AUTH
========================= */

const auth = getAuth(app);


/* =========================
   ELEMENTS
========================= */

const backButton =
    document.getElementById("backButton");

const setupCard =
    document.getElementById("setupCard");

const roomCard =
    document.getElementById("roomCard");

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
   SETTINGS
========================= */

const ROOM_PATH =
    "chaosAuctionRooms";

const AUCTION_PATH =
    "chaosAuctions";

const MIN_PLAYERS =
    2;


/* =========================
   STATE
========================= */

let currentUser = null;

let currentUserData = null;

let currentRoomCode = null;

let currentRoomListener = null;


/* =========================
   AUTH STATE
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

        try {

            const userRef =
                ref(
                    database,
                    `users/${user.uid}`
                );

            const snapshot =
                await get(userRef);

            if (snapshot.exists()) {

                currentUserData =
                    snapshot.val();

            }

        }
        catch (error) {

            console.error(
                "Unable to load user:",
                error
            );

        }

    }
);


/* =========================
   BACK BUTTON
========================= */

if (backButton) {

    backButton.addEventListener(
        "click",
        async function () {

            await leaveCurrentRoom();

            window.location.href =
                "dashboard.html";

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

        setSetupStatus(
            "Please wait for authentication..."
        );

        return;

    }

    createRoomButton.disabled = true;

    setSetupStatus(
        "Creating auction room..."
    );

    try {

        let roomCode;

        let exists = true;


        while (exists) {

            roomCode =
                generateRoomCode();

            const roomRef =
                ref(
                    database,
                    `${ROOM_PATH}/${roomCode}`
                );

            const snapshot =
                await get(roomRef);

            exists =
                snapshot.exists();

        }


        const username =
            getUsername();


        const roomRef =
            ref(
                database,
                `${ROOM_PATH}/${roomCode}`
            );


        const playerRef =
            ref(
                database,
                `${ROOM_PATH}/${roomCode}/players/${currentUser.uid}`
            );


        await set(
            roomRef,
            {

                hostId:
                    currentUser.uid,

                status:
                    "waiting",

                createdAt:
                    Date.now(),

                players: {

                    [currentUser.uid]: {

                        username:
                            username,

                        joinedAt:
                            Date.now(),

                        isHost:
                            true

                    }

                }

            }
        );


        currentRoomCode =
            roomCode;


        await onDisconnect(
            playerRef
        ).remove();


        showRoom(roomCode);

        listenToRoom(roomCode);

    }

    catch (error) {

        console.error(
            "Create room failed:",
            error
        );

        setSetupStatus(
            "Unable to create room. Please try again."
        );

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


if (roomCodeInput) {

    roomCodeInput.addEventListener(
        "keydown",
        function (event) {

            if (
                event.key === "Enter"
            ) {

                joinRoom();

            }

        }
    );

}


async function joinRoom() {

    if (!currentUser) {

        setSetupStatus(
            "Please wait for authentication..."
        );

        return;

    }


    const roomCode =
        roomCodeInput.value
            .trim()
            .toUpperCase();


    if (
        roomCode.length !== 6
    ) {

        setSetupStatus(
            "Enter a valid 6-character room code."
        );

        return;

    }


    joinRoomButton.disabled = true;

    setSetupStatus(
        "Joining auction room..."
    );


    try {

        const roomRef =
            ref(
                database,
                `${ROOM_PATH}/${roomCode}`
            );


        const snapshot =
            await get(roomRef);


        if (!snapshot.exists()) {

            setSetupStatus(
                "Room not found."
            );

            joinRoomButton.disabled =
                false;

            return;

        }


        const room =
            snapshot.val();


        if (
            room.status !== "waiting"
        ) {

            setSetupStatus(
                "This auction has already started."
            );

            joinRoomButton.disabled =
                false;

            return;

        }


        const playerRef =
            ref(
                database,
                `${ROOM_PATH}/${roomCode}/players/${currentUser.uid}`
            );


        await set(
            playerRef,
            {

                username:
                    getUsername(),

                joinedAt:
                    Date.now(),

                isHost:
                    false

            }
        );


        await onDisconnect(
            playerRef
        ).remove();


        currentRoomCode =
            roomCode;


        showRoom(roomCode);

        listenToRoom(roomCode);

    }

    catch (error) {

        console.error(
            "Join room failed:",
            error
        );

        setSetupStatus(
            "Unable to join room. Please try again."
        );

        joinRoomButton.disabled =
            false;

    }

}


/* =========================
   LISTEN ROOM
========================= */

function listenToRoom(roomCode) {

    if (currentRoomListener) {

        currentRoomListener();

        currentRoomListener =
            null;

    }


    const roomRef =
        ref(
            database,
            `${ROOM_PATH}/${roomCode}`
        );


    currentRoomListener =
        onValue(
            roomRef,
            function (snapshot) {

                if (!snapshot.exists()) {

                    roomStatus.textContent =
                        "ROOM CLOSED";

                    setRoomStatus(
                        "This room no longer exists."
                    );

                    setTimeout(
                        resetLobby,
                        1000
                    );

                    return;

                }


                const room =
                    snapshot.val();


                updateRoomUI(
                    room,
                    roomCode
                );


                if (
                    room.status ===
                    "playing"
                ) {

                    window.location.href =
                        `cauc.html?room=${roomCode}`;

                }

            }
        );

}


/* =========================
   UPDATE ROOM UI
========================= */

function updateRoomUI(
    room,
    roomCode
) {

    if (roomCodeDisplay) {

        roomCodeDisplay.textContent =
            roomCode;

    }


    const players =
        room.players
            ? Object.entries(room.players)
            : [];


    if (playerCount) {

        playerCount.textContent =
            players.length;

    }


    renderPlayers(
        players,
        room.hostId
    );


    if (
        room.status === "waiting"
    ) {

        roomStatus.textContent =
            "WAITING FOR PLAYERS";

    }
    else {

        roomStatus.textContent =
            "AUCTION STARTING";

    }


    const isHost =
        room.hostId ===
        currentUser?.uid;


    if (hostControls) {

        hostControls.classList.toggle(
            "hidden",
            !isHost
        );

    }


    if (startGameButton) {

        startGameButton.disabled =
            players.length < MIN_PLAYERS;

    }


    if (isHost) {

        if (
            players.length < MIN_PLAYERS
        ) {

            setRoomStatus(
                `Waiting for at least ${MIN_PLAYERS} players.`
            );

        }
        else {

            setRoomStatus(
                "Enough players have joined. You can start the auction."
            );

        }

    }
    else {

        setRoomStatus(
            "Waiting for the host to start the auction..."
        );

    }

}


/* =========================
   RENDER PLAYERS
========================= */

function renderPlayers(
    players,
    hostId
) {

    if (!playersList) {

        return;

    }


    playersList.innerHTML = "";


    if (
        players.length === 0
    ) {

        playersList.innerHTML = `
            <div class="empty-player">
                Waiting for players...
            </div>
        `;

        return;

    }


    players
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

                const item =
                    document.createElement("div");


                item.className =
                    "player";


                if (
                    uid === hostId
                ) {

                    item.classList.add("host");

                }


                const name =
                    player.username ||
                    "Unknown";


                const isYou =
                    uid ===
                    currentUser?.uid;


                item.innerHTML = `

                    <div class="player-name">

                        <span>👤</span>

                        <span>
                            ${escapeHTML(name)}
                            ${isYou ? " (YOU)" : ""}
                        </span>

                    </div>

                    ${
                        uid === hostId
                            ? `
                                <span class="host-badge">
                                    HOST
                                </span>
                            `
                            : ""
                    }

                `;


                playersList.appendChild(item);

            }
        );

}


/* =========================
   START AUCTION
========================= */

if (startGameButton) {

    startGameButton.addEventListener(
        "click",
        startAuction
    );

}


async function startAuction() {

    if (
        !currentUser ||
        !currentRoomCode
    ) {

        return;

    }


    startGameButton.disabled = true;


    try {

        const roomRef =
            ref(
                database,
                `${ROOM_PATH}/${currentRoomCode}`
            );


        const snapshot =
            await get(roomRef);


        if (!snapshot.exists()) {

            setRoomStatus(
                "Auction room no longer exists."
            );

            startGameButton.disabled =
                false;

            return;

        }


        const room =
            snapshot.val();


        if (
            room.hostId !==
            currentUser.uid
        ) {

            setRoomStatus(
                "Only the host can start the auction."
            );

            startGameButton.disabled =
                false;

            return;

        }


        const roomPlayers =
            room.players || {};


        const playerEntries =
            Object.entries(roomPlayers);


        if (
            playerEntries.length <
            MIN_PLAYERS
        ) {

            setRoomStatus(
                `You need at least ${MIN_PLAYERS} players.`
            );

            startGameButton.disabled =
                false;

            return;

        }


        /*
         * Prevent accidentally creating
         * another auction.
         */

        const existingAuctionRef =
            ref(
                database,
                `${AUCTION_PATH}/${currentRoomCode}`
            );


        const existingAuction =
            await get(existingAuctionRef);


        if (existingAuction.exists()) {

            window.location.href =
                `cauc.html?room=${currentRoomCode}`;

            return;

        }


        /* =========================
           AUCTION PLAYERS
        ========================= */

        const auctionPlayers = {};


        playerEntries.forEach(
            function ([uid, player]) {

                auctionPlayers[uid] = {

                    uid: uid,

                    username:
                        player.username ||
                        "Unknown",

                    chaosPoints:
                        1000,

                    startingPoints:
                        1000,

                    bought:
                        0,

                    totalSpent:
                        0,

                    totalValue:
                        0

                };

            }
        );


        /* =========================
           STORAGE UNITS
        ========================= */

        const storages = [];


        for (
            let i = 1;
            i <= 10;
            i++
        ) {

            const estimatedValue =
                Math.floor(
                    Math.random() * 451
                ) + 150;


            const basePrice =
                Math.max(
                    50,
                    Math.floor(
                        estimatedValue * 0.3
                    )
                );


            storages.push({

                number:
                    i,

                estimatedValue:
                    estimatedValue,

                basePrice:
                    basePrice,

                currentBid:
                    0,

                currentBidder:
                    null,

                currentBidderName:
                    null,

                bidHistory:
                    {}

            });

        }


        /* =========================
           CREATE AUCTION
        ========================= */

        await set(
            existingAuctionRef,
            {

                code:
                    currentRoomCode,

                hostId:
                    currentUser.uid,

                status:
                    "playing",

                currentRound:
                    1,

                roundDuration:
                    30,

                roundEndsAt:
                    Date.now() + 30000,

                createdAt:
                    Date.now(),

                startedAt:
                    Date.now(),

                players:
                    auctionPlayers,

                storages:
                    storages

            }
        );


        /* =========================
           UPDATE LOBBY
        ========================= */

        await update(
            roomRef,
            {

                status:
                    "playing",

                startedAt:
                    Date.now()

            }
        );


        /* =========================
           OPEN AUCTION
        ========================= */

        window.location.href =
            `cauc.html?room=${currentRoomCode}`;

    }

    catch (error) {

        console.error(
            "Start auction failed:",
            error
        );

        setRoomStatus(
            "Unable to start auction. Please try again."
        );

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
        leaveCurrentRoom
    );

}


async function leaveCurrentRoom() {

    if (
        !currentUser ||
        !currentRoomCode
    ) {

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

            resetLobby();

            return;

        }


        const room =
            snapshot.val();


        const players =
            room.players
                ? Object.entries(room.players)
                : [];


        const playerRef =
            ref(
                database,
                `${ROOM_PATH}/${currentRoomCode}/players/${currentUser.uid}`
            );


        await remove(playerRef);


        if (
            room.hostId ===
            currentUser.uid
        ) {

            const remainingPlayers =
                players.filter(
                    function ([uid]) {

                        return (
                            uid !==
                            currentUser.uid
                        );

                    }
                );


            if (
                remainingPlayers.length === 0
            ) {

                await remove(roomRef);


                const auctionRef =
                    ref(
                        database,
                        `${AUCTION_PATH}/${currentRoomCode}`
                    );

                await remove(auctionRef);

            }
            else {

                remainingPlayers.sort(
                    function (a, b) {

                        return (
                            (a[1].joinedAt || 0) -
                            (b[1].joinedAt || 0)
                        );

                    }
                );


                const newHost =
                    remainingPlayers[0];


                await update(
                    roomRef,
                    {

                        hostId:
                            newHost[0],

                        [`players/${newHost[0]}/isHost`]:
                            true

                    }
                );

            }

        }


        resetLobby();

    }

    catch (error) {

        console.error(
            "Leave room failed:",
            error
        );

        resetLobby();

    }

}


/* =========================
   SHOW ROOM
========================= */

function showRoom(roomCode) {

    setupCard?.classList.add("hidden");

    roomCard?.classList.remove("hidden");

    if (roomCodeDisplay) {

        roomCodeDisplay.textContent =
            roomCode;

    }

}


/* =========================
   RESET
========================= */

function resetLobby() {

    currentRoomCode =
        null;


    if (currentRoomListener) {

        currentRoomListener();

        currentRoomListener =
            null;

    }


    setupCard?.classList.remove("hidden");

    roomCard?.classList.add("hidden");


    if (createRoomButton) {

        createRoomButton.disabled =
            false;

    }


    if (joinRoomButton) {

        joinRoomButton.disabled =
            false;

    }


    if (roomCodeInput) {

        roomCodeInput.value = "";

    }


    setSetupStatus("");

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


/* =========================
   USERNAME
========================= */

function getUsername() {

    if (
        currentUserData &&
        currentUserData.username
    ) {

        return currentUserData.username;

    }


    if (
        currentUser &&
        currentUser.displayName
    ) {

        return currentUser.displayName;

    }


    return "Unknown Player";

}


/* =========================
   STATUS
========================= */

function setSetupStatus(message) {

    if (setupStatus) {

        setupStatus.textContent =
            message;

    }

}


function setRoomStatus(message) {

    if (roomStatusText) {

        roomStatusText.textContent =
            message;

    }

}


/* =========================
   ESCAPE HTML
========================= */

function escapeHTML(value) {

    const div =
        document.createElement("div");

    div.textContent =
        value ?? "";

    return div.innerHTML;

}