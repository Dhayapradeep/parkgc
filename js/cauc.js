import {
    ref,
    get,
    set,
    update,
    onValue,
    runTransaction,
    serverTimestamp
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
   AUTH
========================================================= */

const auth = getAuth(app);


/* =========================================================
   ELEMENTS
========================================================= */

const backButton =
    document.getElementById("backButton");

const roomCodeDisplay =
    document.getElementById("roomCodeDisplay");

const playerName =
    document.getElementById("playerName");

const playerPoints =
    document.getElementById("playerPoints");

const roundDisplay =
    document.getElementById("roundDisplay");

const storageNumber =
    document.getElementById("storageNumber");

const auctionStatus =
    document.getElementById("auctionStatus");

const auctionMessage =
    document.getElementById("auctionMessage");

const itemVisual =
    document.getElementById("itemVisual");

const storageTitle =
    document.getElementById("storageTitle");

const itemName =
    document.getElementById("itemName");

const itemDescription =
    document.getElementById("itemDescription");

const estimatedValue =
    document.getElementById("estimatedValue");

const basePrice =
    document.getElementById("basePrice");

const currentBid =
    document.getElementById("currentBid");

const currentBidder =
    document.getElementById("currentBidder");

const bidIncrement =
    document.getElementById("bidIncrement");

const bidButton =
    document.getElementById("bidButton");

const bidMinusButton =
    document.getElementById("bidMinusButton");

const bidPlusButton =
    document.getElementById("bidPlusButton");

const bidStatus =
    document.getElementById("bidStatus");

const bidderCount =
    document.getElementById("bidderCount");

const biddersList =
    document.getElementById("biddersList");

const auctionLog =
    document.getElementById("auctionLog");

const resultsCard =
    document.getElementById("resultsCard");

const podium =
    document.getElementById("podium");

const otherBuyers =
    document.getElementById("otherBuyers");

const nonBuyers =
    document.getElementById("nonBuyers");

const returnLobbyButton =
    document.getElementById("returnLobbyButton");


/* =========================================================
   CONSTANTS
========================================================= */

const AUCTION_PATH =
    "chaosAuctions";

const LOBBY_PATH =
    "chaosAuctionRooms";

const TOTAL_ROUNDS =
    10;


/*
    Classical auction timing.

    3 seconds:
    preparation -> going once

    3 seconds:
    going once -> going twice

    3 seconds:
    going twice -> final call

    1.5 seconds:
    final call -> SOLD
*/

const CALL_DELAY =
    3000;

const SOLD_DELAY =
    1500;


/* =========================================================
   GAME STATE
========================================================= */

let currentUser = null;

let currentUserData = null;

let roomId = null;

let auctionData = null;

let unsubscribeAuction = null;

let schedulerTimer = null;

let selectedBid = 10;


/* =========================================================
   ROOM ID
========================================================= */

const params =
    new URLSearchParams(
        window.location.search
    );

roomId =
    params.get("room");


if (!roomId) {

    alert("No auction room found.");

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
                "caulobby.html?room=" +
                roomId;

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

        await initializeAuction();

        listenToAuction();

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
            await get(userRef);

        if (!snapshot.exists()) {

            currentUserData = {};

            return;

        }

        currentUserData =
            snapshot.val();

        renderPlayerInfo();

    }

    catch (error) {

        console.error(
            "Unable to load user:",
            error
        );

    }

}


/* =========================================================
   PLAYER INFO
========================================================= */

function renderPlayerInfo() {

    const username =
        currentUserData?.username ||
        currentUser.displayName ||
        "Unknown Player";

    const points =
        Number(
            currentUserData?.chaosPoints
        ) || 0;

    if (playerName) {

        playerName.textContent =
            username;

    }

    if (playerPoints) {

        playerPoints.textContent =
            `${points} CP`;

    }

}


/* =========================================================
   INITIALIZE AUCTION
========================================================= */

