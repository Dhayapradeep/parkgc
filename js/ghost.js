import {
    ref,
    get,
    set,
    update,
    onValue,
    push,
    runTransaction
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
   SETTINGS
========================= */

const GAME_DURATION =
    10 * 60 * 1000;

const CLUE_INTERVAL =
    60 * 1000;

const MAX_CLUES =
    5;

const GHOST_REWARD =
    500;

const JOKER_REWARD =
    500;

const FIGHTER_REWARD =
    500;


/* =========================
   AUTH
========================= */

const auth =
    getAuth(app);


/* =========================
   ROOM CODE
========================= */

const params =
    new URLSearchParams(
        window.location.search
    );

const roomCode =
    params.get("room");


if (!roomCode) {

    window.location.href =
        "globby.html";

}


/* =========================
   ELEMENTS
========================= */

const loadingCard =
    document.getElementById(
        "loadingCard"
    );

const loadingText =
    document.getElementById(
        "loadingText"
    );

const gameContent =
    document.getElementById(
        "gameContent"
    );

const gameTimer =
    document.getElementById(
        "gameTimer"
    );

const gamePhase =
    document.getElementById(
        "gamePhase"
    );

const roleIcon =
    document.getElementById(
        "roleIcon"
    );

const roleName =
    document.getElementById(
        "roleName"
    );

const roleDescription =
    document.getElementById(
        "roleDescription"
    );

const clueStatus =
    document.getElementById(
        "clueStatus"
    );

const clueText =
    document.getElementById(
        "clueText"
    );

const letterReveal =
    document.getElementById(
        "letterReveal"
    );

const playersAlive =
    document.getElementById(
        "playersAlive"
    );

const chatMessages =
    document.getElementById(
        "chatMessages"
    );

const chatInput =
    document.getElementById(
        "chatInput"
    );

const sendButton =
    document.getElementById(
        "sendButton"
    );

const votingSection =
    document.getElementById(
        "votingSection"
    );

const votingPlayers =
    document.getElementById(
        "votingPlayers"
    );

const voteStatus =
    document.getElementById(
        "voteStatus"
    );

const waitingResults =
    document.getElementById(
        "waitingResults"
    );

const votesProgress =
    document.getElementById(
        "votesProgress"
    );

const resultSection =
    document.getElementById(
        "resultSection"
    );

const resultIcon =
    document.getElementById(
        "resultIcon"
    );

const resultSmallTitle =
    document.getElementById(
        "resultSmallTitle"
    );

const resultTitle =
    document.getElementById(
        "resultTitle"
    );

const resultDescription =
    document.getElementById(
        "resultDescription"
    );

const revealedGhost =
    document.getElementById(
        "revealedGhost"
    );

const rewardAmount =
    document.getElementById(
        "rewardAmount"
    );

const leaveGameButton =
    document.getElementById(
        "leaveGameButton"
    );

const backToLobbyButton =
    document.getElementById(
        "backToLobbyButton"
    );


/* =========================
   VARIABLES
========================= */

let currentUser =
    null;

let currentRoom =
    null;

let currentPlayer =
    null;

let timerInterval =
    null;

let currentPhase =
    null;

let roomListenerStarted =
    false;

let chatListenerStarted =
    false;

let chatEventsSetup =
    false;

let votingTransitionStarted =
    false;

let startingTransitionStarted =
    false;

let rewardDistributionStarted =
    false;


/* =========================
   ROLE DATA
========================= */

const roles = {

    ghost: {

        icon: "👻",

        name: "GHOST",

        description:
            "Stay hidden. Confuse the group and avoid being voted out."

    },

    joker: {

        icon: "🃏",

        name: "JOKER",

        description:
            "Cause chaos. If a Joker gets voted out, all Jokers receive the reward."

    },

    fighter: {

        icon: "⚔️",

        name: "FIGHTER",

        description:
            "Find the Ghost. Study the clues and vote carefully."

    }

};


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

        currentUser =
            user;

        await loadGame();

    }
);


/* =========================
   LOAD GAME
========================= */

