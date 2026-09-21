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



/* =========================
   ELEMENTS
========================= */

const boardElement =
    document.getElementById(
        "board"
    );

const blackPlayerName =
    document.getElementById(
        "blackPlayerName"
    );

const whitePlayerName =
    document.getElementById(
        "whitePlayerName"
    );

const blackScore =
    document.getElementById(
        "blackScore"
    );

const whiteScore =
    document.getElementById(
        "whiteScore"
    );

const turnText =
    document.getElementById(
        "turnText"
    );

const gameStatus =
    document.getElementById(
        "gameStatus"
    );

const blackPlayerPanel =
    document.getElementById(
        "blackPlayerPanel"
    );

const whitePlayerPanel =
    document.getElementById(
        "whitePlayerPanel"
    );

const passButton =
    document.getElementById(
        "passButton"
    );

const restartButton =
    document.getElementById(
        "restartButton"
    );

const dashboardButton =
    document.getElementById(
        "dashboardButton"
    );

const leaveButton =
    document.getElementById(
        "leaveButton"
    );

const resultCard =
    document.getElementById(
        "resultCard"
    );

const resultTitle =
    document.getElementById(
        "resultTitle"
    );

const resultMessage =
    document.getElementById(
        "resultMessage"
    );

const finalBlackScore =
    document.getElementById(
        "finalBlackScore"
    );

const finalWhiteScore =
    document.getElementById(
        "finalWhiteScore"
    );

const roomCodeDisplay =
    document.getElementById(
        "roomCodeDisplay"
    );



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


            determinePlayerColor();


            renderGame();

        }
    );

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


    currentPlayerColor =
        player.color ||
        null;

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
        currentRoom.players ||
        {};


    let blackPlayer =
        null;

    let whitePlayer =
        null;


    Object.entries(players)
        .forEach(
            function ([uid, player]) {

                if (
                    player.color ===
                    "black"
                ) {

                    blackPlayer =
                        player;

                }


                if (
                    player.color ===
                    "white"
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
                ).fill(EMPTY);

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
        board.length ===
            BOARD_SIZE &&
        board.every(
            function (row) {

                return (
                    Array.isArray(row) &&
                    row.length ===
                        BOARD_SIZE
                );

            }
        )
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
                value !==
                EMPTY
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
                            move.row ===
                                row &&
                            move.col ===
                                col
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
        calculateScores(
            board
        );


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
                flips.length >
                0
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
                directionFlips.length >
                    0 &&
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


    const flips =
        getFlips(
            board,
            row,
            col,
            playerNumber,
            playerNumber ===
                BLACK
                ? WHITE
                : BLACK
        );


    if (
        board[row][col] !==
            EMPTY ||
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
                    room.players ||
                    {};


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
                        currentPlayerColor
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


                const currentFlips =
                    getFlips(
                        currentBoard,
                        row,
                        col,
                        turnNumber,
                        turnNumber ===
                            BLACK
                            ? WHITE
                            : BLACK
                    );


                if (
                    currentFlips.length ===
                    0
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


                const opponent =
                    turnNumber ===
                        BLACK
                        ? WHITE
                        : BLACK;


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
                        opponentMoves.length ===
                            0 &&
                        playerMoves.length ===
                            0
                    )
                ) {

                    room.status =
                        "finished";

                    room.turn =
                        null;

                }

                else if (
                    opponentMoves.length ===
                    0
                ) {

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


    if (
        legalMoves.length >
        0
    ) {

        return;

    }


    const opponent =
        playerNumber ===
            BLACK
            ? WHITE
            : BLACK;


    const opponentMoves =
        getLegalMoves(
            board,
            opponent
        );


    if (
        opponentMoves.length ===
        0
    ) {

        await finishGame();

        return;

    }


    try {

        const roomRef =
            ref(
                database,
                `othelloRooms/${currentRoomCode}`
            );


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

    const roomRef =
        ref(
            database,
            `othelloRooms/${currentRoomCode}`
        );


    try {

        await update(
            roomRef,
            {

                status:
                    "finished",

                turn:
                    null

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
   TURN UI
========================= */

function updateTurnUI() {

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
            ).length ===
                0
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
        currentTurn ===
        null ||
        currentTurn ===
        undefined
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
            legalMoves.length ===
            0
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

function showResult() {

    const board =
        normalizeBoard(
            currentRoom.board
        );


    const scores =
        calculateScores(
            board
        );


    finalBlackScore.textContent =
        scores.black;


    finalWhiteScore.textContent =
        scores.white;


    if (
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


    resultCard.classList.remove(
        "hidden"
    );


    restartButton.classList.remove(
        "hidden"
    );


    dashboardButton.classList.remove(
        "hidden"
    );


    passButton.classList.add(
        "hidden"
    );


    gameStatus.textContent =
        "GAME FINISHED";

}



/* =========================
   CALCULATE SCORE
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
        color ===
        "black"
    ) {

        return BLACK;

    }


    if (
        color ===
        "white"
    ) {

        return WHITE;

    }


    return null;

}



function colorNumberToName(
    number
) {

    if (
        number ===
        BLACK
    ) {

        return "black";

    }


    if (
        number ===
        WHITE
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


            if (
                currentRoom.hostUid !==
                currentUser.uid
            ) {

                gameStatus.textContent =
                    "ONLY THE HOST CAN START A NEW GAME.";

                return;

            }


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
                        null

                }
            );

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


            window.location.href =
                "dashboard.html";

        }
    );

}