import {
    ref,
    get,
    onValue,
    runTransaction,
    update
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
   CONFIGURATION
========================================================= */

const ROOM_PATH =
    "chaosAuctionRooms";

const STARTING_CASH =
    1000;

const BID_INCREMENT =
    10;

const TOTAL_STORAGES =
    5;

const GOING_ONCE_MS =
    3000;

const GOING_TWICE_MS =
    3000;

const SOLD_DELAY_MS =
    2000;


/* =========================================================
   STORAGE CONTENTS
========================================================= */

const STORAGE_TYPES = [

    {
        title: "Luxury Collection",
        estimate: "300 – 700 CP",
        basePrice: 100,
        items: [
            ["⌚", "Luxury Watch"],
            ["💎", "Diamond"],
            ["💍", "Gold Ring"],
            ["👜", "Designer Bag"]
        ]
    },

    {
        title: "Collector's Vault",
        estimate: "450 – 900 CP",
        basePrice: 180,
        items: [
            ["🏆", "Vintage Trophy"],
            ["🪙", "Rare Coins"],
            ["⌚", "Classic Watch"],
            ["🎖️", "Collector Medal"]
        ]
    },

    {
        title: "Hidden Fortune",
        estimate: "700 – 1,400 CP",
        basePrice: 250,
        items: [
            ["💎", "Loose Diamond"],
            ["💍", "Jewelry"],
            ["🪙", "Gold Coins"],
            ["🎨", "Painting"]
        ]
    },

    {
        title: "Celebrity Storage",
        estimate: "900 – 1,800 CP",
        basePrice: 320,
        items: [
            ["👜", "Luxury Bag"],
            ["⌚", "Designer Watch"],
            ["🎸", "Signed Guitar"],
            ["📷", "Vintage Camera"]
        ]
    },

    {
        title: "The Mystery Vault",
        estimate: "1,000 – 2,500 CP",
        basePrice: 400,
        items: [
            ["💎", "Mystery Gem"],
            ["👑", "Antique Crown"],
            ["🏆", "Golden Trophy"],
            ["🎁", "Unknown Item"]
        ]
    }

];


/*
    IMPORTANT:

    The values below are NOT displayed before purchase.

    They are the actual hidden CP values inside
    the five storage units.
*/

const HIDDEN_CP_VALUES = [
    650,
    900,
    1250,
    1650,
    2200
];


/* =========================================================
   AUTH
========================================================= */

const auth =
    getAuth(app);


/* =========================================================
   ELEMENTS
========================================================= */

const backButton =
    document.getElementById(
        "backButton"
    );

const roomCodeDisplay =
    document.getElementById(
        "roomCodeDisplay"
    );

const playerName =
    document.getElementById(
        "playerName"
    );

const playerCash =
    document.getElementById(
        "playerCash"
    );

const playerPoints =
    document.getElementById(
        "playerPoints"
    );

const roundDisplay =
    document.getElementById(
        "roundDisplay"
    );

const storageNumber =
    document.getElementById(
        "storageNumber"
    );

const storageNumberLarge =
    document.getElementById(
        "storageNumberLarge"
    );

const auctionStatus =
    document.getElementById(
        "auctionStatus"
    );

const auctionMessage =
    document.getElementById(
        "auctionMessage"
    );

const callProgress =
    document.getElementById(
        "callProgress"
    );

const callText =
    document.getElementById(
        "callText"
    );

const callBar1 =
    document.getElementById(
        "callBar1"
    );

const callBar2 =
    document.getElementById(
        "callBar2"
    );

const callBar3 =
    document.getElementById(
        "callBar3"
    );

const storageTitle =
    document.getElementById(
        "storageTitle"
    );

const storageItems =
    document.getElementById(
        "storageItems"
    );

const estimatedRange =
    document.getElementById(
        "estimatedRange"
    );

const basePrice =
    document.getElementById(
        "basePrice"
    );

const currentBid =
    document.getElementById(
        "currentBid"
    );

const currentBidder =
    document.getElementById(
        "currentBidder"
    );

const nextBid =
    document.getElementById(
        "nextBid"
    );

const bidButton =
    document.getElementById(
        "bidButton"
    );

const bidStatus =
    document.getElementById(
        "bidStatus"
    );

const bidderCount =
    document.getElementById(
        "bidderCount"
    );

const biddersList =
    document.getElementById(
        "biddersList"
    );

const auctionLog =
    document.getElementById(
        "auctionLog"
    );

const soldReveal =
    document.getElementById(
        "soldReveal"
    );

const soldWinner =
    document.getElementById(
        "soldWinner"
    );

const revealedCP =
    document.getElementById(
        "revealedCP"
    );

const soldProfit =
    document.getElementById(
        "soldProfit"
    );

const resultsCard =
    document.getElementById(
        "resultsCard"
    );

const myResult =
    document.getElementById(
        "myResult"
    );

const podium =
    document.getElementById(
        "podium"
    );

const finalLeaderboard =
    document.getElementById(
        "finalLeaderboard"
    );

const returnLobbyButton =
    document.getElementById(
        "returnLobbyButton"
    );


/* =========================================================
   STATE
========================================================= */

let currentUser =
    null;

let currentRoom =
    null;

let currentRoomCode =
    null;

let unsubscribeRoom =
    null;

let localUserData =
    null;

let localUserCash =
    STARTING_CASH;

let previousStatus =
    null;


/*
    Only the host runs the auction progression.

    This is critical.

    Every client can BID.

    Only the host advances:
        bidding
        → going_once
        → going_twice
        → sold
        → next storage
        → finished

    This prevents five clients from independently
    advancing the same auction.
*/

let hostTimer =
    null;

let hostTimerToken =
    null;


/* =========================================================
   ROOM CODE
========================================================= */

const params =
    new URLSearchParams(
        window.location.search
    );

currentRoomCode =
    params.get("room");


if (!currentRoomCode) {

    window.location.href =
        "caulobby.html";

}


/* =========================================================
   BACK BUTTON
========================================================= */

if (backButton) {

    backButton.addEventListener(
        "click",
        function () {

            window.location.href =
                "caulobby.html";

        }
    );

}


/* =========================================================
   AUTH
========================================================= */

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

        await loadUser();

        listenToRoom();

    }
);


