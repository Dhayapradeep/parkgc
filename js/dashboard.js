import {
    ref,
    onValue,
    runTransaction
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-database.js";

import {
    getAuth,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

import {
    app,
    database
} from "../firebase.js";


/* =========================
   FIREBASE AUTH
========================= */

const auth =
    getAuth(app);


/* =========================
   ELEMENTS
========================= */

const usernameElement =
    document.getElementById("username");

const welcomeElement =
    document.getElementById("welcomeName");

const memberBadge =
    document.getElementById("memberBadge");

const activeMembersList =
    document.getElementById("activeMembersList");

const adminPanelButton =
    document.getElementById("adminPanelButton");

const logoutButton =
    document.getElementById("logoutButton");

const settingsButton =
    document.getElementById("settingsButton");

const streakButton =
    document.getElementById("streakButton");

const streakText =
    document.getElementById("streakText");

const chaosPointsElement =
    document.getElementById("chaosPoints");

const ghostModeButton =
    document.getElementById("ghostModeButton");

const trustNobodyButton =
    document.getElementById("trustNobodyButton");

const chaosGamblingButton =
    document.getElementById("chaosGamblingButton");

const leaderboardButton =
    document.getElementById("leaderboardButton");


/* =========================
   CURRENT USER
========================= */

let currentUserId =
    null;


/* =========================
   DATE HELPERS
========================= */

function getTodayDate() {

    const today =
        new Date();

    return today
        .toISOString()
        .split("T")[0];

}


function getYesterdayDate() {

    const yesterday =
        new Date();

    yesterday.setDate(
        yesterday.getDate() - 1
    );

    return yesterday
        .toISOString()
        .split("T")[0];

}


/* =========================
   SETTINGS
========================= */

if (settingsButton) {

    settingsButton.addEventListener(
        "click",
        function () {

            window.location.href =
                "settings.html";

        }
    );

}


/* =========================
   CHECK LOGGED-IN USER
========================= */

onAuthStateChanged(
    auth,
    function (user) {

        /* NOT LOGGED IN */

        if (!user) {

            window.location.href =
                "login.html";

            return;

        }


        currentUserId =
            user.uid;


        const currentUserRef =
            ref(
                database,
                `users/${user.uid}`
            );


        onValue(
            currentUserRef,
            function (snapshot) {

                if (!snapshot.exists()) {

                    console.error(
                        "User profile not found."
                    );

                    return;

                }


                const userData =
                    snapshot.val();


                /* USERNAME */

                const username =
                    userData.username ||
                    "User";


                if (usernameElement) {

                    usernameElement.textContent =
                        username;

                }


                if (welcomeElement) {

                    welcomeElement.textContent =
                        username.toUpperCase();

                }


                /* BADGE */

                const badge =
                    userData.badge ||
                    "NEWBIE";


                if (memberBadge) {

                    memberBadge.textContent =
                        getBadgeDisplay(
                            badge
                        );

                }


                /* CHAOS POINTS */

                const chaosPoints =
                    userData.chaosPoints ||
                    0;


                if (chaosPointsElement) {

                    chaosPointsElement.textContent =
                        chaosPoints;

                }


                /* STREAK */

                updateStreakButton(
                    userData
                );

            }
        );

    }
);


/* =========================
   BADGE DISPLAY
========================= */

function getBadgeDisplay(
    badge
) {

    switch (
        badge.toUpperCase()
    ) {

        case "FOUNDER":

            return "👑 FOUNDER";


        case "OG":

            return "⭐ OG MEMBER";


        case "ELDER":

            return "🛡️ ELDER";


        case "NEWBIE":

            return "🆕 NEWBIE";


        default:

            return "🆕 NEWBIE";

    }

}


/* =========================
   UPDATE STREAK BUTTON

   CALENDAR DAY SYSTEM

   Today claimed:
   Button disabled.

   Yesterday claimed:
   Next claim continues streak.

   Older than yesterday:
   Streak resets to Day 1.
========================= */

function updateStreakButton(
    userData
) {

    if (
        !streakButton ||
        !streakText
    ) {

        return;

    }


    const currentStreak =
        userData.streak ||
        0;


    const lastClaimDate =
        userData.lastStreakClaimDate ||
        null;


    const today =
        getTodayDate();


    const yesterday =
        getYesterdayDate();


    /* =========================
       ALREADY CLAIMED TODAY
    ========================= */

    if (
        lastClaimDate === today
    ) {

        streakText.textContent =
            `DAY ${currentStreak} CLAIMED`;

        streakButton.disabled =
            true;

        streakButton.classList.add(
            "streak-claimed"
        );

        return;

    }


    /* =========================
       FIRST CLAIM
    ========================= */

    if (
        !lastClaimDate
    ) {

        streakText.textContent =
            "CLAIM DAY 1";

        streakButton.disabled =
            false;

        streakButton.classList.remove(
            "streak-claimed"
        );

        return;

    }


    /* =========================
       CLAIMED YESTERDAY

       STREAK CONTINUES
    ========================= */

    if (
        lastClaimDate === yesterday
    ) {

        streakText.textContent =
            `CLAIM DAY ${currentStreak + 1}`;

        streakButton.disabled =
            false;

        streakButton.classList.remove(
            "streak-claimed"
        );

        return;

    }


    /* =========================
       MISSED A DAY

       SHOW DAY 1 AGAIN
    ========================= */

    streakText.textContent =
        "STREAK LOST • CLAIM DAY 1";

    streakButton.disabled =
        false;

    streakButton.classList.remove(
        "streak-claimed"
    );

}


/* =========================
   CLAIM STREAK
========================= */

if (streakButton) {

    streakButton.addEventListener(
        "click",
        async function () {

            if (!currentUserId) {

                return;

            }


            const userRef =
                ref(
                    database,
                    `users/${currentUserId}`
                );


            try {

                const result =
                    await runTransaction(
                        userRef,
                        function (userData) {

                            if (!userData) {

                                return userData;

                            }


                            const today =
                                getTodayDate();


                            const yesterday =
                                getYesterdayDate();


                            const lastClaimDate =
                                userData.lastStreakClaimDate ||
                                null;


                            /* =========================
                               ALREADY CLAIMED TODAY
                            ========================= */

                            if (
                                lastClaimDate === today
                            ) {

                                return;

                            }


                            let newStreak;


                            /* =========================
                               CONTINUE STREAK

                               USER CLAIMED YESTERDAY
                            ========================= */

                            if (
                                lastClaimDate === yesterday
                            ) {

                                newStreak =
                                    (
                                        userData.streak ||
                                        0
                                    ) + 1;

                            }


                            /* =========================
                               NEW USER OR
                               STREAK WAS BROKEN
                            ========================= */

                            else {

                                newStreak =
                                    1;

                            }


                            /* =========================
                               CALCULATE REWARD

                               DAY 1 = 50
                               DAY 2 = 100
                               DAY 3 = 150
                               ETC.
                            ========================= */

                            const reward =
                                newStreak * 50;


                            userData.streak =
                                newStreak;


                            userData.lastStreakClaimDate =
                                today;


                            userData.chaosPoints =
                                (
                                    userData.chaosPoints ||
                                    0
                                ) +
                                reward;


                            return userData;

                        }
                    );


                if (
                    !result.committed
                ) {

                    return;

                }


                const updatedUser =
                    result.snapshot.val();


                alert(
                    `🔥 DAY ${updatedUser.streak} CLAIMED!\n\n+${updatedUser.streak * 50} CHAOS POINTS`
                );


            }

            catch (error) {

                console.error(
                    "Unable to claim streak:",
                    error
                );


                alert(
                    "Something went wrong. Please try again."
                );

            }

        }
    );

}


/* =========================
   ACTIVE MEMBERS
========================= */

if (activeMembersList) {

    const usersRef =
        ref(
            database,
            "users"
        );


    onValue(
        usersRef,
        function (snapshot) {

            activeMembersList.innerHTML =
                "";


            if (!snapshot.exists()) {

                const empty =
                    document.createElement(
                        "span"
                    );


                empty.textContent =
                    "No active members selected.";


                activeMembersList.appendChild(
                    empty
                );

                return;

            }


            const users =
                snapshot.val();


            const activeMembers =
                Object.values(users)
                    .filter(
                        function (user) {

                            return (
                                user.activeMember ===
                                true
                            );

                        }
                    )
                    .slice(0, 5);


            if (
                activeMembers.length === 0
            ) {

                const empty =
                    document.createElement(
                        "span"
                    );


                empty.textContent =
                    "No active members selected.";


                activeMembersList.appendChild(
                    empty
                );

                return;

            }


            activeMembers.forEach(
                function (user) {

                    const member =
                        document.createElement(
                            "span"
                        );


                    member.textContent =
                        `${
                            user.username ||
                            "Unknown"
                        }`;


                    activeMembersList.appendChild(
                        member
                    );

                }
            );

        }
    );

}


/* =========================
   CHAOS MODE BUTTONS
========================= */

if (ghostModeButton) {

    ghostModeButton.addEventListener(
        "click",
        function () {

            window.location.href =
                "globby.html";

        }
    );

}

if (lastWordButton) {

    lastWordButton.addEventListener(
        "click",
        function () {

            window.location.href =
                "lwlobby.html";

        }
    );

}


if (chaosGamblingButton) {

    chaosGamblingButton.addEventListener(
        "click",
        function () {

            window.location.href =
                "gambling.html";

        }
    );

}


if (leaderboardButton) {

    leaderboardButton.addEventListener(
        "click",
        function () {

            window.location.href =
                "hos.html";

        }
    );

}


/* =========================
   ADMIN PANEL
========================= */

if (adminPanelButton) {

    adminPanelButton.addEventListener(
        "click",
        function () {

            window.location.href =
                "admin.html";

        }
    );

}


/* =========================
   LOG OUT
========================= */

if (logoutButton) {

    logoutButton.addEventListener(
        "click",
        async function () {

            try {

                await signOut(
                    auth
                );


                localStorage.removeItem(
                    "username"
                );


                window.location.href =
                    "login.html";

            }

            catch (error) {

                console.error(
                    "Logout failed:",
                    error
                );


                alert(
                    "Unable to log out. Please try again."
                );

            }

        }
    );

}