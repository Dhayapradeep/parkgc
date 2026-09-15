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


/* =========================================================
   CHAOS CODE
========================================================= */

const auth = getAuth(app);


/* =========================================================
   GAME SETTINGS
========================================================= */

const TOTAL_ROUNDS = 5;

const CODE_LENGTH = 5;

const ROUND_DURATION =
    120 * 1000;

const CLUE_INTERVAL =
    10 * 1000;

const BREAK_DURATION =
    5 * 1000;


/* =========================================================
   CHAOS POINT REWARDS
========================================================= */

const TOP_REWARDS = {

    1: 100,

    2: 75,

    3: 50

};


/* =========================================================
   DOM ELEMENTS
========================================================= */

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

    document.getElementById(
        "digit1"
    ),

    document.getElementById(
        "digit2"
    ),

    document.getElementById(
        "digit3"
    ),

    document.getElementById(
        "digit4"
    ),

    document.getElementById(
        "digit5"
    )

];


/* =========================================================
   URL
========================================================= */

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


/* =========================================================
   STATE
========================================================= */

let currentUser = null;

let currentUsername =
    "Player";

let currentRoomData =
    null;

let roomListenerStarted =
    false;

let answerProcessorStarted =
    false;

let timerInterval =
    null;

let countdownTimer =
    null;

let hostRoundTimer =
    null;

let hostTransitionTimer =
    null;

let hostRoundKey =
    null;

let hostTransitionKey =
    null;

let currentRoundNumber =
    null;


/* =========================================================
   AUTH
========================================================= */

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


/* =========================================================
   LOAD USER PROFILE
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


        if (
            snapshot.exists()
        ) {

            const data =
                snapshot.val();


            currentUsername =
                data.username ||
                "Player";

        }

        else {

            currentUsername =
                currentUser.displayName ||
                "Player";

        }

    }

    catch (error) {

        console.error(
            "LOAD USER ERROR:",
            error
        );


        currentUsername =
            currentUser.displayName ||
            "Player";

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
   ROOM LISTENER
========================================================= */

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
                currentRoomData
                    .players?.[
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
                    player.score ||
                    0
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

        },

        function (error) {

            console.error(
                "ROOM LISTENER ERROR:",
                error
            );

        }
    );

}


/* =========================================================
   STARTING STATE
========================================================= */