/* =========================================================
   LOAD USER
========================================================= */

async function loadUser() {

    try {

        const userRef =
            ref(
                database,
                `users/${currentUser.uid}`
            );

        const snapshot =
            await get(
                userRef
            );

        if (!snapshot.exists()) {

            localUserData = {
                username:
                    currentUser.displayName ||
                    "Player"
            };

            return;

        }

        localUserData =
            snapshot.val();

        if (playerName) {

            playerName.textContent =
                localUserData.username ||
                currentUser.displayName ||
                "Player";

        }

        if (playerPoints) {

            playerPoints.textContent =
                formatNumber(
                    Number(
                        localUserData.chaosPoints
                    ) || 0
                );

        }

    }

    catch (error) {

        console.error(
            "Unable to load user:",
            error
        );

    }

}


/* =========================================================
   LISTEN TO ROOM
========================================================= */

function listenToRoom() {

    const roomRef =
        ref(
            database,
            `${ROOM_PATH}/${currentRoomCode}`
        );

    unsubscribeRoom =
        onValue(
            roomRef,
            function (snapshot) {

                if (!snapshot.exists()) {

                    alert(
                        "Auction room no longer exists."
                    );

                    window.location.href =
                        "caulobby.html";

                    return;

                }

                currentRoom =
                    snapshot.val();

                renderRoom();

                handleHostAuction();

            }
        );

}


/* =========================================================
   RENDER ROOM
========================================================= */

function renderRoom() {

    const room =
        currentRoom;

    if (roomCodeDisplay) {

        roomCodeDisplay.textContent =
            room.code ||
            currentRoomCode;

    }


    const player =
        room.players?.[
            currentUser.uid
        ];


    if (player) {

        localUserCash =
            Number(
                player.cash
            );

        if (
            !Number.isFinite(
                localUserCash
            )
        ) {

            localUserCash =
                STARTING_CASH;

        }

        if (playerName) {

            playerName.textContent =
                player.username ||
                "Player";

        }

    }


    if (playerCash) {

        playerCash.textContent =
            formatNumber(
                localUserCash
            );

    }


    if (playerPoints) {

        playerPoints.textContent =
            formatNumber(
                Number(
                    localUserData?.chaosPoints
                ) || 0
            );

    }


    if (
        room.status ===
        "finished"
    ) {

        showFinalResults();

        return;

    }


    const round =
        Math.max(
            1,
            Number(
                room.currentRound
            ) || 1
        );


    if (roundDisplay) {

        roundDisplay.textContent =
            `${round} / ${TOTAL_STORAGES}`;

    }


    if (storageNumber) {

        storageNumber.textContent =
            round;

    }


    if (storageNumberLarge) {

        storageNumberLarge.textContent =
            round;

    }


    const storage =
        getCurrentStorage();


    if (!storage) {

        return;

    }


    renderStorage(
        storage,
        round
    );


    renderBidders(
        storage
    );


    renderAuctionLog(
        storage
    );


    updateBidButton(
        storage
    );


    renderAuctionState(
        storage
    );

    renderSoldReveal();

}


/* =========================================================
   GET CURRENT STORAGE
========================================================= */

function getCurrentStorage() {

    if (
        !currentRoom ||
        !currentRoom.storages
    ) {

        return null;

    }

    const round =
        (
            Number(
                currentRoom.currentRound
            ) || 1
        ) - 1;

    return (
        currentRoom.storages[round] ||
        null
    );

}


/* =========================================================
   STORAGE UI
========================================================= */

function renderStorage(
    storage,
    round
) {

    const config =
        STORAGE_TYPES[
            round - 1
        ];

    if (!config) {

        return;

    }


    if (storageTitle) {

        storageTitle.textContent =
            `UNIT #${round} — ${config.title}`;

    }


    if (estimatedRange) {

        estimatedRange.textContent =
            storage.estimatedRange ||
            config.estimate;

    }


    if (basePrice) {

        basePrice.textContent =
            `${Number(storage.basePrice) || config.basePrice} CASH`;

    }


    if (storageItems) {

        storageItems.innerHTML =
            "";

        config.items.forEach(
            function (item) {

                const element =
                    document.createElement(
                        "div"
                    );

                element.className =
                    "storage-item";

                element.innerHTML = `
                    <div class="storage-item-icon">
                        ${item[0]}
                    </div>

                    <div class="storage-item-name">
                        ${escapeHTML(item[1])}
                    </div>
                `;

                storageItems.appendChild(
                    element
                );

            }
        );

    }


    const bid =
        Number(
            storage.currentBid
        ) ||
        Number(
            storage.basePrice
        ) ||
        0;


    if (currentBid) {

        currentBid.textContent =
            `${formatNumber(bid)} CASH`;

    }


    if (nextBid) {

        nextBid.textContent =
            `${formatNumber(
                bid + BID_INCREMENT
            )} CASH`;

    }


    if (currentBidder) {

        currentBidder.textContent =
            storage.currentBidderName ||
            "NO BIDS YET";

    }

}


