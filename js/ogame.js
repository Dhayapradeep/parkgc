import {
    ref,
    get,
    update,
    runTransaction,
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


/* =========================
   FIREBASE
========================= */

const auth =
    getAuth(app);


/* =========================
   GAME SETTINGS
========================= */

const BOARD_SIZE = 8;

const EMPTY = 0;

const BLACK = 1;

const WHITE = 2;


/*
 * Winner reward.
 *
 * Change this number later if
 * you want a different reward.
 */

const WINNER_CP_REWARD = 500;


/* =========================
   ELEMENTS
========================= */

const boardElement =
    document.getElementById("board");

const blackPlayerName =
    document.getElementById("blackPlayerName");

const whitePlayerName =
    document.getElementById("whitePlayerName");

const blackScore =
    document.getElementById("blackScore");

const whiteScore =
    document.getElementById("whiteScore");

const turnText =
    document.getElementById("turnText");

const gameStatus =
    document.getElementById("gameStatus");

const blackPlayerPanel =
    document.getElementById("blackPlayerPanel");

const whitePlayerPanel =
    document.getElementById("whitePlayerPanel");

const passButton =
    document.getElementById("passButton");

const restartButton =
    document.getElementById("restartButton");

const dashboardButton =
    document.getElementById("dashboardButton");

const leaveButton =
    document.getElementById("leaveButton");

const resultCard =
    document.getElementById("resultCard");

const resultTitle =
    document.getElementById("resultTitle");

const resultMessage =
    document.getElementById("resultMessage");

const finalBlackScore =
    document.getElementById("finalBlackScore");

const finalWhiteScore =
    document.getElementById("finalWhiteScore");

const roomCodeDisplay =
    document.getElementById("roomCodeDisplay");


/* =========================
   VARIABLES
========================= */

let currentUser = null;

let currentUsername = "Player";

let currentRoomCode = null;

let currentRoom = null;

let currentPlayerColor = null;

let roomListenerStarted = false;


/* =========================
   ROOM CODE
========================= */

const urlParams =
    new URLSearchParams(
        window.location.search
    );

currentRoomCode =
    urlParams.get("room");


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


        if (!currentRoomCode) {

            gameStatus.textContent =
                "NO ROOM CODE PROVIDED.";

            return;

        }


        roomCodeDisplay.textContent =
            currentRoomCode;


        listenToGame();

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
            "Unable to load profile:",
            error
        );

    }

}


/* =========================
   GAME LISTENER
========================= */

function listenToGame() {

    if (roomListenerStarted) {
        return;
    }


    roomListenerStarted = true;


    const roomRef =
        ref(
            database,
            `othelloRooms/${currentRoomCode}`
        );


    onValue(
        roomRef,
        async function (snapshot) {

            if (!snapshot.exists()) {

                gameStatus.textContent =
                    "ROOM NO LONGER EXISTS.";

                return;

            }


            currentRoom =
                snapshot.val();


            /*
             * Reconnect this player.
             */

            await markPlayerConnected();


            determinePlayerColor();


            renderGame();


            /*
             * Detect opponent leaving.
             */

            await checkOpponentConnection();

        }
    );

}


/* =========================
   MARK PLAYER CONNECTED
========================= */

async function markPlayerConnected() {

    if (
        !currentUser ||
        !currentRoom ||
        !currentRoom.players
    ) {

        return;

    }


    const player =
        currentRoom.players[
            currentUser.uid
        ];


    if (!player) {

        gameStatus.textContent =
            "YOU ARE NOT PART OF THIS GAME.";

        return;

    }


    if (
        player.connected !== true
    ) {

        try {

            await update(
                ref(
                    database,
                    `othelloRooms/${currentRoomCode}/players/${currentUser.uid}`
                ),
                {
                    connected: true
                }
            );

        }
        catch (error) {

            console.error(
                "Reconnect error:",
                error
            );

        }

    }

}


/* =========================
   DETERMINE COLOR
========================= */

function determinePlayerColor() {

    if (
        !currentRoom ||
        !currentRoom.players ||
        !currentUser
    ) {

        return;

    }


    const player =
        currentRoom.players[
            currentUser.uid
        ];


    if (!player) {

        currentPlayerColor = null;

        return;

    }


    /*
     * IMPORTANT:
     *
     * Lobby now stores:
     *
     * color: "black"
     * color: "white"
     */

    currentPlayerColor =
        player.color || null;

}


/* =========================
   RENDER GAME
========================= */

