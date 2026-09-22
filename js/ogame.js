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

const WIN_REWARD = 100;



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

const rewardMessage =
    document.getElementById("rewardMessage");

const roomCodeDisplay =
    document.getElementById("roomCodeDisplay");

const opponentLeftCard =
    document.getElementById("opponentLeftCard");

const opponentLeftMessage =
    document.getElementById("opponentLeftMessage");

const opponentLeftDashboardButton =
    document.getElementById(
        "opponentLeftDashboardButton"
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

let currentRoom =
    null;

let currentPlayerColor =
    null;

let roomListenerStarted =
    false;

let opponentLeft =
    false;



/* =========================
   GET ROOM CODE
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


        currentUser =
            user;


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
            "Unable to load profile:",
            error
        );

    }

}



/* =========================
   GAME LISTENER
========================= */

function listenToGame() {

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
            `othelloRooms/${currentRoomCode}`
        );


    onValue(
        roomRef,
        function (snapshot) {

            if (!snapshot.exists()) {

                gameStatus.textContent =
                    "ROOM NO LONGER EXISTS.";

                return;

            }


            currentRoom =
                snapshot.val();


            handleRoomState();

        }
    );

}



/* =========================
   HANDLE ROOM STATE
========================= */

function handleRoomState() {

    if (
        !currentRoom ||
        !currentRoom.players
    ) {

        return;

    }


    const players =
        currentRoom.players;


    const playerIds =
        Object.keys(players);



    /*
       If the game was already
       completed normally, do not
       treat the missing player as
       someone leaving.
    */

    if (
        currentRoom.status ===
        "finished"
    ) {

        determinePlayerColor();

        renderGame();

        return;

    }



    /*
       A valid Othello game requires
       exactly two players.
    */

    if (
        playerIds.length < 2
    ) {

        /*
           If we were previously playing
           and now only one player remains,
           the opponent has left.
        */

        if (
            currentRoom.status ===
                "playing" ||
            currentRoom.status ===
                "starting"
        ) {

            handleOpponentLeft();

            return;

        }

    }



    determinePlayerColor();

    renderGame();

}



/* =========================
   DETERMINE PLAYER COLOR
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

        currentPlayerColor =
            null;

        return;

    }


    /*
       New lobby uses color.
       This also supports the old
       symbol structure if it exists.
    */

    if (player.color) {

        currentPlayerColor =
            player.color;

    }

    else if (
        player.symbol === "X"
    ) {

        currentPlayerColor =
            "black";

    }

    else if (
        player.symbol === "O"
    ) {

        currentPlayerColor =
            "white";

    }

    else {

        currentPlayerColor =
            null;

    }

}



/* =========================
   RENDER GAME
========================= */