/* =========================================================
   AUCTION STATE UI
========================================================= */

function renderAuctionState(
    storage
) {

    const state =
        storage.state ||
        "bidding";


    if (
        state ===
        "bidding"
    ) {

        auctionStatus.textContent =
            "BIDDING OPEN";

        auctionMessage.textContent =
            "Place your bid. Every bid increases the price by 10 Cash.";

        callProgress.classList.add(
            "hidden"
        );

        return;

    }


    if (
        state ===
        "going_once"
    ) {

        auctionStatus.textContent =
            "GOING ONCE";

        auctionMessage.textContent =
            "No higher bid yet...";

        showCall(
            1,
            "GOING ONCE"
        );

        return;

    }


    if (
        state ===
        "going_twice"
    ) {

        auctionStatus.textContent =
            "GOING TWICE";

        auctionMessage.textContent =
            "Last chance to bid!";

        showCall(
            2,
            "GOING TWICE"
        );

        return;

    }


    if (
        state ===
        "sold"
    ) {

        auctionStatus.textContent =
            "SOLD!";

        auctionMessage.textContent =
            "The winning bidder has claimed the storage.";

        callProgress.classList.add(
            "hidden"
        );

    }

}


/* =========================================================
   CALL DISPLAY
========================================================= */

function showCall(
    stage,
    text
) {

    callProgress.classList.remove(
        "hidden"
    );

    callText.textContent =
        text;

    callBar1.classList.toggle(
        "active",
        stage >= 1
    );

    callBar2.classList.toggle(
        "active",
        stage >= 2
    );

    callBar3.classList.toggle(
        "active",
        false
    );

}


/* =========================================================
   BID BUTTON
========================================================= */

function updateBidButton(
    storage
) {

    if (!bidButton) {

        return;

    }


    const state =
        storage.state ||
        "bidding";


    const current =
        Number(
            storage.currentBid
        ) ||
        Number(
            storage.basePrice
        ) ||
        0;


    const amount =
        current +
        BID_INCREMENT;


    const player =
        currentRoom.players?.[
            currentUser.uid
        ];


    const cash =
        Number(
            player?.cash
        );


    const availableCash =
        Number.isFinite(cash)
            ? cash
            : localUserCash;


    bidButton.disabled =
        state !== "bidding" ||
        amount > availableCash ||
        currentRoom.status === "finished";


    if (
        amount >
        availableCash
    ) {

        bidButton.textContent =
            "💸 NOT ENOUGH CASH";

    }

    else {

        bidButton.textContent =
            `🔨 BID +${BID_INCREMENT} CASH`;

    }

}


/* =========================================================
   PLACE BID
========================================================= */

if (bidButton) {

    bidButton.addEventListener(
        "click",
        placeBid
    );

}


async function placeBid() {

    if (
        !currentUser ||
        !currentRoomCode
    ) {

        return;

    }


    const auctionRef =
        ref(
            database,
            `${ROOM_PATH}/${currentRoomCode}`
        );


    try {

        const result =
            await runTransaction(
                auctionRef,
                function (room) {

                    if (!room) {

                        return;

                    }


                    if (
                        room.status ===
                        "finished"
                    ) {

                        return;

                    }


                    const round =
                        (
                            Number(
                                room.currentRound
                            ) || 1
                        );


                    if (
                        round >
                        TOTAL_STORAGES
                    ) {

                        return;

                    }


                    if (
                        !room.players ||
                        !room.players[
                            currentUser.uid
                        ]
                    ) {

                        return;

                    }


                    const storage =
                        room.storages?.[
                            round - 1
                        ];


                    if (!storage) {

                        return;

                    }


                    /*
                        Bids are only accepted during
                        the normal BIDDING state.

                        This deliberately prevents race
                        conditions during SOLD.
                    */

                    if (
                        storage.state &&
                        storage.state !==
                        "bidding"
                    ) {

                        return;

                    }


                    const player =
                        room.players[
                            currentUser.uid
                        ];


                    const cash =
                        Number(
                            player.cash
                        );


                    const oldBid =
                        Number(
                            storage.currentBid
                        ) ||
                        Number(
                            storage.basePrice
                        ) ||
                        0;


                    const newBid =
                        oldBid +
                        BID_INCREMENT;


                    if (
                        !Number.isFinite(
                            cash
                        ) ||
                        cash <
                        newBid
                    ) {

                        return;

                    }


                    /*
                        CASH IS DEDUCTED ONLY WHEN
                        THE BID IS PLACED.

                        The player therefore cannot
                        bid more than their remaining
                        1000-Cash budget.
                    */

                    player.cash =
                        cash -
                        BID_INCREMENT;


                    /*
                        But the first bid is special:

                        If the starting bid is 100,
                        the first valid bid should
                        actually be 100, not 110.

                        Therefore restore the first
                        increment when no previous
                        bidder exists.
                    */

                    if (
                        !storage.currentBidder
                    ) {

                        const firstBid =
                            Number(
                                storage.basePrice
                            ) ||
                            0;


                        if (
                            cash <
                            firstBid
                        ) {

                            return;

                        }


                        player.cash =
                            cash -
                            firstBid;


                        storage.currentBid =
                            firstBid;

                    }

                    else {

                        storage.currentBid =
                            newBid;

                    }


                    storage.currentBidder =
                        currentUser.uid;

                    storage.currentBidderName =
                        player.username ||
                        "Player";


                    /*
                        Any new bid immediately
                        cancels GOING ONCE / GOING TWICE.
                    */

                    storage.state =
                        "bidding";


                    if (
                        !storage.bidHistory
                    ) {

                        storage.bidHistory =
                            {};

                    }


                    const bidId =
                        `${Date.now()}_${currentUser.uid}_${Math.random()
                            .toString(36)
                            .slice(2, 7)}`;


                    storage.bidHistory[
                        bidId
                    ] = {

                        uid:
                            currentUser.uid,

                        username:
                            player.username ||
                            "Player",

                        amount:
                            storage.currentBid,

                        timestamp:
                            Date.now()

                    };


                    room.storages[
                        round - 1
                    ] =
                        storage;


                    return room;

                }
            );


        if (
            !result.committed
        ) {

            showBidStatus(
                "Bid rejected. The auction may have changed."
            );

            return;

        }


        showBidStatus(
            "🔨 BID PLACED!"
        );

    }

    catch (error) {

        console.error(
            "Bid failed:",
            error
        );

        showBidStatus(
            "Unable to place bid."
        );

    }

}