async function initializeAuction() {

    const auctionRef =
        ref(
            database,
            `${AUCTION_PATH}/${roomId}`
        );

    const existing =
        await get(auctionRef);


    /*
        If the auction already exists,
        DO NOT recreate it.
    */

    if (existing.exists()) {

        return;

    }


    /*
        Read the lobby room.
    */

    const lobbyRef =
        ref(
            database,
            `${LOBBY_PATH}/${roomId}`
        );

    const lobbySnapshot =
        await get(lobbyRef);


    if (!lobbySnapshot.exists()) {

        alert(
            "The lobby room could not be found."
        );

        window.location.href =
            "caulobby.html";

        return;

    }


    const lobby =
        lobbySnapshot.val();


    /*
        Make sure the player is actually
        part of the lobby.
    */

    const lobbyPlayers =
        lobby.players || {};

    const playerIds =
        Object.keys(lobbyPlayers);


    if (
        !lobbyPlayers[currentUser.uid]
    ) {

        alert(
            "You are not a player in this auction."
        );

        window.location.href =
            "caulobby.html";

        return;

    }


    /*
        Create the game players.
    */

    const gamePlayers = {};


    for (
        const uid of playerIds
    ) {

        const lobbyPlayer =
            lobbyPlayers[uid] || {};

        let points =
            Number(
                lobbyPlayer.chaosPoints
            );


        /*
            If the lobby doesn't have CP,
            read it from the user profile.
        */

        if (
            !Number.isFinite(points)
        ) {

            try {

                const userSnapshot =
                    await get(
                        ref(
                            database,
                            `users/${uid}`
                        )
                    );

                if (
                    userSnapshot.exists()
                ) {

                    points =
                        Number(
                            userSnapshot.val()
                                .chaosPoints
                        ) || 1000;

                }

                else {

                    points = 1000;

                }

            }

            catch {

                points = 1000;

            }

        }


        gamePlayers[uid] = {

            uid: uid,

            username:
                lobbyPlayer.username ||
                "Unknown Player",

            chaosPoints:
                points,

            startingPoints:
                points,

            spent: 0,

            bought: 0,

            items: {}

        };

    }


    /*
        Create the ten auction items.
    */

    const storages =
        createStorages();


    /*
        Only the original lobby host
        becomes the auction coordinator.
    */

    const auction = {

        code: roomId,

        hostId:
            lobby.hostId,

        status:
            "playing",

        currentRound:
            1,

        phase:
            "open",

        callNumber:
            0,

        phaseStartedAt:
            Date.now(),

        currentBid:
            0,

        currentBidder:
            null,

        currentBidderName:
            null,

        players:
            gamePlayers,

        storages:
            storages,

        log: {

            start: {

                message:
                    "Auction opened.",

                timestamp:
                    Date.now()

            }

        },

        createdAt:
            Date.now()

    };


    try {

        await set(
            auctionRef,
            auction
        );

    }

    catch (error) {

        console.error(
            "Unable to initialize auction:",
            error
        );

        alert(
            "Unable to start auction."
        );

        window.location.href =
            "caulobby.html";

    }

}


/* =========================================================
   STORAGE ITEMS
========================================================= */

function createStorages() {

    return [

        {
            icon: "⌚",
            name: "Luxury Watch",
            description:
                "A premium mechanical watch hidden inside the unit.",
            estimatedValue: 520,
            basePrice: 100
        },

        {
            icon: "🏆",
            name: "Championship Trophy",
            description:
                "A mysterious engraved trophy from an unknown competition.",
            estimatedValue: 760,
            basePrice: 180
        },

        {
            icon: "💎",
            name: "Loose Diamond",
            description:
                "A brilliant stone sealed inside a small velvet box.",
            estimatedValue: 1200,
            basePrice: 300
        },

        {
            icon: "🖼️",
            name: "Old Master Painting",
            description:
                "An antique painting with an uncertain history.",
            estimatedValue: 1500,
            basePrice: 400
        },

        {
            icon: "📷",
            name: "Vintage Camera",
            description:
                "A collectible film camera from a forgotten era.",
            estimatedValue: 650,
            basePrice: 150
        },

        {
            icon: "🎸",
            name: "Signed Guitar",
            description:
                "A beautifully preserved guitar carrying a mysterious signature.",
            estimatedValue: 980,
            basePrice: 250
        },

        {
            icon: "💻",
            name: "Collector Laptop",
            description:
                "An unusual limited-edition computer hidden in its original case.",
            estimatedValue: 830,
            basePrice: 220
        },

        {
            icon: "🪙",
            name: "Rare Coin Collection",
            description:
                "Several old coins wrapped in a weathered leather pouch.",
            estimatedValue: 1100,
            basePrice: 280
        },

        {
            icon: "💍",
            name: "Antique Jewelry Box",
            description:
                "An ornate box containing several unidentified pieces of jewelry.",
            estimatedValue: 1350,
            basePrice: 350
        },

        {
            icon: "👑",
            name: "Mystery Heirloom",
            description:
                "A strange antique object whose true value is impossible to know.",
            estimatedValue: 1800,
            basePrice: 500
        }

    ].map(
        function (item, index) {

            return {

                ...item,

                round:
                    index + 1,

                currentBid:
                    item.basePrice,

                currentBidder:
                    null,

                currentBidderName:
                    null,

                bidHistory: {},

                result:
                    "unsold"

            };

        }
    );

}