function renderGame() {

    if (
        !currentRoom
    ) {

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


    let blackPlayer =
        null;

    let whitePlayer =
        null;


    Object.entries(players)
        .forEach(
            function ([uid, player]) {

                let color =
                    player.color;


                if (!color) {

                    if (
                        player.symbol === "X"
                    ) {

                        color =
                            "black";

                    }

                    else if (
                        player.symbol === "O"
                    ) {

                        color =
                            "white";

                    }

                }


                if (
                    color === "black"
                ) {

                    blackPlayer =
                        player;

                }


                if (
                    color === "white"
                ) {

                    whitePlayer =
                        player;

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
   RENDER BOARD
========================= */

function renderBoard() {

    const board =
        normalizeBoard(
            currentRoom.board
        );


    boardElement.innerHTML =
        "";


    const currentTurn =
        currentRoom.turn;


    let legalMoves =
        [];


    if (
        currentTurn &&
        currentPlayerColor ===
            colorNumberToName(
                currentTurn
            )
    ) {

        legalMoves =
            getLegalMoves(
                board,
                currentTurn
            );

    }



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


            if (
                isLegal &&
                !opponentLeft
            ) {

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
   GET LEGAL MOVES
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
                board[row][col] !==
                EMPTY
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

            const directionFlips =
                [];


            let r =
                row + dr;

            let c =
                col + dc;


            while (
                r >= 0 &&
                r < BOARD_SIZE &&
                c >= 0 &&
                c < BOARD_SIZE &&
                board[r][c] ===
                    opponent
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
                board[r][c] ===
                    player
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
   MAKE MOVE
========================= */

async function makeMove(
    row,
    col
) {

    if (
        !currentRoom ||
        !currentUser ||
        !currentPlayerColor ||
        opponentLeft
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
                    !player
                ) {

                    return;

                }


                let playerColor =
                    player.color;


                if (!playerColor) {

                    playerColor =
                        player.symbol === "X"
                            ? "black"
                            : "white";

                }


                if (
                    playerColor !==
                    currentPlayerColor
                ) {

                    return;

                }


                if (
                    room.status !==
                        "playing"
                ) {

                    return;

                }


                const turnNumber =
                    colorNameToNumber(
                        playerColor
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


                const opponent =
                    turnNumber === BLACK
                        ? WHITE
                        : BLACK;


                const currentFlips =
                    getFlips(
                        currentBoard,
                        row,
                        col,
                        turnNumber,
                        opponent
                    );


                if (
                    currentFlips.length === 0
                ) {

                    return;

                }


                currentBoard[row][col] =
                    turnNumber;


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
                        opponent
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

                else if (
                    opponentMoves.length === 0
                ) {

                    /*
                       Opponent has no legal
                       move, so they automatically
                       lose their turn.
                    */

                    room.turn =
                        turnNumber;

                    room.status =
                        "playing";

                    room.lastAction =
                        "pass";

                }

                else {

                    room.turn =
                        opponent;

                    room.status =
                        "playing";

                    room.lastAction =
                        "move";

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
   PASS TURN
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
        !currentPlayerColor ||
        opponentLeft
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
       You can only pass if
       you genuinely have no move.
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


    try {

        const roomRef =
            ref(
                database,
                `othelloRooms/${currentRoomCode}`
            );


        if (
            opponentMoves.length === 0
        ) {

            await update(
                roomRef,
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

        else {

            await update(
                roomRef,
                {

                    turn:
                        opponent,

                    lastAction:
                        "pass"

                }
            );

        }

    }

    catch (error) {

        console.error(
            "Pass error:",
            error
        );

    }

}



/* =========================
   UPDATE TURN UI
========================= */

function updateTurnUI() {

    if (
        opponentLeft
    ) {

        turnText.textContent =
            "ENDED";

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
        opponentLeft
    ) {

        return;

    }


    if (
        currentRoom.status ===
        "finished"
    ) {

        gameStatus.textContent =
            "GAME FINISHED";

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

    if (
        !currentRoom
    ) {

        return;

    }


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


    restartButton.classList.remove(
        "hidden"
    );


    passButton.classList.add(
        "hidden"
    );


    if (
        scores.black >
        scores.white
    ) {

        resultTitle.textContent =
            "BLACK WINS";


        resultMessage.textContent =
            "Black controlled more discs.";


        await processWinnerReward(
            "black"
        );

    }

    else if (
        scores.white >
        scores.black
    ) {

        resultTitle.textContent =
            "WHITE WINS";


        resultMessage.textContent =
            "White controlled more discs.";


        await processWinnerReward(
            "white"
        );

    }

    else {

        resultTitle.textContent =
            "DRAW";


        resultMessage.textContent =
            "The board ended perfectly balanced.";


        rewardMessage.textContent =
            "NO WINNER • NO CHAOS POINT REWARD";

    }


    resultCard.classList.remove(
        "hidden"
    );


    gameStatus.textContent =
        "GAME FINISHED";

}



/* =========================
   WINNER REWARD
========================= */

async function processWinnerReward(
    winnerColor
) {

    if (
        !currentRoom ||
        !currentUser
    ) {

        return;

    }


    const players =
        currentRoom.players || {};


    let winnerUid =
        null;


    Object.entries(players)
        .forEach(
            function ([uid, player]) {

                let color =
                    player.color;


                if (!color) {

                    color =
                        player.symbol === "X"
                            ? "black"
                            : "white";

                }


                if (
                    color ===
                    winnerColor
                ) {

                    winnerUid =
                        uid;

                }

            }
        );


    if (!winnerUid) {

        return;

    }



    /*
       The reward flag is stored inside
       the room so refreshing the page
       cannot award CP twice.
    */

    const rewardRef =
        ref(
            database,
            `othelloRooms/${currentRoomCode}/rewardGiven`
        );


    try {

        const result =
            await runTransaction(
                rewardRef,
                function (value) {

                    if (
                        value === true
                    ) {

                        return;

                    }


                    return true;

                }
            );


        /*
           Another browser already awarded it.
        */

        if (
            !result.committed
        ) {

            return;

        }


        const winnerUserRef =
            ref(
                database,
                `users/${winnerUid}`
            );


        await runTransaction(
            winnerUserRef,
            function (userData) {

                if (!userData) {

                    return userData;

                }


                userData.chaosPoints =
                    (
                        userData.chaosPoints ||
                        0
                    ) +
                    WIN_REWARD;


                return userData;

            }
        );


        /*
           Show reward only to the winner.
        */

        if (
            winnerUid ===
            currentUser.uid
        ) {

            rewardMessage.textContent =
                `🏆 YOU WIN • +${WIN_REWARD} CHAOS POINTS`;

        }

        else {

            rewardMessage.textContent =
                `🏆 ${winnerColor.toUpperCase()} WINS • +${WIN_REWARD} CHAOS POINTS`;

        }

    }

    catch (error) {

        console.error(
            "Reward error:",
            error
        );

        rewardMessage.textContent =
            "🏆 WINNER • REWARD PROCESSING ERROR";

    }

}



/* =========================
   HANDLE OPPONENT LEFT
========================= */

function handleOpponentLeft() {

    if (
        opponentLeft
    ) {

        return;

    }


    opponentLeft =
        true;


    /*
       Find the remaining player.
       This means the departed player's
       name is no longer rendered.
    */

    const players =
        currentRoom.players || {};


    const remainingPlayer =
        Object.values(players)
            .find(
                function (player) {

                    return true;

                }
            );


    if (
        remainingPlayer
    ) {

        opponentLeftMessage.textContent =
            `${remainingPlayer.username || "Player"}, your opponent left the game.`;

    }

    else {

        opponentLeftMessage.textContent =
            "Your opponent left the game.";

    }


    /*
       Completely stop game controls.
    */

    passButton.disabled =
        true;

    passButton.classList.add(
        "hidden"
    );


    restartButton.classList.add(
        "hidden"
    );


    boardElement
        .querySelectorAll(".cell")
        .forEach(
            function (cell) {

                cell.classList.remove(
                    "valid"
                );

            }
        );


    blackPlayerPanel.classList.remove(
        "active"
    );


    whitePlayerPanel.classList.remove(
        "active"
    );


    turnText.textContent =
        "ENDED";


    gameStatus.textContent =
        "YOUR OPPONENT LEFT THE GAME.";


    opponentLeftCard.classList.remove(
        "hidden"
    );

}



/* =========================
   CALCULATE SCORE
========================= */

function calculateScores(
    board
) {

    let black =
        0;

    let white =
        0;


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


if (
    opponentLeftDashboardButton
) {

    opponentLeftDashboardButton.addEventListener(
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
                !currentUser ||
                opponentLeft
            ) {

                return;

            }


            if (
                currentRoom.status !==
                "finished"
            ) {

                return;

            }


            if (
                currentRoom.hostUid !==
                currentUser.uid
            ) {

                gameStatus.textContent =
                    "ONLY THE HOST CAN START A NEW GAME.";

                return;

            }


            try {

                const newBoard =
                    createInitialBoard();


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

                        lastAction:
                            "restart",

                        finishedAt:
                            null,

                        rewardGiven:
                            false

                    }
                );


                resultCard.classList.add(
                    "hidden"
                );


                passButton.classList.remove(
                    "hidden"
                );


                restartButton.classList.remove(
                    "hidden"
                );


                gameStatus.textContent =
                    "NEW GAME STARTED.";

            }

            catch (error) {

                console.error(
                    "Restart error:",
                    error
                );

                gameStatus.textContent =
                    "UNABLE TO RESTART GAME.";

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


            try {

                const roomRef =
                    ref(
                        database,
                        `othelloRooms/${currentRoomCode}`
                    );


                /*
                   Remove THIS player from the room.
                   The remaining browser will detect
                   that only one player remains.
                */

                await runTransaction(
                    roomRef,
                    function (room) {

                        if (!room) {

                            return room;

                        }


                        if (
                            room.players &&
                            room.players[
                                currentUser.uid
                            ]
                        ) {

                            delete room.players[
                                currentUser.uid
                            ];

                        }


                        /*
                           If nobody remains,
                           remove the room logically.
                        */

                        const remaining =
                            Object.keys(
                                room.players || {}
                            );


                        if (
                            remaining.length === 0
                        ) {

                            return null;

                        }


                        /*
                           If the host leaves,
                           transfer host to the
                           remaining player.
                        */

                        if (
                            room.hostUid ===
                            currentUser.uid
                        ) {

                            room.hostUid =
                                remaining[0];

                            room.players[
                                remaining[0]
                            ].isHost =
                                true;

                        }


                        /*
                           Mark game as abandoned.
                        */

                        if (
                            room.status ===
                                "playing" ||
                            room.status ===
                                "starting"
                        ) {

                            room.status =
                                "abandoned";

                        }


                        return room;

                    }
                );

            }

            catch (error) {

                console.error(
                    "Leave game error:",
                    error
                );

            }


            window.location.href =
                "dashboard.html";

        }
    );

}