/* =========================================================
   HOST AUCTION ENGINE
========================================================= */

function handleHostAuction() {

    if (
        !currentUser ||
        !currentRoom
    ) {

        return;

    }


    const isHost =
        currentRoom.hostId ===
        currentUser.uid;


    if (!isHost) {

        clearHostTimer();

        return;

    }


    if (
        currentRoom.status ===
        "finished"
    ) {

        clearHostTimer();

        return;

    }


    const storage =
        getCurrentStorage();


    if (!storage) {

        return;

    }


    const state =
        storage.state ||
        "bidding";


    /*
        If the room has just started,
        initialize the first storage.
    */

    if (
        currentRoom.status ===
        "starting"
        ||
        currentRoom.status ===
        "waiting"
    ) {

        initializeAuction();

        return;

    }


    if (
        state ===
        "bidding"
    ) {

        clearHostTimer();

        /*
            We intentionally DO NOT automatically
            start the call immediately.

            The auctioneer waits 3 seconds after
            the latest bid before saying "going once".

            This gives players a reasonable amount
            of time to react.
        */

        scheduleGoingOnce();

        return;

    }


    if (
        state ===
        "going_once"
    ) {

        scheduleGoingTwice();

        return;

    }


    if (
        state ===
        "going_twice"
    ) {

        scheduleSold();

        return;

    }


    if (
        state ===
        "sold"
    ) {

        scheduleNextRound();

    }

}


/* =========================================================
   INITIALIZE AUCTION
========================================================= */

async function initializeAuction() {

    const roomRef =
        ref(
            database,
            `${ROOM_PATH}/${currentRoomCode}`
        );


    const result =
        await runTransaction(
            roomRef,
            function (room) {

                if (!room) {

                    return;

                }


                if (
                    room.auctionInitialized
                ) {

                    return;

                }


                const existingPlayers =
                    room.players ||
                    {};


                Object.keys(
                    existingPlayers
                ).forEach(
                    function (uid) {

                        existingPlayers[
                            uid
                        ].cash =
                            STARTING_CASH;

                        existingPlayers[
                            uid
                        ].startingCash =
                            STARTING_CASH;

                        existingPlayers[
                            uid
                        ].totalSpent =
                            0;

                        existingPlayers[
                            uid
                        ].totalCP =
                            0;

                        existingPlayers[
                            uid
                        ].profit =
                            0;

                        existingPlayers[
                            uid
                        ].boxesWon =
                            0;

                    }
                );


                const storages =
                    STORAGE_TYPES.map(
                        function (
                            config,
                            index
                        ) {

                            return {

                                number:
                                    index + 1,

                                title:
                                    config.title,

                                estimatedRange:
                                    config.estimate,

                                basePrice:
                                    config.basePrice,

                                hiddenCP:
                                    HIDDEN_CP_VALUES[
                                        index
                                    ],

                                state:
                                    "bidding",

                                currentBid:
                                    null,

                                currentBidder:
                                    null,

                                currentBidderName:
                                    null,

                                bidHistory:
                                    {},

                                sold:
                                    false,

                                winnerCP:
                                    0

                            };

                        }
                    );


                room.players =
                    existingPlayers;

                room.storages =
                    storages;

                room.currentRound =
                    1;

                room.status =
                    "playing";

                room.auctionInitialized =
                    true;

                room.startedAt =
                    Date.now();

                room.lastActionAt =
                    Date.now();

                return room;

            }
        );


    if (!result.committed) {

        return;

    }

}


/* =========================================================
   GOING ONCE
========================================================= */

