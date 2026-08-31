import {
    getAuth,
    signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

import {
    ref,
    get
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

const loginForm =
    document.getElementById("loginForm");

const message =
    document.getElementById("message");


/* =========================
   LOGIN
========================= */

loginForm.addEventListener(
    "submit",
    async function (event) {

        event.preventDefault();


        const username =
            document
                .getElementById("displayName")
                .value
                .trim();


        const password =
            document
                .getElementById("password")
                .value;


        /* =========================
           VALIDATION
        ========================= */

        if (username.length < 3) {

            message.textContent =
                "Please enter your username.";

            return;

        }


        if (!password) {

            message.textContent =
                "Please enter your password.";

            return;

        }


        try {

            message.textContent =
                "Entering the park...";


            /* =========================
               USERNAME KEY
            ========================= */

            const usernameKey =
                username
                    .toLowerCase()
                    .replace(/\s+/g, "_");


            /* =========================
               FIND USERNAME
            ========================= */

            const usernameRef =
                ref(
                    database,
                    `usernames/${usernameKey}`
                );


            const usernameSnapshot =
                await get(usernameRef);


            if (!usernameSnapshot.exists()) {

                message.textContent =
                    "Username or password is incorrect.";

                return;

            }


            /* =========================
               GET UID
            ========================= */

            const uid =
                usernameSnapshot.val();


            /* =========================
               GET PROFILE
            ========================= */

            const userRef =
                ref(
                    database,
                    `users/${uid}`
                );


            const userSnapshot =
                await get(userRef);


            if (!userSnapshot.exists()) {

                message.textContent =
                    "Account not found.";

                return;

            }


            const userData =
                userSnapshot.val();


            /* =========================
               AUTH EMAIL
            ========================= */

            /*
                IMPORTANT:

                The authentication email is
                permanent and is NOT based
                on the current username.

                Older accounts without
                authEmail will temporarily
                use their original usernameKey.
            */

            const authEmail =
                userData.authEmail ||
                `${userData.usernameKey}@abusementpark.local`;


            /* =========================
               FIREBASE LOGIN
            ========================= */

            const userCredential =
                await signInWithEmailAndPassword(
                    auth,
                    authEmail,
                    password
                );


            const user =
                userCredential.user;


            /* =========================
               SAVE SESSION
            ========================= */

            localStorage.setItem(
                "userUID",
                user.uid
            );


            localStorage.setItem(
                "username",
                userData.username
            );


            /* =========================
               SUCCESS
            ========================= */

            message.textContent =
                "Welcome back!";


            setTimeout(
                function () {

                    window.location.href =
                        "dashboard.html";

                },
                500
            );

        }

        catch (error) {

            console.error(
                "Login error:",
                error
            );


            if (
                error.code ===
                    "auth/invalid-credential" ||
                error.code ===
                    "auth/wrong-password" ||
                error.code ===
                    "auth/user-not-found"
            ) {

                message.textContent =
                    "Username or password is incorrect.";

            }

            else {

                message.textContent =
                    "Unable to log in. Please try again.";

            }

        }

    }
);