/* =========================================================
   LISTEN TO AUCTION
========================================================= */

function listenToAuction() {

    const auctionRef =
        ref(
            database,
            `${AUCTION_PATH}/${roomId}`
        );


    unsubscribeAuction =
        onValue(
            auctionRef,
            function (snapshot) {

                if (
                    !snapshot.exists()
                ) {

                    alert(
                        "Auction room no longer exists."
                    );

                    window.location.href =
                        "caulobby.html";

                    return;

                }


                auctionData =
                    snapshot.val();


                renderAuction();


                /*
                    Only the host runs the
                    auction progression scheduler.
                */

                if (
                    auctionData.hostId ===
                    currentUser?.uid
                ) {

                    scheduleAuctionProgress();

                }

            }
        );

}


/* =========================================================
   RENDER AUCTION
========================================================= */

function renderAuction() {

    if (!auctionData) {

        return;

    }


    if (roomCodeDisplay) {

        roomCodeDisplay.textContent =
            auctionData.code ||
            roomId;

    }


    if (
        auctionData.status ===
        "finished"
    ) {

        showFinalResults();

        return;

    }


    const round =
        Number(
            auctionData.currentRound
        ) || 1;


    if (roundDisplay) {

        roundDisplay.textContent =
            `${round} / ${TOTAL_ROUNDS}`;

    }


    if (storageNumber) {

        storageNumber.textContent =
            round;

    }


    const storage =
        auctionData.storages?.[
            round - 1
        ];


    if (!storage) {

        return;

    }


    renderStorage(
        storage,
        round
    );


    renderBid(
        storage
    );


    renderBidders(
        storage
    );


    renderAuctionLog(
        storage
    );


    renderCallState();


    updateBidButton(
        storage
    );

}


/* =========================================================
   RENDER STORAGE
========================================================= */

function renderStorage(
    storage,
    round
) {

    if (itemVisual) {

        itemVisual.textContent =
            storage.icon || "📦";

    }


    if (storageTitle) {

        storageTitle.textContent =
            `UNIT #${round}`;

    }


    if (itemName) {

        itemName.textContent =
            storage.name ||
            "Mystery Storage";

    }


    if (itemDescription) {

        itemDescription.textContent =
            storage.description ||
            "The contents are unknown.";

    }


    if (estimatedValue) {

        estimatedValue.textContent =
            `${Number(storage.estimatedValue) || 0} CP`;

    }


    if (basePrice) {

        basePrice.textContent =
            `${Number(storage.basePrice) || 0} CP`;

    }

}


/* =========================================================
   CALL STATE
========================================================= */

function renderCallState() {

    const phase =
        auctionData.phase ||
        "open";

    const callNumber =
        Number(
            auctionData.callNumber
        ) || 0;


    if (phase === "open") {

        auctionStatus.textContent =
            "OPEN FOR BIDS";

        auctionMessage.textContent =
            "Place your bid. The auctioneer is waiting.";

        return;

    }


    if (phase === "call") {

        if (callNumber === 1) {

            auctionStatus.textContent =
                "GOING ONCE";

            auctionMessage.textContent =
                "Going once... any higher bid?";

        }

        else if (callNumber === 2) {

            auctionStatus.textContent =
                "GOING TWICE";

            auctionMessage.textContent =
                "Going twice... final opportunity.";

        }

        else if (callNumber === 3) {

            auctionStatus.textContent =
                "FINAL CALL";

            auctionMessage.textContent =
                "Last call... going, going...";

        }

        return;

    }


    if (phase === "sold") {

        auctionStatus.textContent =
            "SOLD! 🔨";

        auctionMessage.textContent =
            auctionData.currentBidderName
                ? `${auctionData.currentBidderName} wins the unit.`
                : "No one bought this unit.";

    }


    if (phase === "preparing") {

        auctionStatus.textContent =
            "NEXT UNIT";

        auctionMessage.textContent =
            "Preparing the next storage unit...";

    }

}


