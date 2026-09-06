import {
    ref,
    set,
    get,
    update,
    onValue,
    remove,
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



/* =========================
   FIREBASE
========================= */

const auth =
    getAuth(app);



/* =========================
   GAME SETTINGS
========================= */

const TOTAL_ROUNDS =
    5;

const CODE_LENGTH =
    5;

const ROUND_DURATION =
    60 * 1000;

const CLUE_INTERVAL =
    10 * 1000;

const BREAK_DURATION =
    5 * 1000;


/*
   Top 3 Chaos Point rewards.

   Change these values later if you
   want different rewards.
*/

const TOP_REWARDS = {

    1: 100,

    2: 75,

    3: 50

};



/* =========================
   ELEMENTS
========================= */

const roomCodeDisplay =
    document.getElementById(
        "roomCodeDisplay"
    );

const exitButton =
    document.getElementById(
        "exitButton"
    );

const roundDisplay =
    document.getElementById(
        "roundDisplay"
    );

const timerDisplay =
    document.getElementById(
        "timerDisplay"
    );

const scoreDisplay =
    document.getElementById(
        "scoreDisplay"
    );

const codeDigits =
    document.getElementById(
        "codeDigits"
    );

const clueCounter =
    document.getElementById(
        "clueCounter"
    );

const cluesList =
    document.getElementById(
        "cluesList"
    );

const submitButton =
    document.getElementById(
        "submitButton"
    );

const answerStatus =
    document.getElementById(
        "answerStatus"
    );

const standingsList =
    document.getElementById(
        "standingsList"
    );

const gameSection =
    document.getElementById(
        "gameSection"
    );

const roundBreak =
    document.getElementById(
        "roundBreak"
    );

const breakTitle =
    document.getElementById(
        "breakTitle"
    );

const roundResultList =
    document.getElementById(
        "roundResultList"
    );

const breakCountdown =
    document.getElementById(
        "breakCountdown"
    );

const finalResults =
    document.getElementById(
        "finalResults"
    );

const winnerDisplay =
    document.getElementById(
        "winnerDisplay"
    );

const finalLeaderboard =
    document.getElementById(
        "finalLeaderboard"
    );

const lobbyButton =
    document.getElementById(
        "lobbyButton"
    );

const dashboardButton =
    document.getElementById(
        "dashboardButton"
    );

const digitInputs = [
    document.getElementById("digit1"),
    document.getElementById("digit2"),
    document.getElementById("digit3"),
    document.getElementById("digit4"),
    document.getElementById("digit5")
];



/* =========================
   STATE
========================= */

let currentUser =
    null;

let currentUsername =
    "Player";

let currentRoomCode =
    null;

let currentRoomData =
    null;

let roomListenerStarted =
    false;

let timerInterval =
    null;

let lifecycleTimeout =
    null;

let hostLifecycleRunning =
    false;

let redirecting =
    false;

let currentRoundNumber =
    null;



/* =========================
   GET ROOM CODE
========================= */

const params =
    new URLSearchParams(
        window.location.search
    );


currentRoomCode =
    params.get("room")
        ?.trim()
        .toUpperCase();



/* =========================
   VALIDATE ROOM
========================= */

if (!currentRoomCode) {

    window.location.href =
        "clobby.html";

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


        await loadUserProfile();


        if (
            currentRoomCode
        ) {

            listenToRoom();

        }

    }
);



/* =========================
   LOAD PROFILE
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


        if (
            snapshot.exists()
        ) {

            const data =
                snapshot.val();


            currentUsername =
                data.username ||
                "Player";

        }

    }

    catch (error) {

        console.error(
            "LOAD USER ERROR:",
            error
        );

    }

}



/* =========================
   ROOM REFERENCE
========================= */

function getRoomRef() {

    return ref(
        database,
        `chaosCodeRooms/${currentRoomCode}`
    );

}



/* =========================
   LISTEN TO ROOM
========================= */

function listenToRoom() {

    if (
        roomListenerStarted
    ) {

        return;

    }


    roomListenerStarted =
        true;


    const roomRef =
        getRoomRef();


    onValue(
        roomRef,
        async function (snapshot) {

            if (
                !snapshot.exists()
            ) {

                window.location.href =
                    "clobby.html";

                return;

            }


            currentRoomData =
                snapshot.val();


            const player =
                currentRoomData.players?.[
                    currentUser.uid
                ];


            /*
               User is no longer in room.
            */

            if (!player) {

                window.location.href =
                    "clobby.html";

                return;

            }


            /*
               Basic display.
            */

            roomCodeDisplay.textContent =
                currentRoomCode;


            scoreDisplay.textContent =
                player.score || 0;


            renderStandings(
                currentRoomData
            );


            /*
               Handle current room state.
            */

            if (
                currentRoomData.status ===
                "starting"
            ) {

                await handleStartingState();

            }


            else if (
                currentRoomData.status ===
                "playing"
            ) {

                handlePlayingState();

            }


            else if (
                currentRoomData.status ===
                "roundResult"
            ) {

                handleRoundResultState();

            }


            else if (
                currentRoomData.status ===
                "finished"
            ) {

                renderFinalResults(
                    currentRoomData
                );

            }

        }
    );

}



/* =========================
   STARTING STATE
========================= */

