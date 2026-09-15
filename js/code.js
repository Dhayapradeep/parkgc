import {
    ref,
    set,
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


const auth = getAuth(app);


/* =========================================================
   GAME SETTINGS
   ========================================================= */

const TOTAL_ROUNDS = 5;

const CODE_LENGTH = 5;

const ROUND_DURATION = 120 * 1000;

const CLUE_INTERVAL = 20 * 1000;

const BREAK_DURATION = 5 * 1000;


const TOP_REWARDS = {
    1: 500,
    2: 250,
    3: 100
};


/* =========================================================
   DOM ELEMENTS
   ========================================================= */

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


/* =========================================================
   ROOM
   ========================================================= */

const params =
    new URLSearchParams(window.location.search);

const roomFromUrl =
    params.get("room");

let currentRoomCode =
    roomFromUrl?.trim().toUpperCase();


if (!currentRoomCode) {
    window.location.href = "clobby.html";
}


/* =========================================================
   STATE
   ========================================================= */

let currentUser = null;

let currentUsername = "Player";

let currentRoomData = null;

let roomListenerStarted = false;

let timerInterval = null;

let hostRoundTimer = null;

let hostTransitionTimer = null;

let countdownTimer = null;

let hostRoundKey = null;

let hostTransitionKey = null;

let currentRoundNumber = null;

let answerProcessorStarted = false;


/* =========================================================
   AUTH
   ========================================================= */

onAuthStateChanged(
    auth,
    async function (user) {

        if (!user) {
            window.location.href = "login.html";
            return;
        }

        currentUser = user;

        await loadUserProfile();

        if (currentRoomCode) {
            listenToRoom();
        }

    }
);


/* =========================================================
   LOAD PROFILE
   ========================================================= */

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
                data.username || "Player";

        }

    } catch (error) {

        console.error(
            "LOAD USER ERROR:",
            error
        );

    }

}


/* =========================================================
   ROOM REFERENCE
   ========================================================= */

function getRoomRef() {

    return ref(
        database,
        `chaosCodeRooms/${currentRoomCode}`
    );

}


/* =========================================================
   LISTEN TO ROOM
   ========================================================= */

function listenToRoom() {

    if (roomListenerStarted) {
        return;
    }

    roomListenerStarted = true;

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


            ensureAnswerProcessor();


            if (
                currentRoomData.status ===
                "starting"
            ) {

                await handleStartingState();

            } else if (
                currentRoomData.status ===
                "playing"
            ) {

                handlePlayingState();

            } else if (
                currentRoomData.status ===
                "roundResult"
            ) {

                handleRoundResultState();

            } else if (
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


/* =========================================================
   STARTING STATE
   ========================================================= */

async function handleStartingState() {

    if (
        currentRoomData.hostUid !==
        currentUser.uid
    ) {
        return;
    }


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
                "rounds/1": round,

                currentRound: 1,

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

    } catch (error) {

        console.error(
            "INITIALIZE FIRST ROUND ERROR:",
            error
        );

    }

}


/* =========================================================
   PLAYING STATE
   ========================================================= */

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


    if (
        currentRoomData.hostUid ===
        currentUser.uid
    ) {

        scheduleHostRoundEnd();

    }

}


/* =========================================================
   RENDER ROUND
   ========================================================= */

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


    renderAvailableClues(
        round
    );


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

        submitButton.disabled = true;


        digitInputs.forEach(
            function (input) {

                input.disabled = true;

            }
        );


        answerStatus.className =
            "answer-status correct";


        answerStatus.textContent =
            `✅ CODE CRACKED! +${Number(
                myAnswer.points || 0
            )} POINTS`;


    } else {

        submitButton.disabled = false;


        digitInputs.forEach(
            function (input) {

                input.disabled = false;

            }
        );

    }

}


/* =========================================================
   RENDER AVAILABLE CLUES
   ========================================================= */