function scheduleGoingOnce() {

    if (
        hostTimer
    ) {

        return;

    }


    const storage =
        getCurrentStorage();


    if (!storage) {

        return;

    }


    if (
        storage.currentBidder ===
        null
        ||
        storage.currentBidder ===
        undefined
    ) {

        return;

    }


    const lastBidTime =
        getLastBidTime(
            storage
        );


    /*
        Wait three seconds after the
        latest bid.
    */

    const elapsed =
        Date.now() -
        lastBidTime;


    const remaining =
        Math.max(
            3000 - elapsed,
            0
        );


    const token =
        Date.now() +
        Math.random();


    hostTimerToken =
        token;


    hostTimer =
        setTimeout(
            async function () {

                hostTimer =
                    null;


                if (
                    hostTimerToken !==
                    token
                ) {

                    return;

                }


                await changeStorageState(
                    "going_once"
                );

            },
            remaining
        );

}


/* =========================================================
   GOING TWICE
========================================================= */

function scheduleGoingTwice() {

    if (
        hostTimer
    ) {

        return;

    }


    const token =
        Date.now() +
        Math.random();


    hostTimerToken =
        token;


    hostTimer =
        setTimeout(
            async function () {

                hostTimer =
                    null;


                if (
                    hostTimerToken !==
                    token
                ) {

                    return;

                }


                const latest =
                    getCurrentStorage();


                if (!latest) {

                    return;

                }


                if (
                    latest.state !==
                    "going_once"
                ) {

                    return;

                }


                await changeStorageState(
                    "going_twice"
                );

            },
            GOING_ONCE_MS
        );

}


/* =========================================================
   SOLD
========================================================= */

function scheduleSold() {

    if (
        hostTimer
    ) {

        return;

    }


    const token =
        Date.now() +
        Math.random();


    hostTimerToken =
        token;


    hostTimer =
        setTimeout(
            async function () {

                hostTimer =
                    null;


                if (
                    hostTimerToken !==
                    token
                ) {

                    return;

                }


                const latest =
                    getCurrentStorage();


                if (!latest) {

                    return;

                }


                if (
                    latest.state !==
                    "going_twice"
                ) {

                    return;

                }


                await sellCurrentStorage();

            },
            GOING_TWICE_MS
        );

}


/* =========================================================
   SELL CURRENT STORAGE
========================================================= */

async function sellCurrentStorage() {

    const roomRef =
        ref(
            database,
            `${ROOM_PATH}/${currentRoomCode}`
        );


    const result =
        await runTransaction(
            roomRef,
            function (room) {

                if (!room) {

                    return;

                }


                if (
                    room.status ===
                    "finished"
                ) {

                    return;

                }


                const round =
                    Number(
                        room.currentRound
                    ) || 1;


                const index =
                    round - 1;


                const storage =
                    room.storages?.[
                        index
                    ];


                if (!storage) {

                    return;

                }


                if (
                    storage.state !==
                    "going_twice"
                ) {

                    return;

                }


                const winnerId =
                    storage.currentBidder;


                /*
                    Nobody bid.

                    The storage is simply marked
                    unsold and we move on.
                */

                if (!winnerId) {

                    storage.state =
                        "sold";

                    storage.sold =
                        true;

                    storage.winnerCP =
                        0;

                    room.storages[
                        index
                    ] =
                        storage;

                    return room;

                }


                const winner =
                    room.players?.[
                        winnerId
                    ];


                if (!winner) {

                    return;

                }


                const winningBid =
                    Number(
                        storage.currentBid
                    ) || 0;


                const hiddenCP =
                    Number(
                        storage.hiddenCP
                    ) || 0;


                /*
                    Cash was reserved/deducted
                    when each bid was placed.

                    Therefore we do NOT deduct
                    anything here.

                    The winning bid becomes the
                    player's spending amount.
                */

                winner.totalSpent =
                    (
                        Number(
                            winner.totalSpent
                        ) || 0
                    ) +
                    winningBid;


                winner.totalCP =
                    (
                        Number(
                            winner.totalCP
                        ) || 0
                    ) +
                    hiddenCP;


                winner.boxesWon =
                    (
                        Number(
                            winner.boxesWon
                        ) || 0
                    ) +
                    1;


                winner.profit =
                    (
                        Number(
                            winner.totalCP
                        ) || 0
                    ) -
                    (
                        Number(
                            winner.totalSpent
                        ) || 0
                    );


                storage.state =
                    "sold";

                storage.sold =
                    true;

                storage.winnerCP =
                    hiddenCP;

                storage.winnerId =
                    winnerId;

                storage.winnerName =
                    winner.username ||
                    "Player";

                storage.winningBid =
                    winningBid;

                storage.soldAt =
                    Date.now();


                room.storages[
                    index
                ] =
                    storage;


                room.lastActionAt =
                    Date.now();


                return room;

            }
        );


    if (!result.committed) {

        return;

    }


    /*
        The room listener will show the
        revealed CP automatically.

        Then the host waits 2 seconds
        before moving forward.
    */

}


/* =========================================================
   NEXT ROUND
========================================================= */

function scheduleNextRound() {

    if (
        hostTimer
    ) {

        return;

    }


    const token =
        Date.now() +
        Math.random();


    hostTimerToken =
        token;


    hostTimer =
        setTimeout(
            async function () {

                hostTimer =
                    null;


                if (
                    hostTimerToken !==
                    token
                ) {

                    return;

                }


                await moveToNextRound();

            },
            SOLD_DELAY_MS
        );

}


/* =========================================================
   MOVE TO NEXT ROUND
========================================================= */

