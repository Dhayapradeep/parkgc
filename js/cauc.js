import {
    ref,
    onValue,
    runTransaction,
    get,
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


/* =========================
   AUTH
========================= */

const auth =
    getAuth(app);


/* =========================
   ELEMENTS
========================= */

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

const callBadge =
    document.getElementById("callBadge");

const storageIcon =
    document.getElementById("storageIcon");

const storageCategory =
    document.getElementById("storageCategory");

const storageTitle =
    document.getElementById("storageTitle");

const storageDescription =
    document.getElementById("storageDescription");

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


/* =========================
   STATE
========================= */

let currentUser = null;

let roomId = null;

let roomData = null;

let players = {};

let currentRound = 1;

let selectedBid = 10;

let unsubscribeRoom = null;

let auctioneerInterval = null;

let lastRenderedLogSignature = "";


/*
    There is deliberately NO visible timer.

    These values control the auctioneer calls internally.

    OPEN
      ↓
    1st CALL
      ↓
    2nd CALL
      ↓
    3rd CALL
      ↓
    SOLD
*/

const CALL_DELAY = 4000;


/* =========================
   ROOM ID
========================= */

const params =
    new URLSearchParams(
        window.location.search
    );

roomId =
    params.get("room");


if (!roomId) {

    alert(
        "No auction room found."
    );

    window.location.href =
        "caulobby.html";

}


/* =========================
   BACK
========================= */

if (backButton) {

    backButton.addEventListener(
        "click",
        function () {

            window.location.href =
                `caulobby.html?room=${roomId}`;

        }
    );

}


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

        await loadUser();

        listenToAuction();

    }
);