async function handleStartingState() {

    /*
       Only the host generates the first
       round.

       Other players simply wait for the
       host to save it.
    */

    if (
        currentRoomData.hostUid ===
        currentUser.uid
    ) {

        await initializeFirstRound();

    }

}



/* =========================
   INITIALIZE FIRST ROUND
========================= */

async function initializeFirstRound() {

    if (
        currentRoomData.rounds &&
        currentRoomData.rounds["1"]
    ) {

        return;

    }


    try {

        const round =
            generateRound();


        const roomRef =
            getRoomRef();


        const updates = {};


        updates[
            "rounds/1"
        ] = round;


        updates[
            "currentRound"
        ] = 1;


        updates[
            "currentCode"
        ] = round.code;


        updates[
            "currentClues"
        ] = round.clues;


        updates[
            "roundStartAt"
        ] = serverTimestamp();


        updates[
            "roundEndAt"
        ] = null;


        updates[
            "roundResultAt"
        ] = null;


        updates[
            "status"
        ] = "playing";


        updates[
            "answers/1"
        ] = null;


        await update(
            roomRef,
            updates
        );

    }

    catch (error) {

        console.error(
            "INITIALIZE ROUND ERROR:",
            error
        );

    }

}



/* =========================
   PLAYING STATE
========================= */

function handlePlayingState() {

    const roundNumber =
        Number(
            currentRoomData.currentRound
        );


    if (
        !roundNumber
    ) {

        return;

    }


    const round =
        currentRoomData.rounds?.[
            roundNumber
        ];


    if (!round) {

        return;

    }


    /*
       Render current round.
    */

    renderRound(
        roundNumber,
        round
    );


    /*
       Start local countdown.
    */

    startTimer();


    /*
       Only host controls
       round transitions.
    */

    if (
        currentRoomData.hostUid ===
        currentUser.uid
    ) {

        startHostLifecycle();

    }

}



/* =========================
   RENDER ROUND
========================= */

function renderRound(
    roundNumber,
    round
) {

    if (
        currentRoundNumber !==
        roundNumber
    ) {

        currentRoundNumber =
            roundNumber;


        clearAnswerInputs();

        resetAnswerStatus();

    }


    roundDisplay.textContent =
        `${roundNumber} / ${TOTAL_ROUNDS}`;


    /*
       Show the five digits in the
       shuffled display order.

       The actual secret arrangement
       is not exposed here.
    */

    renderCodeDigits(
        round.displayDigits
    );


    /*
       Render clues according to
       elapsed time.
    */

    renderAvailableClues(
        round
    );


    /*
       Check whether this player
       already solved the round.
    */

    const answers =
        currentRoomData.answers?.[
            roundNumber
        ] || {};


    const myAnswer =
        answers[
            currentUser.uid
        ];


    if (
        myAnswer &&
        myAnswer.correct === true
    ) {

        submitButton.disabled =
            true;


        digitInputs.forEach(
            input => {
                input.disabled = true;
            }
        );


        answerStatus.className =
            "answer-status correct";


        answerStatus.textContent =
            `✅ CODE CRACKED! +${myAnswer.points || 0} POINTS`;

    }


    else {

        submitButton.disabled =
            false;

        digitInputs.forEach(
            input => {
                input.disabled = false;
            }
        );

    }

}



/* =========================
   CODE DIGITS
========================= */

function renderCodeDigits(
    digits
) {

    codeDigits.innerHTML =
        "";


    digits.forEach(
        function (digit) {

            const element =
                document.createElement(
                    "span"
                );


            element.textContent =
                digit;


            codeDigits.appendChild(
                element
            );

        }
    );

}



/* =========================
   CLUES
========================= */

function renderAvailableClues(
    round
) {

    const startAt =
        getTimestamp(
            currentRoomData.roundStartAt
        );


    if (
        !startAt
    ) {

        return;

    }


    const elapsed =
        Math.max(
            0,
            Date.now() - startAt
        );


    let visibleCount =
        Math.floor(
            elapsed /
            CLUE_INTERVAL
        ) + 1;


    if (
        elapsed >=
        ROUND_DURATION
    ) {

        visibleCount =
            5;

    }


    visibleCount =
        Math.max(
            0,
            Math.min(
                5,
                visibleCount
            )
        );


    clueCounter.textContent =
        `${visibleCount} / 5`;


    cluesList.innerHTML =
        "";


    for (
        let i = 0;
        i < 5;
        i++
    ) {

        if (
            i < visibleCount
        ) {

            const clue =
                round.clues[i];


            const element =
                document.createElement(
                    "div"
                );


            element.className =
                "clue";


            element.innerHTML = `

                <div class="clue-number">
                    🔢 CLUE ${i + 1}
                </div>

                <div class="clue-guess">
                    ${clue.guess.join(" ")}
                </div>

                <div class="clue-text">
                    ${escapeHtml(clue.text)}
                </div>

            `;


            cluesList.appendChild(
                element
            );

        }

        else {

            const element =
                document.createElement(
                    "div"
                );


            element.className =
                "locked-clue";


            element.textContent =
                `🔒 CLUE ${i + 1}`;


            cluesList.appendChild(
                element
            );

        }

    }

}



/* =========================
   TIMER
========================= */

