import {
    ref,
    get,
    onValue,
    runTransaction
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-database.js";

import {
    getAuth,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

import { app, database } from "../firebase.js";


/* =========================================================
   GAME RULES
   ========================================================= */

const ROOM_PATH = "chaosAuctionRooms";
const STARTING_CASH = 1000;
const BID_INCREMENT = 10;
const TOTAL_STORAGES = 5;

const GOING_ONCE_MS = 3000;
const GOING_TWICE_MS = 3000;
const SOLD_DELAY_MS = 2000;


/* =========================================================
   STORAGE CONFIGURATION
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
 * These values stay in Firebase but are never rendered before SOLD.
 */
const HIDDEN_CP_VALUES = [
    650,
    900,
    1250,
    1650,
    2200
];


const auth = getAuth(app);


/* =========================================================
   DOM
   ========================================================= */

const backButton =
    document.getElementById("backButton");

const roomCodeDisplay =
    document.getElementById("roomCodeDisplay");

const playerName =
    document.getElementById("playerName");

const playerCash =
    document.getElementById("playerCash");

const playerPoints =
    document.getElementById("playerPoints");

const roundDisplay =
    document.getElementById("roundDisplay");


const storageNumber =
    document.getElementById("storageNumber");

const storageNumberLarge =
    document.getElementById("storageNumberLarge");

const auctionStatus =
    document.getElementById("auctionStatus");

const auctionMessage =
    document.getElementById("auctionMessage");


const callProgress =
    document.getElementById("callProgress");

const callText =
    document.getElementById("callText");

const callBar1 =
    document.getElementById("callBar1");

const callBar2 =
    document.getElementById("callBar2");

const callBar3 =
    document.getElementById("callBar3");


const storageTitle =
    document.getElementById("storageTitle");

const storageItems =
    document.getElementById("storageItems");

const estimatedRange =
    document.getElementById("estimatedRange");

const basePrice =
    document.getElementById("basePrice");


const currentBid =
    document.getElementById("currentBid");

const currentBidder =
    document.getElementById("currentBidder");

const nextBid =
    document.getElementById("nextBid");

const bidButton =
    document.getElementById("bidButton");

const bidStatus =
    document.getElementById("bidStatus");


const bidderCount =
    document.getElementById("bidderCount");

const biddersList =
    document.getElementById("biddersList");

const auctionLog =
    document.getElementById("auctionLog");


const soldReveal =
    document.getElementById("soldReveal");

const soldWinner =
    document.getElementById("soldWinner");

const revealedCP =
    document.getElementById("revealedCP");

const revealedBid =
    document.getElementById("revealedBid");

const soldProfit =
    document.getElementById("soldProfit");


const resultsCard =
    document.getElementById("resultsCard");

const myResult =
    document.getElementById("myResult");

const podium =
    document.getElementById("podium");

const finalLeaderboard =
    document.getElementById("finalLeaderboard");

const returnLobbyButton =
    document.getElementById("returnLobbyButton");


/* =========================================================
   STATE
   ========================================================= */

let currentUser = null;
let currentRoom = null;
let currentRoomCode = null;
let localUserData = null;

let unsubscribeRoom = null;

let hostTimer = null;
let hostTimerToken = null;

let initializationInProgress = false;
let rewardUpdateInProgress = false;


/* =========================================================
   ROOM
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
   AUTH
   ========================================================= */

onAuthStateChanged(
    auth,
    async (user) => {

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

        const snapshot =
            await get(
                ref(
                    database,
                    `users/${currentUser.uid}`
                )
            );


        if (snapshot.exists()) {

            localUserData =
                snapshot.val();

        }

        else {

            localUserData = {

                username:
                    currentUser.displayName ||
                    "Player",

                chaosPoints:
                    0

            };

        }


        if (playerName) {

            playerName.textContent =
                localUserData.username ||
                currentUser.displayName ||
                "Player";

        }


        renderPersistentCP();

    }

    catch (error) {

        console.error(
            "Unable to load user:",
            error
        );

    }

}


async function refreshUserPoints() {

    try {

        const snapshot =
            await get(
                ref(
                    database,
                    `users/${currentUser.uid}`
                )
            );


        if (snapshot.exists()) {

            localUserData =
                snapshot.val();

            renderPersistentCP();

        }

    }

    catch (error) {

        console.error(
            "Unable to refresh CP:",
            error
        );

    }

}


function renderPersistentCP() {

    if (playerPoints) {

        playerPoints.textContent =
            formatNumber(
                Number(
                    localUserData?.chaosPoints
                ) || 0
            );

    }

}


/* =========================================================
   ROOM LISTENER
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
            (snapshot) => {

                if (!snapshot.exists()) {

                    clearHostTimer();

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


                /*
                 * IMPORTANT:
                 *
                 * Initialization is checked before
                 * getCurrentStorage().
                 *
                 * This fixes the broken state where Firebase
                 * says "playing" but storages were never created.
                 */

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


    if (!room) {

        return;

    }


    if (roomCodeDisplay) {

        roomCodeDisplay.textContent =
            room.code ||
            currentRoomCode;

    }


    const me =
        room.players?.[
            currentUser.uid
        ];


    if (me) {

        if (playerName) {

            playerName.textContent =
                me.username ||
                "Player";

        }


        if (playerCash) {

            playerCash.textContent =
                formatNumber(
                    Number.isFinite(
                        Number(me.cash)
                    )
                        ? Number(me.cash)
                        : STARTING_CASH
                );

        }

    }


    renderPersistentCP();


    if (
        room.status ===
        "finished"
    ) {

        clearHostTimer();

        showFinalResults();

        return;

    }


    const round =
        Math.max(
            1,
            Math.min(
                TOTAL_STORAGES,
                Number(
                    room.currentRound
                ) || 1
            )
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
            `#${round}`;

    }


    const storage =
        getCurrentStorage();


    if (!storage) {

        /*
         * Host will repair/initialize this.
         * Other players simply see preparation state.
         */

        if (auctionStatus) {

            auctionStatus.textContent =
                "PREPARING AUCTION...";

        }


        if (auctionMessage) {

            auctionMessage.textContent =
                "The auctioneer is preparing the next storage unit.";

        }


        if (bidButton) {

            bidButton.disabled =
                true;

        }


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


    renderAuctionState(
        storage
    );


    updateBidButton(
        storage
    );


    renderSoldReveal();

}


/* =========================================================
   CURRENT STORAGE
   ========================================================= */

function getCurrentStorage() {

    if (
        !currentRoom ||
        !currentRoom.storages
    ) {

        return null;

    }


    const index =
        (
            Number(
                currentRoom.currentRound
            ) || 1
        ) - 1;


    return (
        currentRoom.storages[index] ||
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
            ([icon, name]) => {

                const element =
                    document.createElement(
                        "div"
                    );


                element.className =
                    "storage-item";


                element.innerHTML = `
                    <div class="storage-item-icon">
                        ${icon}
                    </div>

                    <div class="storage-item-name">
                        ${escapeHTML(name)}
                    </div>
                `;


                storageItems.appendChild(
                    element
                );

            }
        );

    }


    const bid =
        storage.currentBid === null ||
        storage.currentBid === undefined
            ? 0
            : Number(
                storage.currentBid
            );


    if (currentBid) {

        currentBid.textContent =
            `${formatNumber(
                bid ||
                Number(
                    storage.basePrice
                ) ||
                0
            )} CASH`;

    }


    if (nextBid) {

        const next =
            bid > 0
                ? bid + BID_INCREMENT
                : Number(
                    storage.basePrice
                ) || 0;


        nextBid.textContent =
            `${formatNumber(next)} CASH`;

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


    if (callProgress) {

        callProgress.classList.toggle(
            "hidden",
            state === "bidding" ||
            state === "sold"
        );

    }


    if (state === "bidding") {

        if (auctionStatus) {

            auctionStatus.textContent =
                "BIDDING OPEN";

        }


        if (auctionMessage) {

            auctionMessage.textContent =
                "Every bid increases the price by exactly 10 Cash.";

        }


        if (callText) {

            callText.textContent =
                "";

        }


        setCallBars(0);

        return;

    }


    if (state === "going_once") {

        if (auctionStatus) {

            auctionStatus.textContent =
                "GOING ONCE";

        }


        if (auctionMessage) {

            auctionMessage.textContent =
                "No higher bid yet. You still have time to bid.";

        }


        if (callText) {

            callText.textContent =
                "GOING ONCE";

        }


        setCallBars(1);

        return;

    }


    if (state === "going_twice") {

        if (auctionStatus) {

            auctionStatus.textContent =
                "GOING TWICE";

        }


        if (auctionMessage) {

            auctionMessage.textContent =
                "Last chance. Place a higher bid to continue.";

        }


        if (callText) {

            callText.textContent =
                "GOING TWICE";

        }


        setCallBars(2);

        return;

    }


    if (state === "sold") {

        if (auctionStatus) {

            auctionStatus.textContent =
                "SOLD!";

        }


        if (auctionMessage) {

            auctionMessage.textContent =
                storage.currentBidderName
                    ? `Sold to ${storage.currentBidderName}. Opening the box...`
                    : "No one bought this storage unit.";

        }


        if (callText) {

            callText.textContent =
                storage.currentBidderName
                    ? "SOLD"
                    : "UNSOLD";

        }


        setCallBars(3);

    }

}


function setCallBars(stage) {

    callBar1?.classList.toggle(
        "active",
        stage >= 1
    );

    callBar2?.classList.toggle(
        "active",
        stage >= 2
    );

    callBar3?.classList.toggle(
        "active",
        stage >= 3
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
        storage.currentBid === null ||
        storage.currentBid === undefined
            ? Number(
                storage.basePrice
            ) || 0
            : Number(
                storage.currentBid
            );


    const proposedBid =
        current > 0
            ? current + BID_INCREMENT
            : Number(
                storage.basePrice
            ) || 0;


    const player =
        currentRoom.players?.[
            currentUser.uid
        ];


    const cash =
        Number(
            player?.cash
        );


    /*
     * Cash is NOT deducted when bidding.
     *
     * It is only checked here so a player cannot
     * make a bid they could not afford if they win.
     */

    const affordable =
        Number.isFinite(cash) &&
        proposedBid <= cash;


    bidButton.disabled =
        state !== "bidding" ||
        !affordable ||
        currentRoom.status === "finished";


    bidButton.textContent =
        affordable
            ? `🔨 BID +${
                state === "bidding" &&
                current > 0
                    ? BID_INCREMENT
                    : 0
            } CASH`
            : "💸 NOT ENOUGH CASH";


    /*
     * On a fresh storage the first bid is
     * the starting price.
     *
     * After that every bid is exactly +10.
     */

    if (
        state === "bidding" &&
        current ===
            Number(
                storage.basePrice
            )
    ) {

        bidButton.textContent =
            `🔨 OPEN AT ${formatNumber(current)} CASH`;

    }

}


/* =========================================================
   PLACE BID
   ========================================================= */

bidButton?.addEventListener(
    "click",
    placeBid
);


async function placeBid() {

    if (
        !currentUser ||
        !currentRoomCode
    ) {

        return;

    }


    const roomRef =
        ref(
            database,
            `${ROOM_PATH}/${currentRoomCode}`
        );


    try {

        const result =
            await runTransaction(
                roomRef,
                (room) => {

                    if (
                        !room ||
                        room.status ===
                            "finished"
                    ) {

                        return;

                    }


                    const round =
                        Number(
                            room.currentRound
                        ) || 1;


                    if (
                        round < 1 ||
                        round > TOTAL_STORAGES ||
                        !room.players?.[
                            currentUser.uid
                        ]
                    ) {

                        return;

                    }


                    const storage =
                        room.storages?.[
                            round - 1
                        ];


                    if (
                        !storage ||
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


                    if (
                        !Number.isFinite(cash)
                    ) {

                        return;

                    }


                    const hasBidder =
                        Boolean(
                            storage.currentBidder
                        );


                    const current =
                        hasBidder
                            ? Number(
                                storage.currentBid
                            )
                            : Number(
                                storage.basePrice
                            );


                    const proposedBid =
                        hasBidder
                            ? current +
                              BID_INCREMENT
                            : current;


                    if (
                        !Number.isFinite(
                            proposedBid
                        ) ||
                        proposedBid > cash
                    ) {

                        return;

                    }


                    /*
                     * IMPORTANT:
                     *
                     * NO CASH IS DEDUCTED HERE.
                     *
                     * The player only proves they can afford
                     * the bid.
                     *
                     * The winner pays the winning bid exactly
                     * once when the storage is SOLD.
                     */

                    storage.currentBid =
                        proposedBid;


                    storage.currentBidder =
                        currentUser.uid;


                    storage.currentBidderName =
                        player.username ||
                        "Player";


                    storage.lastBidAt =
                        Date.now();


                    storage.state =
                        "bidding";


                    if (
                        !storage.bidHistory
                    ) {

                        storage.bidHistory =
                            {};

                    }


                    const bidId =
                        `${Date.now()}_${
                            currentUser.uid
                        }_${Math.random()
                            .toString(36)
                            .slice(2, 8)}`;


                    storage.bidHistory[
                        bidId
                    ] = {

                        uid:
                            currentUser.uid,

                        username:
                            player.username ||
                            "Player",

                        amount:
                            proposedBid,

                        timestamp:
                            Date.now()

                    };


                    room.storages[
                        round - 1
                    ] =
                        storage;


                    room.lastActionAt =
                        Date.now();


                    return room;

                }
            );


        if (
            !result.committed
        ) {

            showBidStatus(
                "Bid rejected. Another bid may have changed the auction."
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


    /*
     * SELF-HEAL INITIALIZATION
     *
     * A previous broken room could have:
     *
     * status = "playing"
     * auctionInitialized = true
     * storages = missing
     *
     * That state previously caused the host engine
     * to return forever.
     *
     * We only repair startup state.
     */

    const round =
        Number(
            currentRoom.currentRound
        ) || 1;


    const storagesValid =
        Array.isArray(
            currentRoom.storages
        ) &&
        currentRoom.storages.length ===
            TOTAL_STORAGES &&
        currentRoom.storages[0] &&
        Number(
            currentRoom.storages[0].basePrice
        ) > 0;


    const needsStartupRepair =
        round === 1 &&
        (
            !currentRoom.auctionInitialized ||
            !storagesValid
        );


    if (
        (
            currentRoom.status ===
                "starting" ||
            currentRoom.status ===
                "playing"
        ) &&
        needsStartupRepair
    ) {

        initializeAuction();

        return;

    }


    const storage =
        getCurrentStorage();


    if (!storage) {

        /*
         * If a later round is somehow missing,
         * finish safely rather than freezing forever.
         */

        if (round > 1) {

            finalizeGameSafely();

        }

        return;

    }


    const state =
        storage.state ||
        "bidding";


    if (state === "bidding") {

        /*
         * Do nothing until a bid exists.
         */

        clearHostTimer();


        if (
            storage.currentBidder
        ) {

            scheduleGoingOnce();

        }


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
   INITIALIZE / REPAIR AUCTION
   ========================================================= */

async function initializeAuction() {

    if (
        initializationInProgress
    ) {

        return;

    }


    initializationInProgress =
        true;


    try {

        const roomRef =
            ref(
                database,
                `${ROOM_PATH}/${currentRoomCode}`
            );


        const result =
            await runTransaction(
                roomRef,
                (room) => {

                    if (!room) {

                        return;

                    }


                    const round =
                        Number(
                            room.currentRound
                        ) || 1;


                    /*
                     * Never reset an auction after
                     * it has moved past round 1.
                     */

                    if (
                        round !== 1
                    ) {

                        return;

                    }


                    const players =
                        room.players ||
                        {};


                    /*
                     * Give every player exactly
                     * 1,000 starting Cash.
                     *
                     * CP is NOT touched.
                     */

                    Object.entries(
                        players
                    ).forEach(
                        ([uid, player]) => {

                            players[uid] = {

                                ...player,

                                cash:
                                    STARTING_CASH,

                                startingCash:
                                    STARTING_CASH,

                                totalSpent:
                                    0,

                                totalCP:
                                    0,

                                boxesWon:
                                    0,

                                profit:
                                    0,

                                rewardApplied:
                                    false

                            };

                        }
                    );


                    const storages =
                        STORAGE_TYPES.map(
                            (
                                config,
                                index
                            ) => ({

                                number:
                                    index + 1,

                                title:
                                    config.title,

                                estimatedRange:
                                    config.estimate,

                                basePrice:
                                    config.basePrice,

                                /*
                                 * Hidden until SOLD
                                 */

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

                                lastBidAt:
                                    null,

                                bidHistory:
                                    {},

                                sold:
                                    false,

                                winnerCP:
                                    0,

                                winningBid:
                                    0,

                                winnerId:
                                    null,

                                winnerName:
                                    null,

                                soldAt:
                                    null

                            })
                        );


                    room.players =
                        players;


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


                    room.leaderboardApplied =
                        false;


                    return room;

                }
            );


        if (
            !result.committed
        ) {

            console.warn(
                "Auction initialization was not committed."
            );

        }

    }

    catch (error) {

        console.error(
            "Auction initialization failed:",
            error
        );

    }

    finally {

        initializationInProgress =
            false;

    }

}


/* =========================================================
   HOST TIMERS
   ========================================================= */

function scheduleGoingOnce() {

    if (hostTimer) {

        return;

    }


    const storage =
        getCurrentStorage();


    if (
        !storage?.currentBidder
    ) {

        return;

    }


    const lastBidAt =
        Number(
            storage.lastBidAt
        ) ||
        getLastBidTime(
            storage
        ) ||
        Date.now();


    const remaining =
        Math.max(
            GOING_ONCE_MS -
                (
                    Date.now() -
                    lastBidAt
                ),
            0
        );


    setHostTimer(
        async () => {

            const latest =
                getCurrentStorage();


            if (
                !latest ||
                latest.state !==
                    "bidding" ||
                !latest.currentBidder
            ) {

                return;

            }


            const latestBidAt =
                Number(
                    latest.lastBidAt
                ) ||
                getLastBidTime(
                    latest
                );


            /*
             * If somebody bid while the timer
             * was waiting, wait a full 3 seconds
             * from that new bid.
             */

            const elapsed =
                Date.now() -
                latestBidAt;


            if (
                elapsed <
                GOING_ONCE_MS
            ) {

                scheduleGoingOnce();

                return;

            }


            await changeStorageState(
                "going_once"
            );

        },
        remaining
    );

}


function scheduleGoingTwice() {

    if (hostTimer) {

        return;

    }


    setHostTimer(
        async () => {

            const latest =
                getCurrentStorage();


            if (
                !latest ||
                latest.state !==
                    "going_once"
            ) {

                return;

            }


            await changeStorageState(
                "going_twice"
            );

        },
        GOING_TWICE_MS
    );

}


function scheduleSold() {

    if (hostTimer) {

        return;

    }


    setHostTimer(
        async () => {

            const latest =
                getCurrentStorage();


            if (
                !latest ||
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


function scheduleNextRound() {

    if (hostTimer) {

        return;

    }


    setHostTimer(
        async () => {

            const latest =
                getCurrentStorage();


            if (
                !latest ||
                latest.state !==
                    "sold"
            ) {

                return;

            }


            await moveToNextRound();

        },
        SOLD_DELAY_MS
    );

}


function setHostTimer(
    callback,
    delay
) {

    const token =
        `${Date.now()}_${Math.random()}`;


    hostTimerToken =
        token;


    hostTimer =
        setTimeout(
            async () => {

                hostTimer =
                    null;


                if (
                    hostTimerToken !==
                    token
                ) {

                    return;

                }


                await callback();

            },
            delay
        );

}


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
        (room) => {

            if (
                !room ||
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


            if (
                newState ===
                    "going_once" &&
                (
                    storage.state !==
                        "bidding" ||
                    !storage.currentBidder
                )
            ) {

                return;

            }


            if (
                newState ===
                    "going_twice" &&
                storage.state !==
                    "going_once"
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
            (room) => {

                if (
                    !room ||
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


                if (
                    !storage ||
                    storage.state !==
                        "going_twice"
                ) {

                    return;

                }


                const winnerId =
                    storage.currentBidder;


                /*
                 * Nobody bid:
                 *
                 * Mark UNSOLD and continue.
                 */

                if (!winnerId) {

                    storage.state =
                        "sold";


                    storage.sold =
                        true;


                    storage.winnerCP =
                        0;


                    storage.winningBid =
                        0;


                    storage.winnerId =
                        null;


                    storage.winnerName =
                        null;


                    storage.soldAt =
                        Date.now();


                    room.storages[index] =
                        storage;


                    room.lastActionAt =
                        Date.now();


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
                 * FINAL CASH DEDUCTION
                 *
                 * Cash was never deducted during bidding.
                 *
                 * The winner pays the winning bid exactly once NOW.
                 */

                const winnerCash =
                    Number(
                        winner.cash
                    );


                if (
                    !Number.isFinite(
                        winnerCash
                    ) ||
                    winnerCash <
                        winningBid
                ) {

                    /*
                     * This should normally be impossible
                     * because every bid checked affordability.
                     */

                    return;

                }


                winner.cash =
                    winnerCash -
                    winningBid;


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
                    winner.totalCP -
                    winner.totalSpent;


                storage.state =
                    "sold";


                storage.sold =
                    true;


                storage.winnerCP =
                    hiddenCP;


                storage.winningBid =
                    winningBid;


                storage.winnerId =
                    winnerId;


                storage.winnerName =
                    winner.username ||
                    "Player";


                storage.soldAt =
                    Date.now();


                room.players[
                    winnerId
                ] =
                    winner;


                room.storages[index] =
                    storage;


                room.lastActionAt =
                    Date.now();


                return room;

            }
        );


    if (
        !result.committed
    ) {

        return;

    }

}


/* =========================================================
   NEXT STORAGE / FINISH
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
            (room) => {

                if (
                    !room ||
                    room.status ===
                        "finished"
                ) {

                    return;

                }


                const round =
                    Number(
                        room.currentRound
                    ) || 1;


                const currentStorage =
                    room.storages?.[
                        round - 1
                    ];


                if (
                    !currentStorage ||
                    currentStorage.state !==
                        "sold"
                ) {

                    return;

                }


                /*
                 * FINAL STORAGE
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


                const nextIndex =
                    round;


                const nextStorage =
                    room.storages?.[
                        nextIndex
                    ];


                if (!nextStorage) {

                    finalizeGame(
                        room
                    );

                    return room;

                }


                /*
                 * Each storage starts fresh.
                 *
                 * Previous storage data remains untouched.
                 */

                nextStorage.state =
                    "bidding";


                nextStorage.currentBid =
                    null;


                nextStorage.currentBidder =
                    null;


                nextStorage.currentBidderName =
                    null;


                nextStorage.lastBidAt =
                    null;


                nextStorage.bidHistory =
                    {};


                nextStorage.sold =
                    false;


                nextStorage.winnerCP =
                    0;


                nextStorage.winningBid =
                    0;


                nextStorage.winnerId =
                    null;


                nextStorage.winnerName =
                    null;


                nextStorage.soldAt =
                    null;


                room.currentRound =
                    round + 1;


                room.storages[
                    nextIndex
                ] =
                    nextStorage;


                room.lastActionAt =
                    Date.now();


                return room;

            }
        );


    if (
        result.committed &&
        result.snapshot?.val?.status ===
            "finished"
    ) {

        await applyLeaderboardRewards(
            result.snapshot.val()
        );

    }

}


/* =========================================================
   SAFE FINALIZATION
   ========================================================= */

async function finalizeGameSafely() {

    const roomRef =
        ref(
            database,
            `${ROOM_PATH}/${currentRoomCode}`
        );


    const result =
        await runTransaction(
            roomRef,
            (room) => {

                if (
                    !room ||
                    room.status ===
                        "finished"
                ) {

                    return;

                }


                finalizeGame(
                    room
                );


                return room;

            }
        );


    if (
        result.committed &&
        result.snapshot?.val()?.status ===
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


    Object.values(
        players
    ).forEach(
        (player) => {

            player.totalSpent =
                Number(
                    player.totalSpent
                ) || 0;


            player.totalCP =
                Number(
                    player.totalCP
                ) || 0;


            player.profit =
                player.totalCP -
                player.totalSpent;


            player.finalReward =
                player.totalCP;

        }
    );


    const ranked =
        Object.entries(
            players
        ).sort(
            ([, a], [, b]) => {

                const profitDifference =
                    (
                        Number(
                            b.profit
                        ) || 0
                    ) -
                    (
                        Number(
                            a.profit
                        ) || 0
                    );


                if (
                    profitDifference !==
                    0
                ) {

                    return profitDifference;

                }


                return (
                    (
                        Number(
                            b.totalCP
                        ) || 0
                    ) -
                    (
                        Number(
                            a.totalCP
                        ) || 0
                    )
                );

            }
        );


    ranked.forEach(
        ([, player], index) => {

            player.finalRank =
                index + 1;

        }
    );


    room.players =
        players;


    room.leaderboardApplied =
        false;


    room.finishedAt =
        Date.now();


    return room;

}


/* =========================================================
   PERSIST CP TO GLOBAL LEADERBOARD
   ========================================================= */

async function applyLeaderboardRewards(
    finishedRoom
) {

    if (
        rewardUpdateInProgress ||
        finishedRoom?.status !==
            "finished"
    ) {

        return;

    }


    rewardUpdateInProgress =
        true;


    try {

        /*
         * One room-level transaction claims
         * the leaderboard update.
         *
         * This prevents every player's browser
         * from adding CP multiple times.
         */

        const roomRef =
            ref(
                database,
                `${ROOM_PATH}/${currentRoomCode}`
            );


        const claim =
            await runTransaction(
                roomRef,
                (room) => {

                    if (
                        !room ||
                        room.status !==
                            "finished"
                    ) {

                        return;

                    }


                    if (
                        room.leaderboardApplied
                    ) {

                        return;

                    }


                    room.leaderboardApplied =
                        true;


                    return room;

                }
            );


        if (
            !claim.committed
        ) {

            return;

        }


        const players =
            claim.snapshot
                .val()
                ?.players ||
            {};


        /*
         * Host browser performs actual
         * persistent CP updates.
         */

        for (
            const [
                uid,
                player
            ]
            of Object.entries(players)
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


            const pointsRef =
                ref(
                    database,
                    `users/${uid}/chaosPoints`
                );


            await runTransaction(
                pointsRef,
                (existingPoints) =>
                    (
                        Number(
                            existingPoints
                        ) || 0
                    ) +
                    reward
            );

        }


        await refreshUserPoints();

    }

    catch (error) {

        console.error(
            "Unable to update leaderboard:",
            error
        );

    }

    finally {

        rewardUpdateInProgress =
            false;

    }

}


/* =========================================================
   BIDDERS
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
        ).sort(
            (a, b) =>
                (
                    Number(
                        b.timestamp
                    ) || 0
                ) -
                (
                    Number(
                        a.timestamp
                    ) || 0
                )
        );


    if (bidderCount) {

        bidderCount.textContent =
            bids.length;

    }


    if (!bids.length) {

        biddersList.innerHTML =
            `
            <div class="empty-bidders">
                No bids yet.
            </div>
            `;

        return;

    }


    bids.forEach(
        (bid) => {

            const element =
                document.createElement(
                    "div"
                );


            element.className =
                "bidder";


            const current =
                bid.uid ===
                storage.currentBidder
                    ? " 🔨"
                    : "";


            element.innerHTML =
                `
                <span class="bidder-name">
                    ${escapeHTML(
                        bid.username ||
                        "Player"
                    )}${current}
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
        ).sort(
            (a, b) =>
                (
                    Number(
                        a.timestamp
                    ) || 0
                ) -
                (
                    Number(
                        b.timestamp
                    ) || 0
                )
        );


    const opening =
        document.createElement(
            "div"
        );


    opening.className =
        "log-item";


    opening.innerHTML =
        `
        Auction opened at
        <strong>
            ${formatNumber(
                Number(
                    storage.basePrice
                ) || 0
            )} CASH
        </strong>
        `;


    auctionLog.appendChild(
        opening
    );


    bids.forEach(
        (bid) => {

            const item =
                document.createElement(
                    "div"
                );


            item.className =
                "log-item";


            item.innerHTML =
                `
                <strong>
                    ${escapeHTML(
                        bid.username ||
                        "Player"
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


    if (
        storage.state ===
        "going_once"
    ) {

        addLogMessage(
            "Auctioneer: GOING ONCE..."
        );

    }


    if (
        storage.state ===
        "going_twice"
    ) {

        addLogMessage(
            "Auctioneer: GOING TWICE..."
        );

    }


    if (
        storage.state ===
        "sold"
    ) {

        if (
            storage.winnerName
        ) {

            addLogMessage(
                `Auctioneer: SOLD to ${storage.winnerName}!`
            );

        }

        else {

            addLogMessage(
                "Auctioneer: UNSOLD."
            );

        }

    }

}


function addLogMessage(
    message
) {

    const item =
        document.createElement(
            "div"
        );


    item.className =
        "log-item";


    item.textContent =
        message;


    auctionLog.appendChild(
        item
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
        !storage.sold ||
        !soldReveal
    ) {

        soldReveal?.classList.add(
            "hidden"
        );

        return;

    }


    soldReveal.classList.remove(
        "hidden"
    );


    if (soldWinner) {

        soldWinner.textContent =
            storage.winnerName ||
            "NO WINNER";

    }


    if (revealedCP) {

        revealedCP.textContent =
            `${formatNumber(
                Number(
                    storage.winnerCP
                ) || 0
            )} CP`;

    }


    if (revealedBid) {

        revealedBid.textContent =
            `${formatNumber(
                Number(
                    storage.winningBid
                ) || 0
            )} CASH`;

    }


    const value =
        Number(
            storage.winnerCP
        ) || 0;


    const price =
        Number(
            storage.winningBid
        ) || 0;


    const profit =
        value -
        price;


    if (soldProfit) {

        soldProfit.textContent =
            `${
                profit >= 0
                    ? "+"
                    : ""
            }${formatNumber(
                profit
            )} CP`;


        soldProfit.className =
            profit >= 0
                ? "profit"
                : "loss";

    }

}


/* =========================================================
   FINAL RESULTS
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


    soldReveal?.classList.add(
        "hidden"
    );


    resultsCard.classList.remove(
        "hidden"
    );


    renderResults();


    /*
     * Only the host should attempt the
     * persistent leaderboard update.
     */

    if (
        currentUser?.uid ===
        currentRoom?.hostId
    ) {

        applyLeaderboardRewards(
            currentRoom
        );

    }

}


/* =========================================================
   RENDER RESULTS
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
        ).sort(
            ([, a], [, b]) =>
                (
                    Number(
                        a.finalRank
                    ) || 9999
                ) -
                (
                    Number(
                        b.finalRank
                    ) || 9999
                )
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


        myResult.innerHTML =
            `
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
                )} CP PROFIT / LOSS

            </div>
            `;

    }


    renderPodium(
        entries
    );


    renderFinalLeaderboard(
        entries
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
        [
            1,
            0,
            2
        ];


    order.forEach(
        (index) => {

            const entry =
                top[index];


            if (!entry) {

                return;

            }


            const [
                uid,
                player
            ] =
                entry;


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


            element.innerHTML =
                `
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
        ([uid, player]) => {

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


            const cp =
                Number(
                    player.totalCP
                ) || 0;


            const spent =
                Number(
                    player.totalSpent
                ) || 0;


            row.innerHTML =
                `
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

                    <small
                        style="
                            display:block;
                            color:#777;
                            font-weight:400;
                            margin-top:3px
                        "
                    >
                        ${formatNumber(
                            cp
                        )} CP
                        •
                        ${formatNumber(
                            spent
                        )} CASH SPENT
                    </small>

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
   NAVIGATION
   ========================================================= */

backButton?.addEventListener(
    "click",
    () => {

        clearHostTimer();

        window.location.href =
            "caulobby.html";

    }
);


returnLobbyButton?.addEventListener(
    "click",
    () => {

        clearHostTimer();

        window.location.href =
            "caulobby.html";

    }
);


/* =========================================================
   HELPERS
   ========================================================= */

function getLastBidTime(
    storage
) {

    const history =
        storage?.bidHistory ||
        {};


    const bids =
        Object.values(
            history
        );


    if (!bids.length) {

        return 0;

    }


    return Math.max(
        ...bids.map(
            (bid) =>
                Number(
                    bid.timestamp
                ) || 0
        )
    );

}


function showBidStatus(
    message
) {

    if (!bidStatus) {

        return;

    }


    bidStatus.textContent =
        message;


    setTimeout(
        () => {

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


function formatNumber(
    number
) {

    return Number(
        number || 0
    ).toLocaleString(
        "en-US"
    );

}


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