/* =========================
   LOAD USER
========================= */

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

            if (playerName) {

                playerName.textContent =
                    currentUser.displayName ||
                    "Unknown";

            }

            return;

        }

        const data =
            snapshot.val();

        if (playerName) {

            playerName.textContent =
                data.username ||
                currentUser.displayName ||
                "Unknown";

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
   LISTEN TO AUCTION
========================= */

function listenToAuction() {

    const auctionRef =
        ref(
            database,
            `chaosAuctions/${roomId}`
        );

    unsubscribeRoom =
        onValue(
            auctionRef,
            function (snapshot) {

                if (!snapshot.exists()) {

                    alert(
                        "Auction room no longer exists."
                    );

                    window.location.href =
                        "caulobby.html";

                    return;

                }

                roomData =
                    snapshot.val();

                players =
                    roomData.players ||
                    {};

                currentRound =
                    Number(
                        roomData.currentRound
                    ) || 1;

                renderAuction();

                startAuctioneer();

            }
        );

}


/* =========================
   RENDER AUCTION
========================= */

function renderAuction() {

    if (
        roomCodeDisplay &&
        roomData.code
    ) {

        roomCodeDisplay.textContent =
            roomData.code;

    }


    if (
        roomData.status ===
        "finished"
    ) {

        stopAuctioneer();

        showFinalResults();

        return;

    }


    if (roundDisplay) {

        roundDisplay.textContent =
            `${currentRound} / 10`;

    }


    if (storageNumber) {

        storageNumber.textContent =
            currentRound;

    }


    const storage =
        roomData.storages &&
        roomData.storages[
            currentRound - 1
        ];


    if (!storage) {

        return;

    }


    if (storageIcon) {

        storageIcon.textContent =
            storage.icon ||
            "📦";

    }


    if (storageCategory) {

        storageCategory.textContent =
            storage.category ||
            "MYSTERY";

    }


    if (storageTitle) {

        storageTitle.textContent =
            storage.name ||
            `UNIT #${currentRound}`;

    }


    if (storageDescription) {

        storageDescription.textContent =
            storage.description ||
            "A mysterious item.";

    }


    if (estimatedValue) {

        estimatedValue.textContent =
            `${Number(storage.estimatedValue) || 0} CP`;

    }


    if (basePrice) {

        basePrice.textContent =
            `${Number(storage.basePrice) || 0} CP`;

    }


    const bid =
        Number(storage.currentBid) > 0
            ? Number(storage.currentBid)
            : Number(storage.basePrice) || 0;


    if (currentBid) {

        currentBid.textContent =
            `${bid} CP`;

    }


    if (currentBidder) {

        currentBidder.textContent =
            storage.currentBidderName ||
            "NO BIDS YET";

    }


    renderCallStatus(storage);

    renderBidders(storage);

    renderAuctionLog(storage);

    updatePlayerPoints();

    updateBidControls(storage);

}


/* =========================
   AUCTION CALL DISPLAY
========================= */

function renderCallStatus(storage) {

    const call =
        Number(storage.callNumber) || 0;


    if (
        storage.sold
    ) {

        if (auctionStatus) {

            auctionStatus.textContent =
                "SOLD";

        }

        if (auctionMessage) {

            auctionMessage.textContent =
                `${storage.currentBidderName || "Player"} bought the lot for ${storage.currentBid} CP.`;

        }

        if (callBadge) {

            callBadge.textContent =
                "SOLD";

        }

        return;

    }


    if (call === 0) {

        if (auctionStatus) {

            auctionStatus.textContent =
                "AUCTION OPEN";

        }

        if (auctionMessage) {

            auctionMessage.textContent =
                storage.currentBidderName
                    ? `Going at ${storage.currentBid} CP. Any advance?`
                    : "Who wants to make the opening bid?";

        }

        if (callBadge) {

            callBadge.textContent =
                "OPEN";

        }

        return;

    }


    if (call === 1) {

        if (auctionStatus) {

            auctionStatus.textContent =
                "GOING ONCE";

        }

        if (auctionMessage) {

            auctionMessage.textContent =
                `Going once at ${storage.currentBid} CP...`;

        }

        if (callBadge) {

            callBadge.textContent =
                "1ST CALL";

        }

        return;

    }


    if (call === 2) {

        if (auctionStatus) {

            auctionStatus.textContent =
                "GOING TWICE";

        }

        if (auctionMessage) {

            auctionMessage.textContent =
                `Going twice at ${storage.currentBid} CP...`;

        }

        if (callBadge) {

            callBadge.textContent =
                "2ND CALL";

        }

        return;

    }


    if (call === 3) {

        if (auctionStatus) {

            auctionStatus.textContent =
                "LAST CALL";

        }

        if (auctionMessage) {

            auctionMessage.textContent =
                `Final call at ${storage.currentBid} CP...`;

        }

        if (callBadge) {

            callBadge.textContent =
                "3RD CALL";

        }

    }

}


/* =========================
   AUCTIONEER ENGINE
========================= */

function startAuctioneer() {

    stopAuctioneer();

    if (
        !currentUser ||
        !roomData
    ) {

        return;

    }

    if (
        roomData.status !==
        "playing"
    ) {

        return;

    }

    if (
        roomData.hostId !==
        currentUser.uid
    ) {

        return;

    }

    auctioneerInterval =
        setInterval(
            auctioneerTick,
            1000
        );

}


function stopAuctioneer() {

    if (auctioneerInterval) {

        clearInterval(
            auctioneerInterval
        );

        auctioneerInterval =
            null;

    }

}


/* =========================
   AUCTIONEER TICK
========================= */

async function auctioneerTick() {

    if (
        !roomData ||
        !currentUser
    ) {

        return;

    }

    if (
        roomData.hostId !==
        currentUser.uid
    ) {

        stopAuctioneer();

        return;

    }

    if (
        roomData.status !==
        "playing"
    ) {

        stopAuctioneer();

        return;

    }

    const index =
        (
            Number(
                roomData.currentRound
            ) || 1
        ) - 1;

    const storage =
        roomData.storages?.[index];


    if (!storage) {

        return;

    }


    if (storage.sold) {

        return;

    }


    /*
        If nobody has bid yet,
        don't start "going once".
    */

    if (
        !storage.currentBidder
    ) {

        return;

    }


    const lastBidAt =
        Number(
            storage.lastBidAt
        ) || 0;


    const elapsed =
        Date.now() -
        lastBidAt;


    /*
        A player gets CALL_DELAY
        milliseconds to respond.
    */

    if (
        elapsed <
        CALL_DELAY
    ) {

        return;

    }


    const callNumber =
        Number(
            storage.callNumber
        ) || 0;


    if (
        callNumber < 3
    ) {

        await advanceCall(
            callNumber + 1
        );

        return;

    }


    await sellCurrentLot();

}


/* =========================
   ADVANCE CALL
========================= */

async function advanceCall(
    nextCall
) {

    const auctionRef =
        ref(
            database,
            `chaosAuctions/${roomId}`
        );

    try {

        await runTransaction(
            auctionRef,
            function (data) {

                if (!data) {

                    return;

                }

                if (
                    data.status !==
                    "playing"
                ) {

                    return;

                }

                if (
                    data.hostId !==
                    currentUser.uid
                ) {

                    return;

                }

                const index =
                    (
                        Number(
                            data.currentRound
                        ) || 1
                    ) - 1;

                const storage =
                    data.storages?.[index];


                if (!storage) {

                    return;

                }


                if (storage.sold) {

                    return;

                }


                if (
                    !storage.currentBidder
                ) {

                    return;

                }


                const elapsed =
                    Date.now() -
                    (
                        Number(
                            storage.lastBidAt
                        ) || 0
                    );


                if (
                    elapsed <
                    CALL_DELAY
                ) {

                    return;

                }


                if (
                    Number(
                        storage.callNumber
                    ) !==
                    nextCall - 1
                ) {

                    return;

                }


                storage.callNumber =
                    nextCall;

                storage.callText =
                    nextCall === 1
                        ? "GOING ONCE"
                        : nextCall === 2
                            ? "GOING TWICE"
                            : "LAST CALL";


                storage.callAt =
                    Date.now();


                data.storages[index] =
                    storage;


                return data;

            }
        );

    }

    catch (error) {

        console.error(
            "Auctioneer call failed:",
            error
        );

    }

}


/* =========================
   SELL LOT
========================= */

async function sellCurrentLot() {

    const auctionRef =
        ref(
            database,
            `chaosAuctions/${roomId}`
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
                        data.status !==
                        "playing"
                    ) {

                        return;

                    }

                    if (
                        data.hostId !==
                        currentUser.uid
                    ) {

                        return;

                    }

                    const index =
                        (
                            Number(
                                data.currentRound
                            ) || 1
                        ) - 1;

                    const storage =
                        data.storages?.[index];


                    if (!storage) {

                        return;

                    }


                    if (storage.sold) {

                        return;

                    }


                    if (
                        !storage.currentBidder
                    ) {

                        return;

                    }


                    if (
                        Number(
                            storage.callNumber
                        ) !== 3
                    ) {

                        return;

                    }


                    const winnerId =
                        storage.currentBidder;

                    const price =
                        Number(
                            storage.currentBid
                        ) || 0;


                    const winner =
                        data.players?.[winnerId];


                    if (winner) {

                        winner.bought =
                            Number(
                                winner.bought
                            ) + 1;

                        winner.spent =
                            Number(
                                winner.spent
                            ) + price;

                        winner.chaosPoints =
                            Math.max(
                                0,
                                (
                                    Number(
                                        winner.chaosPoints
                                    ) || 0
                                ) - price
                            );

                    }


                    storage.sold =
                        true;

                    storage.soldAt =
                        Date.now();

                    storage.callText =
                        "SOLD";


                    data.storages[index] =
                        storage;


                    /*
                        Move to next lot.
                    */

                    if (
                        index >=
                        data.storages.length - 1
                    ) {

                        data.status =
                            "finished";

                        data.finishedAt =
                            Date.now();

                    }

                    else {

                        data.currentRound =
                            index + 2;

                    }


                    data.players[winnerId] =
                        winner;


                    return data;

                }
            );


        if (
            result.committed
        ) {

            /*
                Refresh the local state immediately.
            */

            roomData =
                result.snapshot.val();

            players =
                roomData.players || {};

            currentRound =
                Number(
                    roomData.currentRound
                ) || 1;

            renderAuction();

        }

    }

    catch (error) {

        console.error(
            "Unable to sell lot:",
            error
        );

    }

}