function startTimer() {

    clearInterval(
        timerInterval
    );


    function updateTimer() {

        const startAt =
            getTimestamp(
                currentRoomData.roundStartAt
            );


        if (
            !startAt
        ) {

            timerDisplay.textContent =
                "01:00";

            return;

        }


        const elapsed =
            Date.now() -
            startAt;


        const remaining =
            Math.max(
                0,
                ROUND_DURATION -
                elapsed
            );


        const seconds =
            Math.ceil(
                remaining /
                1000
            );


        const minutes =
            Math.floor(
                seconds /
                60
            );


        const displaySeconds =
            String(
                seconds % 60
            ).padStart(
                2,
                "0"
            );


        timerDisplay.textContent =
            `${String(minutes).padStart(2, "0")}:${displaySeconds}`;


        renderAvailableClues(
            currentRoomData.rounds?.[
                currentRoomData.currentRound
            ]
        );


        if (
            remaining <= 0
        ) {

            clearInterval(
                timerInterval
            );

        }

    }


    updateTimer();


    timerInterval =
        setInterval(
            updateTimer,
            200
        );

}



/* =========================
   HOST ROUND LIFECYCLE
========================= */

function startHostLifecycle() {

    if (
        hostLifecycleRunning
    ) {

        return;

    }


    hostLifecycleRunning =
        true;


    clearTimeout(
        lifecycleTimeout
    );


    lifecycleTimeout =
        setTimeout(
            function () {

                finishCurrentRound();

            },
            getRemainingRoundTime()
        );

}



/* =========================
   REMAINING ROUND TIME
========================= */

function getRemainingRoundTime() {

    const startAt =
        getTimestamp(
            currentRoomData.roundStartAt
        );


    if (
        !startAt
    ) {

        return ROUND_DURATION;

    }


    const elapsed =
        Date.now() -
        startAt;


    return Math.max(
        0,
        ROUND_DURATION -
        elapsed
    );

}



/* =========================
   FINISH ROUND
========================= */

async function finishCurrentRound() {

    if (
        !currentRoomData
    ) {

        return;

    }


    if (
        currentRoomData.status !==
        "playing"
    ) {

        return;

    }


    const roomRef =
        getRoomRef();


    try {

        await update(
            roomRef,
            {

                status:
                    "roundResult",

                roundEndAt:
                    serverTimestamp(),

                roundResultAt:
                    serverTimestamp()

            }
        );

    }

    catch (error) {

        console.error(
            "FINISH ROUND ERROR:",
            error
        );

    }

}



/* =========================
   ROUND RESULT STATE
========================= */

function handleRoundResultState() {

    clearInterval(
        timerInterval
    );


    hostLifecycleRunning =
        false;


    const roundNumber =
        Number(
            currentRoomData.currentRound
        );


    const round =
        currentRoomData.rounds?.[
            roundNumber
        ];


    if (!round) {

        return;

    }


    /*
       Finish the player's interaction.
    */

    submitButton.disabled =
        true;


    digitInputs.forEach(
        input => {
            input.disabled = true;
        }
    );


    /*
       Show round result.
    */

    const answers =
        currentRoomData.answers?.[
            roundNumber
        ] || {};


    const players =
        currentRoomData.players ||
        {};


    const results =
        Object.entries(players)
            .filter(
                ([, player]) =>
                    !player.leftGame
            )
            .map(
                ([uid, player]) => {

                    const answer =
                        answers[uid];

                    return {

                        uid,

                        username:
                            player.username ||
                            "Player",

                        points:
                            answer?.points ||
                            0,

                        correct:
                            answer?.correct === true,

                        totalScore:
                            player.score ||
                            0

                    };

                }
            )
            .sort(
                (a, b) =>
                    b.points -
                    a.points
            );


    showRoundBreak(
        roundNumber,
        results
    );


    /*
       Host creates the next round after
       exactly 5 seconds.
    */

    if (
        currentRoomData.hostUid ===
        currentUser.uid
    ) {

        clearTimeout(
            lifecycleTimeout
        );


        lifecycleTimeout =
            setTimeout(
                startNextRound,
                BREAK_DURATION
            );

    }

}



/* =========================
   ROUND BREAK UI
========================= */

function showRoundBreak(
    roundNumber,
    results
) {

    roundBreak.classList.remove(
        "hidden"
    );


    breakTitle.textContent =
        `ROUND ${roundNumber} RESULTS`;


    roundResultList.innerHTML =
        "";


    results.forEach(
        function (result, index) {

            const row =
                document.createElement(
                    "div"
                );


            row.className =
                "round-result";


            const left =
                document.createElement(
                    "span"
                );


            left.textContent =
                `${index + 1}. ${result.username}`;


            const right =
                document.createElement(
                    "strong"
                );


            right.textContent =
                result.correct
                    ? `+${result.points}`
                    : "+0";


            row.appendChild(
                left
            );


            row.appendChild(
                right
            );


            roundResultList.appendChild(
                row
            );

        }
    );


    startBreakCountdown();

}



/* =========================
   BREAK COUNTDOWN
========================= */

function startBreakCountdown() {

    const started =
        Date.now();


    function tick() {

        const elapsed =
            Date.now() -
            started;


        const remaining =
            Math.max(
                0,
                BREAK_DURATION -
                elapsed
            );


        const seconds =
            Math.ceil(
                remaining /
                1000
            );


        breakCountdown.textContent =
            seconds;


        if (
            remaining <= 0
        ) {

            clearTimeout(
                countdownTimeout
            );

        }

    }


    let countdownTimeout;


    function run() {

        tick();


        if (
            Date.now() -
            started <
            BREAK_DURATION
        ) {

            countdownTimeout =
                setTimeout(
                    run,
                    100
                );

        }

    }


    run();

}



