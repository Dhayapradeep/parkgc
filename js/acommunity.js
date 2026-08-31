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
   AUTH
========================= */

const auth =
    getAuth();


/* =========================
   ELEMENTS
========================= */

const hubActions =
    document.querySelectorAll(".hub-action");

const formCards =
    document.querySelectorAll(".hub-form-card");

const statusMessage =
    document.getElementById("statusMessage");

const publishUpdate =
    document.getElementById("publishUpdate");

const publishGift =
    document.getElementById("publishGift");

const publishPoll =
    document.getElementById("publishPoll");

const publishGc =
    document.getElementById("publishGc");

const addPollOption =
    document.getElementById("addPollOption");


/* =========================
   ADMIN AUTH CHECK
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


            if (!snapshot.exists()) {

                window.location.href =
                    "unauthorized.html";

                return;

            }


            const userData =
                snapshot.val();


            if (
                userData.role !==
                "admin"
            ) {

                window.location.href =
                    "unauthorized.html";

                return;

            }


            console.log(
                "Community Hub admin access granted."
            );


            enableCommunityHub();

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

function enableCommunityHub() {

    hubActions.forEach(
        function (button) {

            button.addEventListener(
                "click",
                function () {

                    const target =
                        this.dataset.target;

                    openForm(target);

                }
            );

        }
    );


    if (addPollOption) {

        addPollOption.addEventListener(
            "click",
            createPollOption
        );

    }


    if (publishUpdate) {

        publishUpdate.addEventListener(
            "click",
            createUpdate
        );

    }


    if (publishGift) {

        publishGift.addEventListener(
            "click",
            createGift
        );

    }


    if (publishPoll) {

        publishPoll.addEventListener(
            "click",
            createPoll
        );

    }


    if (publishGc) {

        publishGc.addEventListener(
            "click",
            createGcInvitation
        );

    }

}


/* =========================
   OPEN FORM
========================= */

function openForm(targetId) {

    const targetForm =
        document.getElementById(
            targetId
        );


    if (!targetForm) {

        return;

    }


    const isAlreadyOpen =
        targetForm.classList.contains(
            "active"
        );


    formCards.forEach(
        function (form) {

            form.classList.remove(
                "active"
            );

        }
    );


    hubActions.forEach(
        function (button) {

            button.classList.remove(
                "active"
            );


            const arrow =
                button.querySelector(
                    ".arrow"
                );


            if (arrow) {

                arrow.textContent =
                    "+";

            }

        }
    );


    if (isAlreadyOpen) {

        return;

    }


    targetForm.classList.add(
        "active"
    );


    const activeButton =
        document.querySelector(
            `[data-target="${targetId}"]`
        );


    if (activeButton) {

        activeButton.classList.add(
            "active"
        );


        const arrow =
            activeButton.querySelector(
                ".arrow"
            );


        if (arrow) {

            arrow.textContent =
                "−";

        }

    }


    setTimeout(
        function () {

            targetForm.scrollIntoView({

                behavior: "smooth",

                block: "nearest"

            });

        },
        50
    );

}


/* =========================
   ADD POLL OPTION
========================= */

function createPollOption() {

    const pollOptions =
        document.getElementById(
            "pollOptions"
        );


    if (!pollOptions) {

        return;

    }


    const number =
        pollOptions.querySelectorAll(
            ".poll-option-row"
        ).length + 1;


    const row =
        document.createElement(
            "div"
        );


    row.className =
        "poll-option-row";


    row.innerHTML = `

        <input
            type="text"
            class="poll-option"
            placeholder="Option ${number}"
        >

    `;


    pollOptions.appendChild(
        row
    );

}


/* =========================
   CREATE ADMIN UPDATE
========================= */

async function createUpdate() {

    const title =
        document
            .getElementById(
                "updateTitle"
            )
            .value
            .trim();


    const message =
        document
            .getElementById(
                "updateMessage"
            )
            .value
            .trim();


    if (
        !title ||
        !message
    ) {

        showStatus(
            "Please fill in all fields."
        );

        return;

    }


    await saveCommunitySlot(
        "update",
        {

            type: "update",

            title: title,

            message: message,

            createdAt:
                Date.now(),

            active:
                true

        }
    );


    document
        .getElementById(
            "updateTitle"
        )
        .value = "";


    document
        .getElementById(
            "updateMessage"
        )
        .value = "";

}