/* =========================================================
   RENDER BID
========================================================= */

function renderBid(
    storage
) {

    const bid =
        Number(
            storage.currentBid
        ) || Number(
            storage.basePrice
        ) || 0;


    if (currentBid) {

        currentBid.textContent =
            `${bid} CP`;

    }


    if (currentBidder) {

        currentBidder.textContent =
            storage.currentBidderName ||
            "NO BIDS YET";

    }

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


    /*
        Bids are allowed only while
        the auction is OPEN.
    */

    if (
        auctionData.phase !==
        "open"
    ) {

        bidButton.disabled =
            true;

        return;

    }


    const current =
        Number(
            storage.currentBid
        ) || 0;


    const nextBid =
        current +
        selectedBid;


    const myPoints =
        Number(
            auctionData.players?.[
                currentUser.uid
            ]?.chaosPoints
        ) ||
        getLocalUserPoints();


    bidButton.disabled =
        nextBid >
        myPoints;

}


/* =========================================================
   GET LOCAL POINTS
========================================================= */

function getLocalUserPoints() {

    const text =
        playerPoints?.textContent ||
        "0";

    return Number(
        text.replace(
            /[^0-9-]/g,
            ""
        )
    ) || 0;

}


/* =========================================================
   INCREMENT
========================================================= */

if (bidPlusButton) {

    bidPlusButton.addEventListener(
        "click",
        function () {

            selectedBid += 10;

            bidIncrement.textContent =
                selectedBid;

            if (auctionData) {

                const storage =
                    auctionData.storages?.[
                        (
                            Number(
                                auctionData.currentRound
                            ) || 1
                        ) - 1
                    ];

                if (storage) {

                    updateBidButton(
                        storage
                    );

                }

            }

        }
    );

}