/* =========================
   START NEXT ROUND
========================= */

async function startNextRound() {

    if (
        !currentRoomData
    ) {

        return;

    }


    const currentRound =
        Number(
            currentRoomData.currentRound
        );


    /*
       Round 5 is the final round.
    */

    if (
        currentRound >=
        TOTAL_ROUNDS
    ) {

        await finishGame();

        return;

    }


    const nextRound =
        currentRound + 1;


    const roomRef =
        getRoomRef();


    try {

        /*
           Generate next round.
        */

        const round =
            generateRound();


        /*
           Reset answers for this round.
        */

        const players =
            currentRoomData.players ||
            {};


        const playerUpdates = {};


        Object.keys(
            players
        ).forEach(
            function (uid) {

                playerUpdates[
                    `players/${uid}/currentRoundScore`
                ] = 0;


                playerUpdates[
                    `players/${uid}/lastAnswer`
                ] = null;


                playerUpdates[
                    `players/${uid}/lastAnsweredRound`
                ] = null;


                playerUpdates[
                    `players/${uid}/submittedAt`
                ] = null;

            }
        );


        /*
           Save round before
           players see it.
        */

        const updates = {

            ...playerUpdates,

            [`rounds/${nextRound}`]:
                round,

            [`answers/${nextRound}`]:
                null,

            currentRound:
                nextRound,

            currentCode:
                round.code,

            currentClues:
                round.clues,

            roundStartAt:
                serverTimestamp(),

            roundEndAt:
                null,

            roundResultAt:
                null,

            status:
                "playing"

        };


        await update(
            roomRef,
            updates
        );


        roundBreak.classList.add(
            "hidden"
        );


        currentRoundNumber =
            null;


        hostLifecycleRunning =
            false;


        clearAnswerInputs();

    }

    catch (error) {

        console.error(
            "START NEXT ROUND ERROR:",
            error
        );

    }

}



/* =========================
   SUBMIT ANSWER
========================= */

submitButton.addEventListener(
    "click",
    submitAnswer
);



async function submitAnswer() {

    if (
        !currentUser ||
        !currentRoomData
    ) {

        return;

    }


    if (
        currentRoomData.status !==
        "playing"
    ) {

        return;

    }


    const roundNumber =
        Number(
            currentRoomData.currentRound
        );


    const round =
        currentRoomData.rounds?.[
            roundNumber
        ];


    if (!round) {

        return;

    }


    /*
       Check whether already solved.
    */

    const existingAnswer =
        currentRoomData.answers?.[
            roundNumber
        ]?.[
            currentUser.uid
        ];


    if (
        existingAnswer?.correct
    ) {

        return;

    }


    const answer =
        getAnswerFromInputs();


    if (
        answer.length !==
        CODE_LENGTH
    ) {

        showAnswerStatus(
            "ENTER ALL 5 DIGITS.",
            "wrong"
        );

        return;

    }


    if (
        new Set(answer).size !==
        CODE_LENGTH
    ) {

        showAnswerStatus(
            "USE EACH OF THE 5 CODE DIGITS ONCE.",
            "wrong"
        );

        return;

    }


    /*
       Make sure player is actually using
       the five digits supplied by the round.
    */

    const availableDigits =
        round.displayDigits
            .map(
                digit =>
                    String(digit)
            );


    const validDigits =
        availableDigits.every(
            digit =>
                answer.includes(
                    digit
                )
        );


    if (!validDigits) {

        showAnswerStatus(
            "USE ONLY THE FIVE DIGITS SHOWN ABOVE.",
            "wrong"
        );

        return;

    }


    const codeString =
        round.code.join("");


    const isCorrect =
        answer === codeString;


    submitButton.disabled =
        true;


    try {

        const answerRef =
            ref(
                database,
                `chaosCodeRooms/${currentRoomCode}/answers/${roundNumber}/${currentUser.uid}`
            );


        /*
           serverTimestamp makes solve speed
           much fairer across different devices.
        */

        await set(
            answerRef,
            {

                answer,

                submittedAt:
                    serverTimestamp(),

                correct:
                    isCorrect,

                points:
                    isCorrect
                        ? 0
                        : 0

            }
        );


        if (!isCorrect) {

            showAnswerStatus(
                "❌ NOT THE CODE. TRY AGAIN.",
                "wrong"
            );


            /*
               Allow another attempt.
            */

            setTimeout(
                function () {

                    if (
                        currentRoomData.status ===
                        "playing"
                    ) {

                        submitButton.disabled =
                            false;

                    }

                },
                250
            );

        }

        else {

            showAnswerStatus(
                "✅ CORRECT! CALCULATING SPEED...",
                "correct"
            );

        }

    }

    catch (error) {

        console.error(
            "SUBMIT ANSWER ERROR:",
            error
        );


        submitButton.disabled =
            false;


        showAnswerStatus(
            "COULD NOT SUBMIT. TRY AGAIN.",
            "wrong"
        );

    }

}



/* =========================
   ANSWER INPUT
========================= */

function getAnswerFromInputs() {

    return digitInputs
        .map(
            input =>
                input.value.trim()
        )
        .join("");

}



/* =========================
   INPUT HANDLING
========================= */