/* =========================
   CREATE GIFT DROP
========================= */

async function createGift() {

    const title =
        document
            .getElementById(
                "giftTitle"
            )
            .value
            .trim();


    const message =
        document
            .getElementById(
                "giftMessage"
            )
            .value
            .trim();


    const reward =
        Number(
            document
                .getElementById(
                    "giftReward"
                )
                .value
        );


    const winners =
        Number(
            document
                .getElementById(
                    "giftWinners"
                )
                .value
        );


    if (
        !title ||
        !message ||
        reward <= 0 ||
        winners <= 0
    ) {

        showStatus(
            "Please complete all gift details."
        );

        return;

    }


    /*
       A new gift is a completely
       fresh gift drop.

       Previous claims are reset.
    */

    await saveCommunitySlot(
        "gift",
        {

            type: "gift",

            title: title,

            message: message,

            reward: reward,

            total: winners,

            claimed: 0,

            claims: {},

            createdAt:
                Date.now(),

            active:
                true

        }
    );


    document
        .getElementById(
            "giftTitle"
        )
        .value = "";


    document
        .getElementById(
            "giftMessage"
        )
        .value = "";


    document
        .getElementById(
            "giftReward"
        )
        .value = "";


    document
        .getElementById(
            "giftWinners"
        )
        .value = "";

}


/* =========================
   CREATE POLL
========================= */

async function createPoll() {

    const question =
        document
            .getElementById(
                "pollQuestion"
            )
            .value
            .trim();


    const inputs =
        document.querySelectorAll(
            "#pollOptions .poll-option"
        );


    const options = [];


    inputs.forEach(
        function (input) {

            const value =
                input.value.trim();


            if (value) {

                options.push(
                    value
                );

            }

        }
    );


    if (
        !question ||
        options.length < 2
    ) {

        showStatus(
            "Enter a question and at least 2 options."
        );

        return;

    }


    await saveCommunitySlot(
        "poll",
        {

            type: "poll",

            question:
                question,

            options:
                options,

            votes: {},

            createdAt:
                Date.now(),

            active:
                true

        }
    );


    document
        .getElementById(
            "pollQuestion"
        )
        .value = "";


    inputs.forEach(
        function (input) {

            input.value = "";

        }
    );

}


/* =========================
   CREATE GC INVITATION
========================= */

async function createGcInvitation() {

    const title =
        document
            .getElementById(
                "gcTitle"
            )
            .value
            .trim();


    const message =
        document
            .getElementById(
                "gcMessage"
            )
            .value
            .trim();


    const link =
        document
            .getElementById(
                "gcLink"
            )
            .value
            .trim();


    if (
        !title ||
        !message ||
        !link
    ) {

        showStatus(
            "Please complete all fields."
        );

        return;

    }


    await saveCommunitySlot(
        "gc",
        {

            type: "gc",

            title: title,

            message: message,

            link: link,

            createdAt:
                Date.now(),

            active:
                true

        }
    );


    document
        .getElementById(
            "gcTitle"
        )
        .value = "";


    document
        .getElementById(
            "gcMessage"
        )
        .value = "";


    document
        .getElementById(
            "gcLink"
        )
        .value = "";

}


/* =========================
   SAVE COMMUNITY SLOT
=========================

   FIXED LOCATIONS:

   communityHub/update
   communityHub/gift
   communityHub/poll
   communityHub/gc

   This means publishing again
   replaces the previous content.
========================= */

async function saveCommunitySlot(
    slot,
    postData
) {

    try {

        const slotRef =
            ref(
                database,
                `communityHub/${slot}`
            );


        await set(
            slotRef,
            postData
        );


        showStatus(
            "✓ Published successfully!"
        );


        console.log(
            `Community Hub ${slot} updated.`
        );

    }

    catch (error) {

        console.error(
            "Failed to publish Community Hub slot:",
            error
        );


        showStatus(
            "Failed to publish. Try again."
        );

    }

}


/* =========================
   STATUS MESSAGE
========================= */

function showStatus(
    message
) {

    if (!statusMessage) {

        return;

    }


    statusMessage.textContent =
        message;


    statusMessage.classList.add(
        "show"
    );


    setTimeout(
        function () {

            statusMessage.classList.remove(
                "show"
            );

        },
        3000
    );

}