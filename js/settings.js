import {
    getAuth,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

import {
    ref,
    get,
    set,
    update,
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

const profileInput =
    document.getElementById(
        "profileInput"
    );

const addProfileButton =
    document.getElementById(
        "addProfileButton"
    );

const deleteProfileButton =
    document.getElementById(
        "deleteProfileButton"
    );

const profilePreview =
    document.getElementById(
        "profilePreview"
    );

const defaultAvatar =
    document.getElementById(
        "defaultAvatar"
    );

const profileMessage =
    document.getElementById(
        "profileMessage"
    );

const newUsername =
    document.getElementById(
        "newUsername"
    );

const changeUsernameButton =
    document.getElementById(
        "changeUsernameButton"
    );

const usernameMessage =
    document.getElementById(
        "usernameMessage"
    );


/* =========================
   CURRENT USER
========================= */

let currentUser = null;


/* =========================
   CHECK AUTH
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


        await loadProfile();

    }
);


/* =========================
   LOAD PROFILE
========================= */

async function loadProfile() {

    try {

        const userRef =
            ref(
                database,
                `users/${currentUser.uid}`
            );


        const snapshot =
            await get(userRef);


        if (!snapshot.exists()) {

            return;

        }


        const userData =
            snapshot.val();


        /* =========================
           USERNAME
        ========================= */

        newUsername.value =
            userData.username ||
            "";


        /* =========================
           PROFILE PICTURE
        ========================= */

        if (
            userData.profilePicture
        ) {

            showProfilePicture(
                userData.profilePicture
            );

        }

        else {

            showDefaultAvatar();

        }

    }

    catch (error) {

        console.error(
            "Failed to load profile:",
            error
        );

    }

}


/* =========================
   ADD PROFILE PICTURE
========================= */

addProfileButton.addEventListener(
    "click",
    function () {

        profileInput.click();

    }
);


profileInput.addEventListener(
    "change",
    async function () {

        const file =
            profileInput.files[0];


        if (!file) {

            return;

        }


        if (
            !file.type.startsWith(
                "image/"
            )
        ) {

            profileMessage.textContent =
                "Please select an image.";

            return;

        }


        if (
            file.size >
            5 * 1024 * 1024
        ) {

            profileMessage.textContent =
                "Image must be smaller than 5 MB.";

            return;

        }


        try {

            profileMessage.textContent =
                "Uploading...";


            const reader =
                new FileReader();


            reader.onload =
                async function () {

                    const imageData =
                        reader.result;


                    await set(
                        ref(
                            database,
                            `users/${currentUser.uid}/profilePicture`
                        ),
                        imageData
                    );


                    showProfilePicture(
                        imageData
                    );


                    profileMessage.textContent =
                        "Profile picture added ✓";

                };


            reader.readAsDataURL(file);

        }

        catch (error) {

            console.error(
                "Profile picture upload failed:",
                error
            );


            profileMessage.textContent =
                "Failed to add profile picture.";

        }

    }
);


/* =========================
   DELETE PROFILE PICTURE
========================= */

deleteProfileButton.addEventListener(
    "click",
    async function () {

        try {

            await remove(
                ref(
                    database,
                    `users/${currentUser.uid}/profilePicture`
                )
            );


            showDefaultAvatar();


            profileMessage.textContent =
                "Profile picture deleted ✓";

        }

        catch (error) {

            console.error(
                "Profile picture deletion failed:",
                error
            );


            profileMessage.textContent =
                "Failed to delete profile picture.";

        }

    }
);


/* =========================
   CHANGE USERNAME
========================= */

changeUsernameButton.addEventListener(
    "click",
    async function () {

        const username =
            newUsername.value.trim();


        /* =========================
           VALIDATION
        ========================= */

        if (
            username.length < 3
        ) {

            usernameMessage.textContent =
                "Username must contain at least 3 characters.";

            return;

        }


        if (
            username.length > 20
        ) {

            usernameMessage.textContent =
                "Username cannot exceed 20 characters.";

            return;

        }


        /* =========================
           CREATE NEW KEY
        ========================= */

        const newUsernameKey =
            username
                .toLowerCase()
                .replace(/\s+/g, "_");


        try {

            usernameMessage.textContent =
                "Checking username...";


            /* =========================
               CURRENT PROFILE
            ========================= */

            const userRef =
                ref(
                    database,
                    `users/${currentUser.uid}`
                );


            const userSnapshot =
                await get(userRef);


            if (!userSnapshot.exists()) {

                usernameMessage.textContent =
                    "Account profile not found.";

                return;

            }


            const userData =
                userSnapshot.val();


            const oldUsername =
                userData.username ||
                "";


            const oldUsernameKey =
                userData.usernameKey ||
                oldUsername
                    .toLowerCase()
                    .replace(/\s+/g, "_");


            /* =========================
               SAME USERNAME
            ========================= */

            if (
                newUsernameKey ===
                oldUsernameKey
            ) {

                usernameMessage.textContent =
                    "This is already your username.";

                return;

            }


            /* =========================
               CHECK NEW USERNAME
            ========================= */

            const newUsernameRef =
                ref(
                    database,
                    `usernames/${newUsernameKey}`
                );


            const usernameSnapshot =
                await get(
                    newUsernameRef
                );


            if (
                usernameSnapshot.exists()
            ) {

                const existingUID =
                    usernameSnapshot.val();


                if (
                    existingUID !==
                    currentUser.uid
                ) {

                    usernameMessage.textContent =
                        "That username is already taken.";

                    return;

                }

            }


            /* =========================
               SAVE NEW USERNAME
            ========================= */

            await update(
                userRef,
                {

                    username:
                        username,

                    usernameKey:
                        newUsernameKey

                }
            );


            /* =========================
               REMOVE OLD USERNAME KEY
            ========================= */

            if (
                oldUsernameKey !==
                newUsernameKey
            ) {

                await remove(
                    ref(
                        database,
                        `usernames/${oldUsernameKey}`
                    )
                );

            }


            /* =========================
               CREATE NEW USERNAME KEY
            ========================= */

            await set(
                newUsernameRef,
                currentUser.uid
            );


            /* =========================
               LOCAL STORAGE
            ========================= */

            localStorage.setItem(
                "username",
                username
            );


            localStorage.setItem(
                "userUID",
                currentUser.uid
            );


            /* =========================
               SUCCESS
            ========================= */

            usernameMessage.textContent =
                "Username changed successfully ✓";

        }

        catch (error) {

            console.error(
                "Username update failed:",
                error
            );


            usernameMessage.textContent =
                "Failed to change username.";

        }

    }
);


/* =========================
   SHOW PROFILE PICTURE
========================= */

function showProfilePicture(
    image
) {

    profilePreview.src =
        image;


    profilePreview.style.display =
        "block";


    defaultAvatar.style.display =
        "none";

}


/* =========================
   SHOW DEFAULT AVATAR
========================= */

function showDefaultAvatar() {

    profilePreview.src =
        "";


    profilePreview.style.display =
        "none";


    defaultAvatar.style.display =
        "block";

}