digitInputs.forEach(
    function (input, index) {

        input.addEventListener(
            "input",
            function () {

                input.value =
                    input.value
                        .replace(
                            /[^0-9]/g,
                            ""
                        )
                        .slice(0, 1);


                if (
                    input.value &&
                    index <
                    digitInputs.length - 1
                ) {

                    digitInputs[
                        index + 1
                    ].focus();

                }

            }
        );


        input.addEventListener(
            "keydown",
            function (event) {

                if (
                    event.key ===
                    "Backspace" &&
                    !input.value &&
                    index > 0
                ) {

                    digitInputs[
                        index - 1
                    ].focus();

                }


                if (
                    event.key ===
                    "Enter"
                ) {

                    submitAnswer();

                }

            }
        );

    }
);



/* =========================
   ROUND ANSWER PROCESSOR
========================= */

/*
   The host watches the answer records and
   assigns points to correct answers.

   This prevents each client from calculating
   their own score.
*/

onAuthStateChanged(
    auth,
    function () {

        /*
           Listener is attached once authentication
           is available.

           The actual room listener below will
           trigger processing.
        */

    }
);


/*
   Add a second listener only when the room
   has been loaded by the main room listener.
*/

async function processCorrectAnswers() {

    if (
        !currentRoomData
    ) {

        return;

    }


    if (
        currentRoomData.hostUid !==
        currentUser.uid
    ) {

        return;

    }


    if (
        currentRoomData.status !==
        "playing"
    ) {

        return;

    }


    const roundNumber =
        Number(
            currentRoomData.currentRound
        );


    const round =
        currentRoomData.rounds?.[
            roundNumber
        ];


    const answers =
        currentRoomData.answers?.[
            roundNumber
        ] || {};


    if (
        !round
    ) {

        return;

    }


    const roomRef =
        getRoomRef();


    for (
        const [uid, answer] of
        Object.entries(answers)
    ) {

        if (
            !answer ||
            answer.correct !== true ||
            answer.points > 0
        ) {

            continue;

        }


        /*
           Get server-generated submission time.
        */

        const submittedAt =
            getTimestamp(
                answer.submittedAt
            );


        const roundStartAt =
            getTimestamp(
                currentRoomData.roundStartAt
            );


        if (
            !submittedAt ||
            !roundStartAt
        ) {

            continue;

        }


        const elapsed =
            Math.max(
                0,
                submittedAt -
                roundStartAt
            );


        /*
           CONTINUOUS SPEED SCORE

           No 10-second brackets.

           The score smoothly decreases
           as the solve gets slower.

           100 points at extremely high speed.
           1 point at the end of the minute.
        */

        const progress =
            Math.max(
                0,
                Math.min(
                    1,
                    1 -
                    elapsed /
                    ROUND_DURATION
                )
            );


        const points =
            Math.max(
                1,
                Math.round(
                    100 *
                    Math.pow(
                        progress,
                        1.25
                    )
                )
            );


        /*
           Write awarded points.
        */

        const answerRef =
            ref(
                database,
                `chaosCodeRooms/${currentRoomCode}/answers/${roundNumber}/${uid}`
            );


        const transactionResult =
            await runTransaction(
                answerRef,
                function (current) {

                    if (
                        !current
                    ) {

                        return current;

                    }


                    /*
                       Another host-cycle already
                       processed it.
                    */

                    if (
                        current.points &&
                        current.points > 0
                    ) {

                        return;

                    }


                    current.points =
                        points;


                    current.processed =
                        true;


                    return current;

                }
            );


        if (
            !transactionResult.committed
        ) {

            continue;

        }


        /*
           Add points to the player total.
        */

        const playerRef =
            ref(
                database,
                `chaosCodeRooms/${currentRoomCode}/players/${uid}`
            );


        await runTransaction(
            playerRef,
            function (player) {

                if (!player) {

                    return player;

                }


                /*
                   Prevent duplicate awarding.
                */

                const currentRoundAwarded =
                    Number(
                        player.lastAnsweredRound
                    );


                if (
                    currentRoundAwarded ===
                    roundNumber
                ) {

                    return;

                }


                player.score =
                    Number(
                        player.score || 0
                    ) +
                    points;


                player.currentRoundScore =
                    points;


                player.lastAnsweredRound =
                    roundNumber;


                player.lastAnswer =
                    answer.answer;


                player.submittedAt =
                    answer.submittedAt;


                return player;

            }
        );

    }

}



/* =========================
   WATCH ANSWERS
========================= */

function startAnswerProcessor() {

    if (
        !currentUser ||
        !currentRoomCode
    ) {

        return;

    }


    if (
        currentRoomData &&
        currentRoomData.hostUid !==
        currentUser.uid
    ) {

        return;

    }


    const answersRef =
        ref(
            database,
            `chaosCodeRooms/${currentRoomCode}/answers`
        );


    onValue(
        answersRef,
        async function () {

            await processCorrectAnswers();

        }
    );

}



/* =========================
   START ANSWER PROCESSOR
========================= */

let answerProcessorStarted =
    false;


function ensureAnswerProcessor() {

    if (
        answerProcessorStarted
    ) {

        return;

    }


    if (
        !currentUser ||
        !currentRoomCode
    ) {

        return;

    }


    answerProcessorStarted =
        true;


    startAnswerProcessor();

}


/*
   The room listener runs frequently enough
   to ensure this starts after auth.
*/

