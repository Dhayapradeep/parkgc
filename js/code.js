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

const TOTAL_ROUNDS =
    5;

const CODE_LENGTH =
    5;


/*
   UPDATED:
   2 MINUTES PER ROUND
*/

const ROUND_DURATION =
    120 * 1000;


/*
   One new clue every 10 seconds.
*/

const CLUE_INTERVAL =
    10 * 1000;


/*
   Five-second break between rounds.
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

let redirecting =
    false;

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
   ROOM REF
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
               Start answer processor once.
            */

            ensureAnswerProcessor();


            /*
               GAME STATE
            */

            if (
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


            /*
               STARTING STATE
            */

            else if (
                currentRoomData.status ===
                "starting"
            ) {

                await handleStartingState();

            }

        }
    );

}



/* =========================
   STARTING
========================= */

async function handleStartingState() {

    /*
       ONLY HOST generates the first round.
    */

    if (
        currentRoomData.hostUid !==
        currentUser.uid
    ) {

        return;

    }


    /*
       Don't create it twice.
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


        const updates = {

            "rounds/1":
                round,

            currentRound:
                1,

            currentCode:
                round.code,

            currentClues:
                round.clues,

            /*
               IMPORTANT:
               use numeric Date.now()
               instead of serverTimestamp()
               for state scheduling.
            */

            roundStartAt:
                now,

            roundEndAt:
                null,

            roundResultAt:
                null,

            status:
                "playing"

        };


        await update(
            getRoomRef(),
            updates
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
       Hide result overlay.
    */

    roundBreak.classList.add(
        "hidden"
    );


    /*
       Render round.
    */

    renderRound(
        roundNumber,
        round
    );


    /*
       Start player's local timer.
    */

    startTimer();


    /*
       Host controls exact round transition.
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
            `✅ CODE CRACKED! +${myAnswer.points || 0} POINTS`;

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
   CODE DISPLAY
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
            totalSeconds % 60;


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


    /*
       Prevent repeated timers every time
       Firebase sends another update.
    */

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
            finishCurrentRound,
            remaining + 100
        );

}



/* =========================
   FINISH CURRENT ROUND
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


    /*
       Disable answering.
    */

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


    /*
       Show round result overlay.
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
                            Number(
                                answer?.points || 0
                            ),

                        correct:
                            answer?.correct === true,

                        totalScore:
                            Number(
                                player.score || 0
                            )

                    };

                }
            )
            .sort(
                (a, b) => {

                    if (
                        b.points !==
                        a.points
                    ) {

                        return b.points -
                            a.points;

                    }


                    return b.totalScore -
                        a.totalScore;

                }
            );


    showRoundBreak(
        roundNumber,
        results
    );


    /*
       Only host schedules the next step.
    */

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
   FIVE-SECOND COUNTDOWN
========================= */

function startBreakCountdown() {

    clearInterval(
        countdownTimer
    );


    const resultAt =
        Number(
            currentRoomData.roundResultAt
        );


    /*
       If Firebase hasn't delivered the value
       yet, use the current time temporarily.
    */

    const effectiveStart =
        resultAt ||
        Date.now();


    function updateCountdown() {

        const elapsed =
            Date.now() -
            effectiveStart;


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
   SCHEDULE NEXT ROUND
========================= */

function scheduleNextRound() {

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


    /*
       VERY IMPORTANT:

       Firebase may trigger onValue multiple
       times while the result screen is visible.

       We only schedule ONE transition.
    */

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
        "roundResult"
    ) {

        return;

    }


    const currentRound =
        Number(
            currentRoomData.currentRound
        );


    /*
       Round 5 is finished.
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
           Make sure another onValue event
           doesn't cause duplicate generation.
        */

        const freshSnapshot =
            await get(roomRef);


        if (
            !freshSnapshot.exists()
        ) {

            return;

        }


        const freshRoom =
            freshSnapshot.val();


        if (
            freshRoom.hostUid !==
            currentUser.uid
        ) {

            return;

        }


        if (
            freshRoom.status !==
            "roundResult"
        ) {

            return;

        }


        if (
            freshRoom.currentRound !==
            currentRound
        ) {

            return;

        }


        /*
           Generate the new round.
        */

        const round =
            generateRound();


        const now =
            Date.now();


        const updates = {};


        /*
           Reset only round-specific
           player information.

           Total score is NOT reset.
        */

        const players =
            freshRoom.players ||
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
        ] = round;


        /*
           Clear answer area for this round.
        */

        updates[
            `answers/${nextRound}`
        ] = null;


        updates.currentRound =
            nextRound;


        updates.currentCode =
            round.code;


        updates.currentClues =
            round.clues;


        /*
           Numeric timestamp.
        */

        updates.roundStartAt =
            now;


        updates.roundEndAt =
            null;


        updates.roundResultAt =
            null;


        updates.status =
            "playing";


        await update(
            roomRef,
            updates
        );


        /*
           Reset host scheduling state.
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


        /*
           The realtime listener will close
           the result screen and render the
           new round.
        */

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


    const existingAnswer =
        currentRoomData.answers?.[
            roundNumber
        ]?.[
            currentUser.uid
        ];


    if (
        existingAnswer?.correct === true
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
           Do not overwrite a correct answer
           that was already stored.
        */

        const existingSnapshot =
            await get(
                answerRef
            );


        if (
            existingSnapshot.exists() &&
            existingSnapshot.val()?.correct === true
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
       Only host processes scores.
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
        const [uid, answer] of
        Object.entries(answers)
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


        /*
           Continuous speed-based scoring.

           100 points at very high speed,
           gradually decreasing to 1 point
           near the end of the 2-minute round.

           There are NO 10-second brackets.
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
   FINAL GAME
========================= */

async function finishGame() {

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
        currentRoomData.status ===
        "finished"
    ) {

        return;

    }


    clearTimeout(
        hostRoundTimer
    );


    clearTimeout(
        hostTransitionTimer
    );


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
            room.status ===
            "finished"
        ) {

            return;

        }


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
            Date.now();


        updates.rewardsCalculated =
            true;


        await update(
            getRoomRef(),
            updates
        );


        await distributeRewards(
            entries
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
            "DISTRIBUTE REWARDS ERROR:",
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


    clearTimeout(
        hostRoundTimer
    );


    clearTimeout(
        hostTransitionTimer
    );


    clearInterval(
        countdownTimer
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

                        ${
                            rank <= 3
                                ? ["🥇", "🥈", "🥉"][
                                    rank - 1
                                ]
                                : rank
                        }

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
   EXIT
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
   LOBBY
========================= */

lobbyButton.addEventListener(
    "click",
    function () {

        window.location.href =
            "clobby.html";

    }
);



/* =========================
   DASHBOARD
========================= */

dashboardButton.addEventListener(
    "click",
    function () {

        window.location.href =
            "dashboard.html";

    }
);



/* =========================
   INPUT RESET
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
   STATUS
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

    const digits =
        generateUniqueDigits(
            CODE_LENGTH
        );


    const secret =
        shuffle(
            [...digits]
        );


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


            if (
                feedback.exact === 0 &&
                feedback.misplaced === 0
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


    if (
        clues.length !== 5
    ) {

        clues =
            createFallbackClues(
                digits,
                secret
            );

    }


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
   DIGITS
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
   GUESS
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
   EVALUATE
========================= */

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
   UNIQUE SOLUTION
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


    let solutions =
        0;


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

        return [
            array
        ];

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
   ESCAPE HTML
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