async function loadGame() {

    try {

        loadingText.textContent =
            "CONNECTING TO THE GAME...";


        const roomRef =
            ref(
                database,
                `ghostRooms/${roomCode}`
            );


        const snapshot =
            await get(roomRef);


        if (!snapshot.exists()) {

            loadingText.textContent =
                "ROOM DOES NOT EXIST.";

            return;

        }


        currentRoom =
            snapshot.val();


        const players =
            currentRoom.players ||
            {};


        currentPlayer =
            players[
                currentUser.uid
            ];


        if (!currentPlayer) {

            loadingText.textContent =
                "YOU ARE NOT PART OF THIS GAME.";

            return;

        }


        setupChatEvents();

        startRoomListener();

        startChatListener();


        loadingCard.classList.add(
            "hidden"
        );

        gameContent.classList.remove(
            "hidden"
        );


        renderPlayerInfo();

        updatePlayerCount();

        updateGameState();

    }

    catch (error) {

        console.error(
            "GAME LOAD ERROR:",
            error
        );

        loadingText.textContent =
            "FAILED TO LOAD GAME.";

    }

}


/* =========================
   ROOM LISTENER
========================= */

function startRoomListener() {

    if (
        roomListenerStarted
    ) {

        return;

    }


    roomListenerStarted =
        true;


    const roomRef =
        ref(
            database,
            `ghostRooms/${roomCode}`
        );


    onValue(
        roomRef,
        function (snapshot) {

            if (!snapshot.exists()) {

                showDisconnectedMessage();

                return;

            }


            currentRoom =
                snapshot.val();


            const players =
                currentRoom.players ||
                {};


            currentPlayer =
                players[
                    currentUser.uid
                ];


            if (!currentPlayer) {

                showDisconnectedMessage();

                return;

            }


            renderPlayerInfo();

            updatePlayerCount();

            updateGameState();

            updateVoteProgress();


            if (
                currentRoom.status ===
                "finished"
            ) {

                distributeRewardsOnce();

            }

        }
    );

}


/* =========================
   PLAYER INFO
========================= */

function renderPlayerInfo() {

    if (!currentPlayer) {

        return;

    }


    const role =
        roles[
            currentPlayer.role
        ];


    if (!role) {

        roleIcon.textContent =
            "❓";

        roleName.textContent =
            "ASSIGNING...";

        roleDescription.textContent =
            "Your role is being assigned.";

        return;

    }


    roleIcon.textContent =
        role.icon;

    roleName.textContent =
        role.name;

    roleDescription.textContent =
        role.description;

}


/* =========================
   PLAYER COUNT
========================= */

function updatePlayerCount() {

    if (!currentRoom) {

        return;

    }


    const players =
        currentRoom.players ||
        {};


    const activePlayers =
        Object.values(players)
            .filter(
                function (player) {

                    return !player.leftGame;

                }
            );


    playersAlive.textContent =
        `${activePlayers.length} PLAYERS`;

}


/* =========================
   GAME STATE
========================= */

function updateGameState() {

    if (!currentRoom) {

        return;

    }


    const status =
        currentRoom.status;


    if (
        status === "starting"
    ) {

        showStartingInterface();

        startTimer();

        return;

    }


    if (
        status === "playing"
    ) {

        showPlayingInterface();

        startTimer();

        return;

    }


    if (
        status === "voting"
    ) {

        showVotingInterface();

        return;

    }


    if (
        status === "finished"
    ) {

        showFinalResult();

    }

}


/* =========================
   STARTING INTERFACE
========================= */

function showStartingInterface() {

    currentPhase =
        "starting";


    votingSection.classList.add(
        "hidden"
    );

    waitingResults.classList.add(
        "hidden"
    );

    resultSection.classList.add(
        "hidden"
    );


    gamePhase.textContent =
        "THE GAME IS ABOUT TO BEGIN";


    chatInput.disabled =
        true;

    sendButton.disabled =
        true;

}


/* =========================
   PLAYING INTERFACE
========================= */

function showPlayingInterface() {

    if (
        currentPhase === "playing"
    ) {

        return;

    }


    currentPhase =
        "playing";


    votingSection.classList.add(
        "hidden"
    );

    waitingResults.classList.add(
        "hidden"
    );

    resultSection.classList.add(
        "hidden"
    );


    gamePhase.textContent =
        "THE INVESTIGATION HAS BEGUN";


    chatInput.disabled =
        false;

    sendButton.disabled =
        false;

}


/* =========================
   TIMER
========================= */

function startTimer() {

    if (timerInterval) {

        calculateTime();

        return;

    }


    calculateTime();


    timerInterval =
        setInterval(
            calculateTime,
            1000
        );

}


/* =========================
   CALCULATE TIME
========================= */