const originalListenPlaceholder =
    listenToRoom;



/* =========================
   STANDINGS
========================= */

function renderStandings(
    room
) {

    const players =
        room.players || {};


    const entries =
        Object.entries(
            players
        )
        .filter(
            ([, player]) =>
                !player.leftGame
        )
        .sort(
            (a, b) =>
                Number(
                    b[1].score || 0
                ) -
                Number(
                    a[1].score || 0
                )
        );


    standingsList.innerHTML =
        "";


    if (
        entries.length === 0
    ) {

        standingsList.innerHTML = `
            <div class="empty-standing">
                Waiting for scores...
            </div>
        `;

        return;

    }


    entries.forEach(
        function ([uid, player], index) {

            const row =
                document.createElement(
                    "div"
                );


            row.className =
                "standing";


            const left =
                document.createElement(
                    "div"
                );


            left.className =
                "standing-left";


            const rank =
                document.createElement(
                    "span"
                );


            rank.className =
                "rank";


            rank.textContent =
                index < 3
                    ? ["🥇", "🥈", "🥉"][index]
                    : index + 1;


            const name =
                document.createElement(
                    "span"
                );


            name.className =
                "standing-name";


            name.textContent =
                player.username ||
                "Player";


            if (
                currentUser &&
                uid === currentUser.uid
            ) {

                const you =
                    document.createElement(
                        "span"
                    );


                you.className =
                    "standing-you";


                you.textContent =
                    "YOU";


                name.appendChild(
                    you
                );

            }


            left.appendChild(
                rank
            );


            left.appendChild(
                name
            );


            const score =
                document.createElement(
                    "span"
                );


            score.className =
                "standing-score";


            score.textContent =
                `${player.score || 0} PTS`;


            row.appendChild(
                left
            );


            row.appendChild(
                score
            );


            standingsList.appendChild(
                row
            );

        }
    );

}



/* =========================
   FINAL GAME
========================= */

