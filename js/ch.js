import { database } from "../firebase.js";

import {
    getAuth,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

import {
    ref,
    onValue,
    runTransaction
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-database.js";


/* =========================
   ELEMENTS
========================= */

const hubFeed =
    document.getElementById(
        "hubFeed"
    );


const giftModal =
    document.getElementById(
        "giftModal"
    );


const closeGiftModal =
    document.getElementById(
        "closeGiftModal"
    );


const giftModalButton =
    document.getElementById(
        "giftModalButton"
    );


const giftModalMessage =
    document.getElementById(
        "giftModalMessage"
    );


/* =========================
   FIREBASE AUTH
========================= */

const auth =
    getAuth();


let currentUser =
    null;


/* =========================
   CHECK USER
========================= */

onAuthStateChanged(
    auth,
    function (user) {

        if (!user) {

            window.location.href =
                "login.html";

            return;

        }


        currentUser =
            user;


        loadCommunityHub();

    }
);


/* =========================
   LOAD COMMUNITY HUB
========================= */

function loadCommunityHub() {

    if (!hubFeed) {

        console.error(
            "Community Hub feed not found."
        );

        return;

    }


    const communityRef =
        ref(
            database,
            "communityHub"
        );


    onValue(
        communityRef,

        function (snapshot) {

            hubFeed.innerHTML =
                "";


            if (!snapshot.exists()) {

                showEmptyState();

                return;

            }


            const data =
                snapshot.val();


            /*
               FIXED ORDER:

               1. UPDATE
               2. GIFT
               3. POLL
               4. GROUP CHAT
            */

            const slotOrder = [

                "update",

                "gift",

                "poll",

                "gc"

            ];


            let cardsShown =
                0;


            slotOrder.forEach(
                function (slot) {

                    const post =
                        data[slot];


                    if (
                        !post ||
                        post.active === false
                    ) {

                        return;

                    }


                    const card =
                        createPostCard(
                            post,
                            slot
                        );


                    if (card) {

                        hubFeed.appendChild(
                            card
                        );


                        cardsShown++;

                    }

                }
            );


            if (
                cardsShown === 0
            ) {

                showEmptyState();

            }

        },

        function (error) {

            console.error(
                "Failed to load Community Hub:",
                error
            );


            hubFeed.innerHTML = `

                <div class="empty-card">

                    <div class="loading-icon">
                        ⚠️
                    </div>

                    <p>
                        Failed to load Community Hub.
                    </p>

                </div>

            `;

        }
    );

}


/* =========================
   EMPTY STATE
========================= */

function showEmptyState() {

    hubFeed.innerHTML = `

        <div class="empty-card">

            <div class="loading-icon">
                📬
            </div>

            <p>
                No community updates yet.
            </p>

        </div>

    `;

}


/* =========================
   CREATE POST CARD
========================= */

function createPostCard(
    post,
    slot
) {

    const card =
        document.createElement(
            "article"
        );


    card.className =
        "hub-card";


    /* =========================
       ADMIN UPDATE
    ========================= */

    if (
        slot === "update" ||
        post.type === "update" ||
        post.type === "text"
    ) {

        card.innerHTML = `

            <div class="card-top">

                <div class="card-icon">
                    📢
                </div>


                <div>

                    <div class="card-type">
                        ADMIN UPDATE
                    </div>


                    <div class="card-title">

                        ${escapeHTML(
                            post.title ||
                            "COMMUNITY UPDATE"
                        )}

                    </div>

                </div>

            </div>


            <p class="card-message">

                ${escapeHTML(
                    post.message ||
                    post.text ||
                    ""
                )}

            </p>

        `;


        return card;

    }


    /* =========================
       GIFT DROP
    ========================= */

    if (
        slot === "gift" ||
        post.type === "gift" ||
        post.type === "giftDrop"
    ) {

        const total =
            Number(
                post.total ||
                post.quantity ||
                0
            );


        const claimed =
            Number(
                post.claimed ||
                0
            );


        const remaining =
            Math.max(
                0,
                total - claimed
            );


        const alreadyClaimed =
            post.claims &&
            currentUser &&
            post.claims[
                currentUser.uid
            ];


        card.innerHTML = `

            <div class="card-top">

                <div class="card-icon">
                    🎁
                </div>


                <div>

                    <div class="card-type">
                        GIFT DROP
                    </div>


                    <div class="card-title">

                        ${escapeHTML(
                            post.title ||
                            "SURPRISE GIFT DROP"
                        )}

                    </div>

                </div>

            </div>


            <p class="card-message">

                ${escapeHTML(
                    post.message ||
                    ""
                )}

            </p>


            <div class="gift-info">

                <div class="gift-details">

                    <span class="gift-reward">

                        +${escapeHTML(
                            String(
                                post.reward ||
                                0
                            )
                        )} CP

                    </span>


                    <span class="gift-remaining">

                        ${remaining} / ${total}
                        GIFTS REMAINING

                    </span>

                </div>


                <button
                    class="claim-button"
                    ${
                        remaining <= 0 ||
                        alreadyClaimed
                            ? "disabled"
                            : ""
                    }
                >

                    ${
                        alreadyClaimed
                            ? "ALREADY CLAIMED"
                            :
                        remaining <= 0
                            ? "ALL CLAIMED"
                            : "CLAIM GIFT"
                    }

                </button>

            </div>

        `;


        const claimButton =
            card.querySelector(
                ".claim-button"
            );


        if (
            claimButton &&
            !claimButton.disabled
        ) {

            claimButton.addEventListener(
                "click",
                function () {

                    claimGift(
                        post,
                        claimButton
                    );

                }
            );

        }


        return card;

    }


    /* =========================
       POLL
    ========================= */

    if (
        slot === "poll" ||
        post.type === "poll"
    ) {

        const options =
            normalizePollOptions(
                post.options
            );


        const votedOption =
            post.votes &&
            currentUser
                ? post.votes[
                    currentUser.uid
                ]
                : null;


        card.innerHTML = `

            <div class="card-top">

                <div class="card-icon">
                    🗳️
                </div>


                <div>

                    <div class="card-type">
                        COMMUNITY POLL
                    </div>


                    <div class="card-title">

                        ${escapeHTML(
                            post.question ||
                            post.title ||
                            "POLL"
                        )}

                    </div>

                </div>

            </div>


            <div class="poll-options">

                ${
                    options.map(
                        function (
                            option,
                            index
                        ) {

                            const voteCount =
                                getOptionVotes(
                                    post,
                                    index
                                );


                            const selected =
                                votedOption ===
                                String(index);


                            return `

                                <button
                                    type="button"
                                    class="poll-option ${
                                        selected
                                            ? "selected"
                                            : ""
                                    }"
                                    data-option-index="${index}"
                                    ${
                                        votedOption !== null &&
                                        votedOption !== undefined
                                            ? "disabled"
                                            : ""
                                    }
                                >

                                    <span
                                        class="poll-option-text"
                                    >

                                        ${escapeHTML(
                                            option
                                        )}

                                    </span>


                                    <span
                                        class="poll-votes"
                                    >

                                        ${voteCount}

                                    </span>

                                </button>

                            `;

                        }
                    ).join("")
                }

            </div>

        `;


        const optionButtons =
            card.querySelectorAll(
                ".poll-option"
            );


        optionButtons.forEach(
            function (button) {

                button.addEventListener(
                    "click",
                    function () {

                        const optionIndex =
                            Number(
                                button.dataset
                                    .optionIndex
                            );


                        votePoll(
                            post.id ||
                            "poll",
                            optionIndex
                        );

                    }
                );

            }
        );


        return card;

    }


    /* =========================
       GROUP CHAT
    ========================= */

    if (
        slot === "gc" ||
        post.type === "gc" ||
        post.type === "link" ||
        post.type === "invite"
    ) {

        const link =
            post.link ||
            post.url ||
            "";


        card.innerHTML = `

            <div class="card-top">

                <div class="card-icon">
                    🔗
                </div>


                <div>

                    <div class="card-type">
                        GROUP CHAT
                    </div>


                    <div class="card-title">

                        ${escapeHTML(
                            post.title ||
                            "GROUP CHAT INVITATION"
                        )}

                    </div>

                </div>

            </div>


            <p class="card-message">

                ${escapeHTML(
                    post.message ||
                    "Join the group chat."
                )}

            </p>


            ${
                link
                    ? `

                        <a
                            href="${escapeAttribute(
                                link
                            )}"
                            class="gc-button"
                            target="_blank"
                            rel="noopener noreferrer"
                        >

                            JOIN GROUP CHAT →

                        </a>

                    `
                    : ""
            }

        `;


        return card;

    }


    return null;

}


