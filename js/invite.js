import { database } from "../firebase.js";

import {
    ref,
    get
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-database.js";


const inviteInput =
    document.getElementById("inviteCode");

const message =
    document.getElementById("message");


window.verifyInvite = async function () {

    const code =
        inviteInput.value
            .trim()
            .toUpperCase();


    if (!code) {

        message.textContent =
            "Please enter your invitation code.";

        return;

    }


    try {

        const invitationRef =
            ref(
                database,
                `invitations/${code}`
            );


        const snapshot =
            await get(invitationRef);


        if (!snapshot.exists()) {

            message.textContent =
                "❌ Invalid invitation code.";

            return;

        }


        const invitation =
            snapshot.val();


        if (invitation.used === true) {

            message.textContent =
                "❌ This invitation has already been used.";

            return;

        }


        /* Valid invitation */

        sessionStorage.setItem(
            "inviteCode",
            code
        );


        message.textContent =
            "✓ Invitation verified!";


        setTimeout(() => {

            window.location.href =
                "account.html";

        }, 700);


    } catch (error) {

        console.error(error);

        message.textContent =
            "Something went wrong. Please try again.";

    }

};