function calculateTime() {

    if (!currentRoom) {

        return;

    }


    const status =
        currentRoom.status;


    const gameStartAt =
        Number(
            currentRoom.gameStartAt
        );


    if (!gameStartAt) {

        gameTimer.textContent =
            "10:00";

        return;

    }


    const now =
        Date.now();


    /*
    3 SECOND START COUNTDOWN
    */

    if (
        status === "starting"
    ) {

        const untilStart =
            Math.max(
                0,
                gameStartAt - now
            );


        const seconds =
            Math.ceil(
                untilStart / 1000
            );


        gameTimer.textContent =
            `00:0${Math.min(seconds, 9)}`;


        if (
            untilStart <= 0
        ) {

            gameTimer.textContent =
                "10:00";

            transitionToPlaying();

        }


        return;

    }


    /*
    GAMEPLAY TIMER
    */

    if (
        status !== "playing"
    ) {

        return;

    }


    const elapsed =
        now -
        gameStartAt;


    const remaining =
        Math.max(
            0,
            GAME_DURATION -
            elapsed
        );


    const minutes =
        Math.floor(
            remaining / 60000
        );


    const seconds =
        Math.floor(
            (remaining % 60000) /
            1000
        );


    gameTimer.textContent =
        `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;


    updateClues(
        elapsed
    );


    if (
        remaining <= 0
    ) {

        gameTimer.textContent =
            "00:00";


        transitionToVoting();

    }

}


/* =========================
   TRANSITION TO PLAYING
========================= */

async function transitionToPlaying() {

    if (
        startingTransitionStarted
    ) {

        return;

    }


    startingTransitionStarted =
        true;


    try {

        const roomRef =
            ref(
                database,
                `ghostRooms/${roomCode}`
            );


        await runTransaction(
            roomRef,
            function (room) {

                if (!room) {

                    return room;

                }


                if (
                    room.status === "starting" &&
                    Date.now() >=
                    Number(room.gameStartAt)
                ) {

                    room.status =
                        "playing";

                }


                return room;

            }
        );

    }

    catch (error) {

        console.error(
            "PLAYING TRANSITION ERROR:",
            error
        );

    }

}


/* =========================
   TRANSITION TO VOTING
========================= */

async function transitionToVoting() {

    if (
        votingTransitionStarted
    ) {

        return;

    }


    votingTransitionStarted =
        true;


    try {

        const roomRef =
            ref(
                database,
                `ghostRooms/${roomCode}`
            );


        await runTransaction(
            roomRef,
            function (room) {

                if (!room) {

                    return room;

                }


                const startTime =
                    Number(
                        room.gameStartAt
                    );


                const gameEnded =
                    Date.now() >=
                    startTime +
                    GAME_DURATION;


                if (
                    room.status === "playing" &&
                    gameEnded
                ) {

                    room.status =
                        "voting";

                    room.votingStartAt =
                        Date.now();

                }


                return room;

            }
        );

    }

    catch (error) {

        console.error(
            "VOTING TRANSITION ERROR:",
            error
        );

    }

}


/* =========================
   CLUES
========================= */

function updateClues(
    elapsed
) {

    if (!currentRoom) {

        return;

    }


    const players =
        currentRoom.players ||
        {};


    let ghost =
        null;


    Object.values(players)
        .forEach(
            function (player) {

                if (
                    player.role ===
                    "ghost"
                ) {

                    ghost =
                        player;

                }

            }
        );


    if (!ghost) {

        return;

    }


    const username =
        String(
            ghost.username ||
            "GHOST"
        );


    const letters =
        username
            .replace(/\s/g, "")
            .split("");


    if (
        elapsed < CLUE_INTERVAL
    ) {

        clueStatus.textContent =
            "WAITING";

        clueText.textContent =
            "The Ghost is still hiding.";

        letterReveal.textContent =
            letters
                .map(
                    function () {

                        return "•";

                    }
                )
                .join(" ");

        return;

    }


    const clueCount =
        Math.min(
            MAX_CLUES,
            Math.floor(
                elapsed /
                CLUE_INTERVAL
            )
        );


    clueStatus.textContent =
        `${clueCount}/${MAX_CLUES} REVEALED`;


    clueText.textContent =
        "A letter from the Ghost's username has been revealed.";


    revealGhostLetters(
        letters,
        clueCount
    );

}


/* =========================
   REVEAL GHOST LETTERS
========================= */

function revealGhostLetters(
    letters,
    count
) {

    const total =
        letters.length;


    if (
        total === 0
    ) {

        return;

    }


    const maxReveal =
        Math.min(
            MAX_CLUES,
            total
        );


    const positions =
        [];


    for (
        let i = 0;
        i < maxReveal;
        i++
    ) {

        const position =
            Math.floor(
                (
                    i /
                    maxReveal
                ) *
                total
            );


        if (
            !positions.includes(
                position
            )
        ) {

            positions.push(
                position
            );

        }

    }


    const revealed =
        letters.map(
            function (
                letter,
                index
            ) {

                const revealIndex =
                    positions.indexOf(
                        index
                    );


                if (
                    revealIndex !== -1 &&
                    revealIndex < count
                ) {

                    return letter;

                }


                return "•";

            }
        );


    letterReveal.textContent =
        revealed.join(" ");

}


/* =========================
   CHAT EVENTS
========================= */

function setupChatEvents() {

    if (
        chatEventsSetup
    ) {

        return;

    }


    chatEventsSetup =
        true;


    sendButton.addEventListener(
        "click",
        sendChatMessage
    );


    chatInput.addEventListener(
        "keydown",
        function (event) {

            if (
                event.key === "Enter"
            ) {

                event.preventDefault();

                sendChatMessage();

            }

        }
    );

}


/* =========================
   CHAT LISTENER
========================= */

function startChatListener() {

    if (
        chatListenerStarted
    ) {

        return;

    }


    chatListenerStarted =
        true;


    const messagesRef =
        ref(
            database,
            `ghostRooms/${roomCode}/messages`
        );


    onValue(
        messagesRef,
        function (snapshot) {

            const messages =
                snapshot.val() ||
                {};


            renderMessages(
                messages
            );

        }
    );

}


/* =========================
   SEND CHAT
========================= */

async function sendChatMessage() {

    if (
        !currentUser ||
        !currentPlayer
    ) {

        return;

    }


    const text =
        chatInput.value
            .trim();


    if (!text) {

        return;

    }


    if (
        !currentRoom ||
        currentRoom.status !==
        "playing"
    ) {

        return;

    }


    try {

        sendButton.disabled =
            true;


        const messagesRef =
            ref(
                database,
                `ghostRooms/${roomCode}/messages`
            );


        const newMessageRef =
            push(
                messagesRef
            );


        await set(
            newMessageRef,
            {

                senderUid:
                    currentUser.uid,

                senderName:
                    currentPlayer.anonymousName ||
                    "PLAYER",

                text:
                    text,

                timestamp:
                    Date.now()

            }
        );


        chatInput.value =
            "";

    }

    catch (error) {

        console.error(
            "CHAT ERROR:",
            error
        );

        alert(
            "MESSAGE FAILED TO SEND."
        );

    }

    finally {

        if (
            currentRoom &&
            currentRoom.status ===
            "playing"
        ) {

            sendButton.disabled =
                false;

        }

    }

}


/* =========================
   RENDER MESSAGES
========================= */

function renderMessages(
    messages
) {

    chatMessages.innerHTML =
        "";


    const entries =
        Object.values(messages)
            .sort(
                function (a, b) {

                    return (
                        Number(a.timestamp) -
                        Number(b.timestamp)
                    );

                }
            );


    entries.forEach(
        function (message) {

            const messageElement =
                document.createElement(
                    "div"
                );


            messageElement.className =
                "message";


            const name =
                document.createElement(
                    "strong"
                );


            name.className =
                "message-name";


            name.textContent =
                message.senderName ||
                "PLAYER";


            const text =
                document.createElement(
                    "p"
                );


            text.className =
                "message-text";


            text.textContent =
                message.text ||
                "";


            messageElement.appendChild(
                name
            );

            messageElement.appendChild(
                text
            );


            chatMessages.appendChild(
                messageElement
            );

        }
    );


    chatMessages.scrollTop =
        chatMessages.scrollHeight;

}


/* =========================
   VOTING INTERFACE
========================= */

function showVotingInterface() {

    if (timerInterval) {

        clearInterval(
            timerInterval
        );

        timerInterval =
            null;

    }


    currentPhase =
        "voting";


    gameTimer.textContent =
        "VOTE";

    gamePhase.textContent =
        "THE INVESTIGATION IS OVER";


    chatInput.disabled =
        true;

    sendButton.disabled =
        true;


    resultSection.classList.add(
        "hidden"
    );


    if (
        currentPlayer &&
        currentPlayer.voted
    ) {

        votingSection.classList.add(
            "hidden"
        );

        waitingResults.classList.remove(
            "hidden"
        );

    }

    else {

        waitingResults.classList.add(
            "hidden"
        );

        votingSection.classList.remove(
            "hidden"
        );

        renderVotingPlayers();

    }


    updateVoteProgress();

}


/* =========================
   RENDER VOTING PLAYERS
========================= */

function renderVotingPlayers() {

    votingPlayers.innerHTML =
        "";


    if (!currentRoom) {

        return;

    }


    const players =
        currentRoom.players ||
        {};


    Object.entries(players)
        .forEach(
            function ([uid, player]) {

                if (
                    player.leftGame
                ) {

                    return;

                }


                const button =
                    document.createElement(
                        "button"
                    );


                button.type =
                    "button";


                button.className =
                    "vote-player";


                button.textContent =
                    player.anonymousName ||
                    "PLAYER";


                if (
                    uid ===
                    currentUser.uid
                ) {

                    button.disabled =
                        true;

                    button.textContent +=
                        " (YOU)";

                }


                button.addEventListener(
                    "click",
                    function () {

                        castVote(
                            uid
                        );

                    }
                );


                votingPlayers.appendChild(
                    button
                );

            }
        );

}


/* =========================
   CAST VOTE
========================= */

async function castVote(
    targetUid
) {

    if (
        !currentUser ||
        !currentPlayer
    ) {

        return;

    }


    if (
        currentPlayer.voted
    ) {

        return;

    }


    if (
        targetUid ===
        currentUser.uid
    ) {

        voteStatus.textContent =
            "YOU CANNOT VOTE FOR YOURSELF.";

        return;

    }


    if (
        !currentRoom ||
        currentRoom.status !==
        "voting"
    ) {

        return;

    }


    try {

        voteStatus.textContent =
            "CASTING VOTE...";


        const playerRef =
            ref(
                database,
                `ghostRooms/${roomCode}/players/${currentUser.uid}`
            );


        const result =
            await runTransaction(
                playerRef,
                function (player) {

                    if (!player) {

                        return player;

                    }


                    if (
                        player.leftGame ||
                        player.voted
                    ) {

                        return player;

                    }


                    player.voted =
                        true;

                    player.vote =
                        targetUid;

                    player.voteAt =
                        Date.now();


                    return player;

                }
            );


        if (
            result.committed
        ) {

            voteStatus.textContent =
                "✓ VOTE LOCKED.";

        }

    }

    catch (error) {

        console.error(
            "VOTE ERROR:",
            error
        );


        voteStatus.textContent =
            "VOTE FAILED. TRY AGAIN.";

    }

}


/* =========================
   VOTE PROGRESS
========================= */

function updateVoteProgress() {

    if (
        !currentRoom ||
        currentRoom.status !==
        "voting"
    ) {

        return;

    }


    const players =
        currentRoom.players ||
        {};


    const activePlayers =
        Object.values(players)
            .filter(
                function (player) {

                    return !player.leftGame;

                }
            );


    const total =
        activePlayers.length;


    const voted =
        activePlayers.filter(
            function (player) {

                return player.voted;

            }
        ).length;


    votesProgress.textContent =
        `${voted} / ${total} VOTES`;


    if (
        total > 0 &&
        voted >= total
    ) {

        finishGameOnce();

    }

}


/* =========================
   FINISH GAME
========================= */

async function finishGameOnce() {

    try {

        const roomRef =
            ref(
                database,
                `ghostRooms/${roomCode}`
            );


        const transaction =
            await runTransaction(
                roomRef,
                function (room) {

                    if (!room) {

                        return room;

                    }


                    if (
                        room.status !==
                        "voting"
                    ) {

                        return room;

                    }


                    const players =
                        room.players ||
                        {};


                    const activeEntries =
                        Object.entries(players)
                            .filter(
                                function ([, player]) {

                                    return !player.leftGame;

                                }
                            );


                    const everyoneVoted =
                        activeEntries.length > 0 &&
                        activeEntries.every(
                            function ([, player]) {

                                return player.voted;

                            }
                        );


                    if (!everyoneVoted) {

                        return room;

                    }


                    const tally =
                        {};


                    activeEntries.forEach(
                        function ([, player]) {

                            if (
                                !player.vote
                            ) {

                                return;

                            }


                            tally[
                                player.vote
                            ] =
                                (
                                    tally[
                                        player.vote
                                    ] || 0
                                ) + 1;

                        }
                    );


                    const sorted =
                        Object.entries(tally)
                            .sort(
                                function (a, b) {

                                    return b[1] - a[1];

                                }
                            );


                    room.status =
                        "finished";

                    room.finishedAt =
                        Date.now();


                    /*
                    NO VALID VOTES
                    */

                    if (
                        sorted.length === 0
                    ) {

                        room.resultType =
                            "tie";

                        room.winningRole =
                            null;

                        room.rewardAmount =
                            0;

                        return room;

                    }


                    const highestVotes =
                        sorted[0][1];


                    const leaders =
                        sorted.filter(
                            function ([, votes]) {

                                return (
                                    votes ===
                                    highestVotes
                                );

                            }
                        );


                    /*
                    TIE
                    */

                    if (
                        leaders.length > 1
                    ) {

                        room.resultType =
                            "tie";

                        room.winningRole =
                            null;

                        room.rewardAmount =
                            0;

                        return room;

                    }


                    const eliminatedUid =
                        leaders[0][0];


                    const eliminatedPlayer =
                        players[
                            eliminatedUid
                        ];


                    if (!eliminatedPlayer) {

                        room.resultType =
                            "tie";

                        room.winningRole =
                            null;

                        room.rewardAmount =
                            0;

                        return room;

                    }


                    room.eliminatedUid =
                        eliminatedUid;

                    room.eliminatedRole =
                        eliminatedPlayer.role;


                    /*
                    GHOST ELIMINATED
                    */

                    if (
                        eliminatedPlayer.role ===
                        "ghost"
                    ) {

                        room.winningRole =
                            "fighter";

                        room.resultType =
                            "fighters_win";

                        room.rewardAmount =
                            FIGHTER_REWARD;

                    }


                    /*
                    JOKER ELIMINATED
                    */

                    else if (
                        eliminatedPlayer.role ===
                        "joker"
                    ) {

                        room.winningRole =
                            "joker";

                        room.resultType =
                            "jokers_win";

                        room.rewardAmount =
                            JOKER_REWARD;

                    }


                    /*
                    FIGHTER ELIMINATED
                    */

                    else {

                        room.winningRole =
                            "ghost";

                        room.resultType =
                            "ghost_win";

                        room.rewardAmount =
                            GHOST_REWARD;

                    }


                    return room;

                }
            );


        if (
            transaction.committed
        ) {

            distributeRewardsOnce();

        }

    }

    catch (error) {

        console.error(
            "FINISH GAME ERROR:",
            error
        );

    }

}


/* =========================
   DISTRIBUTE REWARDS
========================= */

async function distributeRewardsOnce() {

    if (
        rewardDistributionStarted
    ) {

        return;

    }


    rewardDistributionStarted =
        true;


    try {

        const roomRef =
            ref(
                database,
                `ghostRooms/${roomCode}`
            );


        const transaction =
            await runTransaction(
                roomRef,
                function (room) {

                    if (!room) {

                        return room;

                    }


                    if (
                        room.status !== "finished"
                    ) {

                        return room;

                    }


                    if (
                        room.rewardsDistributed
                    ) {

                        return room;

                    }


                    room.rewardsDistributed =
                        true;


                    return room;

                }
            );


        if (
            !transaction.committed
        ) {

            return;

        }


        const room =
            transaction.snapshot.val();


        if (
            !room ||
            !room.winningRole ||
            !room.rewardAmount
        ) {

            return;

        }


        const players =
            room.players ||
            {};


        const winnerUids =
            Object.entries(players)
                .filter(
                    function ([, player]) {

                        return (
                            player.role ===
                            room.winningRole
                        );

                    }
                )
                .map(
                    function ([uid]) {

                        return uid;

                    }
                );


        for (
            const uid of winnerUids
        ) {

            const pointsRef =
                ref(
                    database,
                    `users/${uid}/chaosPoints`
                );


            await runTransaction(
                pointsRef,
                function (points) {

                    return (
                        Number(points) || 0
                    ) +
                    Number(
                        room.rewardAmount
                    );

                }
            );

        }

    }

    catch (error) {

        console.error(
            "REWARD ERROR:",
            error
        );

    }

}


/* =========================
   FINAL RESULT
========================= */

function showFinalResult() {

    if (timerInterval) {

        clearInterval(
            timerInterval
        );

        timerInterval =
            null;

    }


    currentPhase =
        "finished";


    votingSection.classList.add(
        "hidden"
    );

    waitingResults.classList.add(
        "hidden"
    );

    resultSection.classList.remove(
        "hidden"
    );


    chatInput.disabled =
        true;

    sendButton.disabled =
        true;


    renderFinalResult();

}


/* =========================
   RENDER FINAL RESULT
========================= */

function renderFinalResult() {

    if (!currentRoom) {

        return;

    }


    const players =
        currentRoom.players ||
        {};


    let ghost =
        null;


    Object.entries(players)
        .forEach(
            function ([uid, player]) {

                if (
                    player.role ===
                    "ghost"
                ) {

                    ghost = {
                        uid,
                        ...player
                    };

                }

            }
        );


    revealedGhost.textContent =
        ghost
            ? `${ghost.anonymousName} (${ghost.username || "Unknown"})`
            : "UNKNOWN";


    /*
    TIE
    */

    if (
        currentRoom.resultType ===
        "tie"
    ) {

        resultIcon.textContent =
            "⚖️";

        resultSmallTitle.textContent =
            "NO WINNER";

        resultTitle.textContent =
            "THE VOTE ENDED IN A TIE";

        resultDescription.textContent =
            "Nobody received a decisive result.";

        rewardAmount.textContent =
            "0 CP";

        return;

    }


    /*
    FIGHTERS WIN
    */

    if (
        currentRoom.resultType ===
        "fighters_win"
    ) {

        resultIcon.textContent =
            "⚔️";

        resultSmallTitle.textContent =
            "THE FIGHTERS WIN";

        resultTitle.textContent =
            "THE GHOST HAS BEEN CAUGHT";

        resultDescription.textContent =
            "The group successfully identified the Ghost.";

    }


    /*
    JOKERS WIN
    */

    else if (
        currentRoom.resultType ===
        "jokers_win"
    ) {

        resultIcon.textContent =
            "🃏";

        resultSmallTitle.textContent =
            "THE JOKERS WIN";

        resultTitle.textContent =
            "CHAOS WINS";

        resultDescription.textContent =
            "A Joker was voted out. All Jokers receive the reward.";

    }


    /*
    GHOST WINS
    */

    else if (
        currentRoom.resultType ===
        "ghost_win"
    ) {

        resultIcon.textContent =
            "👻";

        resultSmallTitle.textContent =
            "THE GHOST WINS";

        resultTitle.textContent =
            "THE WRONG PERSON WAS ELIMINATED";

        resultDescription.textContent =
            "The Ghost successfully fooled the group.";

    }


    if (
        currentPlayer &&
        currentPlayer.role ===
        currentRoom.winningRole
    ) {

        rewardAmount.textContent =
            `+${currentRoom.rewardAmount || 0} CP`;

    }

    else {

        rewardAmount.textContent =
            "0 CP";

    }

}


/* =========================
   LEAVE GAME
========================= */

leaveGameButton.addEventListener(
    "click",
    async function () {

        const confirmed =
            confirm(
                "Are you sure you want to leave the game?"
            );


        if (!confirmed) {

            return;

        }


        try {

            const playerRef =
                ref(
                    database,
                    `ghostRooms/${roomCode}/players/${currentUser.uid}`
                );


            await update(
                playerRef,
                {

                    leftGame:
                        true,

                    leftAt:
                        Date.now()

                }
            );


            window.location.href =
                "globby.html";

        }

        catch (error) {

            console.error(
                "LEAVE ERROR:",
                error
            );

        }

    }
);


/* =========================
   BACK TO LOBBY
========================= */

backToLobbyButton.addEventListener(
    "click",
    function () {

        window.location.href =
            "globby.html";

    }
);


/* =========================
   DISCONNECTED MESSAGE
========================= */

function showDisconnectedMessage() {

    if (timerInterval) {

        clearInterval(
            timerInterval
        );

        timerInterval =
            null;

    }


    loadingCard.classList.remove(
        "hidden"
    );

    gameContent.classList.add(
        "hidden"
    );


    loadingText.textContent =
        "YOU ARE NO LONGER PART OF THIS GAME.";

}