/* =========================
   CLAIM GIFT
========================= */

async function claimGift(
    post,
    button
) {

    if (!currentUser) {

        return;

    }


    button.disabled =
        true;


    const giftRef =
        ref(
            database,
            "communityHub/gift"
        );


    try {

        /* =========================
           CLAIM GIFT
        ========================= */

        const giftResult =
            await runTransaction(
                giftRef,

                function (
                    currentData
                ) {

                    if (!currentData) {

                        return;

                    }


                    const total =
                        Number(
                            currentData.total ||
                            currentData.quantity ||
                            0
                        );


                    const claimed =
                        Number(
                            currentData.claimed ||
                            0
                        );


                    const claims =
                        currentData.claims ||
                        {};


                    /* ALREADY CLAIMED */

                    if (
                        claims[
                            currentUser.uid
                        ]
                    ) {

                        return;

                    }


                    /* NO GIFTS LEFT */

                    if (
                        claimed >= total
                    ) {

                        return;

                    }


                    claims[
                        currentUser.uid
                    ] = true;


                    currentData.claims =
                        claims;


                    currentData.claimed =
                        claimed + 1;


                    return currentData;

                }
            );


        /* =========================
           CLAIM FAILED
        ========================= */

        if (
            !giftResult.committed
        ) {

            button.disabled =
                false;


            const latest =
                giftResult.snapshot.val();


            if (
                latest &&
                latest.claims &&
                latest.claims[
                    currentUser.uid
                ]
            ) {

                showGiftModal(
                    "You already claimed this gift!"
                );

            }

            else {

                showGiftModal(
                    "Sorry, all gifts have already been claimed."
                );

            }


            return;

        }


        /* =========================
           GET REWARD
        ========================= */

        const giftData =
            giftResult.snapshot.val();


        const reward =
            Number(
                giftData.reward
            ) || 0;


        /* =========================
           ADD CP
        ========================= */

        const userRef =
            ref(
                database,
                `users/${currentUser.uid}`
            );


        const userResult =
            await runTransaction(
                userRef,

                function (
                    userData
                ) {

                    if (!userData) {

                        return userData;

                    }


                    const currentPoints =
                        Number(
                            userData.chaosPoints
                        ) || 0;


                    userData.chaosPoints =
                        currentPoints +
                        reward;


                    return userData;

                }
            );


        if (
            !userResult.committed
        ) {

            showGiftModal(
                "Gift claimed, but there was a problem adding the Chaos Points. Please contact the admin."
            );

            return;

        }


        /* =========================
           SUCCESS
        ========================= */

        showGiftModal(
            `Congratulations! You claimed +${reward} Chaos Points.`
        );

    }

    catch (error) {

        console.error(
            "Gift claim failed:",
            error
        );


        button.disabled =
            false;


        showGiftModal(
            "Something went wrong. Please try again."
        );

    }

}