function renderGame() {

    if (!currentRoom) {
        return;
    }


    renderPlayers();

    renderBoard();

    updateTurnUI();

    updateGameStatus();

}


/* =========================
   RENDER PLAYERS
========================= */

function renderPlayers() {

    const players =
        currentRoom.players || {};


    let blackPlayer = null;

    let whitePlayer = null;


    Object.entries(players)
        .forEach(
            function ([uid, player]) {

                if (
                    player.color === "black"
                ) {

                    blackPlayer = player;

                }


                if (
                    player.color === "white"
                ) {

                    whitePlayer = player;

                }

            }
        );


    blackPlayerName.textContent =
        blackPlayer?.username ||
        "Waiting...";


    whitePlayerName.textContent =
        whitePlayer?.username ||
        "Waiting...";

}


/* =========================
   INITIAL BOARD
========================= */

function createInitialBoard() {

    const board =
        Array.from(
            {
                length: BOARD_SIZE
            },
            function () {

                return Array(
                    BOARD_SIZE
                ).fill(EMPTY);

            }
        );


    board[3][3] = WHITE;

    board[3][4] = BLACK;

    board[4][3] = BLACK;

    board[4][4] = WHITE;


    return board;

}


/* =========================
   NORMALIZE BOARD
========================= */

function normalizeBoard(board) {

    if (
        Array.isArray(board) &&
        board.length === BOARD_SIZE
    ) {

        return board;

    }


    return createInitialBoard();

}


/* =========================
   DIRECTIONS
========================= */

const DIRECTIONS = [

    [-1, -1],

    [-1, 0],

    [-1, 1],

    [0, -1],

    [0, 1],

    [1, -1],

    [1, 0],

    [1, 1]

];


/* =========================
   LEGAL MOVES
========================= */

function getLegalMoves(
    board,
    player
) {

    const opponent =
        player === BLACK
            ? WHITE
            : BLACK;


    const moves = [];


    for (
        let row = 0;
        row < BOARD_SIZE;
        row++
    ) {

        for (
            let col = 0;
            col < BOARD_SIZE;
            col++
        ) {

            if (
                board[row][col] !== EMPTY
            ) {

                continue;

            }


            const flips =
                getFlips(
                    board,
                    row,
                    col,
                    player,
                    opponent
                );


            if (
                flips.length > 0
            ) {

                moves.push(
                    {
                        row,
                        col
                    }
                );

            }

        }

    }


    return moves;

}


/* =========================
   GET FLIPS
========================= */

function getFlips(
    board,
    row,
    col,
    player,
    opponent
) {

    const flips = [];


    DIRECTIONS.forEach(
        function ([dr, dc]) {

            const directionFlips = [];


            let r =
                row + dr;

            let c =
                col + dc;


            while (
                r >= 0 &&
                r < BOARD_SIZE &&
                c >= 0 &&
                c < BOARD_SIZE &&
                board[r][c] === opponent
            ) {

                directionFlips.push(
                    {
                        row: r,
                        col: c
                    }
                );


                r += dr;

                c += dc;

            }


            if (
                directionFlips.length > 0 &&
                r >= 0 &&
                r < BOARD_SIZE &&
                c >= 0 &&
                c < BOARD_SIZE &&
                board[r][c] === player
            ) {

                flips.push(
                    ...directionFlips
                );

            }

        }
    );


    return flips;

}


/* =========================
   RENDER BOARD
========================= */

function renderBoard() {

    if (!boardElement) {
        return;
    }


    const board =
        normalizeBoard(
            currentRoom.board
        );


    boardElement.innerHTML =
        "";


    const currentTurn =
        currentRoom.turn;


    const legalMoves =
        currentTurn &&
        currentPlayerColor ===
            colorNumberToName(
                currentTurn
            )
            ? getLegalMoves(
                board,
                currentTurn
            )
            : [];


    for (
        let row = 0;
        row < BOARD_SIZE;
        row++
    ) {

        for (
            let col = 0;
            col < BOARD_SIZE;
            col++
        ) {

            const cell =
                document.createElement(
                    "div"
                );


            cell.className =
                "cell";


            const value =
                board[row][col];


            if (
                value !== EMPTY
            ) {

                const disc =
                    document.createElement(
                        "div"
                    );


                disc.className =
                    "disc " +
                    (
                        value === BLACK
                            ? "black"
                            : "white"
                    );


                cell.appendChild(
                    disc
                );

            }


            const isLegal =
                legalMoves.some(
                    function (move) {

                        return (
                            move.row === row &&
                            move.col === col
                        );

                    }
                );


            if (isLegal) {

                cell.classList.add(
                    "valid"
                );


                cell.addEventListener(
                    "click",
                    function () {

                        makeMove(
                            row,
                            col
                        );

                    }
                );

            }


            boardElement.appendChild(
                cell
            );

        }

    }


    const scores =
        calculateScores(board);


    blackScore.textContent =
        scores.black;


    whiteScore.textContent =
        scores.white;

}