async function finishGame() {

    if (
        !currentRoomData
    ) {

        return;

    }


    if (
        currentRoomData.status ===
        "finished"
    ) {

        return;

    }


    /*
       Only host calculates final results.
    */

    if (
        currentRoomData.hostUid !==
        currentUser.uid
    ) {

        return;

    }


    const roomRef =
        getRoomRef();


    try {

        const snapshot =
            await get(roomRef);


        if (
            !snapshot.exists()
        ) {

            return;

        }


        const room =
            snapshot.val();


        if (
            room.status ===
            "finished"
        ) {

            return;

        }


        const players =
            room.players || {};


        const entries =
            Object.entries(
                players
            )
            .filter(
                ([, player]) =>
                    !player.leftGame
            )
            .sort(
                (a, b) =>
                    Number(
                        b[1].score || 0
                    ) -
                    Number(
                        a[1].score || 0
                    )
            );


        const updates = {};


        entries.forEach(
            function ([uid], index) {

                const rank =
                    index + 1;


                const reward =
                    TOP_REWARDS[
                        rank
                    ] || 0;


                updates[
                    `players/${uid}/finalRank`
                ] = rank;


                updates[
                    `players/${uid}/finalReward`
                ] = reward;

            }
        );


        updates.status =
            "finished";


        updates.finishedAt =
            serverTimestamp();


        updates.rewardsCalculated =
            true;


        await update(
            roomRef,
            updates
        );


        /*
           Now distribute global Chaos Points.
        */

        if (
            room.rewardsDistributed !==
            true
        ) {

            await distributeRewards(
                entries
            );

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
   DISTRIBUTE CP
========================= */

async function distributeRewards(
    entries
) {

    const roomRef =
        getRoomRef();


    const snapshot =
        await get(roomRef);


    if (
        !snapshot.exists()
    ) {

        return;

    }


    const room =
        snapshot.val();


    if (
        room.rewardsDistributed ===
        true
    ) {

        return;

    }


    try {

        for (
            let index = 0;
            index < entries.length;
            index++
        ) {

            const uid =
                entries[index][0];


            const reward =
                TOP_REWARDS[
                    index + 1
                ] || 0;


            if (
                reward <= 0
            ) {

                continue;

            }


            const chaosPointsRef =
                ref(
                    database,
                    `users/${uid}/chaosPoints`
                );


            await runTransaction(
                chaosPointsRef,
                function (current) {

                    return Number(
                        current || 0
                    ) + reward;

                }
            );

        }


        await update(
            roomRef,
            {
                rewardsDistributed:
                    true
            }
        );

    }

    catch (error) {

        console.error(
            "REWARD DISTRIBUTION ERROR:",
            error
        );

    }

}



/* =========================
   FINAL RESULTS UI
========================= */

function renderFinalResults(
    room
) {

    clearInterval(
        timerInterval
    );


    roundBreak.classList.add(
        "hidden"
    );


    gameSection.classList.add(
        "hidden"
    );


    finalResults.classList.remove(
        "hidden"
    );


    const players =
        room.players || {};


    const entries =
        Object.entries(
            players
        )
        .filter(
            ([, player]) =>
                !player.leftGame
        )
        .sort(
            (a, b) =>
                Number(
                    a[1].finalRank || 999
                ) -
                Number(
                    b[1].finalRank || 999
                )
        );


    const winner =
        entries[0];


    if (winner) {

        winnerDisplay.innerHTML = `

            <div class="winner-title">
                👑 WINNER
            </div>

            <div class="winner-name">
                ${escapeHtml(
                    winner[1].username ||
                    "Player"
                )}
            </div>

            <div class="winner-score">
                ${winner[1].score || 0} POINTS
            </div>

        `;

    }


    finalLeaderboard.innerHTML =
        "";


    entries.forEach(
        function ([, player], index) {

            const rank =
                player.finalRank ||
                index + 1;


            const reward =
                player.finalReward ||
                0;


            const row =
                document.createElement(
                    "div"
                );


            row.className =
                "final-player";


            row.innerHTML = `

                <div class="final-player-left">

                    <span class="final-rank">
                        ${rank <= 3
                            ? ["🥇", "🥈", "🥉"][rank - 1]
                            : rank}
                    </span>

                    <span class="final-name">
                        ${escapeHtml(
                            player.username ||
                            "Player"
                        )}
                    </span>

                </div>

                <div class="final-score">
                    ${player.score || 0} PTS

                    ${
                        reward > 0
                            ? `<span class="reward">
                                +${reward} CP
                               </span>`
                            : ""
                    }

                </div>

            `;


            finalLeaderboard.appendChild(
                row
            );

        }
    );

}



/* =========================
   EXIT GAME
========================= */

exitButton.addEventListener(
    "click",
    async function () {

        if (
            !currentUser ||
            !currentRoomCode
        ) {

            window.location.href =
                "clobby.html";

            return;

        }


        try {

            const playerRef =
                ref(
                    database,
                    `chaosCodeRooms/${currentRoomCode}/players/${currentUser.uid}`
                );


            await update(
                playerRef,
                {
                    leftGame: true
                }
            );


            window.location.href =
                "clobby.html";

        }

        catch (error) {

            console.error(
                "EXIT ERROR:",
                error
            );

        }

    }
);



/* =========================
   LOBBY BUTTON
========================= */

lobbyButton.addEventListener(
    "click",
    function () {

        window.location.href =
            "clobby.html";

    }
);



/* =========================
   DASHBOARD BUTTON
========================= */

dashboardButton.addEventListener(
    "click",
    function () {

        window.location.href =
            "dashboard.html";

    }
);



/* =========================
   CLEAR ANSWERS
========================= */

function clearAnswerInputs() {

    digitInputs.forEach(
        function (input) {

            input.value = "";

            input.disabled = false;

        }
    );


    submitButton.disabled =
        false;

}



/* =========================
   ANSWER STATUS
========================= */

function showAnswerStatus(
    message,
    type
) {

    answerStatus.textContent =
        message;


    answerStatus.className =
        `answer-status ${type}`;

}


function resetAnswerStatus() {

    answerStatus.textContent =
        "";


    answerStatus.className =
        "answer-status";

}



/* =========================
   GENERATE ROUND
========================= */

function generateRound() {

    /*
       Create five unique digits.
    */

    const digits =
        generateUniqueDigits(
            CODE_LENGTH
        );


    /*
       The actual secret order.
    */

    const secret =
        shuffle(
            [...digits]
        );


    /*
       Try to generate five clues
       that uniquely identify the
       secret among its 120 possible
       arrangements.
    */

    let clues = [];


    for (
        let attempt = 0;
        attempt < 500;
        attempt++
    ) {

        const candidateClues = [];


        const usedGuesses =
            new Set();


        while (
            candidateClues.length < 5
        ) {

            const guess =
                generateGuess();


            const guessString =
                guess.join("");


            if (
                usedGuesses.has(
                    guessString
                )
            ) {

                continue;

            }


            usedGuesses.add(
                guessString
            );


            /*
               Don't accidentally use the
               secret itself.
            */

            if (
                guessString ===
                secret.join("")
            ) {

                continue;

            }


            const feedback =
                evaluateGuess(
                    guess,
                    secret
                );


            /*
               Reject completely useless
               clues.
            */

            if (
                feedback.exact ===
                    0 &&
                feedback.misplaced ===
                    0
            ) {

                continue;

            }


            candidateClues.push({

                guess,

                exact:
                    feedback.exact,

                misplaced:
                    feedback.misplaced,

                absent:
                    feedback.absent,

                text:
                    buildClueText(
                        feedback
                    )

            });

        }


        /*
           Check uniqueness.
        */

        if (
            hasUniqueSolution(
                digits,
                candidateClues,
                secret
            )
        ) {

            clues =
                candidateClues;

            break;

        }

    }


    /*
       Fallback.

       This should almost never be needed,
       but guarantees five clues.
    */

    if (
        clues.length !== 5
    ) {

        clues =
            createFallbackClues(
                digits,
                secret
            );

    }


    /*
       Shuffle the order in which the
       available digits are displayed.

       This is NOT the secret order.
    */

    const displayDigits =
        shuffle(
            [...digits]
        );


    return {

        code:
            secret,

        displayDigits,

        clues

    };

}



/* =========================
   GENERATE UNIQUE DIGITS
========================= */

function generateUniqueDigits(
    count
) {

    const digits = [];


    while (
        digits.length <
        count
    ) {

        const digit =
            Math.floor(
                Math.random() * 10
            );


        if (
            !digits.includes(
                digit
            )
        ) {

            digits.push(
                digit
            );

        }

    }


    return digits;

}



/* =========================
   GENERATE GUESS
========================= */

function generateGuess() {

    const digits = [];


    while (
        digits.length <
        CODE_LENGTH
    ) {

        const digit =
            Math.floor(
                Math.random() * 10
            );


        if (
            !digits.includes(
                digit
            )
        ) {

            digits.push(
                digit
            );

        }

    }


    return digits;

}



/* =========================
   EVALUATE GUESS
========================= */

function evaluateGuess(
    guess,
    secret
) {

    let exact = 0;


    let totalCommon = 0;


    for (
        let i = 0;
        i < CODE_LENGTH;
        i++
    ) {

        if (
            guess[i] ===
            secret[i]
        ) {

            exact++;

        }

        if (
            secret.includes(
                guess[i]
            )
        ) {

            totalCommon++;

        }

    }


    const misplaced =
        totalCommon -
        exact;


    const absent =
        CODE_LENGTH -
        exact -
        misplaced;


    return {

        exact,

        misplaced,

        absent

    };

}



/* =========================
   CLUE TEXT
========================= */

function buildClueText(
    feedback
) {

    const parts = [];


    if (
        feedback.exact === 1
    ) {

        parts.push(
            "One number is correct and in the correct position."
        );

    }

    else if (
        feedback.exact > 1
    ) {

        parts.push(
            `${feedback.exact} numbers are correct and in the correct positions.`
        );

    }


    if (
        feedback.misplaced === 1
    ) {

        parts.push(
            "One number is correct but in the wrong position."
        );

    }

    else if (
        feedback.misplaced > 1
    ) {

        parts.push(
            `${feedback.misplaced} numbers are correct but in the wrong positions.`
        );

    }


    if (
        feedback.absent === 1
    ) {

        parts.push(
            "One number is not in the code."
        );

    }

    else if (
        feedback.absent > 1
    ) {

        parts.push(
            `${feedback.absent} numbers are not in the code.`
        );

    }


    return parts.join(" ");

}



/* =========================
   CHECK UNIQUE SOLUTION
========================= */

function hasUniqueSolution(
    digits,
    clues,
    secret
) {

    const permutations =
        generatePermutations(
            digits
        );


    let solutions = 0;


    for (
        const candidate of
        permutations
    ) {

        let matches =
            true;


        for (
            const clue of
            clues
        ) {

            const feedback =
                evaluateGuess(
                    clue.guess,
                    candidate
                );


            if (
                feedback.exact !==
                    clue.exact ||
                feedback.misplaced !==
                    clue.misplaced ||
                feedback.absent !==
                    clue.absent
            ) {

                matches =
                    false;

                break;

            }

        }


        if (
            matches
        ) {

            solutions++;


            if (
                solutions >
                1
            ) {

                return false;

            }

        }

    }


    return (
        solutions === 1
    );

}



/* =========================
   PERMUTATIONS
========================= */

function generatePermutations(
    array
) {

    if (
        array.length <= 1
    ) {

        return [array];

    }


    const result = [];


    array.forEach(
        function (value, index) {

            const remaining =
                array.slice(
                    0,
                    index
                ).concat(
                    array.slice(
                        index + 1
                    )
                );


            const smaller =
                generatePermutations(
                    remaining
                );


            smaller.forEach(
                function (permutation) {

                    result.push([
                        value,
                        ...permutation
                    ]);

                }
            );

        }
    );


    return result;

}



/* =========================
   FALLBACK CLUES
========================= */

function createFallbackClues(
    digits,
    secret
) {

    const clues = [];


    const permutations =
        generatePermutations(
            digits
        );


    for (
        const guess of permutations
    ) {

        if (
            guess.join("") ===
            secret.join("")
        ) {

            continue;

        }


        const feedback =
            evaluateGuess(
                guess,
                secret
            );


        clues.push({

            guess,

            exact:
                feedback.exact,

            misplaced:
                feedback.misplaced,

            absent:
                feedback.absent,

            text:
                buildClueText(
                    feedback
                )

        });


        if (
            clues.length === 5
        ) {

            break;

        }

    }


    return clues;

}



/* =========================
   SHUFFLE
========================= */

function shuffle(
    array
) {

    for (
        let i = array.length - 1;
        i > 0;
        i--
    ) {

        const j =
            Math.floor(
                Math.random() *
                (i + 1)
            );


        [
            array[i],
            array[j]
        ] =
        [
            array[j],
            array[i]
        ];

    }


    return array;

}



/* =========================
   TIMESTAMP
========================= */

function getTimestamp(
    value
) {

    if (
        typeof value ===
        "number"
    ) {

        return value;

    }


    if (
        value &&
        typeof value ===
        "object" &&
        typeof value.toDate ===
        "function"
    ) {

        return value.toDate()
            .getTime();

    }


    if (
        value &&
        typeof value ===
        "object" &&
        typeof value.seconds ===
        "number"
    ) {

        return (
            value.seconds *
            1000
        ) +
        Math.floor(
            (value.nanoseconds || 0) /
            1000000
        );

    }


    return null;

}



/* =========================
   HTML ESCAPE
========================= */

function escapeHtml(
    value
) {

    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}



/* =========================
   START ANSWER PROCESSOR
   AFTER AUTHENTICATION
========================= */

const originalOnAuth =
    onAuthStateChanged;


onAuthStateChanged(
    auth,
    function (user) {

        if (
            user
        ) {

            setTimeout(
                ensureAnswerProcessor,
                1000
            );

        }

    }
);