/* =========================
   UPDATE PLAYER POINTS
========================= */

function updatePlayerPoints() {

    if (
        !currentUser ||
        !players
    ) {

        return;

    }

    const me =
        players[
            currentUser.uid
        ];

    if (!me) {

        return;

    }

    const points =
        Number(
            me.chaosPoints
        ) || 0;


    if (playerPoints) {

        playerPoints.textContent =
            `${points} CP`;

    }

}


/* =========================
   BID CONTROLS
========================= */

function updateBidControls(
    storage
) {

    const current =
        Number(
            storage.currentBid
        ) ||
        Number(
            storage.basePrice
        ) ||
        0;

    const nextBid =
        current +
        selectedBid;

    if (bidIncrement) {

        bidIncrement.textContent =
            selectedBid;

    }

    if (bidButton) {

        const points =
            getLocalUserPoints();

        bidButton.disabled =
            nextBid >
            points;

    }

}


/* =========================
   LOCAL CP
========================= */

function getLocalUserPoints() {

    const me =
        players?.[
            currentUser?.uid
        ];

    if (me) {

        return Number(
            me.chaosPoints
        ) || 0;

    }

    return 0;

}


/* =========================
   BID INCREMENT
========================= */

if (bidPlusButton) {

    bidPlusButton.addEventListener(
        "click",
        function () {

            selectedBid += 10;

            if (bidIncrement) {

                bidIncrement.textContent =
                    selectedBid;

            }

            const storage =
                roomData?.storages?.[
                    currentRound - 1
                ];

            if (storage) {

                updateBidControls(
                    storage
                );

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

            if (bidIncrement) {

                bidIncrement.textContent =
                    selectedBid;

            }

            const storage =
                roomData?.storages?.[
                    currentRound - 1
                ];

            if (storage) {

                updateBidControls(
                    storage
                );

            }

        }
    );

}


/* =========================
   PLACE BID
========================= */

if (bidButton) {

    bidButton.addEventListener(
        "click",
        placeBid
    );

}


async function placeBid() {

    if (
        !currentUser ||
        !roomId
    ) {

        return;

    }


    const auctionRef =
        ref(
            database,
            `chaosAuctions/${roomId}`
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
                        data.status !==
                        "playing"
                    ) {

                        return;

                    }


                    const index =
                        (
                            Number(
                                data.currentRound
                            ) || 1
                        ) - 1;


                    const storage =
                        data.storages?.[
                            index
                        ];


                    if (!storage) {

                        return;

                    }


                    if (storage.sold) {

                        return;

                    }


                    const me =
                        data.players?.[
                            currentUser.uid
                        ];


                    if (!me) {

                        return;

                    }


                    const current =
                        Number(
                            storage.currentBid
                        ) ||
                        Number(
                            storage.basePrice
                        ) ||
                        0;


                    const newBid =
                        current +
                        selectedBid;


                    const points =
                        Number(
                            me.chaosPoints
                        ) || 0;


                    if (
                        points <
                        newBid
                    ) {

                        return;

                    }


                    /*
                        Every bid resets
                        the classical call.
                    */

                    storage.currentBid =
                        newBid;

                    storage.currentBidder =
                        currentUser.uid;

                    storage.currentBidderName =
                        me.username ||
                        "Unknown";

                    storage.callNumber =
                        0;

                    storage.callText =
                        "OPEN FOR BIDDING";

                    storage.lastBidAt =
                        Date.now();


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
                            me.username ||
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


                    return data;

                }
            );


        if (
            !result.committed
        ) {

            showBidStatus(
                "Bid rejected. Check your CP or wait for another bid."
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
            "Something went wrong."
        );

    }

}