/* =========================
   MAKE MOVE
========================= */

async function makeMove(
    row,
    col
) {

    if (
        !currentRoom ||
        !currentUser ||
        !currentPlayerColor
    ) {

        return;

    }


    /*
     * Convert:
     *
     * black -> 1
     * white -> 2
     */

    const playerNumber =
        colorNameToNumber(
            currentPlayerColor
        );


    if (
        currentRoom.turn !==
        playerNumber
    ) {

        return;

    }


    const board =
        normalizeBoard(
            currentRoom.board
        );


    const opponent =
        playerNumber === BLACK
            ? WHITE
            : BLACK;


    const flips =
        getFlips(
            board,
            row,
            col,
            playerNumber,
            opponent
        );


    if (
        board[row][col] !== EMPTY ||
        flips.length === 0
    ) {

        return;

    }


    const roomRef =
        ref(
            database,
            `othelloRooms/${currentRoomCode}`
        );


    try {

        await runTransaction(
            roomRef,
            function (room) {

                if (!room) {
                    return;
                }


                const players =
                    room.players || {};


                const player =
                    players[
                        currentUser.uid
                    ];


                if (
                    !player ||
                    player.color !==
                    currentPlayerColor
                ) {

                    return;

                }


                const turnNumber =
                    colorNameToNumber(
                        player.color
                    );


                if (
                    room.turn !==
                    turnNumber
                ) {

                    return;

                }


                const currentBoard =
                    normalizeBoard(
                        room.board
                    );


                if (
                    currentBoard[row][col] !==
                    EMPTY
                ) {

                    return;

                }


                const currentOpponent =
                    turnNumber === BLACK
                        ? WHITE
                        : BLACK;


                const currentFlips =
                    getFlips(
                        currentBoard,
                        row,
                        col,
                        turnNumber,
                        currentOpponent
                    );


                if (
                    currentFlips.length === 0
                ) {

                    return;

                }


                /*
                 * Place disc.
                 */

                currentBoard[row][col] =
                    turnNumber;


                /*
                 * Flip opponent discs.
                 */

                currentFlips.forEach(
                    function (position) {

                        currentBoard[
                            position.row
                        ][
                            position.col
                        ] =
                            turnNumber;

                    }
                );


                const opponentMoves =
                    getLegalMoves(
                        currentBoard,
                        currentOpponent
                    );


                const playerMoves =
                    getLegalMoves(
                        currentBoard,
                        turnNumber
                    );


                const boardFull =
                    currentBoard.every(
                        function (boardRow) {

                            return boardRow.every(
                                function (cell) {

                                    return (
                                        cell !==
                                        EMPTY
                                    );

                                }
                            );

                        }
                    );


                room.board =
                    currentBoard;


                /*
                 * GAME OVER
                 */

                if (
                    boardFull ||
                    (
                        opponentMoves.length === 0 &&
                        playerMoves.length === 0
                    )
                ) {

                    room.status =
                        "finished";

                    room.turn =
                        null;

                    room.finishedAt =
                        Date.now();

                }


                /*
                 * OPPONENT HAS NO MOVE
                 */

                else if (
                    opponentMoves.length === 0
                ) {

                    room.turn =
                        turnNumber;

                    room.status =
                        "playing";

                    room.lastAction =
                        "pass";

                }


                /*
                 * NORMAL TURN
                 */

                else {

                    room.turn =
                        currentOpponent;

                    room.status =
                        "playing";

                }


                return room;

            }
        );

    }
    catch (error) {

        console.error(
            "Move error:",
            error
        );

    }

}


/* =========================
   PASS
========================= */

if (passButton) {

    passButton.addEventListener(
        "click",
        passTurn
    );

}


