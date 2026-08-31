import {
    getAuth,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

import {
    ref,
    onValue
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

const membersList =
    document.getElementById(
        "membersList"
    );


const memberCount =
    document.getElementById(
        "memberCount"
    );


const statusText =
    document.getElementById(
        "statusText"
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


        loadMembers();

    }
);


/* =========================
   LOAD MEMBERS
========================= */

function loadMembers() {

    const usersRef =
        ref(
            database,
            "users"
        );


    onValue(
        usersRef,
        function (snapshot) {

            membersList.innerHTML =
                "";


            if (!snapshot.exists()) {

                memberCount.textContent =
                    "0";


                statusText.textContent =
                    "NO MEMBERS";


                membersList.innerHTML = `

                    <div class="empty">
                        No members found.
                    </div>

                `;

                return;

            }


            const users =
                snapshot.val();


            const members =
                Object.entries(users);


            /* =========================
               TOTAL
            ========================= */

            memberCount.textContent =
                members.length;


            statusText.textContent =
                `${members.length} MEMBERS`;


            /* =========================
               MEMBER CARDS
            ========================= */

            members.forEach(
                function ([uid, user]) {

                    const username =
                        user.username ||
                        "Unknown";


                    const role =
                        user.role ||
                        "member";


                    /*
                        Read badge directly
                        from Firebase.
                    */

                    const badge =
                        user.badge ||
                        "NEWBIE";


                    const profilePicture =
                        user.profilePicture ||
                        null;


                    /* =========================
                       CARD
                    ========================= */

                    const card =
                        document.createElement(
                            "div"
                        );


                    card.className =
                        "member-card";


                    /* =========================
                       AVATAR
                    ========================= */

                    const avatar =
                        document.createElement(
                            "div"
                        );


                    avatar.className =
                        "avatar";


                    if (
                        profilePicture
                    ) {

                        const image =
                            document.createElement(
                                "img"
                            );


                        image.src =
                            profilePicture;


                        image.alt =
                            `${username}'s profile picture`;


                        avatar.appendChild(
                            image
                        );


                        avatar.classList.add(
                            "has-pfp"
                        );


                        /*
                            Clicking the PFP
                            opens preview.
                        */

                        avatar.addEventListener(
                            "click",
                            function (event) {

                                event.stopPropagation();


                                openPfpPreview(
                                    profilePicture,
                                    username
                                );

                            }
                        );

                    }

                    else {

                        /*
                            Default avatar
                            using first letter.
                        */

                        avatar.textContent =
                            username
                                .charAt(0)
                                .toUpperCase();

                    }


                    /* =========================
                       MEMBER INFO
                    ========================= */

                    const info =
                        document.createElement(
                            "div"
                        );


                    info.className =
                        "member-info";


                    info.innerHTML = `

                        <span
                            class="member-name">

                            ${escapeHTML(
                                username
                            )}

                        </span>

                        <span
                            class="member-role">

                            ${escapeHTML(
                                role.toUpperCase()
                            )}

                        </span>

                    `;


                    /* =========================
                       BADGE
                    ========================= */

                    const badgeElement =
                        document.createElement(
                            "div"
                        );


                    badgeElement.className =
                        "member-badge";


                    badgeElement.innerHTML = `

                        ${getBadgeIcon(badge)}
                        ${escapeHTML(
                            badge.toUpperCase()
                        )}

                    `;


                    /* =========================
                       ADD TO CARD
                    ========================= */

                    card.appendChild(
                        avatar
                    );


                    card.appendChild(
                        info
                    );


                    card.appendChild(
                        badgeElement
                    );


                    membersList.appendChild(
                        card
                    );

                }
            );

        }
    );

}


/* =========================
   OPEN PFP PREVIEW
========================= */

function openPfpPreview(
    image,
    username
) {

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
            event.key === "Escape"
        ) {

            closePfpPreview();

        }

    }
);


/* =========================
   BADGE ICON
========================= */

function getBadgeIcon(
    badge
) {

    switch (
        badge.toUpperCase()
    ) {

        case "FOUNDER":
            return "👑";

        case "OG":
            return "⭐";

        case "ELDER":
            return "🛡️";

        case "NEWBIE":
            return "🆕";

        default:
            return "🏷️";

    }

}


/* =========================
   ESCAPE HTML
========================= */

function escapeHTML(
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