if (bidMinusButton) {

    bidMinusButton.addEventListener(
        "click",
        function () {

            selectedBid =
                Math.max(
                    10,
                    selectedBid - 10
                );

            bidIncrement.textContent =
                selectedBid;

            if (auctionData) {

                const storage =
                    auctionData.storages?.[
                        (
                            Number(
                                auctionData.currentRound
                            ) || 1
                        ) - 1
                    ];

                if (storage) {

                    updateBidButton(
                        storage
                    );

                }

            }

        }
    );

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
        !roomId ||
        !auctionData
    ) {

        return;

    }


    if (
        auctionData.phase !==
        "open"
    ) {

        showBidStatus(
            "The auctioneer has already started calling."
        );

        return;

    }


    const auctionRef =
        ref(
            database,
            `${AUCTION_PATH}/${roomId}`
        );


    try {

        const result =
            await runTransaction(
                auctionRef,
                function (data) {

                    if (!data) {

                        return;

                    }


                    if (
                        data.status ===
                        "finished"
                    ) {

                        return;

                    }


                    if (
                        data.phase !==
                        "open"
                    ) {

                        return;

                    }


                    const round =
                        Number(
                            data.currentRound
                        ) || 1;


                    const index =
                        round - 1;


                    const storage =
                        data.storages?.[
                            index
                        ];


                    if (!storage) {

                        return;

                    }


                    const player =
                        data.players?.[
                            currentUser.uid
                        ];


                    if (!player) {

                        return;

                    }


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
                        selectedBid;


                    const points =
                        Number(
                            player.chaosPoints
                        ) || 0;


                    if (
                        points <
                        newBid
                    ) {

                        return;

                    }


                    /*
                        New bid resets the
                        classical call sequence.
                    */

                    storage.currentBid =
                        newBid;

                    storage.currentBidder =
                        currentUser.uid;

                    storage.currentBidderName =
                        player.username ||
                        "Unknown";


                    if (
                        !storage.bidHistory
                    ) {

                        storage.bidHistory =
                            {};

                    }


                    const bidId =
                        `${Date.now()}_${currentUser.uid}`;


                    storage.bidHistory[
                        bidId
                    ] = {

                        uid:
                            currentUser.uid,

                        username:
                            player.username ||
                            "Unknown",

                        amount:
                            newBid,

                        timestamp:
                            Date.now()

                    };


                    data.storages[
                        index
                    ] =
                        storage;


                    data.phase =
                        "open";

                    data.callNumber =
                        0;

                    data.phaseStartedAt =
                        Date.now();


                    return data;

                }
            );


        if (
            !result.committed
        ) {

            showBidStatus(
                "Bid rejected. Try again."
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
   AUCTION SCHEDULER
========================================================= */

function scheduleAuctionProgress() {

    if (schedulerTimer) {

        clearTimeout(
            schedulerTimer
        );

        schedulerTimer =
            null;

    }


    if (!auctionData) {

        return;

    }


    if (
        auctionData.status ===
        "finished"
    ) {

        return;

    }


    /*
        Only the host controls progression.
    */

    if (
        auctionData.hostId !==
        currentUser?.uid
    ) {

        return;

    }


    const phase =
        auctionData.phase ||
        "open";


    const startedAt =
        Number(
            auctionData.phaseStartedAt
        ) || Date.now();


    let delay;


    if (
        phase === "open"
    ) {

        delay =
            CALL_DELAY;

    }

    else if (
        phase === "call"
    ) {

        if (
            Number(
                auctionData.callNumber
            ) >= 3
        ) {

            delay =
                SOLD_DELAY;

        }

        else {

            delay =
                CALL_DELAY;

        }

    }

    else if (
        phase === "sold"
    ) {

        delay =
            1800;

    }

    else if (
        phase === "preparing"
    ) {

        delay =
            1200;

    }

    else {

        return;

    }


    const elapsed =
        Date.now() -
        startedAt;


    const remaining =
        Math.max(
            100,
            delay - elapsed
        );


    schedulerTimer =
        setTimeout(
            function () {

                advanceAuction();

            },
            remaining
        );

}


/* =========================================================
   ADVANCE AUCTION
========================================================= */

async function advanceAuction() {

    if (
        !auctionData ||
        auctionData.hostId !==
        currentUser?.uid
    ) {

        return;

    }


    const auctionRef =
        ref(
            database,
            `${AUCTION_PATH}/${roomId}`
        );


    try {

        await runTransaction(
            auctionRef,
            function (data) {

                if (!data) {

                    return;

                }


                if (
                    data.status ===
                    "finished"
                ) {

                    return;

                }


                const phase =
                    data.phase ||
                    "open";


                const round =
                    Number(
                        data.currentRound
                    ) || 1;


                /*
                    OPEN -> GOING ONCE
                */

                if (
                    phase ===
                    "open"
                ) {

                    data.phase =
                        "call";

                    data.callNumber =
                        1;

                    data.phaseStartedAt =
                        Date.now();

                    return data;

                }


                /*
                    GOING ONCE -> GOING TWICE
                */

                if (
                    phase ===
                    "call" &&
                    Number(
                        data.callNumber
                    ) === 1
                ) {

                    data.callNumber =
                        2;

                    data.phaseStartedAt =
                        Date.now();

                    return data;

                }


                /*
                    GOING TWICE -> FINAL CALL
                */

                if (
                    phase ===
                    "call" &&
                    Number(
                        data.callNumber
                    ) === 2
                ) {

                    data.callNumber =
                        3;

                    data.phaseStartedAt =
                        Date.now();

                    return data;

                }


                /*
                    FINAL CALL -> SOLD
                */

                if (
                    phase ===
                    "call" &&
                    Number(
                        data.callNumber
                    ) === 3
                ) {

                    const storage =
                        data.storages?.[
                            round - 1
                        ];


                    if (!storage) {

                        return;

                    }


                    const winnerId =
                        storage.currentBidder;


                    const finalPrice =
                        Number(
                            storage.currentBid
                        ) ||
                        Number(
                            storage.basePrice
                        ) ||
                        0;


                    /*
                        There was a winner.
                    */

                    if (winnerId) {

                        const winner =
                            data.players?.[
                                winnerId
                            ];


                        if (winner) {

                            winner.chaosPoints =
                                Math.max(
                                    0,
                                    (
                                        Number(
                                            winner.chaosPoints
                                        ) || 0
                                    ) -
                                    finalPrice
                                );


                            winner.spent =
                                (
                                    Number(
                                        winner.spent
                                    ) || 0
                                ) +
                                finalPrice;


                            winner.bought =
                                (
                                    Number(
                                        winner.bought
                                    ) || 0
                                ) +
                                1;


                            if (
                                !winner.items
                            ) {

                                winner.items =
                                    {};

                            }


                            winner.items[
                                String(round)
                            ] = {

                                name:
                                    storage.name,

                                icon:
                                    storage.icon,

                                value:
                                    Number(
                                        storage.estimatedValue
                                    ) || 0,

                                price:
                                    finalPrice

                            };

                        }


                        storage.result =
                            "sold";

                    }

                    else {

                        storage.result =
                            "unsold";

                    }


                    data.storages[
                        round - 1
                    ] =
                        storage;


                    data.phase =
                        "sold";

                    data.phaseStartedAt =
                        Date.now();

                    return data;

                }


                /*
                    SOLD -> NEXT UNIT
                */

                if (
                    phase ===
                    "sold"
                ) {

                    if (
                        round >=
                        TOTAL_ROUNDS
                    ) {

                        data.status =
                            "finished";

                        data.phase =
                            "finished";

                        data.finishedAt =
                            Date.now();

                        return data;

                    }


                    data.currentRound =
                        round + 1;

                    data.phase =
                        "preparing";

                    data.callNumber =
                        0;

                    data.currentBid =
                        0;

                    data.currentBidder =
                        null;

                    data.currentBidderName =
                        null;

                    data.phaseStartedAt =
                        Date.now();

                    return data;

                }


                /*
                    PREPARING -> OPEN
                */

                if (
                    phase ===
                    "preparing"
                ) {

                    const nextStorage =
                        data.storages?.[
                            round - 1
                        ];


                    if (
                        !nextStorage
                    ) {

                        return;

                    }


                    data.phase =
                        "open";

                    data.callNumber =
                        0;

                    data.phaseStartedAt =
                        Date.now();

                    return data;

                }


                return;

            }
        );

    }

    catch (error) {

        console.error(
            "Auction progression failed:",
            error
        );

    }

}


/* =========================================================
   BIDDER LIST
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

            const item =
                document.createElement(
                    "div"
                );

            item.className =
                "bidder";


            item.innerHTML = `

                <span class="bidder-name">
                    ${escapeHTML(
                        bid.username
                    )}
                </span>

                <span class="bidder-amount">
                    ${Number(
                        bid.amount
                    ) || 0} CP
                </span>

            `;


            biddersList.appendChild(
                item
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
                    ${Number(
                        storage.basePrice
                    ) || 0} CP
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
                    ${Number(
                        bid.amount
                    ) || 0} CP
                </strong>

            `;


            auctionLog.appendChild(
                item
            );

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
   FINAL RESULTS
========================================================= */

function showFinalResults() {

    if (!resultsCard) {

        return;

    }


    resultsCard.classList.remove(
        "hidden"
    );


    document
        .querySelector(
            ".hero"
        )
        ?.classList.add(
            "hidden"
        );


    document
        .querySelector(
            ".player-bar"
        )
        ?.classList.add(
            "hidden"
        );


    document
        .querySelector(
            ".auction-status-card"
        )
        ?.classList.add(
            "hidden"
        );


    document
        .querySelector(
            ".storage-card"
        )
        ?.classList.add(
            "hidden"
        );


    document
        .querySelector(
            ".bid-card"
        )
        ?.classList.add(
            "hidden"
        );


    document
        .querySelector(
            ".players-card"
        )
        ?.classList.add(
            "hidden"
        );


    document
        .querySelector(
            ".log-card"
        )
        ?.classList.add(
            "hidden"
        );


    const results =
        calculateResults();


    renderPodium(
        results
    );


    renderOtherBuyers(
        results
    );


    renderNonBuyers(
        results
    );

}


/* =========================================================
   CALCULATE RESULTS
========================================================= */

function calculateResults() {

    const allPlayers =
        Object.values(
            auctionData.players ||
            {}
        );


    const results = {};


    allPlayers.forEach(
        function (player) {

            results[
                player.uid
            ] = {

                uid:
                    player.uid,

                username:
                    player.username ||
                    "Unknown",

                spent:
                    Number(
                        player.spent
                    ) || 0,

                bought:
                    Number(
                        player.bought
                    ) || 0,

                profit:
                    0

            };

        }
    );


    const storages =
        auctionData.storages ||
        [];


    storages.forEach(
        function (storage) {

            const winner =
                storage.currentBidder;


            if (!winner) {

                return;

            }


            if (
                !results[winner]
            ) {

                return;

            }


            const value =
                Number(
                    storage.estimatedValue
                ) || 0;


            const price =
                Number(
                    storage.currentBid
                ) || 0;


            results[winner].profit +=
                value -
                price;

        }
    );


    const ranked =
        Object.values(
            results
        )
        .sort(
            function (a, b) {

                return (
                    b.profit -
                    a.profit
                );

            }
        );


    return {

        ranked:
            ranked,

        buyers:
            ranked.filter(
                function (player) {

                    return (
                        player.bought >
                        0
                    );

                }
            ),

        nonBuyers:
            ranked.filter(
                function (player) {

                    return (
                        player.bought ===
                        0
                    );

                }
            )

    };

}


/* =========================================================
   PODIUM
========================================================= */

function renderPodium(
    results
) {

    if (!podium) {

        return;

    }


    podium.innerHTML =
        "";


    const positions = [

        {
            index: 1,
            className: "second",
            medal: "🥈"
        },

        {
            index: 0,
            className: "first",
            medal: "🥇"
        },

        {
            index: 2,
            className: "third",
            medal: "🥉"
        }

    ];


    positions.forEach(
        function (position) {

            const player =
                results.ranked[
                    position.index
                ];


            if (!player) {

                return;

            }


            const element =
                document.createElement(
                    "div"
                );


            element.className =
                `podium-player ${position.className}`;


            element.innerHTML = `

                <div class="position">
                    ${position.medal}
                </div>

                <div class="result-name">
                    ${escapeHTML(
                        player.username
                    )}
                </div>

                <div class="result-profit ${
                    player.profit >= 0
                        ? "profit"
                        : "loss"
                }">

                    ${
                        player.profit >= 0
                            ? "+"
                            : ""
                    }${player.profit} CP

                </div>

            `;


            podium.appendChild(
                element
            );

        }
    );

}


/* =========================================================
   OTHER BUYERS
========================================================= */

function renderOtherBuyers(
    results
) {

    if (!otherBuyers) {

        return;

    }


    otherBuyers.innerHTML =
        "";


    results.buyers
        .slice(3)
        .forEach(
            function (
                player,
                index
            ) {

                addResultItem(
                    otherBuyers,
                    player,
                    `#${index + 4}`
                );

            }
        );


    if (
        otherBuyers.children.length ===
        0
    ) {

        otherBuyers.innerHTML = `

            <div class="result-item">
                No other buyers.
            </div>

        `;

    }

}


/* =========================================================
   NON BUYERS
========================================================= */

function renderNonBuyers(
    results
) {

    if (!nonBuyers) {

        return;

    }


    nonBuyers.innerHTML =
        "";


    results.nonBuyers.forEach(
        function (player) {

            addResultItem(
                nonBuyers,
                player,
                "NO BUY"
            );

        }
    );


    if (
        nonBuyers.children.length ===
        0
    ) {

        nonBuyers.innerHTML = `

            <div class="result-item">
                Everyone bought at least one unit.
            </div>

        `;

    }

}


/* =========================================================
   RESULT ITEM
========================================================= */

function addResultItem(
    container,
    player,
    position
) {

    const item =
        document.createElement(
            "div"
        );


    item.className =
        "result-item";


    item.innerHTML = `

        <span>
            ${position}
            ${escapeHTML(
                player.username
            )}
        </span>

        <strong class="${
            player.profit >= 0
                ? "profit"
                : "loss"
        }">

            ${
                player.profit >= 0
                    ? "+"
                    : ""
            }${player.profit} CP

        </strong>

    `;


    container.appendChild(
        item
    );

}


/* =========================================================
   RETURN LOBBY
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
        value ?? "";

    return div.innerHTML;

}