async function moveToNextRound() {

    const roomRef =
        ref(
            database,
            `${ROOM_PATH}/${currentRoomCode}`
        );


    const result =
        await runTransaction(
            roomRef,
            function (room) {

                if (!room) {

                    return;

                }


                if (
                    room.status ===
                    "finished"
                ) {

                    return;

                }


                const round =
                    Number(
                        room.currentRound
                    ) || 1;


                const storage =
                    room.storages?.[
                        round - 1
                    ];


                if (
                    !storage ||
                    storage.state !==
                    "sold"
                ) {

                    return;

                }


                /*
                    FINAL STORAGE
                */

                if (
                    round >=
                    TOTAL_STORAGES
                ) {

                    finalizeGame(
                        room
                    );

                    return room;

                }


                /*
                    NEXT STORAGE
                */

                room.currentRound =
                    round + 1;


                const nextStorage =
                    room.storages[
                        round
                    ];


                if (!nextStorage) {

                    finalizeGame(
                        room
                    );

                    return room;

                }


                nextStorage.state =
                    "bidding";

                nextStorage.currentBid =
                    null;

                nextStorage.currentBidder =
                    null;

                nextStorage.currentBidderName =
                    null;


                room.storages[
                    round
                ] =
                    nextStorage;


                room.lastActionAt =
                    Date.now();


                return room;

            }
        );


    if (!result.committed) {

        return;

    }


    /*
        Final CP rewards are written
        after the auction is finished.
    */

    if (
        result.snapshot?.val?.status ===
        "finished"
    ) {

        await applyLeaderboardRewards(
            result.snapshot.val()
        );

    }

}


/* =========================================================
   FINALIZE GAME
========================================================= */

function finalizeGame(
    room
) {

    room.status =
        "finished";

    room.finishedAt =
        Date.now();


    const players =
        room.players ||
        {};


    Object.entries(
        players
    ).forEach(
        function (
            [uid, player]
        ) {

            player.totalCP =
                Number(
                    player.totalCP
                ) || 0;

            player.totalSpent =
                Number(
                    player.totalSpent
                ) || 0;

            player.profit =
                player.totalCP -
                player.totalSpent;

            player.finalReward =
                player.totalCP;

            player.finalRank =
                0;

        }
    );


    const ranked =
        Object.entries(
            players
        )
        .sort(
            function (a, b) {

                return (
                    Number(
                        b[1].profit
                    ) -
                    Number(
                        a[1].profit
                    )
                );

            }
        );


    ranked.forEach(
        function (
            [, player],
            index
        ) {

            player.finalRank =
                index + 1;

        }
    );


    room.players =
        players;


    room.leaderboardFinalized =
        false;


    return room;

}


/* =========================================================
   APPLY LEADERBOARD CP
========================================================= */

async function applyLeaderboardRewards(
    finishedRoom
) {

    /*
        Every player receives the CP they
        actually discovered in their boxes.

        This updates:

        users/{uid}/chaosPoints

        which is what the existing
        dashboard leaderboard uses.
    */

    const players =
        finishedRoom.players ||
        {};


    for (
        const [uid, player]
        of Object.entries(
            players
        )
    ) {

        const reward =
            Number(
                player.finalReward
            ) || 0;


        if (
            reward <= 0
        ) {

            continue;

        }


        const playerRoomRef =
            ref(
                database,
                `${ROOM_PATH}/${currentRoomCode}/players/${uid}`
            );


        /*
            Mark reward as applied atomically
            so the same finished game cannot
            repeatedly add CP.
        */

        const claim =
            await runTransaction(
                playerRoomRef,
                function (
                    currentPlayer
                ) {

                    if (!currentPlayer) {

                        return;

                    }


                    if (
                        currentPlayer.rewardApplied
                    ) {

                        return;

                    }


                    currentPlayer.rewardApplied =
                        true;

                    return currentPlayer;

                }
            );


        if (
            !claim.committed
        ) {

            continue;

        }


        const pointsRef =
            ref(
                database,
                `users/${uid}/chaosPoints`
            );


        await runTransaction(
            pointsRef,
            function (
                existingPoints
            ) {

                return (
                    Number(
                        existingPoints
                    ) || 0
                ) +
                reward;

            }
        );

    }


    /*
        Refresh local user data after the
        leaderboard update.
    */

    if (currentUser) {

        await refreshUserPoints();

    }

}


/* =========================================================
   REFRESH USER CP
========================================================= */

async function refreshUserPoints() {

    try {

        const userRef =
            ref(
                database,
                `users/${currentUser.uid}`
            );


        const snapshot =
            await get(
                userRef
            );


        if (
            !snapshot.exists()
        ) {

            return;

        }


        localUserData =
            snapshot.val();


        if (playerPoints) {

            playerPoints.textContent =
                formatNumber(
                    Number(
                        localUserData.chaosPoints
                    ) || 0
                );

        }

    }

    catch (error) {

        console.error(
            "Unable to refresh CP:",
            error
        );

    }

}


/* =========================================================
   CHANGE STORAGE STATE
========================================================= */

