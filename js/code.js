import {
    ref,
    set,
    get,
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


/* =========================
   FIREBASE
========================= */

const auth =
    getAuth(app);


/* =========================
   GAME SETTINGS
========================= */

const TOTAL_ROUNDS = 5;

const CODE_LENGTH = 5;

/*
   2 MINUTES PER ROUND
*/
const ROUND_DURATION =
    120 * 1000;

/*
   ONE CLUE EVERY 10 SECONDS
*/
const CLUE_INTERVAL =
    10 * 1000;

/*
   5 SECOND BREAK
*/
const BREAK_DURATION =
    5 * 1000;


/* =========================
   CHAOS POINT REWARDS
========================= */

const TOP_REWARDS = {

    1: 100,

    2: 75,

    3: 50

};


/* =========================
   ELEMENTS
========================= */

const roomCodeDisplay =
    document.getElementById("roomCodeDisplay");

const exitButton =
    document.getElementById("exitButton");

const roundDisplay =
    document.getElementById("roundDisplay");

const timerDisplay =
    document.getElementById("timerDisplay");

const scoreDisplay =
    document.getElementById("scoreDisplay");

const codeDigits =
    document.getElementById("codeDigits");

const clueCounter =
    document.getElementById("clueCounter");

const cluesList =
    document.getElementById("cluesList");

const submitButton =
    document.getElementById("submitButton");

const answerStatus =
    document.getElementById("answerStatus");

const standingsList =
    document.getElementById("standingsList");

const gameSection =
    document.getElementById("gameSection");

const roundBreak =
    document.getElementById("roundBreak");

const breakTitle =
    document.getElementById("breakTitle");

const roundResultList =
    document.getElementById("roundResultList");

const breakCountdown =
    document.getElementById("breakCountdown");

const finalResults =
    document.getElementById("finalResults");

const winnerDisplay =
    document.getElementById("winnerDisplay");

const finalLeaderboard =
    document.getElementById("finalLeaderboard");

const lobbyButton =
    document.getElementById("lobbyButton");

const dashboardButton =
    document.getElementById("dashboardButton");


const digitInputs = [

    document.getElementById("digit1"),

    document.getElementById("digit2"),

    document.getElementById("digit3"),

    document.getElementById("digit4"),

    document.getElementById("digit5")

];


/* =========================
   URL
========================= */

const params =
    new URLSearchParams(
        window.location.search
    );


const roomFromUrl =
    params.get("room");


let currentRoomCode =
    roomFromUrl
        ?.trim()
        .toUpperCase();


if (!currentRoomCode) {

    window.location.href =
        "clobby.html";

}


/* =========================
   STATE
========================= */

let currentUser =
    null;

let currentUsername =
    "Player";

let currentRoomData =
    null;

let roomListenerStarted =
    false;

let timerInterval =
    null;

let hostRoundTimer =
    null;

let hostTransitionTimer =
    null;

let countdownTimer =
    null;

let hostRoundKey =
    null;

let hostTransitionKey =
    null;

let currentRoundNumber =
    null;

let answerProcessorStarted =
    false;


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


        if (currentRoomCode) {

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
   ROOM LISTENER
========================= */

function listenToRoom() {

    if (
        roomListenerStarted
    ) {

        return;

    }


    roomListenerStarted =
        true;


    onValue(
        getRoomRef(),
        async function (snapshot) {

            if (!snapshot.exists()) {

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


            if (!player) {

                window.location.href =
                    "clobby.html";

                return;

            }


            roomCodeDisplay.textContent =
                currentRoomCode;


            scoreDisplay.textContent =
                Number(
                    player.score || 0
                );


            renderStandings(
                currentRoomData
            );


            /*
               Start host answer processor.
            */

            ensureAnswerProcessor();


            /*
               Current state.
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
       ONLY THE HOST CREATES ROUND 1.
    */

    if (
        currentRoomData.hostUid !==
        currentUser.uid
    ) {

        return;

    }


    /*
       Prevent duplicate generation.
    */

    if (
        currentRoomData.rounds?.["1"]
    ) {

        return;

    }


    try {

        const round =
            generateRound();


        const now =
            Date.now();


        await update(
            getRoomRef(),
            {

                "rounds/1":
                    round,

                currentRound:
                    1,

                currentCode:
                    round.code,

                currentClues:
                    round.clues,

                roundStartAt:
                    now,

                roundEndAt:
                    null,

                roundResultAt:
                    null,

                status:
                    "playing"

            }
        );

    }

    catch (error) {

        console.error(
            "INITIALIZE FIRST ROUND ERROR:",
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


    if (!roundNumber) {

        return;

    }


    const round =
        currentRoomData.rounds?.[
            roundNumber
        ];


    if (!round) {

        return;

    }


    roundBreak.classList.add(
        "hidden"
    );


    gameSection.classList.remove(
        "hidden"
    );


    renderRound(
        roundNumber,
        round
    );


    startTimer();


    /*
       Only host controls the round end.
    */

    if (
        currentRoomData.hostUid ===
        currentUser.uid
    ) {

        scheduleHostRoundEnd();

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


    renderCodeDigits(
        round.displayDigits
    );


    renderAvailableClues(
        round
    );


    /*
       Check whether this player
       already solved this round.
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
        myAnswer?.correct === true
    ) {

        submitButton.disabled =
            true;


        digitInputs.forEach(
            function (input) {

                input.disabled =
                    true;

            }
        );


        answerStatus.className =
            "answer-status correct";


        answerStatus.textContent =
            `✅ CODE CRACKED! +${Number(
                myAnswer.points || 0
            )} POINTS`;

    }

    else {

        submitButton.disabled =
            false;


        digitInputs.forEach(
            function (input) {

                input.disabled =
                    false;

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

    if (!round) {

        return;

    }


    const startAt =
        Number(
            currentRoomData.roundStartAt
        );


    if (!startAt) {

        return;

    }


    const elapsed =
        Math.max(
            0,
            Date.now() -
            startAt
        );


    /*
       Clue 1 appears immediately.

       Clue 2 after 10 sec.

       Clue 3 after 20 sec.

       Clue 4 after 30 sec.

       Clue 5 after 40 sec.
    */

    let visibleCount =
        Math.floor(
            elapsed /
            CLUE_INTERVAL
        ) + 1;


    visibleCount =
        Math.max(
            1,
            Math.min(
                5,
                visibleCount
            )
        );


    if (
        elapsed >=
        ROUND_DURATION
    ) {

        visibleCount =
            5;

    }


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
                    ${escapeHtml(
                        clue.guess.join(" ")
                    )}
                </div>

                <div class="clue-text">
                    ${escapeHtml(
                        clue.text
                    )}
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
   PLAYER TIMER
========================= */

function startTimer() {

    clearInterval(
        timerInterval
    );


    function tick() {

        if (
            !currentRoomData ||
            currentRoomData.status !==
            "playing"
        ) {

            clearInterval(
                timerInterval
            );

            return;

        }


        const startAt =
            Number(
                currentRoomData.roundStartAt
            );


        if (!startAt) {

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


        const totalSeconds =
            Math.ceil(
                remaining /
                1000
            );


        const minutes =
            Math.floor(
                totalSeconds /
                60
            );


        const seconds =
            totalSeconds %
            60;


        timerDisplay.textContent =
            `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;


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


    tick();


    timerInterval =
        setInterval(
            tick,
            250
        );

}


/* =========================
   HOST ROUND END
========================= */

function scheduleHostRoundEnd() {

    if (
        !currentRoomData ||
        !currentUser
    ) {

        return;

    }


    if (
        currentRoomData.hostUid !==
        currentUser.uid
    ) {

        return;

    }


    const roundNumber =
        Number(
            currentRoomData.currentRound
        );


    const startAt =
        Number(
            currentRoomData.roundStartAt
        );


    if (
        !roundNumber ||
        !startAt
    ) {

        return;

    }


    const key =
        `${roundNumber}-${startAt}`;


    if (
        hostRoundKey ===
        key
    ) {

        return;

    }


    hostRoundKey =
        key;


    clearTimeout(
        hostRoundTimer
    );


    const elapsed =
        Date.now() -
        startAt;


    const remaining =
        Math.max(
            0,
            ROUND_DURATION -
            elapsed
        );


    hostRoundTimer =
        setTimeout(
            function () {

                finishCurrentRound();

            },
            remaining + 100
        );

}


/* =========================
   FINISH ROUND
========================= */

async function finishCurrentRound() {

    if (
        !currentRoomData ||
        !currentUser
    ) {

        return;

    }


    if (
        currentRoomData.status !==
        "playing"
    ) {

        return;

    }


    if (
        currentRoomData.hostUid !==
        currentUser.uid
    ) {

        return;

    }


    clearTimeout(
        hostRoundTimer
    );


    hostRoundTimer =
        null;


    hostRoundKey =
        null;


    try {

        const now =
            Date.now();


        await update(
            getRoomRef(),
            {

                status:
                    "roundResult",

                roundEndAt:
                    now,

                roundResultAt:
                    now

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


    clearTimeout(
        hostRoundTimer
    );


    hostRoundTimer =
        null;


    submitButton.disabled =
        true;


    digitInputs.forEach(
        function (input) {

            input.disabled =
                true;

        }
    );


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
                            Number(
                                answer?.points ||
                                0
                            ),

                        correct:
                            answer?.correct ===
                            true,

                        totalScore:
                            Number(
                                player.score ||
                                0
                            )

                    };

                }
            )
            .sort(
                function (a, b) {

                    if (
                        b.points !==
                        a.points
                    ) {

                        return (
                            b.points -
                            a.points
                        );

                    }


                    return (
                        b.totalScore -
                        a.totalScore
                    );

                }
            );


    showRoundBreak(
        roundNumber,
        results
    );


    if (
        currentRoomData.hostUid ===
        currentUser.uid
    ) {

        scheduleNextRound();

    }

}


/* =========================
   ROUND BREAK
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

    clearInterval(
        countdownTimer
    );


    const resultAt =
        Number(
            currentRoomData.roundResultAt
        );


    if (!resultAt) {

        breakCountdown.textContent =
            "5";

        return;

    }


    function updateCountdown() {

        const elapsed =
            Date.now() -
            resultAt;


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

            clearInterval(
                countdownTimer
            );

        }

    }


    updateCountdown();


    countdownTimer =
        setInterval(
            updateCountdown,
            100
        );

}


/* =========================
   NEXT ROUND SCHEDULER
========================= */

function scheduleNextRound() {

    if (
        !currentRoomData ||
        !currentUser
    ) {

        return;

    }


    if (
        currentRoomData.hostUid !==
        currentUser.uid
    ) {

        return;

    }


    const roundNumber =
        Number(
            currentRoomData.currentRound
        );


    const resultAt =
        Number(
            currentRoomData.roundResultAt
        );


    if (
        !roundNumber ||
        !resultAt
    ) {

        return;

    }


    const key =
        `${roundNumber}-${resultAt}`;


    if (
        hostTransitionKey ===
        key
    ) {

        return;

    }


    hostTransitionKey =
        key;


    clearTimeout(
        hostTransitionTimer
    );


    const elapsed =
        Date.now() -
        resultAt;


    const remaining =
        Math.max(
            0,
            BREAK_DURATION -
            elapsed
        );


    hostTransitionTimer =
        setTimeout(
            function () {

                startNextRound();

            },
            remaining + 100
        );

}


/* =========================
   START NEXT ROUND
========================= */

async function startNextRound() {

    if (
        !currentRoomData ||
        !currentUser
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
        "roundResult"
    ) {

        return;

    }


    const currentRound =
        Number(
            currentRoomData.currentRound
        );


    /*
       After Round 5:
       finish the entire game.
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


    try {

        /*
           Fresh data from Firebase.
        */

        const snapshot =
            await get(
                getRoomRef()
            );


        if (
            !snapshot.exists()
        ) {

            return;

        }


        const room =
            snapshot.val();


        /*
           Still the same host?
        */

        if (
            room.hostUid !==
            currentUser.uid
        ) {

            return;

        }


        /*
           Still waiting in result state?
        */

        if (
            room.status !==
            "roundResult"
        ) {

            return;

        }


        /*
           Prevent duplicate transition.
        */

        if (
            Number(
                room.currentRound
            ) !==
            currentRound
        ) {

            return;

        }


        /*
           Generate next puzzle.
        */

        const round =
            generateRound();


        const now =
            Date.now();


        const updates = {};


        /*
           Reset round-only player data.

           DO NOT reset total score.
        */

        const players =
            room.players ||
            {};


        Object.keys(players)
            .forEach(
                function (uid) {

                    updates[
                        `players/${uid}/currentRoundScore`
                    ] = 0;


                    updates[
                        `players/${uid}/lastAnswer`
                    ] = null;


                    updates[
                        `players/${uid}/lastAnsweredRound`
                    ] = null;


                    updates[
                        `players/${uid}/submittedAt`
                    ] = null;

                }
            );


        updates[
            `rounds/${nextRound}`
        ] =
            round;


        updates[
            `answers/${nextRound}`
        ] =
            null;


        updates.currentRound =
            nextRound;


        updates.currentCode =
            round.code;


        updates.currentClues =
            round.clues;


        updates.roundStartAt =
            now;


        updates.roundEndAt =
            null;


        updates.roundResultAt =
            null;


        updates.status =
            "playing";


        await update(
            getRoomRef(),
            updates
        );


        /*
           Reset scheduler state.
        */

        hostTransitionKey =
            null;


        hostRoundKey =
            null;


        clearTimeout(
            hostTransitionTimer
        );


        hostTransitionTimer =
            null;

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
       Don't allow another answer
       after a correct answer.
    */

    const existingAnswer =
        currentRoomData.answers?.[
            roundNumber
        ]?.[
            currentUser.uid
        ];


    if (
        existingAnswer?.correct ===
        true
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


    /*
       Code contains five unique digits.
    */

    if (
        new Set(answer).size !==
        CODE_LENGTH
    ) {

        showAnswerStatus(
            "THE CODE USES 5 DIFFERENT DIGITS.",
            "wrong"
        );

        return;

    }


    /*
       Player must use exactly the
       five displayed digits.
    */

    const availableDigits =
        round.displayDigits.map(
            function (digit) {

                return String(digit);

            }
        );


    const validDigits =
        availableDigits.every(
            function (digit) {

                return answer.includes(
                    digit
                );

            }
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
           Check again before writing.
        */

        const existingSnapshot =
            await get(
                answerRef
            );


        if (
            existingSnapshot.exists() &&
            existingSnapshot.val()?.correct ===
            true
        ) {

            submitButton.disabled =
                true;

            return;

        }


        await set(
            answerRef,
            {

                answer,

                submittedAt:
                    serverTimestamp(),

                correct:
                    isCorrect,

                points:
                    0

            }
        );


        if (!isCorrect) {

            showAnswerStatus(
                "❌ NOT THE CODE. TRY AGAIN.",
                "wrong"
            );


            setTimeout(
                function () {

                    if (
                        currentRoomData &&
                        currentRoomData.status ===
                        "playing"
                    ) {

                        submitButton.disabled =
                            false;

                    }

                },
                200
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
   GET ANSWER
========================= */

function getAnswerFromInputs() {

    return digitInputs
        .map(
            function (input) {

                return input.value.trim();

            }
        )
        .join("");

}


/* =========================
   INPUT EVENTS
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
   ANSWER PROCESSOR
========================= */

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


    /*
       ONLY HOST PROCESSES ANSWERS.
    */

    if (
        currentRoomData &&
        currentRoomData.hostUid !==
        currentUser.uid
    ) {

        return;

    }


    answerProcessorStarted =
        true;


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
   PROCESS CORRECT ANSWERS
========================= */

async function processCorrectAnswers() {

    if (
        !currentRoomData ||
        !currentUser
    ) {

        return;

    }


    /*
       Only host.
    */

    if (
        currentRoomData.hostUid !==
        currentUser.uid
    ) {

        return;

    }


    /*
       Only during an active round.
    */

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


    const answers =
        currentRoomData.answers?.[
            roundNumber
        ] || {};


    for (
        const [uid, answer] of
        Object.entries(answers)
    ) {

        /*
           Ignore:
           - missing answer
           - wrong answer
           - already processed answer
        */

        if (
            !answer ||
            answer.correct !== true ||
            Number(answer.points || 0) > 0
        ) {

            continue;

        }


        const submittedAt =
            getTimestamp(
                answer.submittedAt
            );


        const roundStartAt =
            Number(
                currentRoomData.roundStartAt
            );


        if (
            !submittedAt ||
            !roundStartAt
        ) {

            /*
               serverTimestamp may not have
               resolved yet.
            */

            continue;

        }


        /*
           Exact solve speed.
        */

        const elapsed =
            Math.max(
                0,
                submittedAt -
                roundStartAt
            );


        /*
           Continuous speed score.

           100 at the very beginning.

           Gradually decreases throughout
           the 120-second round.

           No 10-second brackets.
        */

        const progress =
            Math.max(
                0,
                Math.min(
                    1,
                    1 -
                    (
                        elapsed /
                        ROUND_DURATION
                    )
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


        const answerRef =
            ref(
                database,
                `chaosCodeRooms/${currentRoomCode}/answers/${roundNumber}/${uid}`
            );


        /*
           Transaction prevents the same
           answer from getting scored twice.
        */

        const transactionResult =
            await runTransaction(
                answerRef,
                function (current) {

                    if (!current) {

                        return current;

                    }


                    if (
                        Number(
                            current.points ||
                            0
                        ) > 0
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
           Add to player's cumulative score.
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
                   Prevent duplicate round award.
                */

                if (
                    Number(
                        player.lastAnsweredRound
                    ) ===
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
   LIVE STANDINGS
========================= */

function renderStandings(
    room
) {

    const players =
        room.players || {};


    const entries =
        Object.entries(players)
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


                    return scoreB -
                        scoreA;

                }
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


            if (
                index === 0
            ) {

                rank.textContent =
                    "🥇";

            }

            else if (
                index === 1
            ) {

                rank.textContent =
                    "🥈";

            }

            else if (
                index === 2
            ) {

                rank.textContent =
                    "🥉";

            }

            else {

                rank.textContent =
                    index + 1;

            }


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
                `${Number(
                    player.score || 0
                )} PTS`;


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
   FINISH GAME
========================= */

async function finishGame() {

    if (
        !currentRoomData ||
        !currentUser
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
        currentRoomData.status ===
        "finished"
    ) {

        return;

    }


    try {

        clearTimeout(
            hostRoundTimer
        );


        clearTimeout(
            hostTransitionTimer
        );


        const snapshot =
            await get(
                getRoomRef()
            );


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
            room.players ||
            {};


        /*
           Final ranking:
           highest game score first.
        */

        const entries =
            Object.entries(players)
                .filter(
                    ([, player]) =>
                        !player.leftGame
                )
                .sort(
                    function (a, b) {

                        const scoreA =
                            Number(
                                a[1].score ||
                                0
                            );


                        const scoreB =
                            Number(
                                b[1].score ||
                                0
                            );


                        return scoreB -
                            scoreA;

                    }
                );


        /*
           ONLY players with actual
           game points are eligible
           for Chaos Point rewards.
        */

        const scoringPlayers =
            entries.filter(
                function ([, player]) {

                    return Number(
                        player.score ||
                        0
                    ) > 0;

                }
            );


        const updates = {};


        /*
           Final rank for EVERY player.
        */

        entries.forEach(
            function ([uid, player], index) {

                const finalRank =
                    index + 1;


                /*
                   Find this player among
                   scoring players.
                */

                const scoringPosition =
                    scoringPlayers.findIndex(
                        function ([scoringUid]) {

                            return (
                                scoringUid ===
                                uid
                            );

                        }
                    );


                let reward = 0;


                /*
                   Only first 3 players
                   who actually scored
                   receive CP.
                */

                if (
                    scoringPosition >= 0 &&
                    scoringPosition < 3
                ) {

                    reward =
                        TOP_REWARDS[
                            scoringPosition + 1
                        ] || 0;

                }


                updates[
                    `players/${uid}/finalRank`
                ] =
                    finalRank;


                updates[
                    `players/${uid}/finalReward`
                ] =
                    reward;

            }
        );


        updates.status =
            "finished";


        updates.finishedAt =
            Date.now();


        updates.rewardsCalculated =
            true;


        await update(
            getRoomRef(),
            updates
        );


        /*
           Distribute CP only to
           scoringPlayers.
        */

        await distributeRewards(
            scoringPlayers
        );

    }

    catch (error) {

        console.error(
            "FINISH GAME ERROR:",
            error
        );

    }

}


/* =========================
   DISTRIBUTE CHAOS POINTS
========================= */

async function distributeRewards(
    scoringPlayers
) {

    try {

        const roomRef =
            getRoomRef();


        const snapshot =
            await get(
                roomRef
            );


        if (
            !snapshot.exists()
        ) {

            return;

        }


        const room =
            snapshot.val();


        /*
           Never distribute twice.
        */

        if (
            room.rewardsDistributed ===
            true
        ) {

            return;

        }


        /*
           scoringPlayers already contains
           ONLY players with score > 0.

           Therefore zero-point players
           cannot receive CP.
        */

        for (
            let index = 0;

            index <
            scoringPlayers.length &&
            index < 3;

            index++
        ) {

            const uid =
                scoringPlayers[index][0];


            const player =
                scoringPlayers[index][1];


            const score =
                Number(
                    player.score || 0
                );


            /*
               Extra safety check.
            */

            if (
                score <= 0
            ) {

                continue;

            }


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
            "DISTRIBUTE REWARDS ERROR:",
            error
        );

    }

}


/* =========================
   FINAL RESULTS
========================= */

function renderFinalResults(
    room
) {

    clearInterval(
        timerInterval
    );


    clearInterval(
        countdownTimer
    );


    clearTimeout(
        hostRoundTimer
    );


    clearTimeout(
        hostTransitionTimer
    );


    gameSection.classList.add(
        "hidden"
    );


    roundBreak.classList.add(
        "hidden"
    );


    finalResults.classList.remove(
        "hidden"
    );


    const players =
        room.players ||
        {};


    const entries =
        Object.entries(players)
            .filter(
                ([, player]) =>
                    !player.leftGame
            )
            .sort(
                function (a, b) {

                    return Number(
                        a[1].finalRank ||
                        999
                    ) -
                    Number(
                        b[1].finalRank ||
                        999
                    );

                }
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
                ${Number(
                    winner[1].score || 0
                )} POINTS
            </div>

        `;

    }


    finalLeaderboard.innerHTML =
        "";


    entries.forEach(
        function ([, player], index) {

            const rank =
                Number(
                    player.finalRank ||
                    index + 1
                );


            const reward =
                Number(
                    player.finalReward ||
                    0
                );


            const row =
                document.createElement(
                    "div"
                );


            row.className =
                "final-player";


            let rankDisplay;


            if (
                rank === 1
            ) {

                rankDisplay =
                    "🥇";

            }

            else if (
                rank === 2
            ) {

                rankDisplay =
                    "🥈";

            }

            else if (
                rank === 3
            ) {

                rankDisplay =
                    "🥉";

            }

            else {

                rankDisplay =
                    rank;

            }


            row.innerHTML = `

                <div class="final-player-left">

                    <span class="final-rank">
                        ${rankDisplay}
                    </span>

                    <span class="final-name">
                        ${escapeHtml(
                            player.username ||
                            "Player"
                        )}
                    </span>

                </div>


                <div class="final-score">

                    ${Number(
                        player.score || 0
                    )} PTS

                    ${
                        reward > 0
                            ? `
                                <span class="reward">
                                    +${reward} CP
                                </span>
                              `
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

                    leftGame:
                        true

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

            input.value =
                "";

            input.disabled =
                false;

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


/* =========================================================
   CHAOS CODE PUZZLE GENERATION
========================================================= */


/* =========================
   GENERATE ROUND
========================= */

function generateRound() {

    /*
       Pick five unique digits.

       Players see these five digits,
       but NOT their correct order.
    */

    const digits =
        generateUniqueDigits(
            CODE_LENGTH
        );


    /*
       Secret order.
    */

    const secret =
        shuffle(
            [...digits]
        );


    /*
       Exactly 120 possible arrangements.
    */

    const allSolutions =
        generatePermutations(
            digits
        );


    /*
       Build easier, more varied clues.
    */

    const cluePool =
        generateCluePool(
            secret
        );


    /*
       Select five clues that:
       - use different kinds of information
       - become progressively stronger
       - always remain mathematically true
       - eventually identify exactly one solution
    */

    let clues = [];


    for (
        let attempt = 0;
        attempt < 25;
        attempt++
    ) {

        clues =
            selectProgressiveClues(
                cluePool,
                allSolutions,
                secret
            );


        if (
            clues.length === 5
        ) {

            break;

        }

    }


    /*
       Emergency fallback.

       This should almost never be needed.
    */

    if (
        clues.length !== 5
    ) {

        clues =
            createEasyFallbackClues(
                secret,
                allSolutions
            );

    }


    /*
       Shuffle only the visible digits.

       The secret order stays hidden.
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
   GENERATE CLUE POOL
========================= */

function generateCluePool(
    secret
) {

    const pool = [];


    /*
       These are the preferred clue shapes.

       They deliberately give different
       types of information.

       1:
       0 exact
       4 misplaced
       1 unavailable

       2:
       1–2 exact
       2–3 misplaced
       0–1 unavailable

       3:
       1–2 exact
       1–2 misplaced
       1–2 unavailable

       4:
       2–3 exact
       1–2 misplaced
       0–1 unavailable

       5:
       3 exact
       1–2 misplaced
       0–1 unavailable
    */

    const profiles = [

        {
            minExact: 0,
            maxExact: 0,

            minMisplaced: 4,
            maxMisplaced: 4,

            minAbsent: 1,
            maxAbsent: 1
        },

        {
            minExact: 1,
            maxExact: 2,

            minMisplaced: 2,
            maxMisplaced: 3,

            minAbsent: 0,
            maxAbsent: 1
        },

        {
            minExact: 1,
            maxExact: 2,

            minMisplaced: 1,
            maxMisplaced: 2,

            minAbsent: 1,
            maxAbsent: 2
        },

        {
            minExact: 2,
            maxExact: 3,

            minMisplaced: 1,
            maxMisplaced: 2,

            minAbsent: 0,
            maxAbsent: 1
        },

        {
            minExact: 3,
            maxExact: 3,

            minMisplaced: 1,
            maxMisplaced: 2,

            minAbsent: 0,
            maxAbsent: 1
        }

    ];


    /*
       Generate a large collection of
       mathematically valid guesses.
    */

    const allGuesses =
        generateAllUniqueGuesses();


    profiles.forEach(
        function (profile) {

            const matching = [];


            for (
                let i = 0;
                i < allGuesses.length;
                i++
            ) {

                const guess =
                    allGuesses[i];


                /*
                   Never use the actual answer.
                */

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


                if (

                    feedback.exact >=
                        profile.minExact &&

                    feedback.exact <=
                        profile.maxExact &&

                    feedback.misplaced >=
                        profile.minMisplaced &&

                    feedback.misplaced <=
                        profile.maxMisplaced &&

                    feedback.absent >=
                        profile.minAbsent &&

                    feedback.absent <=
                        profile.maxAbsent

                ) {

                    matching.push({

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

            }


            /*
               Randomize this category so the
               same clue does not appear every round.
            */

            shuffle(
                matching
            );


            /*
               Keep enough candidates for
               the selector to choose from.
            */

            pool.push(
                matching.slice(
                    0,
                    400
                )
            );

        }
    );


    return pool;

}


/* =========================
   SELECT PROGRESSIVE CLUES
========================= */

function selectProgressiveClues(
    cluePool,
    allSolutions,
    secret
) {

    if (
        cluePool.length !== 5
    ) {

        return [];

    }


    /*
       Target number of possible solutions
       after each clue.

       We intentionally make the early
       clues easier than the old system.
    */

    const targets = [

        {
            min: 45,
            max: 100
        },

        {
            min: 20,
            max: 60
        },

        {
            min: 7,
            max: 30
        },

        {
            min: 2,
            max: 10
        },

        {
            min: 1,
            max: 1
        }

    ];


    /*
       Start with every possible arrangement.
    */

    const initialSolutions =
        [...allSolutions];


    /*
       Recursive search.

       The clue categories are fixed in order,
       so every game has a clear progression.
    */

    function search(
        index,
        possibleSolutions,
        selected,
        usedGuesses
    ) {

        /*
           Five clues selected.
        */

        if (
            index === 5
        ) {

            if (
                possibleSolutions.length === 1 &&
                possibleSolutions[0].join("") ===
                    secret.join("")
            ) {

                return selected;

            }


            return null;

        }


        const candidates =
            cluePool[index];


        const target =
            targets[index];


        const scoredCandidates = [];


        candidates.forEach(
            function (clue) {

                const key =
                    clue.guess.join("");


                /*
                   Don't repeat guesses.
                */

                if (
                    usedGuesses.has(key)
                ) {

                    return;

                }


                /*
                   Find all arrangements
                   compatible with this clue.
                */

                const remaining =
                    possibleSolutions.filter(
                        function (candidate) {

                            const feedback =
                                evaluateGuess(
                                    clue.guess,
                                    candidate
                                );


                            return (

                                feedback.exact ===
                                    clue.exact &&

                                feedback.misplaced ===
                                    clue.misplaced &&

                                feedback.absent ===
                                    clue.absent

                            );

                        }
                    );


                /*
                   Secret must remain possible.
                */

                if (
                    !remaining.some(
                        function (candidate) {

                            return (
                                candidate.join("") ===
                                secret.join("")
                            );

                        }
                    )
                ) {

                    return;

                }


                /*
                   Don't solve the puzzle
                   before the final clue.
                */

                if (
                    index < 4 &&
                    remaining.length <= 1
                ) {

                    return;

                }


                /*
                   How close is this clue to
                   our desired difficulty?
                */

                let distance = 0;


                if (
                    remaining.length <
                    target.min
                ) {

                    distance =
                        target.min -
                        remaining.length;

                }

                else if (
                    remaining.length >
                    target.max
                ) {

                    distance =
                        remaining.length -
                        target.max;

                }


                const midpoint =
                    (
                        target.min +
                        target.max
                    ) / 2;


                const midpointDistance =
                    Math.abs(
                        remaining.length -
                        midpoint
                    );


                /*
                   Prefer clues that contain
                   useful information.

                   Exact > misplaced > absent
                   as a very small tie-breaker.
                */

                const informationScore =

                    clue.exact * 4 +

                    clue.misplaced * 2 +

                    clue.absent;


                scoredCandidates.push({

                    clue,

                    remaining,

                    distance,

                    midpointDistance,

                    informationScore

                });

            }
        );


        if (
            scoredCandidates.length === 0
        ) {

            return null;

        }


        /*
           Best candidates first.
        */

        scoredCandidates.sort(
            function (a, b) {

                if (
                    a.distance !==
                    b.distance
                ) {

                    return (
                        a.distance -
                        b.distance
                    );

                }


                if (
                    a.midpointDistance !==
                    b.midpointDistance
                ) {

                    return (
                        a.midpointDistance -
                        b.midpointDistance
                    );

                }


                if (
                    a.informationScore !==
                    b.informationScore
                ) {

                    return (
                        b.informationScore -
                        a.informationScore
                    );

                }


                return (
                    Math.random() -
                    0.5
                );

            }
        );


        /*
           Try the best candidates first.

           Randomness is limited so the clues
           remain varied between rounds.
        */

        const limit =
            Math.min(
                30,
                scoredCandidates.length
            );


        for (
            let i = 0;
            i < limit;
            i++
        ) {

            const choice =
                scoredCandidates[i];


            const key =
                choice.clue.guess.join("");


            const result =
                search(

                    index + 1,

                    choice.remaining,

                    [
                        ...selected,
                        choice.clue
                    ],

                    new Set([
                        ...usedGuesses,
                        key
                    ])

                );


            if (
                result
            ) {

                return result;

            }

        }


        return null;

    }


    const result =
        search(
            0,
            initialSolutions,
            [],
            new Set()
        );


    /*
       Final safety check.
    */

    if (
        !result ||
        result.length !== 5
    ) {

        return [];

    }


    const finalSolutions =
        allSolutions.filter(
            function (candidate) {

                return result.every(
                    function (clue) {

                        const feedback =
                            evaluateGuess(
                                clue.guess,
                                candidate
                            );


                        return (

                            feedback.exact ===
                                clue.exact &&

                            feedback.misplaced ===
                                clue.misplaced &&

                            feedback.absent ===
                                clue.absent

                        );

                    }
                );

            }
        );


    /*
       MUST be exactly one solution.
    */

    if (
        finalSolutions.length !== 1
    ) {

        return [];

    }


    /*
       MUST be the actual secret.
    */

    if (
        finalSolutions[0].join("") !==
        secret.join("")
    ) {

        return [];

    }


    return result;

}


/* =========================
   GENERATE ALL UNIQUE GUESSES
========================= */

function generateAllUniqueGuesses() {

    const result = [];


    function build(
        current
    ) {

        if (
            current.length ===
            CODE_LENGTH
        ) {

            result.push(
                [...current]
            );

            return;

        }


        for (
            let digit = 0;
            digit <= 9;
            digit++
        ) {

            if (
                current.includes(
                    digit
                )
            ) {

                continue;

            }


            current.push(
                digit
            );


            build(
                current
            );


            current.pop();

        }

    }


    build([]);


    return result;

}


/* =========================
   EASY FALLBACK CLUES
========================= */

function createEasyFallbackClues(
    secret,
    allSolutions
) {

    /*
       Preferred feedback patterns.

       We search directly for clues
       matching these patterns.
    */

    const patterns = [

        {
            exact: 0,
            misplaced: 4,
            absent: 1
        },

        {
            exact: 1,
            misplaced: 3,
            absent: 1
        },

        {
            exact: 2,
            misplaced: 1,
            absent: 2
        },

        {
            exact: 3,
            misplaced: 1,
            absent: 1
        },

        {
            exact: 3,
            misplaced: 2,
            absent: 0
        }

    ];


    const allGuesses =
        generateAllUniqueGuesses();


    const selected = [];


    let possibleSolutions =
        [...allSolutions];


    const used =
        new Set();


    for (
        let patternIndex = 0;
        patternIndex < patterns.length;
        patternIndex++
    ) {

        const target =
            patterns[
                patternIndex
            ];


        const candidates = [];


        for (
            let i = 0;
            i < allGuesses.length;
            i++
        ) {

            const guess =
                allGuesses[i];


            const key =
                guess.join("");


            if (
                used.has(key)
            ) {

                continue;

            }


            if (
                key ===
                secret.join("")
            ) {

                continue;

            }


            const feedback =
                evaluateGuess(
                    guess,
                    secret
                );


            if (

                feedback.exact !==
                    target.exact ||

                feedback.misplaced !==
                    target.misplaced ||

                feedback.absent !==
                    target.absent

            ) {

                continue;

            }


            const remaining =
                possibleSolutions.filter(
                    function (candidate) {

                        const test =
                            evaluateGuess(
                                guess,
                                candidate
                            );


                        return (

                            test.exact ===
                                feedback.exact &&

                            test.misplaced ===
                                feedback.misplaced &&

                            test.absent ===
                                feedback.absent

                        );

                    }
                );


            if (
                !remaining.some(
                    function (candidate) {

                        return (
                            candidate.join("") ===
                            secret.join("")
                        );

                    }
                )
            ) {

                continue;

            }


            candidates.push({

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
                    ),

                remaining

            });

        }


        if (
            candidates.length === 0
        ) {

            return [];

        }


        /*
           Pick the candidate that leaves
           the most reasonable number of
           possibilities.
        */

        candidates.sort(
            function (a, b) {

                return (
                    b.remaining.length -
                    a.remaining.length
                );

            }
        );


        const choice =
            candidates[0];


        selected.push({

            guess:
                choice.guess,

            exact:
                choice.exact,

            misplaced:
                choice.misplaced,

            absent:
                choice.absent,

            text:
                choice.text

        });


        possibleSolutions =
            choice.remaining;


        used.add(
            choice.guess.join("")
        );

    }


    /*
       Only accept fallback if it really
       produces one solution.
    */

    const finalSolutions =
        allSolutions.filter(
            function (candidate) {

                return selected.every(
                    function (clue) {

                        const feedback =
                            evaluateGuess(
                                clue.guess,
                                candidate
                            );


                        return (

                            feedback.exact ===
                                clue.exact &&

                            feedback.misplaced ===
                                clue.misplaced &&

                            feedback.absent ===
                                clue.absent

                        );

                    }
                );

            }
        );


    if (
        finalSolutions.length === 1 &&
        finalSolutions[0].join("") ===
            secret.join("")
    ) {

        return selected;

    }


    /*
       If that exact fallback combination
       isn't possible for a particular code,
       use the existing mathematical fallback
       already present later in the file.
    */

    return [];

}



/* =========================
   MATCHING SOLUTIONS
========================= */

function getMatchingSolutions(
    solutions,
    guess,
    expectedFeedback
) {

    return solutions.filter(
        function (candidate) {

            const feedback =
                evaluateGuess(
                    guess,
                    candidate
                );


            return (

                feedback.exact ===
                    expectedFeedback.exact &&

                feedback.misplaced ===
                    expectedFeedback.misplaced &&

                feedback.absent ===
                    expectedFeedback.absent

            );

        }
    );

}



/* =========================
   GENERATE UNIQUE GUESS
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

        /*
           Correct digit AND position.
        */
        if (
            guess[i] ===
            secret[i]
        ) {

            exact++;

        }


        /*
           Correct digit somewhere
           in the code.
        */
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
   BUILD CLUE TEXT
========================= */

function buildClueText(
    feedback
) {

    const parts = [];


    /*
       Correct position.
    */
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


    /*
       Correct number, wrong position.
    */
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


    /*
       Numbers that don't belong.
    */
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
   UNIQUE DIGITS
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
   PERMUTATIONS
========================= */

function generatePermutations(
    array
) {

    if (
        array.length <= 1
    ) {

        return [
            array
        ];

    }


    const result = [];


    array.forEach(
        function (value, index) {

            const remaining =
                array
                    .slice(
                        0,
                        index
                    )
                    .concat(
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
    secret,
    allSolutions
) {

    const permutationPool =
        buildPermutationCluePool(
            digits,
            secret,
            allSolutions
        );


    /*
       Try the normal selector one last time.
    */
    const selected =
        selectProgressiveClues(
            permutationPool,
            allSolutions,
            secret
        );


    if (
        selected.length === 5
    ) {

        return selected;

    }


    /*
       Absolute emergency fallback.

       We still return five mathematically
       valid clues so the game never breaks.
    */
    const fallback = [];

    const used =
        new Set();


    /*
       Prefer clues with useful information.
    */
    const sortedPool =
        [...permutationPool].sort(
            function (a, b) {

                const infoA =
                    a.exact * 3 +
                    a.misplaced * 2 +
                    a.absent;


                const infoB =
                    b.exact * 3 +
                    b.misplaced * 2 +
                    b.absent;


                return infoB - infoA;

            }
        );


    for (
        const clue of sortedPool
    ) {

        const key =
            clue.guess.join("");


        if (
            used.has(key)
        ) {
            continue;
        }


        used.add(key);


        fallback.push(
            clue
        );


        if (
            fallback.length === 5
        ) {
            break;
        }

    }


    return fallback;

}


/* =========================
   SHUFFLE
========================= */

function shuffle(
    array
) {

    for (
        let i =
            array.length - 1;

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

        return value
            .toDate()
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
            (
                value.nanoseconds ||
                0
            ) /
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