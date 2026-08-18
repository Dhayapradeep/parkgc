import { database } from "../firebase.js";

import {
    getAuth,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

import {
    ref,
    get,
    set
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-database.js";


/* =========================
   ELEMENTS
========================= */

const generateButton =
    document.getElementById("generateInvite");

const inviteResult =
    document.getElementById("inviteResult");


/* =========================
   FIREBASE AUTH
========================= */

const auth = getAuth();


/* =========================
   CHECK ADMIN ACCESS
========================= */

onAuthStateChanged(
    auth,
    async function (user) {

        /* No logged-in user */

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


            /* No user profile */

            if (!snapshot.exists()) {

                window.location.href =
                    "unauthorized.html";

                return;

            }


            const userData =
                snapshot.val();


            /* Not an admin */

            if (
                userData.role !==
                "admin"
            ) {

                window.location.href =
                    "unauthorized.html";

                return;

            }


            /* =========================
               ADMIN VERIFIED
            ========================= */

            console.log(
                "Admin access granted."
            );


            enableAdminPanel();

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
   ENABLE ADMIN PANEL
========================= */

function enableAdminPanel() {

    if (!generateButton) {

        return;

    }


    generateButton.addEventListener(
        "click",
        generateInvitation
    );

}


/* =========================
   GENERATE INVITATION
========================= */

async function generateInvitation() {

    const characters =
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";


    let code = "ABP-";


    /* First section */

    for (let i = 0; i < 4; i++) {

        code +=
            characters[
                Math.floor(
                    Math.random() *
                    characters.length
                )
            ];

    }


    code += "-";


    /* Second section */

    for (let i = 0; i < 3; i++) {

        code +=
            characters[
                Math.floor(
                    Math.random() *
                    characters.length
                )
            ];

    }


    try {

        /* =========================
           CHECK CODE
        ========================= */

        const invitationRef =
            ref(
                database,
                `invitations/${code}`
            );


        const existing =
            await get(
                invitationRef
            );


        if (existing.exists()) {

            generateInvitation();

            return;

        }


        /* =========================
           SAVE CODE
        ========================= */

        await set(
            invitationRef,
            {

                used: false,

                createdAt: Date.now()

            }
        );


        /* =========================
           DISPLAY CODE
        ========================= */

        inviteResult.innerHTML = `

            <p>
                INVITATION CODE
            </p>

            <div class="invite-code">
                ${code}
            </div>

            <button
                class="copy-button"
                id="copyInvite">

                COPY CODE

            </button>

        `;


        inviteResult.classList.add(
            "active"
        );


        /* =========================
           COPY CODE
        ========================= */

        document
            .getElementById("copyInvite")
            .addEventListener(
                "click",
                async function () {

                    try {

                        await navigator
                            .clipboard
                            .writeText(code);


                        this.textContent =
                            "COPIED ✓";

                    }

                    catch (error) {

                        console.error(
                            "Copy failed:",
                            error
                        );

                    }

                }
            );

    }

    catch (error) {

        console.error(
            "Invitation creation failed:",
            error
        );


        inviteResult.innerHTML = `

            <p>
                Failed to create invitation.
            </p>

        `;


        inviteResult.classList.add(
            "active"
        );

    }

}