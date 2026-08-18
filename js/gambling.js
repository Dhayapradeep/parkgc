import {
    getAuth,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

import {
    ref,
    onValue,
    runTransaction
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-database.js";

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
   ELEMENTS
========================= */

const chaosPointsElement =
    document.getElementById(
        "chaosPoints"
    );

const rollButton =
    document.getElementById(
        "rollButton"
    );

const rouletteDisplay =
    document.getElementById(
        "rouletteDisplay"
    );

const resultText =
    document.getElementById(
        "resultText"
    );

const resultDescription =
    document.getElementById(
        "resultDescription"
    );

const statusText =
    document.getElementById(
        "statusText"
    );

const historyCard =
    document.getElementById(
        "historyCard"
    );

const backButton =
    document.getElementById(
        "backButton"
    );


/* =========================
   HOW TO PLAY MODAL
========================= */

const howToPlayButton =
    document.getElementById(
        "howToPlayButton"
    );

const rulesModal =
    document.getElementById(
        "rulesModal"
    );

const closeRulesButton =
    document.getElementById(
        "closeRulesButton"
    );


/* =========================
   GAME VARIABLES
========================= */

let currentUser = null;

let currentChaosPoints = 0;

let isRolling = false;


/* =========================
   HOW TO PLAY
========================= */

if (
    howToPlayButton &&
    rulesModal
) {

    howToPlayButton.addEventListener(
        "click",
        function () {

            rulesModal.classList.add(
                "active"
            );

        }
    );

}


if (
    closeRulesButton &&
    rulesModal
) {

    closeRulesButton.addEventListener(
        "click",
        function () {

            rulesModal.classList.remove(
                "active"
            );

        }
    );

}


/* =========================
   CLOSE MODAL ON OUTSIDE CLICK
========================= */

if (rulesModal) {

    rulesModal.addEventListener(
        "click",
        function (event) {

            if (
                event.target ===
                rulesModal
            ) {

                rulesModal.classList.remove(
                    "active"
                );

            }

        }
    );

}


/* =========================
   BACK TO DASHBOARD
========================= */

if (backButton) {

    backButton.addEventListener(
        "click",
        function () {

            window.location.href =
                "dashboard.html";

        }
    );

}


/* =========================
   AUTH CHECK
========================= */

onAuthStateChanged(
    auth,
    function (user) {

        if (!user) {

            window.location.href =
                "login.html";

            return;

        }

        currentUser = user;

        loadChaosPoints();

    }
);


/* =========================
   LOAD CHAOS POINTS
========================= */

function loadChaosPoints() {

    if (!currentUser) {

        return;

    }

    const userRef =
        ref(
            database,
            `users/${currentUser.uid}`
        );

    onValue(
        userRef,
        function (snapshot) {

            if (!snapshot.exists()) {

                return;

            }

            const userData =
                snapshot.val();

            currentChaosPoints =
                Number(
                    userData.chaosPoints
                ) || 0;

            updateChaosDisplay();

        }
    );

}


/* =========================
   UPDATE CHAOS DISPLAY
========================= */

function updateChaosDisplay() {

    if (chaosPointsElement) {

        chaosPointsElement.textContent =
            currentChaosPoints;

    }

    if (rollButton) {

        rollButton.disabled =
            currentChaosPoints < 500 ||
            isRolling;

    }

}


/* =========================
   WEIGHTED OUTCOMES
========================= */

const outcomes = [

    /* =====================
       COMMON
    ===================== */

    {
        title: "SMALL WIN",
        description:
            "You gained 500 CP.",
        type: "add",
        value: 500,
        icon: "💰",
        weight: 15
    },

    {
        title: "LUCKY WIN",
        description:
            "You gained 750 CP.",
        type: "add",
        value: 750,
        icon: "✨",
        weight: 13
    },

    {
        title: "BIG WIN",
        description:
            "You gained 1,000 CP.",
        type: "add",
        value: 1000,
        icon: "💸",
        weight: 12
    },

    {
        title: "SMALL CRASH",
        description:
            "You lost 25% of your remaining CP.",
        type: "percentSubtract",
        value: 25,
        icon: "📉",
        weight: 10
    },


    /* =====================
       UNCOMMON
    ===================== */

    {
        title: "CHAOS BONUS",
        description:
            "You gained 25% of your remaining CP.",
        type: "percentAdd",
        value: 25,
        icon: "📈",
        weight: 8
    },

    {
        title: "CHAOS RAIN",
        description:
            "You gained 1,500 CP.",
        type: "add",
        value: 1500,
        icon: "🌧️",
        weight: 7
    },

    {
        title: "HALF GONE",
        description:
            "You lost 50% of your remaining CP.",
        type: "percentSubtract",
        value: 50,
        icon: "💀",
        weight: 7
    },

    {
        title: "BREAK EVEN",
        description:
            "Your 500 CP roll cost was refunded.",
        type: "refund",
        value: 500,
        icon: "😐",
        weight: 6
    },


    /* =====================
       RARE
    ===================== */

    {
        title: "SUPER BONUS",
        description:
            "You gained 50% of your remaining CP.",
        type: "percentAdd",
        value: 50,
        icon: "🚀",
        weight: 5
    },

    {
        title: "CHAOS DAMAGE",
        description:
            "You lost 75% of your remaining CP.",
        type: "percentSubtract",
        value: 75,
        icon: "🔥",
        weight: 4
    },

    {
        title: "DOUBLE CHAOS",
        description:
            "Your remaining Chaos Points doubled!",
        type: "double",
        icon: "👑",
        weight: 6
    },


    /* =====================
       VERY RARE
    ===================== */

    {
        title: "MEGA JACKPOT",
        description:
            "You gained 5,000 CP!",
        type: "add",
        value: 5000,
        icon: "⚡",
        weight: 3
    },

    {
        title: "TRIPLE CHAOS",
        description:
            "Your remaining Chaos Points tripled!",
        type: "triple",
        icon: "🔥",
        weight: 2
    },


    /* =====================
       EXTREMELY RARE
    ===================== */

    {
        title: "CHAOS FLIP",
        description:
            "A 50/50 fate will decide your reward.",
        type: "chaosFlip",
        icon: "🪙",
        weight: 1
    },

    {
        title: "TOTAL DESTRUCTION",
        description:
            "You lost ALL your Chaos Points.",
        type: "zero",
        icon: "☠️",
        weight: 1
    },


    /* =====================
       10 NEW CHAOS OUTCOMES
    ===================== */

    {
        title: "PITY MONEY",
        description:
            "The universe felt bad for you. +250 CP.",
        type: "add",
        value: 250,
        icon: "🥲",
        weight: 10
    },

    {
        title: "CHAOS TAX",
        description:
            "The government of chaos took 10% of your CP.",
        type: "percentSubtract",
        value: 10,
        icon: "🧾",
        weight: 9
    },

    {
        title: "MYSTERY GIFT",
        description:
            "Someone anonymously sent you 2,000 CP.",
        type: "add",
        value: 2000,
        icon: "🎁",
        weight: 4
    },

    {
        title: "BROKE BUT ALIVE",
        description:
            "You lost 90% of your remaining CP.",
        type: "percentSubtract",
        value: 90,
        icon: "😭",
        weight: 2
    },

    {
        title: "CHAOS INSURANCE",
        description:
            "You received 300 CP for surviving this madness.",
        type: "add",
        value: 300,
        icon: "🛡️",
        weight: 8
    },

    {
        title: "GOLDEN SHOWER",
        description:
            "CP is falling from the sky. +3,000 CP!",
        type: "add",
        value: 3000,
        icon: "🌟",
        weight: 3
    },

    {
        title: "REVERSE UNO",
        description:
            "Your CP increased by 75%!",
        type: "percentAdd",
        value: 75,
        icon: "🔄",
        weight: 3
    },

    {
        title: "CHAOS GREMLIN",
        description:
            "A gremlin stole 40% of your CP.",
        type: "percentSubtract",
        value: 40,
        icon: "👹",
        weight: 6
    },

    {
        title: "ABSOLUTE UNIT",
        description:
            "You gained 10,000 CP. WHAT?!",
        type: "add",
        value: 10000,
        icon: "🗿",
        weight: 1
    },

    {
        title: "THE VOID",
        description:
            "Half your CP vanished into another dimension.",
        type: "percentSubtract",
        value: 50,
        icon: "🕳️",
        weight: 5
    }

];


/* =========================
   GET WEIGHTED OUTCOME
========================= */

function getWeightedOutcome() {

    const totalWeight =
        outcomes.reduce(
            function (
                total,
                outcome
            ) {

                return total +
                    outcome.weight;

            },
            0
        );

    let random =
        Math.random() *
        totalWeight;

    for (
        const outcome
        of outcomes
    ) {

        random -=
            outcome.weight;

        if (
            random < 0
        ) {

            return outcome;

        }

    }

    return outcomes[
        outcomes.length - 1
    ];

}


/* =========================
   ROLL BUTTON
========================= */

if (rollButton) {

    rollButton.addEventListener(
        "click",
        startRoll
    );

}


/* =========================
   START ROLL
========================= */

function startRoll() {

    if (
        isRolling ||
        !currentUser
    ) {

        return;

    }

    if (
        currentChaosPoints < 500
    ) {

        statusText.textContent =
            "YOU NEED AT LEAST 500 CP.";

        return;

    }


    isRolling = true;

    updateChaosDisplay();


    /* =========================
       IMPORTANT FIX

       Reset previous result emoji
       back to the dice BEFORE
       spinning.
    ========================= */

    rouletteDisplay.textContent =
        "🎲";


    statusText.textContent =
        "THE CHAOS IS DECIDING...";


    resultText.textContent =
        "ROLLING...";


    resultDescription.textContent =
        "Your fate is being decided.";


    rouletteDisplay.classList.remove(
        "rolling"
    );


    /*
       Force browser to recognize
       the reset before animation.
    */

    void rouletteDisplay.offsetWidth;


    rouletteDisplay.classList.add(
        "rolling"
    );


    setTimeout(
        function () {

            rouletteDisplay.classList.remove(
                "rolling"
            );

            const outcome =
                getWeightedOutcome();

            processRoll(
                outcome
            );

        },
        1800
    );

}


/* =========================
   PROCESS ROLL
========================= */

function processRoll(
    outcome
) {

    const pointsRef =
        ref(
            database,
            `users/${currentUser.uid}/chaosPoints`
        );


    let finalOutcome =
        {
            ...outcome
        };


    runTransaction(
        pointsRef,
        function (
            currentPoints
        ) {

            currentPoints =
                Number(
                    currentPoints
                ) || 0;


            /* CHECK COST */

            if (
                currentPoints < 500
            ) {

                return;

            }


            /* PAY ENTRY FEE */

            currentPoints -= 500;


            /* APPLY OUTCOME */

            switch (
                outcome.type
            ) {

                case "add":

                    currentPoints +=
                        outcome.value;

                    break;


                case "refund":

                    currentPoints +=
                        outcome.value;

                    break;


                case "percentAdd":

                    currentPoints +=
                        Math.floor(
                            currentPoints *
                            outcome.value /
                            100
                        );

                    break;


                case "percentSubtract":

                    currentPoints -=
                        Math.floor(
                            currentPoints *
                            outcome.value /
                            100
                        );

                    break;


                case "double":

                    currentPoints =
                        currentPoints * 2;

                    break;


                case "triple":

                    currentPoints =
                        currentPoints * 3;

                    break;


                case "zero":

                    currentPoints = 0;

                    break;


                case "chaosFlip":

                    const flip =
                        Math.random() < 0.5;

                    if (flip) {

                        currentPoints +=
                            2000;

                        finalOutcome =
                            {
                                ...outcome,

                                title:
                                    "CHAOS FLIP — WIN",

                                description:
                                    "The coin chose you. +2,000 CP!",

                                icon:
                                    "🪙"
                            };

                    }

                    else {

                        currentPoints = 0;

                        finalOutcome =
                            {
                                ...outcome,

                                title:
                                    "CHAOS FLIP — LOSE",

                                description:
                                    "The coin betrayed you. Everything is gone.",

                                icon:
                                    "💀"
                            };

                    }

                    break;

            }


            return Math.max(
                0,
                Math.floor(
                    currentPoints
                )
            );

        }
    )
    .then(
        function (result) {

            if (
                !result.committed
            ) {

                statusText.textContent =
                    "ROLL FAILED. TRY AGAIN.";

                isRolling = false;

                updateChaosDisplay();

                return;

            }


            const newPoints =
                Number(
                    result.snapshot.val()
                ) || 0;


            currentChaosPoints =
                newPoints;


            isRolling = false;


            updateChaosDisplay();


            showResult(
                finalOutcome,
                newPoints
            );

        }
    )
    .catch(
        function (error) {

            console.error(
                "Gambling error:",
                error
            );

            statusText.textContent =
                "SOMETHING WENT WRONG.";

            isRolling = false;

            updateChaosDisplay();

        }
    );

}


/* =========================
   SHOW RESULT
========================= */

function showResult(
    outcome,
    newPoints
) {

    rouletteDisplay.textContent =
        outcome.icon;


    resultText.textContent =
        outcome.title;


    resultDescription.textContent =
        outcome.description;


    statusText.textContent =
        `CURRENT BALANCE: ${newPoints} CP`;


    if (historyCard) {

        historyCard.innerHTML =
            `
            <strong>
                ${outcome.icon}
                ${outcome.title}
            </strong>

            <br>

            <span>
                ${outcome.description}
            </span>

            <br><br>

            <small>
                BALANCE: ${newPoints} CP
            </small>
            `;

    }

}