import {
    getAuth,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

import {
    ref,
    get,
    onValue,
    set,
    remove
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-database.js";

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

const membersList =
    document.getElementById(
        "membersList"
    );


const memberCount =
    document.getElementById(
        "memberCount"
    );


/* =========================
   CHECK ADMIN
========================= */

onAuthStateChanged(
    auth,
    async function (user) {

        if (!user) {

            window.location.href =
                "unauthorized.html";

            return;

        }


        try {

            const userRef =
                ref(
                    database,
                    `users/${user.uid}`
                );


            const snapshot =
                await get(userRef);


            if (
                !snapshot.exists() ||
                snapshot.val().role !== "admin"
            ) {

                window.location.href =
                    "unauthorized.html";

                return;

            }


            loadMembers();

        }

        catch (error) {

            console.error(
                "Admin verification failed:",
                error
            );


            window.location.href =
                "unauthorized.html";

        }

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

            membersList.innerHTML = "";


            if (!snapshot.exists()) {

                memberCount.textContent =
                    "0";


                membersList.innerHTML = `

                    <div class="loading">
                        No members found.
                    </div>

                `;

                return;

            }


            const users =
                snapshot.val();


            const members =
                Object.entries(users);


            memberCount.textContent =
                members.length;


            members.forEach(
                function ([uid, user], index) {

                    createMemberCard(
                        uid,
                        user,
                        index + 1
                    );

                }
            );

        }
    );

}


/* =========================
   CREATE MEMBER CARD
========================= */

function createMemberCard(
    uid,
    user,
    number
) {

    const username =
        user.username ||
        "Unknown";


    const role =
        user.role ||
        "member";


    const badge =
        user.badge ||
        "NEWBIE";


    const isActive =
        user.activeMember === true;


    const memberCard =
        document.createElement(
            "div"
        );


    memberCard.className =
        "member-card";


    memberCard.innerHTML = `

        <div class="member-top">

            <span class="member-number">
                ${String(number).padStart(2, "0")}
            </span>


            <div class="member-info">

                <div class="member-name">
                    ${escapeHTML(username)}
                </div>

                <div class="member-role">
                    ${escapeHTML(
                        role.toUpperCase()
                    )}
                </div>

            </div>


            <div class="member-badge">

                ${getBadgeIcon(badge)}
                ${escapeHTML(
                    badge.toUpperCase()
                )}

            </div>


            <button
                class="active-star ${
                    isActive
                        ? "active"
                        : ""
                }"
                title="${
                    isActive
                        ? "Remove from active members"
                        : "Add to active members"
                }">

                ${
                    isActive
                        ? "★"
                        : "☆"
                }

            </button>

        </div>


        <div class="member-controls">

            <select
                class="badge-select">

                <option
                    value="FOUNDER"
                    ${
                        badge === "FOUNDER"
                            ? "selected"
                            : ""
                    }>
                    👑 FOUNDER
                </option>

                <option
                    value="OG"
                    ${
                        badge === "OG"
                            ? "selected"
                            : ""
                    }>
                    ⭐ OG
                </option>

                <option
                    value="ELDER"
                    ${
                        badge === "ELDER"
                            ? "selected"
                            : ""
                    }>
                    🛡️ ELDER
                </option>

                <option
                    value="NEWBIE"
                    ${
                        badge === "NEWBIE"
                            ? "selected"
                            : ""
                    }>
                    🆕 NEWBIE
                </option>

            </select>


            <button
                class="save-badge-button">

                SAVE BADGE

            </button>


            ${
                role.toLowerCase() !== "admin"
                    ? `
                        <button
                            class="kick-button">

                            KICK

                        </button>
                    `
                    : ""
            }

        </div>


        <div
            class="member-action-message">
        </div>

    `;


    membersList.appendChild(
        memberCard
    );


    /* =========================
       STAR BUTTON
    ========================= */

    const starButton =
        memberCard.querySelector(
            ".active-star"
        );


    starButton.addEventListener(
        "click",
        async function () {

            const currentlyActive =
                user.activeMember === true;


            /* =========================
               COUNT ACTIVE MEMBERS
            ========================= */

            if (!currentlyActive) {

                try {

                    const usersSnapshot =
                        await get(
                            ref(
                                database,
                                "users"
                            )
                        );


                    let activeCount = 0;


                    if (
                        usersSnapshot.exists()
                    ) {

                        const allUsers =
                            usersSnapshot.val();


                        Object.values(
                            allUsers
                        ).forEach(
                            function (member) {

                                if (
                                    member.activeMember ===
                                    true
                                ) {

                                    activeCount++;

                                }

                            }
                        );

                    }


                    /* Maximum 5 */

                    if (
                        activeCount >= 5
                    ) {

                        alert(
                            "You can feature a maximum of 5 active members."
                        );

                        return;

                    }

                }

                catch (error) {

                    console.error(
                        "Failed to check active members:",
                        error
                    );

                    return;

                }

            }


            try {

                const newStatus =
                    !currentlyActive;


                await set(
                    ref(
                        database,
                        `users/${uid}/activeMember`
                    ),
                    newStatus
                );


                /*
                    Update the current card
                    immediately.
                */

                user.activeMember =
                    newStatus;


                starButton.textContent =
                    newStatus
                        ? "★"
                        : "☆";


                starButton.classList.toggle(
                    "active",
                    newStatus
                );


                starButton.title =
                    newStatus
                        ? "Remove from active members"
                        : "Add to active members";

            }

            catch (error) {

                console.error(
                    "Active member update failed:",
                    error
                );

            }

        }
    );


    /* =========================
       SAVE BADGE
    ========================= */

    const select =
        memberCard.querySelector(
            ".badge-select"
        );


    const saveButton =
        memberCard.querySelector(
            ".save-badge-button"
        );


    const message =
        memberCard.querySelector(
            ".member-action-message"
        );


    saveButton.addEventListener(
        "click",
        async function () {

            const newBadge =
                select.value;


            try {

                await set(
                    ref(
                        database,
                        `users/${uid}/badge`
                    ),
                    newBadge
                );


                message.textContent =
                    "Badge updated ✓";

            }

            catch (error) {

                console.error(
                    "Badge update failed:",
                    error
                );


                message.textContent =
                    "Failed to update badge.";

            }

        }
    );


    /* =========================
       KICK MEMBER
    ========================= */

    const kickButton =
        memberCard.querySelector(
            ".kick-button"
        );


    if (kickButton) {

        kickButton.addEventListener(
            "click",
            async function () {

                const confirmed =
                    confirm(
                        `Kick ${username} from Abusement Park?`
                    );


                if (!confirmed) {

                    return;

                }


                try {

                    /*
                        Remove database profile.
                    */

                    await remove(
                        ref(
                            database,
                            `users/${uid}`
                        )
                    );

                }

                catch (error) {

                    console.error(
                        "Kick failed:",
                        error
                    );


                    message.textContent =
                        "Failed to kick member.";

                }

            }
        );

    }

}


/* =========================
   BADGE ICON
========================= */

function getBadgeIcon(badge) {

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

function escapeHTML(value) {

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