/* =========================
   BID STATUS
========================= */

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

            bidStatus.textContent =
                "";

        },
        2500
    );

}


/* =========================
   BIDDERS
========================= */

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
        Object.values(history)
            .sort(
                function (a, b) {

                    return (
                        b.timestamp -
                        a.timestamp
                    );

                }
            );


    if (bidderCount) {

        bidderCount.textContent =
            bids.length;

    }


    if (!bids.length) {

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
                document.createElement("div");

            element.className =
                "bidder";

            element.innerHTML = `

                <span class="bidder-name">

                    ${escapeHTML(
                        bid.username
                    )}

                </span>

                <span class="bidder-amount">

                    ${Number(bid.amount)} CP

                </span>

            `;

            biddersList.appendChild(
                element
            );

        }
    );

}


/* =========================
   AUCTION LOG
========================= */

function renderAuctionLog(
    storage
) {

    if (!auctionLog) {

        return;

    }

    const history =
        storage.bidHistory ||
        {};

    const bids =
        Object.values(history)
            .sort(
                function (a, b) {

                    return (
                        a.timestamp -
                        b.timestamp
                    );

                }
            );


    const signature =
        JSON.stringify({
            round: currentRound,
            bids: bids.length,
            call: storage.callNumber,
            sold: storage.sold
        });


    if (
        signature ===
        lastRenderedLogSignature
    ) {

        return;

    }


    lastRenderedLogSignature =
        signature;


    auctionLog.innerHTML =
        "";


    const opening =
        document.createElement("div");

    opening.className =
        "log-item";

    opening.innerHTML = `

        Auction opened at

        <strong>
            ${Number(storage.basePrice)} CP
        </strong>

    `;

    auctionLog.appendChild(
        opening
    );


    bids.forEach(
        function (bid) {

            const item =
                document.createElement("div");

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
                    ${Number(bid.amount)} CP
                </strong>

            `;

            auctionLog.appendChild(
                item
            );

        }
    );


    if (
        Number(
            storage.callNumber
        ) > 0
    ) {

        const call =
            document.createElement("div");

        call.className =
            "log-item";

        call.innerHTML = `

            <strong>
                ${escapeHTML(
                    storage.callText
                )}
            </strong>

            at

            <strong>
                ${Number(storage.currentBid)} CP
            </strong>

        `;

        auctionLog.appendChild(
            call
        );

    }


    if (storage.sold) {

        const sold =
            document.createElement("div");

        sold.className =
            "log-item";

        sold.innerHTML = `

            <strong>
                SOLD
            </strong>

            to

            <strong>
                ${escapeHTML(
                    storage.currentBidderName
                )}
            </strong>

            for

            <strong>
                ${Number(storage.currentBid)} CP
            </strong>

        `;

        auctionLog.appendChild(
            sold
        );

    }


    auctionLog.scrollTop =
        auctionLog.scrollHeight;

}


/* =========================
   FINAL RESULTS
========================= */

function showFinalResults() {

    if (!resultsCard) {

        return;

    }

    resultsCard.classList.remove(
        "hidden"
    );


    const results =
        calculateResults();


    renderPodium(results);

    renderOtherBuyers(results);

    renderNonBuyers(results);


    document
        .querySelector(".auction-status-card")
        ?.classList.add("hidden");

    document
        .querySelector(".storage-card")
        ?.classList.add("hidden");

    document
        .querySelector(".bid-card")
        ?.classList.add("hidden");

    document
        .querySelector(".players-card")
        ?.classList.add("hidden");

    document
        .querySelector(".log-card")
        ?.classList.add("hidden");

}


/* =========================
   CALCULATE RESULTS
========================= */

function calculateResults() {

    const allPlayers =
        Object.values(players);


    const playerResults =
        {};


    allPlayers.forEach(
        function (player) {

            playerResults[
                player.uid
            ] = {

                uid:
                    player.uid,

                username:
                    player.username ||
                    "Unknown",

                profit:
                    0,

                bought:
                    Number(
                        player.bought
                    ) || 0,

                spent:
                    Number(
                        player.spent
                    ) || 0

            };

        }
    );


    const storages =
        roomData.storages ||
        [];


    Object.values(storages)
        .forEach(
            function (storage) {

                if (
                    !storage.sold ||
                    !storage.currentBidder
                ) {

                    return;

                }


                const player =
                    playerResults[
                        storage.currentBidder
                    ];


                if (!player) {

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


                player.profit +=
                    value -
                    price;

            }
        );


    const ranked =
        Object.values(
            playerResults
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

        ranked,

        buyers:
            ranked.filter(
                function (player) {

                    return (
                        player.bought > 0
                    );

                }
            ),

        nonBuyers:
            ranked.filter(
                function (player) {

                    return (
                        player.bought === 0
                    );

                }
            )

    };

}


/* =========================
   PODIUM
========================= */

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


            const div =
                document.createElement("div");

            div.className =
                `podium-player ${position.className}`;


            div.innerHTML = `

                <div class="position">

                    ${position.medal}

                </div>


                <div class="result-name">

                    ${escapeHTML(
                        player.username
                    )}

                </div>


                <div class="
                    result-profit
                    ${
                        player.profit >= 0
                            ? "profit"
                            : "loss"
                    }
                ">

                    ${
                        player.profit >= 0
                            ? "+"
                            : ""
                    }${player.profit} CP

                </div>

            `;


            podium.appendChild(div);

        }
    );

}


/* =========================
   OTHER BUYERS
========================= */

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
            function (player, index) {

                addResultItem(
                    otherBuyers,
                    player,
                    `#${index + 4}`
                );

            }
        );


    if (
        !otherBuyers.children.length
    ) {

        otherBuyers.innerHTML = `
            <div class="result-item">
                No other buyers.
            </div>
        `;

    }

}


/* =========================
   NON BUYERS
========================= */

function renderNonBuyers(
    results
) {

    if (!nonBuyers) {

        return;

    }

    nonBuyers.innerHTML =
        "";


    results.nonBuyers
        .forEach(
            function (player) {

                addResultItem(
                    nonBuyers,
                    player,
                    "NO BUY"
                );

            }
        );


    if (
        !nonBuyers.children.length
    ) {

        nonBuyers.innerHTML = `
            <div class="result-item">
                Everyone bought at least one item.
            </div>
        `;

    }

}


/* =========================
   RESULT ITEM
========================= */

function addResultItem(
    container,
    player,
    position
) {

    const item =
        document.createElement("div");

    item.className =
        "result-item";


    item.innerHTML = `

        <span>

            ${position}

            ${escapeHTML(
                player.username
            )}

        </span>


        <strong
            class="${
                player.profit >= 0
                    ? "profit"
                    : "loss"
            }"
        >

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


/* =========================
   RETURN LOBBY
========================= */

if (returnLobbyButton) {

    returnLobbyButton.addEventListener(
        "click",
        function () {

            window.location.href =
                "caulobby.html";

        }
    );

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