function renderAvailableClues(round) {

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
            Date.now() - startAt
        );


    let visibleCount =
        Math.floor(
            elapsed / CLUE_INTERVAL
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
        elapsed >= ROUND_DURATION
    ) {

        visibleCount = 5;

    }


    clueCounter.textContent =
        `${visibleCount} / 5`;


    cluesList.innerHTML = "";


    for (
        let i = 0;
        i < 5;
        i++
    ) {

        if (i < visibleCount) {

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


        } else {

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


/* =========================================================
   TIMER
   ========================================================= */

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
            Date.now() - startAt;


        const remaining =
            Math.max(
                0,
                ROUND_DURATION - elapsed
            );


        const totalSeconds =
            Math.ceil(
                remaining / 1000
            );


        const minutes =
            Math.floor(
                totalSeconds / 60
            );


        const seconds =
            totalSeconds % 60;


        timerDisplay.textContent =
            `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;


        renderAvailableClues(
            currentRoomData.rounds?.[
                currentRoomData.currentRound
            ]
        );


        if (remaining <= 0) {

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


/* =========================================================
   HOST ROUND TIMER
   ========================================================= */

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
        hostRoundKey === key
    ) {
        return;
    }


    hostRoundKey =
        key;


    clearTimeout(
        hostRoundTimer
    );


    const elapsed =
        Date.now() - startAt;


    const remaining =
        Math.max(
            0,
            ROUND_DURATION - elapsed
        );


    hostRoundTimer =
        setTimeout(
            function () {

                finishCurrentRound();

            },
            remaining + 100
        );

}


/* =========================================================
   FINISH CURRENT ROUND
   ========================================================= */

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


    hostRoundTimer = null;

    hostRoundKey = null;


    try {

        const snapshot =
            await get(
                getRoomRef()
            );


        if (!snapshot.exists()) {
            return;
        }


        currentRoomData =
            snapshot.val();


        await processCorrectAnswers();


        const finalSnapshot =
            await get(
                getRoomRef()
            );


        if (!finalSnapshot.exists()) {
            return;
        }


        currentRoomData =
            finalSnapshot.val();


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


    } catch (error) {

        console.error(
            "FINISH ROUND ERROR:",
            error
        );

    }

}


/* =========================================================
   ROUND RESULT STATE
   ========================================================= */

function handleRoundResultState() {

    clearInterval(
        timerInterval
    );


    clearTimeout(
        hostRoundTimer
    );


    hostRoundTimer = null;


    submitButton.disabled = true;


    digitInputs.forEach(
        function (input) {

            input.disabled = true;

        }
    );


    const roundNumber =
        Number(
            currentRoomData.currentRound
        );


    const answers =
        currentRoomData.answers?.[
            roundNumber
        ] || {};


    const players =
        currentRoomData.players || {};


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


/* =========================================================
   ROUND BREAK
   ========================================================= */

function showRoundBreak(
    roundNumber,
    results
) {

    roundBreak.classList.remove(
        "hidden"
    );


    breakTitle.textContent =
        `ROUND ${roundNumber} RESULTS`;


    roundResultList.innerHTML = "";


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


            row.appendChild(left);

            row.appendChild(right);


            roundResultList.appendChild(
                row
            );

        }
    );


    startBreakCountdown();

}


/* =========================================================
   BREAK COUNTDOWN
   ========================================================= */

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
            Date.now() - resultAt;


        const remaining =
            Math.max(
                0,
                BREAK_DURATION - elapsed
            );


        const seconds =
            Math.ceil(
                remaining / 1000
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


/* =========================================================
   NEXT ROUND TIMER
   ========================================================= */

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
        hostTransitionKey === key
    ) {
        return;
    }


    hostTransitionKey =
        key;


    clearTimeout(
        hostTransitionTimer
    );


    const elapsed =
        Date.now() - resultAt;


    const remaining =
        Math.max(
            0,
            BREAK_DURATION - elapsed
        );


    hostTransitionTimer =
        setTimeout(
            function () {

                startNextRound();

            },
            remaining + 100
        );

}


/* =========================================================
   START NEXT ROUND
   ========================================================= */

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

        const snapshot =
            await get(
                getRoomRef()
            );


        if (!snapshot.exists()) {
            return;
        }


        const room =
            snapshot.val();


        if (
            room.hostUid !==
            currentUser.uid
        ) {
            return;
        }


        if (
            room.status !==
            "roundResult"
        ) {
            return;
        }


        if (
            Number(
                room.currentRound
            ) !== currentRound
        ) {
            return;
        }


        const round =
            generateRound();


        const now =
            Date.now();


        const updates = {};


        const players =
            room.players || {};


        Object.keys(players).forEach(
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
        ] = round;


        updates[
            `answers/${nextRound}`
        ] = null;


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


        hostTransitionKey =
            null;

        hostRoundKey =
            null;


        clearTimeout(
            hostTransitionTimer
        );


        hostTransitionTimer =
            null;


    } catch (error) {

        console.error(
            "START NEXT ROUND ERROR:",
            error
        );

    }

}

/* =========================================================
   ANSWER SUBMISSION
   ========================================================= */

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
            "USE ONLY THE FIVE DIGITS SHOWN IN THE CLUES.",
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


        const existingSnapshot =
            await get(answerRef);


        if (
            existingSnapshot.exists() &&
            existingSnapshot.val()?.correct ===
            true
        ) {
            return;
        }


        await set(
            answerRef,
            {
                answer,

                submittedAt:
                    Date.now(),

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


        } else {

            showAnswerStatus(
                "✅ CORRECT! CALCULATING SPEED...",
                "correct"
            );

        }


    } catch (error) {

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


/* =========================================================
   ANSWER INPUTS
   ========================================================= */

function getAnswerFromInputs() {

    return digitInputs
        .map(
            function (input) {

                return input.value.trim();

            }
        )
        .join("");

}


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


/* =========================================================
   ANSWER PROCESSOR
   ========================================================= */

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


/* =========================================================
   PROCESS CORRECT ANSWERS
   ========================================================= */

async function processCorrectAnswers() {

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
        const [uid, answer]
        of Object.entries(answers)
    ) {

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
            continue;
        }


        const elapsed =
            Math.max(
                0,
                submittedAt -
                roundStartAt
            );


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


        const transactionResult =
            await runTransaction(
                answerRef,
                function (current) {

                    if (!current) {
                        return current;
                    }


                    if (
                        Number(
                            current.points || 0
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


                if (
                    Number(
                        player.lastAnsweredRound
                    ) === roundNumber
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

/* =========================================================
   STANDINGS
   ========================================================= */

function renderStandings(room) {

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


                    return scoreB - scoreA;

                }
            );


    standingsList.innerHTML = "";


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


            if (index === 0) {

                rank.textContent =
                    "🥇";

            } else if (index === 1) {

                rank.textContent =
                    "🥈";

            } else if (index === 2) {

                rank.textContent =
                    "🥉";

            } else {

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


            left.appendChild(rank);

            left.appendChild(name);


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


            row.appendChild(left);

            row.appendChild(score);


            standingsList.appendChild(
                row
            );

        }
    );

}


/* =========================================================
   FINISH GAME
   ========================================================= */

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


        if (!snapshot.exists()) {
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


                        return (
                            scoreB -
                            scoreA
                        );

                    }
                );


        const scoringPlayers =
            entries.filter(
                function ([, player]) {

                    return Number(
                        player.score || 0
                    ) > 0;

                }
            );


        const updates = {};


        entries.forEach(
            function ([uid, player], index) {

                const finalRank =
                    index + 1;


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


        await distributeRewards(
            scoringPlayers
        );


    } catch (error) {

        console.error(
            "FINISH GAME ERROR:",
            error
        );

    }

}


/* =========================================================
   DISTRIBUTE REWARDS
   ========================================================= */

async function distributeRewards(
    scoringPlayers
) {

    try {

        const roomRef =
            getRoomRef();


        const snapshot =
            await get(roomRef);


        if (!snapshot.exists()) {
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


            if (score <= 0) {
                continue;
            }


            const reward =
                TOP_REWARDS[
                    index + 1
                ] || 0;


            if (reward <= 0) {
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


    } catch (error) {

        console.error(
            "DISTRIBUTE REWARDS ERROR:",
            error
        );

    }

}


/* =========================================================
   FINAL RESULTS
   ========================================================= */

function renderFinalResults(room) {

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
        room.players || {};


    const entries =
        Object.entries(players)
            .filter(
                ([, player]) =>
                    !player.leftGame
            )
            .sort(
                function (a, b) {

                    return (
                        Number(
                            a[1].finalRank ||
                            999
                        ) -
                        Number(
                            b[1].finalRank ||
                            999
                        )
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
                    winner[1].score ||
                    0
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


            if (rank === 1) {

                rankDisplay =
                    "🥇";

            } else if (rank === 2) {

                rankDisplay =
                    "🥈";

            } else if (rank === 3) {

                rankDisplay =
                    "🥉";

            } else {

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
                        player.score ||
                        0
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


/* =========================================================
   EXIT
   ========================================================= */

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


        } catch (error) {

            console.error(
                "EXIT ERROR:",
                error
            );

        }

    }
);


/* =========================================================
   LOBBY
   ========================================================= */

lobbyButton.addEventListener(
    "click",
    function () {

        window.location.href =
            "clobby.html";

    }
);


/* =========================================================
   DASHBOARD
   ========================================================= */

dashboardButton.addEventListener(
    "click",
    function () {

        window.location.href =
            "dashboard.html";

    }
);


/* =========================================================
   INPUT RESET
   ========================================================= */

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


/* =========================================================
   ANSWER STATUS
   ========================================================= */

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
   NEW CHAOS CODE CLUE SYSTEM
   ========================================================= */

/*
   CLUE 1
   -------
   Shows all five digits.
   Their order has no meaning.


   CLUE 2
   -------
   Shows ONE digit in its correct position.


   CLUE 3
   -------
   Shows TWO digits in their correct positions.
   One position is carried over from Clue 2.
   One new position is revealed.


   CLUE 4
   -------
   Shows THREE correct positions.
   Two positions came from earlier clues.
   One new position is revealed.


   CLUE 5
   -------
   Shows FOUR correct positions.
   Three came from earlier clues.
   One new position is revealed.


   The remaining fifth position can then be
   solved using the five digits from Clue 1.
*/


function generateRound() {

    const digits =
        generateUniqueDigits(
            CODE_LENGTH
        );


    const secret =
        shuffle(
            [...digits]
        );


    const clues =
        buildProgressiveClues(
            secret,
            digits
        );


    return {

        code:
            secret,

        displayDigits:
            shuffle(
                [...digits]
            ),

        clues

    };

}


/* =========================================================
   BUILD PROGRESSIVE CLUES
   ========================================================= */

function buildProgressiveClues(
    secret,
    digits
) {

    /*
       Random reveal order.

       Example:

       [4, 1, 3, 0, 2]

       This means:

       Clue 2 reveals position 5
       Clue 3 adds position 2
       Clue 4 adds position 4
       Clue 5 adds position 1

       So the player can't simply
       follow a left-to-right pattern.
    */

    const revealOrder =
        shuffle(
            [0, 1, 2, 3, 4]
        );


    const clues = [];


    /* =====================================================
       CLUE 1
       ===================================================== */

    clues.push({

        guess:
            shuffle(
                [...digits]
            ),

        text:
            "These are the five numbers in the code. Their positions are hidden."

    });


    /* =====================================================
       CLUE 2
       ===================================================== */

    const clue2Positions = [
        revealOrder[0]
    ];


    clues.push(
        createPositionClue(
            secret,
            clue2Positions,
            "One number is in its correct position."
        )
    );


    /* =====================================================
       CLUE 3
       ===================================================== */

    const clue3Positions = [
        revealOrder[0],
        revealOrder[1]
    ];


    clues.push(
        createPositionClue(
            secret,
            clue3Positions,
            "Two numbers are now in their correct positions."
        )
    );


    /* =====================================================
       CLUE 4
       ===================================================== */

    const clue4Positions = [
        revealOrder[0],
        revealOrder[1],
        revealOrder[2]
    ];


    clues.push(
        createPositionClue(
            secret,
            clue4Positions,
            "Three numbers are now in their correct positions."
        )
    );


    /* =====================================================
       CLUE 5
       ===================================================== */

    const clue5Positions = [
        revealOrder[0],
        revealOrder[1],
        revealOrder[2],
        revealOrder[3]
    ];


    clues.push(
        createPositionClue(
            secret,
            clue5Positions,
            "Four numbers are now in their correct positions. One position is still unknown."
        )
    );


    return clues;

}


/* =========================================================
   POSITION CLUE CREATOR
   ========================================================= */

function createPositionClue(
    secret,
    revealedPositions,
    text
) {

    const guess = [];


    for (
        let i = 0;
        i < CODE_LENGTH;
        i++
    ) {

        if (
            revealedPositions.includes(i)
        ) {

            guess.push(
                secret[i]
            );

        } else {

            guess.push(
                "?"
            );

        }

    }


    return {

        guess,

        text,

        revealedPositions:
            [...revealedPositions]

    };

}

/* =========================================================
   DIGIT GENERATION
   ========================================================= */

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


/* =========================================================
   SHUFFLE
   ========================================================= */

function shuffle(array) {

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
        ] = [
            array[j],
            array[i]
        ];

    }


    return array;

}


/* =========================================================
   TIMESTAMP HELPER
   ========================================================= */

function getTimestamp(value) {

    if (
        typeof value ===
        "number"
    ) {

        return value;

    }


    if (
        value &&
        typeof value.toDate ===
        "function"
    ) {

        return value
            .toDate()
            .getTime();

    }


    if (
        value &&
        typeof value.seconds ===
        "number"
    ) {

        return (
            value.seconds * 1000
        ) +
        Math.floor(
            (
                value.nanoseconds ||
                0
            ) / 1000000
        );

    }


    return null;

}


/* =========================================================
   HTML ESCAPE
   ========================================================= */

function escapeHtml(value) {

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