async function handleStartingState() {

    /*
        Only the host creates the first round.
    */

    if (
        currentRoomData.hostUid !==
        currentUser.uid
    ) {

        return;

    }


    /*
        Prevent duplicate round creation.
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
        currentRoomData
            .rounds?.[
                roundNumber
            ];


    if (!round) {

        return;

    }


    gameSection.classList.remove(
        "hidden"
    );


    roundBreak.classList.add(
        "hidden"
    );


    finalResults.classList.add(
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


    renderCodeDigits(
        round.displayDigits
    );


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
        myAnswer?.correct ===
        true
    ) {

        submitButton.disabled =
            true;


        digitInputs.forEach(
            function (input) {

                input.disabled =
                    true;

            }
        );


        showAnswerStatus(
            `✅ CODE CRACKED! +${
                Number(
                    myAnswer.points ||
                    0
                )
            } POINTS`,
            "correct"
        );

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


/* =========================================================
   DISPLAY CODE DIGITS
========================================================= */

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


/* =========================================================
   CLUE DISPLAY
========================================================= */

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
        Clue 1 immediately.
        Clue 2 at 10 seconds.
        Clue 3 at 20 seconds.
        Clue 4 at 30 seconds.
        Clue 5 at 40 seconds.
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


/* =========================================================
   PLAYER TIMER
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
            currentRoomData
                .rounds?.[
                    currentRoomData
                        .currentRound
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


/* =========================================================
   HOST ROUND END
========================================================= */

function scheduleHostRoundEnd() {

    if (
        !currentRoomData ||
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


    const remaining =
        Math.max(
            0,
            ROUND_DURATION -
            (
                Date.now() -
                startAt
            )
        );


    hostRoundTimer =
        setTimeout(
            finishCurrentRound,
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
                function ([uid, player]) {

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

                    return (
                        b.points -
                        a.points
                    ) ||
                    (
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
   ROUND BREAK UI
========================================================= */

function showRoundBreak(
    roundNumber,
    results
) {

    roundBreak.classList.remove(
        "hidden"
    );


    gameSection.classList.add(
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


    function tick() {

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


    tick();


    countdownTimer =
        setInterval(
            tick,
            100
        );

}


/* =========================================================
   NEXT ROUND
========================================================= */

function scheduleNextRound() {

    if (
        !currentRoomData ||
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


    const remaining =
        Math.max(
            0,
            BREAK_DURATION -
            (
                Date.now() -
                resultAt
            )
        );


    hostTransitionTimer =
        setTimeout(
            startNextRound,
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


        if (
            !snapshot.exists()
        ) {

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
            ) !==
            currentRound
        ) {

            return;

        }


        const round =
            generateRound();


        const now =
            Date.now();


        const updates = {

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
                now,

            roundEndAt:
                null,

            roundResultAt:
                null,

            status:
                "playing"

        };


        Object.keys(
            room.players ||
            {}
        )
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


        await update(
            getRoomRef(),
            updates
        );


        hostTransitionKey =
            null;


        hostRoundKey =
            null;

    }

    catch (error) {

        console.error(
            "START NEXT ROUND ERROR:",
            error
        );

    }

}


/* =========================================================
   SUBMIT ANSWER
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

                return String(
                    digit
                );

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


    const correct =
        answer ===
        round.code.join("");


    const answerRef =
        ref(
            database,
            `chaosCodeRooms/${currentRoomCode}/answers/${roundNumber}/${currentUser.uid}`
        );


    submitButton.disabled =
        true;


    try {

        const existingSnapshot =
            await get(
                answerRef
            );


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
                    serverTimestamp(),

                correct,

                points:
                    0

            }
        );


        if (!correct) {

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
                        digitInputs.length -
                        1
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
   HOST ANSWER PROCESSOR
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


    if (!round) {

        return;

    }


    const answers =
        currentRoomData.answers?.[
            roundNumber
        ] || {};


    for (
        const [
            uid,
            answer
        ] of Object.entries(
            answers
        )
    ) {

        if (
            !answer ||
            answer.correct !==
                true ||
            Number(
                answer.points ||
                0
            ) > 0
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


        const transaction =
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
            !transaction.committed
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
                    ) ===
                    roundNumber
                ) {

                    return;

                }


                player.score =
                    Number(
                        player.score ||
                        0
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

function renderStandings(
    room
) {

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
        .sort(
            function (a, b) {

                return (
                    Number(
                        b[1].score ||
                        0
                    ) -
                    Number(
                        a[1].score ||
                        0
                    )
                );

            }
        );


    standingsList.innerHTML =
        "";


    if (
        entries.length ===
        0
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
                index ===
                0
            ) {

                rank.textContent =
                    "🥇";

            }

            else if (
                index ===
                1
            ) {

                rank.textContent =
                    "🥈";

            }

            else if (
                index ===
                2
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
                uid ===
                currentUser?.uid
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


            const score =
                document.createElement(
                    "span"
                );


            score.className =
                "standing-score";


            score.textContent =
                `${Number(
                    player.score ||
                    0
                )} PTS`;


            left.appendChild(
                rank
            );


            left.appendChild(
                name
            );


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
            Final ranking includes
            every player still in the game.
        */

        const entries =
            Object.entries(
                players
            )
            .filter(
                ([, player]) =>
                    !player.leftGame
            )
            .sort(
                function (a, b) {

                    return (
                        Number(
                            b[1].score ||
                            0
                        ) -
                        Number(
                            a[1].score ||
                            0
                        )
                    );

                }
            );


        /*
            CP rewards only apply to
            players who actually scored.
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


        const updates =
            {};


        entries.forEach(
            function ([uid, player], index) {

                const scoringPosition =
                    scoringPlayers.findIndex(
                        function ([scoringUid]) {

                            return (
                                scoringUid ===
                                uid
                            );

                        }
                    );


                let reward =
                    0;


                if (
                    scoringPosition >= 0 &&
                    scoringPosition < 3
                ) {

                    reward =
                        TOP_REWARDS[
                            scoringPosition + 1
                        ] ||
                        0;

                }


                updates[
                    `players/${uid}/finalRank`
                ] =
                    index + 1;


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

    }

    catch (error) {

        console.error(
            "FINISH GAME ERROR:",
            error
        );

    }

}


/* =========================================================
   DISTRIBUTE CP
========================================================= */

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

            const [
                uid,
                player
            ] =
                scoringPlayers[index];


            const score =
                Number(
                    player.score ||
                    0
                );


            if (
                score <=
                0
            ) {

                continue;

            }


            const reward =
                TOP_REWARDS[
                    index + 1
                ] ||
                0;


            if (
                reward <=
                0
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
                        current ||
                        0
                    ) +
                    reward;

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


/* =========================================================
   FINAL RESULTS
========================================================= */

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
        Object.entries(
            players
        )
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


            let rankDisplay;


            if (
                rank ===
                1
            ) {

                rankDisplay =
                    "🥇";

            }

            else if (
                rank ===
                2
            ) {

                rankDisplay =
                    "🥈";

            }

            else if (
                rank ===
                3
            ) {

                rankDisplay =
                    "🥉";

            }

            else {

                rankDisplay =
                    rank;

            }


            const row =
                document.createElement(
                    "div"
                );


            row.className =
                "final-player";


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

        }

        catch (error) {

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
   ANSWER UI HELPERS
========================================================= */

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
   =========================================================
   SIMPLE CHAOS CODE PUZZLE GENERATOR
   =========================================================

   THE IMPORTANT RULE:

   Each clue is generated from the remaining
   possible solutions created by the clues before it.

   We never independently generate:

       clue 1
       clue 2
       clue 3
       clue 4
       clue 5

   Instead:

       ALL 120
           ↓
       clue 1
           ↓
       remaining solutions
           ↓
       clue 2
           ↓
       remaining solutions
           ↓
       clue 3
           ↓
       remaining solutions
           ↓
       clue 4
           ↓
       remaining solutions
           ↓
       clue 5
           ↓
       exactly one

=========================================================
========================================================= */


/* =========================================================
   GENERATE ROUND
========================================================= */

function generateRound() {

    /*
        Retry a few different secret codes if
        a clean clue chain cannot be found.
    */

    for (
        let attempt = 0;
        attempt < 100;
        attempt++
    ) {

        const digits =
            generateUniqueDigits(
                CODE_LENGTH
            );


        const secret =
            shuffle(
                [...digits]
            );


        const allSolutions =
            generatePermutations(
                digits
            );


        const clues =
            buildClueChain(
                secret,
                digits,
                allSolutions
            );


        if (
            clues.length === 5
        ) {

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

    }


    /*
        This should be extremely unlikely.
    */

    throw new Error(
        "Unable to create a valid Chaos Code puzzle."
    );

}


/* =========================================================
   BUILD DEPENDENT CLUE CHAIN
========================================================= */

function buildClueChain(
    secret,
    digits,
    allSolutions
) {

    /*
        Start with all 120 possible orders.
    */

    let possibleSolutions =
        [...allSolutions];


    const selectedClues =
        [];


    const usedGuesses =
        new Set();


    /*
        Approximate difficulty targets.

        The exact numbers are not mandatory.
        They simply keep the puzzle comfortable.

        Clue 1:
        broad

        Clue 2:
        narrower

        Clue 3:
        useful deduction

        Clue 4:
        very close

        Clue 5:
        one answer
    */

    const targets = [

        {
            min: 45,
            max: 90
        },

        {
            min: 15,
            max: 45
        },

        {
            min: 5,
            max: 18
        },

        {
            min: 2,
            max: 6
        },

        {
            min: 1,
            max: 1
        }

    ];


    for (
        let clueIndex = 0;
        clueIndex < 5;
        clueIndex++
    ) {

        const target =
            targets[
                clueIndex
            ];


        /*
            Create possible guesses.

            All permutations of the real digits
            are useful for position clues.

            Random guesses provide unavailable
            number information.
        */

        const guesses =
            createGuessPool(
                digits
            );


        const candidates =
            [];


        for (
            const guess of guesses
        ) {

            const guessKey =
                guess.join("");


            /*
                Never repeat a guess.
            */

            if (
                usedGuesses.has(
                    guessKey
                )
            ) {

                continue;

            }


            /*
                Never reveal the answer directly.
            */

            if (
                guessKey ===
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
                A clue with no matching
                numbers gives very little
                useful information here.
            */

            if (
                feedback.exact === 0 &&
                feedback.misplaced === 0
            ) {

                continue;

            }


            /*
                THIS IS WHERE THE CLUE DEPENDS
                ON ALL PREVIOUS CLUES.

                We do not compare against
                allSolutions anymore.

                We compare against the CURRENT
                possibleSolutions.

                Therefore each new clue works
                on what remains after the previous
                clues.
            */

            const remaining =
                possibleSolutions.filter(
                    function (candidate) {

                        const result =
                            evaluateGuess(
                                guess,
                                candidate
                            );


                        return (

                            result.exact ===
                                feedback.exact &&

                            result.misplaced ===
                                feedback.misplaced &&

                            result.absent ===
                                feedback.absent

                        );

                    }
                );


            /*
                The actual secret must remain
                possible.
            */

            const secretStillPossible =
                remaining.some(
                    function (candidate) {

                        return (
                            candidate.join("") ===
                            secret.join("")
                        );

                    }
                );


            if (
                !secretStillPossible
            ) {

                continue;

            }


            /*
                Before clue 5, never completely
                solve the puzzle.
            */

            if (
                clueIndex < 4 &&
                remaining.length <= 1
            ) {

                continue;

            }


            /*
                How close is this clue to the
                desired difficulty?
            */

            let targetDistance =
                0;


            if (
                remaining.length <
                target.min
            ) {

                targetDistance =
                    target.min -
                    remaining.length;

            }

            else if (
                remaining.length >
                target.max
            ) {

                targetDistance =
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
                Make the clue meaningfully
                different from the previous one.

                For example, if the previous clue
                was mostly misplaced digits, prefer
                something that introduces exact
                or unavailable information.
            */

            let diversityBonus =
                0;


            if (
                selectedClues.length > 0
            ) {

                const previous =
                    selectedClues[
                        selectedClues.length -
                        1
                    ];


                if (
                    previous.exact !==
                    feedback.exact
                ) {

                    diversityBonus +=
                        4;

                }


                if (
                    previous.misplaced !==
                    feedback.misplaced
                ) {

                    diversityBonus +=
                        3;

                }


                if (
                    previous.absent !==
                    feedback.absent
                ) {

                    diversityBonus +=
                        2;

                }

            }


            const informationScore =

                (
                    feedback.exact *
                    4
                ) +

                (
                    feedback.misplaced *
                    2
                ) +

                feedback.absent;


            const candidateScore =

                (
                    targetDistance *
                    100
                ) +

                midpointDistance -

                (
                    diversityBonus *
                    5
                ) -

                informationScore;


            candidates.push({

                guess,

                feedback,

                remaining,

                score:
                    candidateScore

            });

        }


        if (
            candidates.length === 0
        ) {

            return [];

        }


        /*
            Best candidates first.
        */

        candidates.sort(
            function (a, b) {

                return (
                    a.score -
                    b.score
                );

            }
        );


        /*
            We don't blindly pick the first one.

            We test a small group to ensure the
            chain can continue.
        */

        const choices =
            candidates.slice(
                0,
                Math.min(
                    15,
                    candidates.length
                )
            );


        let chosen =
            null;


        for (
            const candidate of choices
        ) {

            /*
                Add the candidate clue temporarily.
            */

            const testClues = [

                ...selectedClues,

                {

                    guess:
                        candidate.guess,

                    exact:
                        candidate.feedback.exact,

                    misplaced:
                        candidate.feedback.misplaced,

                    absent:
                        candidate.feedback.absent

                }

            ];


            const solutionsAfter =
                filterSolutions(
                    allSolutions,
                    testClues
                );


            /*
                Last clue:
                MUST leave exactly one.
            */

            if (
                clueIndex === 4
            ) {

                if (
                    solutionsAfter.length === 1 &&
                    solutionsAfter[0].join("") ===
                        secret.join("")
                ) {

                    chosen =
                        candidate;

                    break;

                }

            }

            else {

                /*
                    Earlier clues must still leave
                    multiple possibilities.
                */

                if (
                    solutionsAfter.length > 1
                ) {

                    chosen =
                        candidate;

                    break;

                }

            }

        }


        if (!chosen) {

            return [];

        }


        /*
            Save the clue.
        */

        const clue =
            {

                guess:
                    [...chosen.guess],

                exact:
                    chosen.feedback.exact,

                misplaced:
                    chosen.feedback.misplaced,

                absent:
                    chosen.feedback.absent,

                text:
                    buildClueText(
                        chosen.feedback
                    )

            };


        selectedClues.push(
            clue
        );


        usedGuesses.add(
            chosen.guess.join("")
        );


        /*
            THIS IS THE KEY:

            Everything from now on uses
            ONLY the solutions left by this clue.
        */

        possibleSolutions =
            chosen.remaining;

    }


    /*
        Final safety check.
    */

    const finalSolutions =
        filterSolutions(
            allSolutions,
            selectedClues
        );


    if (
        finalSolutions.length !==
        1
    ) {

        return [];

    }


    if (
        finalSolutions[0].join("") !==
        secret.join("")
    ) {

        return [];

    }


    return selectedClues;

}


/* =========================================================
   CREATE GUESS POOL
========================================================= */

function createGuessPool(
    digits
) {

    const guesses =
        [];


    const used =
        new Set();


    /*
        First:
        all 120 arrangements of the actual
        visible digits.
    */

    const permutations =
        generatePermutations(
            digits
        );


    for (
        const guess of permutations
    ) {

        const key =
            guess.join("");


        if (
            !used.has(key)
        ) {

            used.add(key);

            guesses.push(
                guess
            );

        }

    }


    /*
        Add decoy guesses.

        These contain one or more numbers
        that are not in the actual code.

        This allows clues to say:

        "One number is not in the code."
    */

    let attempts =
        0;


    while (
        guesses.length <
            300 &&
        attempts <
            3000
    ) {

        attempts++;


        const guess =
            generateGuess();


        const key =
            guess.join("");


        if (
            used.has(key)
        ) {

            continue;

        }


        used.add(key);


        guesses.push(
            guess
        );

    }


    shuffle(
        guesses
    );


    return guesses;

}


/* =========================================================
   FILTER POSSIBLE SOLUTIONS
========================================================= */

function filterSolutions(
    solutions,
    clues
) {

    return solutions.filter(
        function (candidate) {

            return clues.every(
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

}


/* =========================================================
   GUESS EVALUATION
========================================================= */

function evaluateGuess(
    guess,
    secret
) {

    let exact =
        0;


    let totalCommon =
        0;


    for (
        let i = 0;
        i < CODE_LENGTH;
        i++
    ) {

        /*
            Correct number AND correct position.
        */

        if (
            guess[i] ===
            secret[i]
        ) {

            exact++;

        }


        /*
            Correct number somewhere in
            the secret.
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


/* =========================================================
   CLUE TEXT
========================================================= */

function buildClueText(
    feedback
) {

    const parts =
        [];


    /*
        EXACT
    */

    if (
        feedback.exact ===
        1
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
        MISPLACED
    */

    if (
        feedback.misplaced ===
        1
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
        ABSENT
    */

    if (
        feedback.absent ===
        1
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


    return parts.join(
        " "
    );

}


/* =========================================================
   UNIQUE DIGITS
========================================================= */

function generateUniqueDigits(
    count
) {

    const digits =
        [];


    while (
        digits.length <
        count
    ) {

        const digit =
            Math.floor(
                Math.random() *
                10
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
   RANDOM GUESS
========================================================= */

function generateGuess() {

    return generateUniqueDigits(
        CODE_LENGTH
    );

}


/* =========================================================
   PERMUTATIONS
========================================================= */

function generatePermutations(
    array
) {

    if (
        array.length <=
        1
    ) {

        return [
            array
        ];

    }


    const result =
        [];


    array.forEach(
        function (
            value,
            index
        ) {

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
                function (
                    permutation
                ) {

                    result.push(
                        [
                            value,
                            ...permutation
                        ]
                    );

                }
            );

        }
    );


    return result;

}


/* =========================================================
   SHUFFLE
========================================================= */

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
                (
                    i + 1
                )
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


/* =========================================================
   TIMESTAMP
========================================================= */

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


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHtml(
    value
) {

    return String(
        value
    )

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