async function passTurn() {

    if (
        !currentRoom ||
        !currentPlayerColor
    ) {

        return;

    }


    const playerNumber =
        colorNameToNumber(
            currentPlayerColor
        );


    if (
        currentRoom.turn !==
        playerNumber
    ) {

        return;

    }


    const board =
        normalizeBoard(
            currentRoom.board
        );


    const legalMoves =
        getLegalMoves(
            board,
            playerNumber
        );


    /*
     * You may only pass when
     * you have no legal move.
     */

    if (
        legalMoves.length > 0
    ) {

        return;

    }


    const opponent =
        playerNumber === BLACK
            ? WHITE
            : BLACK;


    const opponentMoves =
        getLegalMoves(
            board,
            opponent
        );


    if (
        opponentMoves.length === 0
    ) {

        await finishGame();

        return;

    }


    try {

        await update(
            ref(
                database,
                `othelloRooms/${currentRoomCode}`
            ),
            {

                turn:
                    opponent,

                lastAction:
                    "pass"

            }
        );

    }
    catch (error) {

        console.error(
            "Pass error:",
            error
        );

    }

}


/* =========================
   FINISH GAME
========================= */

async function finishGame() {

    try {

        await update(
            ref(
                database,
                `othelloRooms/${currentRoomCode}`
            ),
            {

                status:
                    "finished",

                turn:
                    null,

                finishedAt:
                    Date.now()

            }
        );

    }
    catch (error) {

        console.error(
            "Finish game error:",
            error
        );

    }

}


/* =========================
   OPPONENT CONNECTION
========================= */

async function checkOpponentConnection() {

    if (
        !currentRoom ||
        !currentRoom.players ||
        !currentUser
    ) {

        return;

    }


    /*
     * Only check while the game
     * is actually running.
     */

    if (
        currentRoom.status !== "playing"
    ) {

        return;

    }


    const players =
        Object.entries(
            currentRoom.players
        );


    const opponent =
        players.find(
            function ([uid]) {

                return (
                    uid !==
                    currentUser.uid
                );

            }
        );


    if (!opponent) {

        return;

    }


    const opponentData =
        opponent[1];


    /*
     * Opponent disconnected.
     *
     * We finish the game and give
     * the remaining connected player
     * the win.
     */

    if (
        opponentData.connected === false
    ) {

        const roomRef =
            ref(
                database,
                `othelloRooms/${currentRoomCode}`
            );


        try {

            await runTransaction(
                roomRef,
                function (room) {

                    if (!room) {
                        return;
                    }


                    if (
                        room.status !==
                        "playing"
                    ) {

                        return room;

                    }


                    const opponentStillThere =
                        room.players?.[
                            opponent[0]
                        ];


                    if (
                        !opponentStillThere ||
                        opponentStillThere.connected !==
                        false
                    ) {

                        return room;

                    }


                    room.status =
                        "finished";

                    room.turn =
                        null;

                    room.finishedAt =
                        Date.now();

                    room.winnerUid =
                        currentUser.uid;

                    room.finishedByDisconnect =
                        true;


                    return room;

                }
            );

        }
        catch (error) {

            console.error(
                "Opponent disconnect error:",
                error
            );

        }

    }

}


/* =========================
   TURN UI
========================= */

function updateTurnUI() {

    if (!currentRoom) {
        return;
    }


    const turn =
        currentRoom.turn;


    if (
        turn === null ||
        turn === undefined
    ) {

        turnText.textContent =
            "GAME OVER";


        blackPlayerPanel.classList.remove(
            "active"
        );


        whitePlayerPanel.classList.remove(
            "active"
        );


        passButton.disabled =
            true;


        return;

    }


    const turnName =
        colorNumberToName(
            turn
        );


    turnText.textContent =
        turnName.toUpperCase();


    blackPlayerPanel.classList.toggle(
        "active",
        turn === BLACK
    );


    whitePlayerPanel.classList.toggle(
        "active",
        turn === WHITE
    );


    passButton.disabled =
        !(
            currentPlayerColor ===
            turnName &&
            getLegalMoves(
                normalizeBoard(
                    currentRoom.board
                ),
                turn
            ).length === 0
        );

}


/* =========================
   GAME STATUS
========================= */

function updateGameStatus() {

    if (
        currentRoom.status ===
        "finished"
    ) {

        showResult();

        return;

    }


    const board =
        normalizeBoard(
            currentRoom.board
        );


    const currentTurn =
        currentRoom.turn;


    if (
        currentTurn === null ||
        currentTurn === undefined
    ) {

        return;

    }


    const legalMoves =
        getLegalMoves(
            board,
            currentTurn
        );


    if (
        currentPlayerColor ===
        colorNumberToName(
            currentTurn
        )
    ) {

        if (
            legalMoves.length === 0
        ) {

            gameStatus.textContent =
                "NO VALID MOVES — YOU MUST PASS.";

        }
        else {

            gameStatus.textContent =
                "YOUR TURN — CHOOSE A VALID MOVE.";

        }

    }
    else {

        gameStatus.textContent =
            `${colorNumberToName(
                currentTurn
            ).toUpperCase()} PLAYER'S TURN`;

    }

}