async function changeStorageState(
    newState
) {

    const roomRef =
        ref(
            database,
            `${ROOM_PATH}/${currentRoomCode}`
        );


    await runTransaction(
        roomRef,
        function (room) {

            if (!room) {

                return;

            }


            if (
                room.status ===
                "finished"
            ) {

                return;

            }


            const round =
                Number(
                    room.currentRound
                ) || 1;


            const storage =
                room.storages?.[
                    round - 1
                ];


            if (!storage) {

                return;

            }


            /*
                Do not advance an auction if a
                newer bid has already reset the
                state.
            */

            if (
                newState ===
                "going_twice"
                &&
                storage.state !==
                "going_once"
            ) {

                return;

            }


            if (
                newState ===
                "going_once"
                &&
                storage.state !==
                "bidding"
            ) {

                return;

            }


            if (
                newState ===
                "going_once"
                &&
                !storage.currentBidder
            ) {

                return;

            }


            storage.state =
                newState;


            room.storages[
                round - 1
            ] =
                storage;


            room.lastActionAt =
                Date.now();


            return room;

        }
    );

}


/* =========================================================
   LAST BID TIME
========================================================= */

function getLastBidTime(
    storage
) {

    const history =
        storage.bidHistory ||
        {};


    const bids =
        Object.values(
            history
        );


    if (
        bids.length === 0
    ) {

        return Date.now();

    }


    return Math.max(
        ...bids.map(
            function (bid) {

                return Number(
                    bid.timestamp
                ) || 0;

            }
        )
    );

}


/* =========================================================
   CLEAR HOST TIMER
========================================================= */

function clearHostTimer() {

    if (hostTimer) {

        clearTimeout(
            hostTimer
        );

        hostTimer =
            null;

    }


    hostTimerToken =
        null;

}


/* =========================================================
   RENDER BIDDERS
========================================================= */

function renderBidders(
    storage
) {

    if (!biddersList) {

        return;

    }


    biddersList.innerHTML =
        "";


    const history =
        storage.bidHistory ||
        {};


    const bids =
        Object.values(
            history
        )
        .sort(
            function (a, b) {

                return (
                    Number(
                        b.timestamp
                    ) -
                    Number(
                        a.timestamp
                    )
                );

            }
        );


    if (bidderCount) {

        bidderCount.textContent =
            bids.length;

    }


    if (
        bids.length === 0
    ) {

        biddersList.innerHTML = `
            <div class="empty-bidders">
                No bids yet.
            </div>
        `;

        return;

    }


    bids.forEach(
        function (bid) {

            const element =
                document.createElement(
                    "div"
                );

            element.className =
                "bidder";


            const isCurrent =
                bid.uid ===
                storage.currentBidder;


            element.innerHTML = `

                <span class="bidder-name">

                    ${escapeHTML(
                        bid.username
                    )}

                    ${
                        isCurrent
                            ? " 🔨"
                            : ""
                    }

                </span>

                <span class="bidder-amount">

                    ${formatNumber(
                        Number(
                            bid.amount
                        ) || 0
                    )} CASH

                </span>

            `;


            biddersList.appendChild(
                element
            );

        }
    );

}


/* =========================================================
   AUCTION LOG
========================================================= */

function renderAuctionLog(
    storage
) {

    if (!auctionLog) {

        return;

    }


    auctionLog.innerHTML =
        "";


    const history =
        storage.bidHistory ||
        {};


    const bids =
        Object.values(
            history
        )
        .sort(
            function (a, b) {

                return (
                    Number(
                        a.timestamp
                    ) -
                    Number(
                        b.timestamp
                    )
                );

            }
        );


    if (
        bids.length === 0
    ) {

        auctionLog.innerHTML = `

            <div class="log-item">

                Auction opened at

                <strong>
                    ${formatNumber(
                        Number(
                            storage.basePrice
                        ) || 0
                    )} CASH
                </strong>

            </div>

        `;

        return;

    }


    bids.forEach(
        function (bid) {

            const item =
                document.createElement(
                    "div"
                );

            item.className =
                "log-item";


            item.innerHTML = `

                <strong>
                    ${escapeHTML(
                        bid.username
                    )}
                </strong>

                bid

                <strong>
                    ${formatNumber(
                        Number(
                            bid.amount
                        ) || 0
                    )} CASH
                </strong>

            `;


            auctionLog.appendChild(
                item
            );

        }
    );

}


/* =========================================================
   SOLD REVEAL
========================================================= */

function renderSoldReveal() {

    const storage =
        getCurrentStorage();


    if (
        !storage ||
        !storage.sold
    ) {

        soldReveal.classList.add(
            "hidden"
        );

        return;

    }


    soldReveal.classList.remove(
        "hidden"
    );


    soldWinner.textContent =
        storage.winnerName ||
        "NO WINNER";


    revealedCP.textContent =
        `${formatNumber(
            Number(
                storage.winnerCP
            ) || 0
        )} CP`;


    const winnerBid =
        Number(
            storage.winningBid
        ) || 0;


    const value =
        Number(
            storage.winnerCP
        ) || 0;


    const profit =
        value -
        winnerBid;


    soldProfit.textContent =
        `Storage result: ${
            profit >= 0
                ? "+"
                : ""
        }${formatNumber(profit)} CP`;


}


/* =========================================================
   SHOW FINAL RESULTS
========================================================= */

