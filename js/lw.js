import {
    ref,
    get,
    update,
    onValue,
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

import {
    questions
} from "./lwq.js";


/* =========================
   SETTINGS
========================= */

const TOTAL_ROUNDS =
    30;

const ROUND_DURATION =
    15 * 1000;

const RESULT_DURATION =
    3 * 1000;


/*
   CHANGE THESE IF YOU WANT
   DIFFERENT CP REWARDS
*/

const FIRST_REWARD =
    1000;

const SECOND_REWARD =
    500;

const THIRD_REWARD =
    250;


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
        "lwlobby.html";

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

const roomDisplay =
    document.getElementById(
        "roomDisplay"
    );

const roundNumber =
    document.getElementById(
        "roundNumber"
    );

const roundTimer =
    document.getElementById(
        "roundTimer"
    );

const playerScore =
    document.getElementById(
        "playerScore"
    );

const categoryText =
    document.getElementById(
        "categoryText"
    );

const letterDisplay =
    document.getElementById(
        "letterDisplay"
    );

const answerInput =
    document.getElementById(
        "answerInput"
    );

const submitAnswerButton =
    document.getElementById(
        "submitAnswerButton"
    );

const answerStatus =
    document.getElementById(
        "answerStatus"
    );

const usedWords =
    document.getElementById(
        "usedWords"
    );

const usedWordCount =
    document.getElementById(
        "usedWordCount"
    );

const scoreboard =
    document.getElementById(
        "scoreboard"
    );

const roundResult =
    document.getElementById(
        "roundResult"
    );

const roundResultSmall =
    document.getElementById(
        "roundResultSmall"
    );

const roundResultTitle =
    document.getElementById(
        "roundResultTitle"
    );

const roundResultDescription =
    document.getElementById(
        "roundResultDescription"
    );

const nextRoundTimer =
    document.getElementById(
        "nextRoundTimer"
    );

const finalResult =
    document.getElementById(
        "finalResult"
    );

const finalIcon =
    document.getElementById(
        "finalIcon"
    );

const finalSmallTitle =
    document.getElementById(
        "finalSmallTitle"
    );

const finalTitle =
    document.getElementById(
        "finalTitle"
    );

const finalDescription =
    document.getElementById(
        "finalDescription"
    );

const finalLeaderboard =
    document.getElementById(
        "finalLeaderboard"
    );

const rewardAmount =
    document.getElementById(
        "rewardAmount"
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

let roomListenerStarted =
    false;

let lastRoundIndex =
    null;

let submittedRound =
    null;

let transitionStarted =
    false;

let resultTransitionStarted =
    false;


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
            "CONNECTING TO GAME...";


        const roomRef =
            ref(
                database,
                `lastWordRooms/${roomCode}`
            );


        const snapshot =
            await get(
                roomRef
            );


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


        roomDisplay.textContent =
            `ROOM ${roomCode}`;


        setupEvents();

        startRoomListener();


        loadingCard.classList.add(
            "hidden"
        );

        gameContent.classList.remove(
            "hidden"
        );


        updateGame();

    }

    catch (error) {

        console.error(
            "LOAD GAME ERROR:",
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
            `lastWordRooms/${roomCode}`
        );


    onValue(
        roomRef,
        function (snapshot) {

            if (!snapshot.exists()) {

                showDisconnected();

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

                showDisconnected();

                return;

            }


            updateGame();

        }
    );

}


/* =========================
   SETUP EVENTS
========================= */

function setupEvents() {

    submitAnswerButton.addEventListener(
        "click",
        submitAnswer
    );


    answerInput.addEventListener(
        "keydown",
        function (event) {

            if (
                event.key === "Enter"
            ) {

                event.preventDefault();

                submitAnswer();

            }

        }
    );


    backToLobbyButton.addEventListener(
        "click",
        function () {

            window.location.href =
                "lwlobby.html";

        }
    );

}


/* =========================
   UPDATE GAME
========================= */

function updateGame() {

    if (!currentRoom) {

        return;

    }


    renderScoreboard();


    const status =
        currentRoom.status;


    if (
        status === "starting" ||
        status === "playing"
    ) {

        finalResult.classList.add(
            "hidden"
        );


        roundResult.classList.add(
            "hidden"
        );


        showRound();

        return;

    }


    if (
        status === "roundResult"
    ) {

        showRoundResult();

        return;

    }


    if (
        status === "finished"
    ) {

        showFinalResult();

    }

}


/* =========================
   SHOW ROUND
========================= */

function showRound() {

    const roundIndex =
        Number(
            currentRoom.currentRound || 0
        );


    const gameQuestions =
        currentRoom.questions ||
        [];


    const question =
        gameQuestions[
            roundIndex
        ];


    if (!question) {

        return;

    }


    if (
        lastRoundIndex !==
        roundIndex
    ) {

        lastRoundIndex =
            roundIndex;


        submittedRound =
            null;


        answerInput.value =
            "";

        answerStatus.textContent =
            "";


        answerInput.disabled =
            false;

        submitAnswerButton.disabled =
            false;

    }


    roundNumber.textContent =
        `${roundIndex + 1} / ${TOTAL_ROUNDS}`;


    categoryText.textContent =
        question.category ||
        "UNKNOWN";


    letterDisplay.textContent =
        question.letter ||
        "?";


    playerScore.textContent =
        Number(
            currentPlayer.score || 0
        );


    renderUsedWords();

    startTimer();

}


/* =========================
   TIMER
========================= */

function startTimer() {

    if (
        timerInterval
    ) {

        updateTimer();

        return;

    }


    updateTimer();


    timerInterval =
        setInterval(
            updateTimer,
            250
        );

}


/* =========================
   UPDATE TIMER
========================= */

function updateTimer() {

    if (!currentRoom) {

        return;

    }


    if (
        currentRoom.status !== "playing" &&
        currentRoom.status !== "starting"
    ) {

        return;

    }


    const roundStartAt =
        Number(
            currentRoom.roundStartAt
        );


    if (!roundStartAt) {

        return;

    }


    const elapsed =
        Date.now() -
        roundStartAt;


    const remaining =
        Math.max(
            0,
            ROUND_DURATION -
            elapsed
        );


    const seconds =
        Math.ceil(
            remaining / 1000
        );


    roundTimer.textContent =
        seconds;


    if (
        remaining <= 0
    ) {

        roundTimer.textContent =
            "0";


        answerInput.disabled =
            true;

        submitAnswerButton.disabled =
            true;


        transitionToRoundResult();

    }

}


/* =========================
   SUBMIT ANSWER
========================= */

async function submitAnswer() {

    if (
        !currentUser ||
        !currentRoom ||
        !currentPlayer
    ) {

        return;

    }


    if (
        submittedRound ===
        currentRoom.currentRound
    ) {

        return;

    }


    if (
        currentRoom.status !==
        "playing"
    ) {

        return;

    }


    const answer =
        answerInput.value
            .trim()
            .toLowerCase();


    if (!answer) {

        answerStatus.textContent =
            "ENTER AN ANSWER.";

        return;

    }


    const roundIndex =
        Number(
            currentRoom.currentRound
        );


    const question =
        currentRoom.questions?.[
            roundIndex
        ];


    if (!question) {

        return;

    }


    /*
       CHECK FIRST LETTER
    */

    const requiredLetter =
        String(
            question.letter || ""
        )
            .toLowerCase();


    if (
        !answer.startsWith(
            requiredLetter
        )
    ) {

        answerStatus.textContent =
            `ANSWER MUST START WITH "${question.letter}".`;

        return;

    }


    /*
       CHECK PREDEFINED ANSWERS
    */

    const validAnswers =
        (
            question.answers ||
            []
        )
        .map(
            function (item) {

                return String(
                    item
                ).toLowerCase();

            }
        );


    if (
        !validAnswers.includes(
            answer
        )
    ) {

        answerStatus.textContent =
            "INVALID ANSWER.";

        return;

    }


    submitAnswerButton.disabled =
        true;


    answerInput.disabled =
        true;


    answerStatus.textContent =
        "CHECKING ANSWER...";


    try {

        const roomRef =
            ref(
                database,
                `lastWordRooms/${roomCode}`
            );


        const result =
            await runTransaction(
                roomRef,
                function (room) {

                    if (!room) {

                        return room;

                    }


                    if (
                        room.status !==
                        "playing"
                    ) {

                        return room;

                    }


                    const now =
                        Date.now();


                    const startTime =
                        Number(
                            room.roundStartAt
                        );


                    /*
                       TIME EXPIRED
                    */

                    if (
                        now >=
                        startTime +
                        ROUND_DURATION
                    ) {

                        return room;

                    }


                    const activeRound =
                        Number(
                            room.currentRound
                        );


                    if (
                        activeRound !==
                        roundIndex
                    ) {

                        return room;

                    }


                    const usedAnswers =
                        room.usedAnswers ||
                        {};


                    const roundAnswers =
                        usedAnswers[
                            activeRound
                        ] ||
                        {};


                    /*
                       ANSWER ALREADY USED
                    */

                    if (
                        roundAnswers[
                            answer
                        ]
                    ) {

                        return room;

                    }


                    /*
                       CHECK PLAYER
                    */

                    const player =
                        room.players?.[
                            currentUser.uid
                        ];


                    if (!player) {

                        return room;

                    }


                    if (
                        Number(
                            player.lastAnsweredRound
                        ) ===
                        activeRound
                    ) {

                        return room;

                    }


                    /*
                       ACCEPT ANSWER
                    */

                    if (!room.usedAnswers) {

                        room.usedAnswers =
                            {};

                    }


                    if (
                        !room.usedAnswers[
                            activeRound
                        ]
                    ) {

                        room.usedAnswers[
                            activeRound
                        ] =
                            {};

                    }


                    room.usedAnswers[
                        activeRound
                    ][
                        answer
                    ] =
                    {
                        uid:
                            currentUser.uid,

                        username:
                            player.username ||
                            "Player",

                        timestamp:
                            now
                    };


                    player.score =
                        (
                            Number(
                                player.score
                            ) || 0
                        ) +
                        1;


                    player.lastAnsweredRound =
                        activeRound;


                    player.lastAnswer =
                        answer;


                    return room;

                }
            );


        if (
            !result.committed
        ) {

            answerInput.disabled =
                false;

            submitAnswerButton.disabled =
                false;

            answerStatus.textContent =
                "FAILED. TRY AGAIN.";

            return;

        }


        const updatedRoom =
            result.snapshot.val();


        const updatedPlayer =
            updatedRoom.players?.[
                currentUser.uid
            ];


        const accepted =
            Number(
                updatedPlayer?.lastAnsweredRound
            ) ===
            roundIndex;


        if (accepted) {

            submittedRound =
                roundIndex;


            answerStatus.textContent =
                "✓ CORRECT! +1 POINT";


            answerInput.disabled =
                true;

            submitAnswerButton.disabled =
                true;

        }

        else {

            answerInput.disabled =
                false;

            submitAnswerButton.disabled =
                false;


            const used =
                updatedRoom.usedAnswers?.[
                    roundIndex
                ]?.[
                    answer
                ];


            if (used) {

                answerStatus.textContent =
                    "WORD ALREADY USED. TRY ANOTHER.";

            }

            else {

                answerStatus.textContent =
                    "ROUND ENDED.";

            }

        }

    }

    catch (error) {

        console.error(
            "ANSWER ERROR:",
            error
        );


        answerInput.disabled =
            false;

        submitAnswerButton.disabled =
            false;


        answerStatus.textContent =
            "ERROR. TRY AGAIN.";

    }

}


/* =========================
   USED WORDS
========================= */

function renderUsedWords() {

    if (!currentRoom) {

        return;

    }


    const roundIndex =
        Number(
            currentRoom.currentRound || 0
        );


    const answers =
        currentRoom.usedAnswers?.[
            roundIndex
        ] ||
        {};


    const entries =
        Object.entries(
            answers
        );


    usedWordCount.textContent =
        entries.length;


    usedWords.innerHTML =
        "";


    if (
        entries.length === 0
    ) {

        const empty =
            document.createElement(
                "div"
            );


        empty.className =
            "empty-words";


        empty.textContent =
            "No words submitted yet.";


        usedWords.appendChild(
            empty
        );

        return;

    }


    entries
        .sort(
            function (
                a,
                b
            ) {

                return (
                    Number(
                        a[1].timestamp
                    ) -
                    Number(
                        b[1].timestamp
                    )
                );

            }
        )
        .forEach(
            function ([word]) {

                const element =
                    document.createElement(
                        "div"
                    );


                element.className =
                    "used-word";


                element.textContent =
                    word;


                usedWords.appendChild(
                    element
                );

            }
        );

}


/* =========================
   SCOREBOARD
========================= */

function renderScoreboard() {

    if (!currentRoom) {

        return;

    }


    const players =
        currentRoom.players ||
        {};


    const entries =
        Object.entries(
            players
        )
        .filter(
            function ([, player]) {

                return !player.leftGame;

            }
        )
        .sort(
            function (a, b) {

                const scoreA =
                    Number(
                        a[1].score || 0
                    );


                const scoreB =
                    Number(
                        b[1].score || 0
                    );


                return (
                    scoreB -
                    scoreA
                );

            }
        );


    scoreboard.innerHTML =
        "";


    entries.forEach(
        function (
            [uid, player],
            index
        ) {

            const playerElement =
                document.createElement(
                    "div"
                );


            playerElement.className =
                "scoreboard-player";


            if (
                uid ===
                currentUser.uid
            ) {

                playerElement.classList.add(
                    "you"
                );

            }


            const name =
                document.createElement(
                    "span"
                );


            name.className =
                "scoreboard-name";


            name.textContent =
                `${index + 1}. ${
                    player.username ||
                    "Player"
                }${
                    uid === currentUser.uid
                        ? " (YOU)"
                        : ""
                }`;


            const score =
                document.createElement(
                    "span"
                );


            score.className =
                "scoreboard-score";


            score.textContent =
                `${Number(
                    player.score || 0
                )} PTS`;


            playerElement.appendChild(
                name
            );

            playerElement.appendChild(
                score
            );


            scoreboard.appendChild(
                playerElement
            );

        }
    );

}


/* =========================
   ROUND TRANSITION
========================= */

async function transitionToRoundResult() {

    if (
        transitionStarted
    ) {

        return;

    }


    transitionStarted =
        true;


    try {

        const roomRef =
            ref(
                database,
                `lastWordRooms/${roomCode}`
            );


        await runTransaction(
            roomRef,
            function (room) {

                if (!room) {

                    return room;

                }


                if (
                    room.status !==
                    "playing"
                ) {

                    return room;

                }


                const now =
                    Date.now();


                const startTime =
                    Number(
                        room.roundStartAt
                    );


                if (
                    now <
                    startTime +
                    ROUND_DURATION
                ) {

                    return room;

                }


                room.status =
                    "roundResult";


                room.roundResultAt =
                    now;


                return room;

            }
        );

    }

    catch (error) {

        console.error(
            "ROUND TRANSITION ERROR:",
            error
        );

    }

}


/* =========================
   SHOW ROUND RESULT
========================= */

function showRoundResult() {

    if (timerInterval) {

        clearInterval(
            timerInterval
        );


        timerInterval =
            null;

    }


    answerInput.disabled =
        true;

    submitAnswerButton.disabled =
        true;


    roundResult.classList.remove(
        "hidden"
    );


    roundResultSmall.textContent =
        `ROUND ${
            Number(
                currentRoom.currentRound
            ) + 1
        } COMPLETE`;


    roundResultTitle.textContent =
        "TIME'S UP!";


    roundResultDescription.textContent =
        "Get ready for the next category.";


    updateResultCountdown();

}


/* =========================
   RESULT COUNTDOWN
========================= */

function updateResultCountdown() {

    if (
        currentRoom.status !==
        "roundResult"
    ) {

        return;

    }


    const resultStart =
        Number(
            currentRoom.roundResultAt
        );


    const elapsed =
        Date.now() -
        resultStart;


    const remaining =
        Math.max(
            0,
            RESULT_DURATION -
            elapsed
        );


    const seconds =
        Math.ceil(
            remaining / 1000
        );


    nextRoundTimer.textContent =
        seconds;


    if (
        remaining <= 0
    ) {

        moveToNextRound();

    }

    else {

        requestAnimationFrame(
            updateResultCountdown
        );

    }

}


/* =========================
   NEXT ROUND
========================= */

async function moveToNextRound() {

    if (
        resultTransitionStarted
    ) {

        return;

    }


    resultTransitionStarted =
        true;


    try {

        const roomRef =
            ref(
                database,
                `lastWordRooms/${roomCode}`
            );


        await runTransaction(
            roomRef,
            function (room) {

                if (!room) {

                    return room;

                }


                if (
                    room.status !==
                    "roundResult"
                ) {

                    return room;

                }


                const now =
                    Date.now();


                if (
                    now <
                    Number(
                        room.roundResultAt
                    ) +
                    RESULT_DURATION
                ) {

                    return room;

                }


                const currentRound =
                    Number(
                        room.currentRound
                    );


                /*
                   GAME FINISHED
                */

                if (
                    currentRound >=
                    TOTAL_ROUNDS - 1
                ) {

                    room.status =
                        "finished";


                    room.finishedAt =
                        now;


                    return room;

                }


                /*
                   NEXT ROUND
                */

                room.currentRound =
                    currentRound + 1;


                room.status =
                    "playing";


                room.roundStartAt =
                    now;


                return room;

            }
        );

    }

    catch (error) {

        console.error(
            "NEXT ROUND ERROR:",
            error
        );

    }

    finally {

        resultTransitionStarted =
            false;

        transitionStarted =
            false;

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


    roundResult.classList.add(
        "hidden"
    );


    finalResult.classList.remove(
        "hidden"
    );


    calculateFinalResults();

}


/* =========================
   CALCULATE FINAL RESULTS
========================= */

async function calculateFinalResults() {

    try {

        const roomRef =
            ref(
                database,
                `lastWordRooms/${roomCode}`
            );


        const result =
            await runTransaction(
                roomRef,
                function (room) {

                    if (!room) {

                        return room;

                    }


                    if (
                        room.rewardsCalculated
                    ) {

                        return room;

                    }


                    const players =
                        room.players ||
                        {};


                    const entries =
                        Object.entries(
                            players
                        )
                        .filter(
                            function ([, player]) {

                                return !player.leftGame;

                            }
                        )
                        .map(
                            function ([uid, player]) {

                                return {
                                    uid,
                                    score:
                                        Number(
                                            player.score || 0
                                        )
                                };

                            }
                        )
                        .sort(
                            function (a, b) {

                                return (
                                    b.score -
                                    a.score
                                );

                            }
                        );


                    /*
                       COUNT SAME SCORES
                    */

                    const scoreCount =
                        {};


                    entries.forEach(
                        function (player) {

                            scoreCount[
                                player.score
                            ] =
                                (
                                    scoreCount[
                                        player.score
                                    ] || 0
                                ) + 1;

                        }
                    );


                    /*
                       ONLY UNIQUE SCORES
                       CAN RECEIVE CP
                    */

                    entries.forEach(
                        function (
                            player,
                            index
                        ) {

                            const isTied =
                                scoreCount[
                                    player.score
                                ] > 1;


                            let reward =
                                0;


                            /*
                               Rank is only rewarded
                               if that score is unique.
                            */

                            if (!isTied) {

                                if (
                                    index === 0
                                ) {

                                    reward =
                                        FIRST_REWARD;

                                }

                                else if (
                                    index === 1
                                ) {

                                    reward =
                                        SECOND_REWARD;

                                }

                                else if (
                                    index === 2
                                ) {

                                    reward =
                                        THIRD_REWARD;

                                }

                            }


                            players[
                                player.uid
                            ].finalRank =
                                index + 1;


                            players[
                                player.uid
                            ].finalReward =
                                reward;

                        }
                    );


                    room.rewardsCalculated =
                        true;


                    return room;

                }
            );


        if (
            result.committed
        ) {

            await distributeRewards();

        }

    }

    catch (error) {

        console.error(
            "FINAL RESULT ERROR:",
            error
        );

    }


    renderFinalLeaderboard();

}


/* =========================
   DISTRIBUTE REWARDS
========================= */

async function distributeRewards() {

    try {

        const roomRef =
            ref(
                database,
                `lastWordRooms/${roomCode}`
            );


        const snapshot =
            await get(
                roomRef
            );


        if (!snapshot.exists()) {

            return;

        }


        const room =
            snapshot.val();


        if (
            room.rewardsDistributed
        ) {

            return;

        }


        const transaction =
            await runTransaction(
                roomRef,
                function (latestRoom) {

                    if (!latestRoom) {

                        return latestRoom;

                    }


                    if (
                        latestRoom.rewardsDistributed
                    ) {

                        return latestRoom;

                    }


                    latestRoom.rewardsDistributed =
                        true;


                    return latestRoom;

                }
            );


        if (
            !transaction.committed
        ) {

            return;

        }


        const players =
            room.players ||
            {};


        for (
            const [uid, player]
            of Object.entries(
                players
            )
        ) {

            const reward =
                Number(
                    player.finalReward || 0
                );


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
                function (points) {

                    return (
                        Number(points) || 0
                    ) +
                    reward;

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
   FINAL LEADERBOARD
========================= */

function renderFinalLeaderboard() {

    if (!currentRoom) {

        return;

    }


    const players =
        currentRoom.players ||
        {};


    const entries =
        Object.entries(
            players
        )
        .filter(
            function ([, player]) {

                return !player.leftGame;

            }
        )
        .sort(
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


    finalLeaderboard.innerHTML =
        "";


    entries.forEach(
        function ([uid, player]) {

            const row =
                document.createElement(
                    "div"
                );


            row.className =
                "final-player";


            const rank =
                document.createElement(
                    "span"
                );


            rank.className =
                "final-rank";


            rank.textContent =
                `#${player.finalRank}`;


            const name =
                document.createElement(
                    "span"
                );


            name.className =
                "final-name";


            name.textContent =
                `${player.username || "Player"}${
                    uid === currentUser.uid
                        ? " (YOU)"
                        : ""
                }`;


            const score =
                document.createElement(
                    "span"
                );


            score.className =
                "final-score";


            score.textContent =
                `${Number(
                    player.score || 0
                )} PTS`;


            row.appendChild(
                rank
            );

            row.appendChild(
                name
            );

            row.appendChild(
                score
            );


            finalLeaderboard.appendChild(
                row
            );

        }
    );


    const myReward =
        Number(
            currentPlayer.finalReward || 0
        );


    rewardAmount.textContent =
        `+${myReward} CP`;


    if (
        myReward > 0
    ) {

        finalIcon.textContent =
            "🏆";


        finalSmallTitle.textContent =
            "YOU WON CHAOS POINTS";


        finalTitle.textContent =
            "CONGRATULATIONS!";


        finalDescription.textContent =
            `You finished with ${
                currentPlayer.score || 0
            } points and earned ${myReward} CP.`;

    }

    else {

        finalIcon.textContent =
            "🎮";


        finalSmallTitle.textContent =
            "GAME COMPLETE";


        finalTitle.textContent =
            "BETTER LUCK NEXT TIME";


        finalDescription.textContent =
            `You finished with ${
                currentPlayer.score || 0
            } points.`;

    }

}


/* =========================
   DISCONNECTED
========================= */

function showDisconnected() {

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