/* =========================
   SHOW GIFT MODAL
========================= */

function showGiftModal(
    message
) {

    if (giftModalMessage) {

        giftModalMessage.textContent =
            message;

    }


    if (giftModal) {

        giftModal.classList.add(
            "show"
        );

    }

}


/* =========================
   VOTE POLL
========================= */

async function votePoll(
    postId,
    optionIndex
) {

    if (!currentUser) {

        return;

    }


    /*
       Poll always lives at:

       communityHub/poll
    */

    const pollRef =
        ref(
            database,
            "communityHub/poll"
        );


    try {

        await runTransaction(
            pollRef,

            function (
                currentData
            ) {

                if (!currentData) {

                    return;

                }


                const votes =
                    currentData.votes ||
                    {};


                /* ALREADY VOTED */

                if (
                    votes[
                        currentUser.uid
                    ] !== undefined
                ) {

                    return;

                }


                votes[
                    currentUser.uid
                ] =
                    String(
                        optionIndex
                    );


                currentData.votes =
                    votes;


                return currentData;

            }
        );

    }

    catch (error) {

        console.error(
            "Poll voting failed:",
            error
        );

    }

}


/* =========================
   NORMALIZE POLL OPTIONS
========================= */

function normalizePollOptions(
    options
) {

    if (
        Array.isArray(
            options
        )
    ) {

        return options.map(
            function (option) {

                if (
                    typeof option ===
                    "object"
                ) {

                    return (
                        option.text ||
                        option.label ||
                        ""
                    );

                }


                return String(
                    option
                );

            }
        );

    }


    if (
        options &&
        typeof options ===
        "object"
    ) {

        return Object.values(
            options
        ).map(
            function (option) {

                if (
                    typeof option ===
                    "object"
                ) {

                    return (
                        option.text ||
                        option.label ||
                        ""
                    );

                }


                return String(
                    option
                );

            }
        );

    }


    return [];

}


/* =========================
   GET OPTION VOTES
========================= */

function getOptionVotes(
    post,
    optionIndex
) {

    if (!post.votes) {

        return 0;

    }


    return Object.values(
        post.votes
    ).filter(
        function (value) {

            return (
                String(value) ===
                String(optionIndex)
            );

        }
    ).length;

}


/* =========================
   CLOSE MODAL
========================= */

if (closeGiftModal) {

    closeGiftModal.addEventListener(
        "click",
        closeModal
    );

}


if (giftModalButton) {

    giftModalButton.addEventListener(
        "click",
        closeModal
    );

}


if (giftModal) {

    giftModal.addEventListener(
        "click",
        function (event) {

            if (
                event.target ===
                giftModal
            ) {

                closeModal();

            }

        }
    );

}


function closeModal() {

    if (giftModal) {

        giftModal.classList.remove(
            "show"
        );

    }

}


/* =========================
   SECURITY HELPERS
========================= */

function escapeHTML(
    value
) {

    const div =
        document.createElement(
            "div"
        );


    div.textContent =
        value ?? "";


    return div.innerHTML;

}


function escapeAttribute(
    value
) {

    return String(
        value ?? ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        );

}