function showFinalResults() {

    if (!resultsCard) {

        return;

    }


    document
        .querySelector(".hero")
        ?.classList.add(
            "hidden"
        );

    document
        .querySelector(".wallet-card")
        ?.classList.add(
            "hidden"
        );

    document
        .querySelector(".auction-call-card")
        ?.classList.add(
            "hidden"
        );

    document
        .querySelector(".storage-card")
        ?.classList.add(
            "hidden"
        );

    document
        .querySelector(".bid-card")
        ?.classList.add(
            "hidden"
        );

    document
        .querySelector(".players-card")
        ?.classList.add(
            "hidden"
        );

    document
        .querySelector(".log-card")
        ?.classList.add(
            "hidden"
        );

    soldReveal.classList.add(
        "hidden"
    );


    resultsCard.classList.remove(
        "hidden"
    );


    renderResults();

}


/* =========================================================
   RESULTS
========================================================= */

function renderResults() {

    if (!currentRoom) {

        return;

    }


    const players =
        currentRoom.players ||
        {};


    const entries =
        Object.entries(
            players
        );


    entries.sort(
        function (a, b) {

            return (
                Number(
                    a[1].finalRank
                ) -
                Number(
                    b[1].finalRank
                )
            );

        }
    );


    const me =
        players[
            currentUser.uid
        ];


    if (
        myResult &&
        me
    ) {

        const profit =
            Number(
                me.profit
            ) || 0;


        myResult.innerHTML = `

            <div class="result-cash">

                REMAINING CASH

            </div>

            <div class="result-cp">

                ${formatNumber(
                    Number(
                        me.totalCP
                    ) || 0
                )} CP

            </div>

            <div class="result-profit ${
                profit >= 0
                    ? "profit"
                    : "loss"
            }">

                ${
                    profit >= 0
                        ? "+"
                        : ""
                }${formatNumber(
                    profit
                )} CP PROFIT/LOSS

            </div>

        `;

    }


    renderPodium(
        entries
    );


    renderFinalLeaderboard(
        entries
    );


    /*
        Refresh the player's persistent
        leaderboard CP.

        The transaction is protected by
        rewardApplied.
    */

    applyLeaderboardRewards(
        currentRoom
    );

}


/* =========================================================
   PODIUM
========================================================= */

function renderPodium(
    entries
) {

    if (!podium) {

        return;

    }


    podium.innerHTML =
        "";


    const top =
        entries.slice(
            0,
            3
        );


    const order =
        [1, 0, 2];


    order.forEach(
        function (index) {

            const entry =
                top[index];


            if (!entry) {

                return;

            }


            const uid =
                entry[0];

            const player =
                entry[1];


            const element =
                document.createElement(
                    "div"
                );


            element.className =
                "podium-player";


            if (
                index === 0
            ) {

                element.classList.add(
                    "first"
                );

            }


            const medal =
                index === 0
                    ? "🥇"
                    : index === 1
                        ? "🥈"
                        : "🥉";


            const profit =
                Number(
                    player.profit
                ) || 0;


            element.innerHTML = `

                <div class="podium-medal">

                    ${medal}

                </div>

                <div class="podium-name">

                    ${escapeHTML(
                        player.username ||
                        "Player"
                    )}

                    ${
                        uid ===
                        currentUser.uid
                            ? " (YOU)"
                            : ""
                    }

                </div>

                <div class="podium-profit ${
                    profit >= 0
                        ? "profit"
                        : "loss"
                }">

                    ${
                        profit >= 0
                            ? "+"
                            : ""
                    }${formatNumber(
                        profit
                    )} CP

                </div>

            `;


            podium.appendChild(
                element
            );

        }
    );

}


/* =========================================================
   FINAL LEADERBOARD
========================================================= */

function renderFinalLeaderboard(
    entries
) {

    if (!finalLeaderboard) {

        return;

    }


    finalLeaderboard.innerHTML =
        "";


    entries.forEach(
        function (
            [uid, player]
        ) {

            const row =
                document.createElement(
                    "div"
                );


            row.className =
                "final-player";


            const rank =
                Number(
                    player.finalRank
                ) || 0;


            const profit =
                Number(
                    player.profit
                ) || 0;


            row.innerHTML = `

                <span class="final-rank">

                    #${rank}

                </span>

                <span class="final-name">

                    ${escapeHTML(
                        player.username ||
                        "Player"
                    )}

                    ${
                        uid ===
                        currentUser.uid
                            ? " (YOU)"
                            : ""
                    }

                </span>

                <span class="final-score ${
                    profit >= 0
                        ? "profit"
                        : "loss"
                }">

                    ${
                        profit >= 0
                            ? "+"
                            : ""
                    }${formatNumber(
                        profit
                    )} CP

                </span>

            `;


            finalLeaderboard.appendChild(
                row
            );

        }
    );

}


/* =========================================================
   RETURN TO LOBBY
========================================================= */

if (returnLobbyButton) {

    returnLobbyButton.addEventListener(
        "click",
        function () {

            window.location.href =
                "caulobby.html";

        }
    );

}


/* =========================================================
   BID STATUS
========================================================= */

function showBidStatus(
    message
) {

    if (!bidStatus) {

        return;

    }


    bidStatus.textContent =
        message;


    setTimeout(
        function () {

            if (
                bidStatus.textContent ===
                message
            ) {

                bidStatus.textContent =
                    "";

            }

        },
        2500
    );

}


/* =========================================================
   NUMBER FORMAT
========================================================= */

function formatNumber(
    number
) {

    return Number(
        number || 0
    ).toLocaleString(
        "en-US"
    );

}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHTML(
    value
) {

    const div =
        document.createElement(
            "div"
        );


    div.textContent =
        value ??
        "";


    return div.innerHTML;

}

