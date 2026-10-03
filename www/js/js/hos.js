import {
    ref,
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
   FIREBASE AUTH
========================= */

const auth =
    getAuth(app);


/* =========================
   ELEMENTS
========================= */

const backButton =
    document.getElementById(
        "backButton"
    );


const leaderboardList =
    document.getElementById(
        "leaderboardList"
    );


const yourRankElement =
    document.getElementById(
        "yourRank"
    );


const yourChaosPointsElement =
    document.getElementById(
        "yourChaosPoints"
    );


const memberCountElement =
    document.getElementById(
        "memberCount"
    );

    const pfpModal =
    document.getElementById(
        "pfpModal"
    );

const pfpModalImage =
    document.getElementById(
        "pfpModalImage"
    );

const pfpModalName =
    document.getElementById(
        "pfpModalName"
    );

const closePfp =
    document.getElementById(
        "closePfp"
    );


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
   CHECK AUTH
========================= */

onAuthStateChanged(
    auth,
    function (currentUser) {

        if (!currentUser) {

            window.location.href =
                "login.html";

            return;

        }


        loadLeaderboard(
            currentUser.uid
        );

    }
);


/* =========================
   LOAD LEADERBOARD
========================= */

function loadLeaderboard(
    currentUserId
) {

    const usersRef =
        ref(
            database,
            "users"
        );


    onValue(
        usersRef,
        function (snapshot) {

            if (!leaderboardList) {

                return;

            }


            leaderboardList.innerHTML =
                "";


            /* =========================
               NO USERS
            ========================= */

            if (!snapshot.exists()) {

                leaderboardList.innerHTML =
                    `
                    <div class="empty-message">
                        NO MEMBERS HAVE ENTERED
                        THE CHAOS YET.
                    </div>
                    `;


                return;

            }


            const usersObject =
                snapshot.val();


            /* =========================
               CONVERT FIREBASE OBJECT
               TO ARRAY
            ========================= */

            const users =
                Object.entries(
                    usersObject
                )
                .map(
                    function (
                        [uid, user]
                    ) {

                        return {

    uid: uid,

    username:
        user.username ||
        "Unknown",

    badge:
        user.badge ||
        "NEWBIE",

    profilePicture:
        user.profilePicture ||
        null,

    chaosPoints:
        Number(
            user.chaosPoints
        ) || 0

};

                    }
                );


            /* =========================
               SORT BY CHAOS POINTS
            ========================= */

            users.sort(
                function (
                    a,
                    b
                ) {

                    return (
                        b.chaosPoints -
                        a.chaosPoints
                    );

                }
            );


            /* =========================
               MEMBER COUNT
            ========================= */

            if (memberCountElement) {

                memberCountElement.textContent =
                    `${users.length} MEMBERS`;

            }


            /* =========================
               FIND CURRENT USER
            ========================= */

            const currentUserIndex =
                users.findIndex(
                    function (user) {

                        return (
                            user.uid ===
                            currentUserId
                        );

                    }
                );


            if (
                currentUserIndex !== -1
            ) {

                const currentUser =
                    users[
                        currentUserIndex
                    ];


                if (yourRankElement) {

                    yourRankElement.textContent =
                        `#${currentUserIndex + 1}`;

                }


                if (
                    yourChaosPointsElement
                ) {

                    yourChaosPointsElement.textContent =
                        currentUser.chaosPoints;

                }

            }


            /* =========================
               DISPLAY USERS
            ========================= */

            users.forEach(
                function (
                    user,
                    index
                ) {

                    const rank =
                        index + 1;


                    const item =
                        document.createElement(
                            "div"
                        );


                    item.classList.add(
                        "leaderboard-item"
                    );


                    /* TOP 3 */

                    if (
                        rank === 1
                    ) {

                        item.classList.add(
                            "rank-1"
                        );

                    }


                    if (
                        rank === 2
                    ) {

                        item.classList.add(
                            "rank-2"
                        );

                    }


                    if (
                        rank === 3
                    ) {

                        item.classList.add(
                            "rank-3"
                        );

                    }


                    /* CURRENT USER */

                    if (
                        user.uid ===
                        currentUserId
                    ) {

                        item.classList.add(
                            "current-user"
                        );

                    }


                    /* =========================
                       MEDALS
                    ========================= */

                    let rankDisplay =
                        `#${rank}`;


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


                    /* =========================
   CREATE CONTENT
========================= */

item.innerHTML =
    `
    <div class="rank-number">

        ${rankDisplay}

    </div>


    <div
        class="player-avatar"
        data-uid="${user.uid}"
    >

    </div>


    <div class="player-info">

        <div class="player-name">

            ${user.username}

            ${
                user.uid ===
                currentUserId

                ? " (YOU)"

                : ""
            }

        </div>


        <div class="player-badge">

            ${getBadgeDisplay(
                user.badge
            )}

        </div>

    </div>


    <div class="player-points">

        ${user.chaosPoints}

        <span>

            CHAOS POINTS

        </span>

    </div>
    `;

    /* =========================
   PROFILE PICTURE
========================= */

const playerAvatar =
    item.querySelector(
        ".player-avatar"
    );


if (
    playerAvatar &&
    user.profilePicture
) {

    const image =
        document.createElement(
            "img"
        );

    image.src =
        user.profilePicture;

    image.alt =
        `${user.username}'s profile picture`;


    playerAvatar.appendChild(
        image
    );


    playerAvatar.classList.add(
        "has-pfp"
    );


    /* =========================
       OPEN PFP PREVIEW
    ========================= */

    playerAvatar.addEventListener(
        "click",
        function (event) {

            event.stopPropagation();

            openPfpPreview(
                user.profilePicture,
                user.username
            );

        }
    );

}
else if (playerAvatar) {

    /* Default avatar */

    playerAvatar.textContent =
        user.username
            .charAt(0)
            .toUpperCase();

}


                    leaderboardList.appendChild(
                        item
                    );

                }
            );

        }
    );

}


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

            return "💎 ELDER";


        case "NEWBIE":

            return "🎯 NEWBIE";


        default:

            return "🎯 NEWBIE";

    }

}

/* =========================
   OPEN PFP PREVIEW
========================= */

function openPfpPreview(
    image,
    username
) {

    if (!pfpModal) return;

    pfpModalImage.src =
        image;

    pfpModalName.textContent =
        username;

    pfpModal.classList.add(
        "active"
    );
}


/* =========================
   CLOSE PFP
========================= */

function closePfpPreview() {

    if (!pfpModal) return;

    pfpModal.classList.remove(
        "active"
    );

    pfpModalImage.src =
        "";
}


/* =========================
   CLOSE BUTTON
========================= */

if (closePfp) {

    closePfp.addEventListener(
        "click",
        closePfpPreview
    );

}


/* =========================
   CLICK OUTSIDE
========================= */

if (pfpModal) {

    pfpModal.addEventListener(
        "click",
        function (event) {

            if (
                event.target ===
                pfpModal
            ) {

                closePfpPreview();

            }

        }
    );

}


/* =========================
   ESCAPE KEY
========================= */

document.addEventListener(
    "keydown",
    function (event) {

        if (
            event.key ===
            "Escape"
        ) {

            closePfpPreview();

        }

    }
);