/* =========================
   SHOW RESULT
========================= */

async function showResult() {

    const board =
        normalizeBoard(
            currentRoom.board
        );


    const scores =
        calculateScores(board);


    finalBlackScore.textContent =
        scores.black;


    finalWhiteScore.textContent =
        scores.white;


    /*
     * DISCONNECT WIN
     */

    if (
        currentRoom.finishedByDisconnect
    ) {

        if (
            currentRoom.winnerUid ===
            currentUser.uid
        ) {

            resultTitle.textContent =
                "YOU WIN";


            resultMessage.textContent =
                `Your opponent left the game. +${WINNER_CP_REWARD} CHAOS POINTS`;

        }
        else {

            resultTitle.textContent =
                "OPPONENT LEFT";


            resultMessage.textContent =
                "The opponent has left the game.";

        }

    }


    /*
     * NORMAL GAME
     */

    else if (
        scores.black >
        scores.white
    ) {

        resultTitle.textContent =
            "BLACK WINS";


        resultMessage.textContent =
            "Black controlled more discs.";

    }


    else if (
        scores.white >
        scores.black
    ) {

        resultTitle.textContent =
            "WHITE WINS";


        resultMessage.textContent =
            "White controlled more discs.";

    }


    else {

        resultTitle.textContent =
            "DRAW";


        resultMessage.textContent =
            "The board ended perfectly balanced.";

    }


    /*
     * AWARD WINNER
     */

    await awardWinnerReward();


    /*
     * Show result.
     */

    resultCard.classList.remove(
        "hidden"
    );


    if (restartButton) {

        /*
         * Only the host gets
         * the restart button.
         */

        if (
            currentRoom.hostUid ===
            currentUser.uid
        ) {

            restartButton.classList.remove(
                "hidden"
            );

        }
        else {

            restartButton.classList.add(
                "hidden"
            );

        }

    }


    if (dashboardButton) {

        dashboardButton.classList.remove(
            "hidden"
        );

    }


    passButton.classList.add(
        "hidden"
    );


    gameStatus.textContent =
        "GAME FINISHED";

}


/* =========================
   REWARD WINNER
========================= */

async function awardWinnerReward() {

    if (
        !currentRoom ||
        !currentUser
    ) {

        return;

    }


    /*
     * Determine winner.
     */

    let winnerUid =
        currentRoom.winnerUid ||
        null;


    /*
     * If this wasn't a disconnect,
     * determine winner from score.
     */

    if (
        !winnerUid &&
        !currentRoom.finishedByDisconnect
    ) {

        const board =
            normalizeBoard(
                currentRoom.board
            );


        const scores =
            calculateScores(board);


        if (
            scores.black >
            scores.white
        ) {

            winnerUid =
                getPlayerUidByColor(
                    "black"
                );

        }
        else if (
            scores.white >
            scores.black
        ) {

            winnerUid =
                getPlayerUidByColor(
                    "white"
                );

        }

    }


    /*
     * Draw = no reward.
     */

    if (!winnerUid) {
        return;
    }


    const roomRef =
        ref(
            database,
            `othelloRooms/${currentRoomCode}`
        );


    try {

        const rewardResult =
            await runTransaction(
                roomRef,
                function (room) {

                    if (!room) {
                        return;
                    }


                    /*
                     * Prevent duplicate rewards.
                     */

                    if (
                        room.rewardGiven === true
                    ) {

                        return room;

                    }


                    room.rewardGiven =
                        true;


                    room.winnerUid =
                        winnerUid;


                    return room;

                }
            );


        if (
            !rewardResult.committed
        ) {

            return;

        }


        /*
         * Only the winner updates
         * their own user account.
         */

        if (
            winnerUid !==
            currentUser.uid
        ) {

            return;

        }


        const userRef =
            ref(
                database,
                `users/${currentUser.uid}`
            );


        await runTransaction(
            userRef,
            function (userData) {

                if (!userData) {

                    return userData;

                }


                userData.chaosPoints =
                    (
                        userData.chaosPoints ||
                        0
                    ) +
                    WINNER_CP_REWARD;


                return userData;

            }
        );


    }
    catch (error) {

        console.error(
            "Reward error:",
            error
        );

    }

}


