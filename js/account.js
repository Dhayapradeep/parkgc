import { database } from "../firebase.js";

import {
    getAuth,
    createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

import {
    ref,
    get,
    set,
    update
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-database.js";


/* =========================
   FIREBASE AUTH
========================= */

const auth = getAuth();


/* =========================
   ELEMENTS
========================= */

const accountForm =
    document.getElementById("accountForm");

const message =
    document.getElementById("message");


/* =========================
   INVITATION
========================= */

const inviteCode =
    sessionStorage.getItem("inviteCode");


if (!inviteCode) {

    message.textContent =
        "No valid invitation found.";

    accountForm.style.display =
        "none";

}


/* =========================
   CREATE ACCOUNT
========================= */

accountForm.addEventListener(
    "submit",
    async function (event) {

        event.preventDefault();


        const username =
            document
                .getElementById("username")
                .value
                .trim();


        const password =
            document
                .getElementById("password")
                .value;


        const confirmPassword =
            document
                .getElementById("confirmPassword")
                .value;


        /* =========================
           VALIDATION
        ========================= */

        if (username.length < 3) {

            message.textContent =
                "Username must contain at least 3 characters.";

            return;

        }


        if (password.length < 6) {

            message.textContent =
                "Password must contain at least 6 characters.";

            return;

        }


        if (password !== confirmPassword) {

            message.textContent =
                "Passwords do not match.";

            return;

        }


        /* =========================
           NORMALIZE USERNAME
        ========================= */

        const usernameKey =
            username
                .toLowerCase()
                .replace(/\s+/g, "_");


        try {

            message.textContent =
                "Checking your invitation...";


            /* =========================
               CHECK INVITATION
            ========================= */

            const invitationRef =
                ref(
                    database,
                    `invitations/${inviteCode}`
                );


            const invitationSnapshot =
                await get(invitationRef);


            if (!invitationSnapshot.exists()) {

                message.textContent =
                    "This invitation is invalid.";

                return;

            }


            const invitation =
                invitationSnapshot.val();


            if (invitation.used === true) {

                message.textContent =
                    "This invitation has already been used.";

                return;

            }


            /* =========================
               CHECK USERNAME
            ========================= */

            const usernameRef =
                ref(
                    database,
                    `usernames/${usernameKey}`
                );


            const usernameSnapshot =
                await get(usernameRef);


            if (usernameSnapshot.exists()) {

                message.textContent =
                    "That username is already taken.";

                return;

            }


            /* =========================
               CREATE AUTH ACCOUNT
            ========================= */

            message.textContent =
                "Creating your account...";


            /*
                Firebase Authentication
                requires an email/password
                credential.

                The email is internal and
                is NOT shown as the user's
                public identity.
            */

            const internalEmail =
                `${usernameKey}@abusementpark.local`;


            const userCredential =
                await createUserWithEmailAndPassword(
                    auth,
                    internalEmail,
                    password
                );


            const user =
                userCredential.user;


            /* =========================
               SAVE USER PROFILE
            ========================= */

            await set(
                ref(
                    database,
                    `users/${user.uid}`
                ),
                {

                    username: username,

                    usernameKey: usernameKey,

                    authEmail: internalEmail,

                    role: "member",

                    level: 1,

                    xp: 0,

                    createdAt: Date.now(),

                    invitationCode: inviteCode

                }
            );


            /* =========================
               RESERVE USERNAME
            ========================= */

            await set(
                usernameRef,
                user.uid
            );


            /* =========================
               MARK INVITATION USED
            ========================= */

            await update(
                invitationRef,
                {

                    used: true,

                    usedBy: user.uid,

                    usedAt: Date.now()

                }
            );


            /* =========================
               CLEAN UP
            ========================= */

            sessionStorage.removeItem(
                "inviteCode"
            );


            /*
                Keep the UID available
                temporarily for the
                dashboard.
            */

            localStorage.setItem(
                "userUID",
                user.uid
            );


            localStorage.setItem(
                "username",
                username
            );


            /* =========================
               SUCCESS
            ========================= */

            message.textContent =
                "Account created successfully!";


            setTimeout(
                function () {

                    window.location.href =
                        "dashboard.html";

                },
                1000
            );


        } catch (error) {

            console.error(
                "Account creation error:",
                error
            );


            if (
                error.code ===
                "auth/email-already-in-use"
            ) {

                message.textContent =
                    "That username is already in use.";

            }

            else if (
                error.code ===
                "auth/invalid-email"
            ) {

                message.textContent =
                    "Invalid username.";

            }

            else if (
                error.code ===
                "auth/weak-password"
            ) {

                message.textContent =
                    "Password is too weak.";

            }

            else {

                message.textContent =
                    "Account creation failed. Please try again.";

            }

        }

    }
);