/* =========================
   FIND PLAYER BY COLOR
========================= */

function getPlayerUidByColor(
    color
) {

    if (
        !currentRoom ||
        !currentRoom.players
    ) {

        return null;

    }


    const entry =
        Object.entries(
            currentRoom.players
        ).find(
            function ([uid, player]) {

                return (
                    player.color ===
                    color
                );

            }
        );


    return entry
        ? entry[0]
        : null;

}


/* =========================
   SCORE
========================= */

function calculateScores(
    board
) {

    let black = 0;

    let white = 0;


    board.forEach(
        function (row) {

            row.forEach(
                function (cell) {

                    if (
                        cell === BLACK
                    ) {

                        black++;

                    }
                    else if (
                        cell === WHITE
                    ) {

                        white++;

                    }

                }
            );

        }
    );


    return {
        black,
        white
    };

}


/* =========================
   COLOR HELPERS
========================= */

function colorNameToNumber(
    color
) {

    if (
        color === "black"
    ) {

        return BLACK;

    }


    if (
        color === "white"
    ) {

        return WHITE;

    }


    return null;

}


function colorNumberToName(
    number
) {

    if (
        number === BLACK
    ) {

        return "black";

    }


    if (
        number === WHITE
    ) {

        return "white";

    }


    return null;

}


/* =========================
   DASHBOARD
========================= */

if (dashboardButton) {

    dashboardButton.addEventListener(
        "click",
        function () {

            window.location.href =
                "dashboard.html";

        }
    );

}


/* =========================
   RESTART
========================= */

if (restartButton) {

    restartButton.addEventListener(
        "click",
        async function () {

            if (
                !currentRoom ||
                !currentUser
            ) {

                return;

            }


            /*
             * Only host can restart.
             */

            if (
                currentRoom.hostUid !==
                currentUser.uid
            ) {

                gameStatus.textContent =
                    "ONLY THE HOST CAN START A NEW GAME.";

                return;

            }


            /*
             * Both players must still
             * exist in the room.
             */

            const players =
                currentRoom.players || {};


            const playerEntries =
                Object.entries(players);


            if (
                playerEntries.length !==
                2
            ) {

                gameStatus.textContent =
                    "WAITING FOR BOTH PLAYERS.";

                return;

            }


            const blackPlayer =
                playerEntries.find(
                    ([uid, player]) =>
                        player.color ===
                        "black"
                );


            const whitePlayer =
                playerEntries.find(
                    ([uid, player]) =>
                        player.color ===
                        "white"
                );


            if (
                !blackPlayer ||
                !whitePlayer
            ) {

                gameStatus.textContent =
                    "PLAYERS ARE NOT READY.";

                return;

            }


            const newBoard =
                createInitialBoard();


            try {

                await update(
                    ref(
                        database,
                        `othelloRooms/${currentRoomCode}`
                    ),
                    {

                        board:
                            newBoard,

                        turn:
                            BLACK,

                        status:
                            "playing",

                        finishedAt:
                            null,

                        winnerUid:
                            null,

                        rewardGiven:
                            false,

                        finishedByDisconnect:
                            false,

                        lastAction:
                            "restart"

                    }
                );


                resultCard.classList.add(
                    "hidden"
                );


                passButton.classList.remove(
                    "hidden"
                );


            }
            catch (error) {

                console.error(
                    "Restart error:",
                    error
                );

            }

        }
    );

}


/* =========================
   LEAVE GAME
========================= */

if (leaveButton) {

    leaveButton.addEventListener(
        "click",
        async function () {

            const confirmed =
                confirm(
                    "Leave this game?"
                );


            if (!confirmed) {
                return;
            }


            if (
                !currentUser ||
                !currentRoomCode
            ) {

                window.location.href =
                    "dashboard.html";

                return;

            }


            try {

                /*
                 * IMPORTANT:
                 *
                 * We do NOT delete the player.
                 *
                 * We mark them disconnected so
                 * the opponent can receive the win,
                 * while the player can still
                 * reconnect later.
                 */

                await update(
                    ref(
                        database,
                        `othelloRooms/${currentRoomCode}/players/${currentUser.uid}`
                    ),
                    {

                        connected:
                            false

                    }
                );


                window.location.href =
                    "dashboard.html";

            }
            catch (error) {

                console.error(
                    "Leave game error:",
                    error
                );


                window.location.href =
                    "dashboard.html";

            }

        }
    );

}