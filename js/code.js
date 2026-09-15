import{ref,set,get,update,onValue,runTransaction,serverTimestamp}from"https://www.gstatic.com/firebasejs/12.17.1/firebase-database.js";
import{getAuth,onAuthStateChanged}from"https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import{app,database}from"../firebase.js";

const auth=getAuth(app);

const TOTAL_ROUNDS=5;
const CODE_LENGTH=5;
const ROUND_DURATION=120*1000;
const CLUE_INTERVAL=10*1000;
const BREAK_DURATION=5*1000;

const TOP_REWARDS={
    1:100,
    2:75,
    3:50
};

const roomCodeDisplay=document.getElementById("roomCodeDisplay");
const exitButton=document.getElementById("exitButton");
const roundDisplay=document.getElementById("roundDisplay");
const timerDisplay=document.getElementById("timerDisplay");
const scoreDisplay=document.getElementById("scoreDisplay");
const codeDigits=document.getElementById("codeDigits");
const clueCounter=document.getElementById("clueCounter");
const cluesList=document.getElementById("cluesList");
const submitButton=document.getElementById("submitButton");
const answerStatus=document.getElementById("answerStatus");
const standingsList=document.getElementById("standingsList");
const gameSection=document.getElementById("gameSection");
const roundBreak=document.getElementById("roundBreak");
const breakTitle=document.getElementById("breakTitle");
const roundResultList=document.getElementById("roundResultList");
const breakCountdown=document.getElementById("breakCountdown");
const finalResults=document.getElementById("finalResults");
const winnerDisplay=document.getElementById("winnerDisplay");
const finalLeaderboard=document.getElementById("finalLeaderboard");
const lobbyButton=document.getElementById("lobbyButton");
const dashboardButton=document.getElementById("dashboardButton");

const digitInputs=[
    document.getElementById("digit1"),
    document.getElementById("digit2"),
    document.getElementById("digit3"),
    document.getElementById("digit4"),
    document.getElementById("digit5")
];

const params=new URLSearchParams(window.location.search);
const roomFromUrl=params.get("room");

let currentRoomCode=roomFromUrl?.trim().toUpperCase();

if(!currentRoomCode){
    window.location.href="clobby.html";
}

let currentUser=null;
let currentUsername="Player";
let currentRoomData=null;
let roomListenerStarted=false;
let timerInterval=null;
let hostRoundTimer=null;
let hostTransitionTimer=null;
let countdownTimer=null;
let hostRoundKey=null;
let hostTransitionKey=null;
let currentRoundNumber=null;
let answerProcessorStarted=false;

onAuthStateChanged(auth,async function(user){

    if(!user){
        window.location.href="login.html";
        return;
    }

    currentUser=user;

    await loadUserProfile();

    if(currentRoomCode){
        listenToRoom();
    }

});

async function loadUserProfile(){

    try{

        const userRef=ref(
            database,
            `users/${currentUser.uid}`
        );

        const snapshot=await get(userRef);

        if(snapshot.exists()){

            const data=snapshot.val();

            currentUsername=data.username||"Player";

        }

    }catch(error){

        console.error(
            "LOAD USER ERROR:",
            error
        );

    }

}

function getRoomRef(){

    return ref(
        database,
        `chaosCodeRooms/${currentRoomCode}`
    );

}

function listenToRoom(){

    if(roomListenerStarted){
        return;
    }

    roomListenerStarted=true;

    onValue(
        getRoomRef(),
        async function(snapshot){

            if(!snapshot.exists()){

                window.location.href="clobby.html";
                return;

            }

            currentRoomData=snapshot.val();

            const player=
                currentRoomData.players?.[
                    currentUser.uid
                ];

            if(!player){

                window.location.href="clobby.html";
                return;

            }

            roomCodeDisplay.textContent=
                currentRoomCode;

            scoreDisplay.textContent=
                Number(player.score||0);

            renderStandings(
                currentRoomData
            );

            ensureAnswerProcessor();

            if(
                currentRoomData.status===
                "starting"
            ){

                await handleStartingState();

            }else if(
                currentRoomData.status===
                "playing"
            ){

                handlePlayingState();

            }else if(
                currentRoomData.status===
                "roundResult"
            ){

                handleRoundResultState();

            }else if(
                currentRoomData.status===
                "finished"
            ){

                renderFinalResults(
                    currentRoomData
                );

            }

        }
    );

}

async function handleStartingState(){

    if(
        currentRoomData.hostUid!==
        currentUser.uid
    ){
        return;
    }

    if(
        currentRoomData.rounds?.["1"]
    ){
        return;
    }

    try{

        const round=generateRound();
        const now=Date.now();

        await update(
            getRoomRef(),
            {
                "rounds/1":round,
                currentRound:1,
                currentCode:round.code,
                currentClues:round.clues,
                roundStartAt:now,
                roundEndAt:null,
                roundResultAt:null,
                status:"playing"
            }
        );

    }catch(error){

        console.error(
            "INITIALIZE FIRST ROUND ERROR:",
            error
        );

    }

}

function handlePlayingState(){

    const roundNumber=
        Number(
            currentRoomData.currentRound
        );

    if(!roundNumber){
        return;
    }

    const round=
        currentRoomData.rounds?.[
            roundNumber
        ];

    if(!round){
        return;
    }

    roundBreak.classList.add(
        "hidden"
    );

    gameSection.classList.remove(
        "hidden"
    );

    renderRound(
        roundNumber,
        round
    );

    startTimer();

    if(
        currentRoomData.hostUid===
        currentUser.uid
    ){

        scheduleHostRoundEnd();

    }

}

function renderRound(
    roundNumber,
    round
){

    if(
        currentRoundNumber!==
        roundNumber
    ){

        currentRoundNumber=
            roundNumber;

        clearAnswerInputs();

        resetAnswerStatus();

    }

    roundDisplay.textContent=
        `${roundNumber} / ${TOTAL_ROUNDS}`;

    renderCodeDigits(
        round.displayDigits
    );

    renderAvailableClues(
        round
    );

    const answers=
        currentRoomData.answers?.[
            roundNumber
        ]||{};

    const myAnswer=
        answers[
            currentUser.uid
        ];

    if(
        myAnswer?.correct===
        true
    ){

        submitButton.disabled=true;

        digitInputs.forEach(
            function(input){
                input.disabled=true;
            }
        );

        answerStatus.className=
            "answer-status correct";

        answerStatus.textContent=
            `✅ CODE CRACKED! +${Number(
                myAnswer.points||0
            )} POINTS`;

    }else{

        submitButton.disabled=false;

        digitInputs.forEach(
            function(input){
                input.disabled=false;
            }
        );

    }

}

function renderCodeDigits(digits){

    codeDigits.innerHTML="";

    digits.forEach(
        function(digit){

            const element=
                document.createElement(
                    "span"
                );

            element.textContent=digit;

            codeDigits.appendChild(
                element
            );

        }
    );

}

function renderAvailableClues(round){

    if(!round){
        return;
    }

    const startAt=
        Number(
            currentRoomData.roundStartAt
        );

    if(!startAt){
        return;
    }

    const elapsed=
        Math.max(
            0,
            Date.now()-startAt
        );

    let visibleCount=
        Math.floor(
            elapsed/CLUE_INTERVAL
        )+1;

    visibleCount=
        Math.max(
            1,
            Math.min(
                5,
                visibleCount
            )
        );

    if(
        elapsed>=ROUND_DURATION
    ){

        visibleCount=5;

    }

    clueCounter.textContent=
        `${visibleCount} / 5`;

    cluesList.innerHTML="";

    for(
        let i=0;
        i<5;
        i++
    ){

        if(i<visibleCount){

            const clue=
                round.clues[i];

            const element=
                document.createElement(
                    "div"
                );

            element.className="clue";

            element.innerHTML=`

                <div class="clue-number">
                    🔢 CLUE ${i+1}
                </div>

                <div class="clue-guess">
                    ${escapeHtml(
                        clue.guess.join(" ")
                    )}
                </div>

                <div class="clue-text">
                    ${escapeHtml(
                        clue.text
                    )}
                </div>

            `;

            cluesList.appendChild(
                element
            );

        }else{

            const element=
                document.createElement(
                    "div"
                );

            element.className=
                "locked-clue";

            element.textContent=
                `🔒 CLUE ${i+1}`;

            cluesList.appendChild(
                element
            );

        }

    }

}

function startTimer(){

    clearInterval(
        timerInterval
    );

    function tick(){

        if(
            !currentRoomData||
            currentRoomData.status!==
            "playing"
        ){

            clearInterval(
                timerInterval
            );

            return;

        }

        const startAt=
            Number(
                currentRoomData.roundStartAt
            );

        if(!startAt){
            return;
        }

        const elapsed=
            Date.now()-startAt;

        const remaining=
            Math.max(
                0,
                ROUND_DURATION-elapsed
            );

        const totalSeconds=
            Math.ceil(
                remaining/1000
            );

        const minutes=
            Math.floor(
                totalSeconds/60
            );

        const seconds=
            totalSeconds%60;

        timerDisplay.textContent=
            `${String(minutes).padStart(2,"0")}:${String(seconds).padStart(2,"0")}`;

        renderAvailableClues(
            currentRoomData.rounds?.[
                currentRoomData.currentRound
            ]
        );

        if(remaining<=0){

            clearInterval(
                timerInterval
            );

        }

    }

    tick();

    timerInterval=
        setInterval(
            tick,
            250
        );

}

function scheduleHostRoundEnd(){

    if(
        !currentRoomData||
        !currentUser
    ){
        return;
    }

    if(
        currentRoomData.hostUid!==
        currentUser.uid
    ){
        return;
    }

    const roundNumber=
        Number(
            currentRoomData.currentRound
        );

    const startAt=
        Number(
            currentRoomData.roundStartAt
        );

    if(
        !roundNumber||
        !startAt
    ){
        return;
    }

    const key=
        `${roundNumber}-${startAt}`;

    if(
        hostRoundKey===
        key
    ){
        return;
    }

    hostRoundKey=key;

    clearTimeout(
        hostRoundTimer
    );

    const elapsed=
        Date.now()-startAt;

    const remaining=
        Math.max(
            0,
            ROUND_DURATION-elapsed
        );

    hostRoundTimer=
        setTimeout(
            function(){
                finishCurrentRound();
            },
            remaining+100
        );

}

async function finishCurrentRound() {

    if (
        !currentRoomData ||
        !currentUser
    ) {
        return;
    }


    if (
        currentRoomData.status !==
        "playing"
    ) {
        return;
    }


    if (
        currentRoomData.hostUid !==
        currentUser.uid
    ) {
        return;
    }


    clearTimeout(
        hostRoundTimer
    );

    hostRoundTimer = null;

    hostRoundKey = null;


    try {

        /*
         * Get the freshest Firebase data first.
         * This is important because a player may have
         * answered very close to the end of the round.
         */

        const snapshot =
            await get(
                getRoomRef()
            );


        if (
            !snapshot.exists()
        ) {
            return;
        }


        /*
         * Refresh local room data.
         */

        currentRoomData =
            snapshot.val();


        /*
         * IMPORTANT:
         *
         * Score every correct answer while the
         * room is still "playing".
         *
         * We do this BEFORE changing the status
         * to "roundResult".
         */

        await processCorrectAnswers();


        /*
         * Read Firebase one more time so that
         * all score/points transactions are reflected
         * before the round-result screen appears.
         */

        const finalSnapshot =
            await get(
                getRoomRef()
            );


        if (
            !finalSnapshot.exists()
        ) {
            return;
        }


        currentRoomData =
            finalSnapshot.val();


        const now =
            Date.now();


        /*
         * NOW end the round.
         */

        await update(
            getRoomRef(),
            {

                status:
                    "roundResult",

                roundEndAt:
                    now,

                roundResultAt:
                    now

            }
        );

    }

    catch (error) {

        console.error(
            "FINISH ROUND ERROR:",
            error
        );

    }

}

function handleRoundResultState(){

    clearInterval(
        timerInterval
    );

    clearTimeout(
        hostRoundTimer
    );

    hostRoundTimer=null;

    submitButton.disabled=true;

    digitInputs.forEach(
        function(input){
            input.disabled=true;
        }
    );

    const roundNumber=
        Number(
            currentRoomData.currentRound
        );

    const answers=
        currentRoomData.answers?.[
            roundNumber
        ]||{};

    const players=
        currentRoomData.players||{};

    const results=
        Object.entries(players)
            .filter(
                ([,player])=>
                    !player.leftGame
            )
            .map(
                ([uid,player])=>{

                    const answer=
                        answers[uid];

                    return{
                        uid,
                        username:
                            player.username||
                            "Player",
                        points:
                            Number(
                                answer?.points||0
                            ),
                        correct:
                            answer?.correct===
                            true,
                        totalScore:
                            Number(
                                player.score||0
                            )
                    };

                }
            )
            .sort(
                function(a,b){

                    if(
                        b.points!==
                        a.points
                    ){

                        return(
                            b.points-
                            a.points
                        );

                    }

                    return(
                        b.totalScore-
                        a.totalScore
                    );

                }
            );

    showRoundBreak(
        roundNumber,
        results
    );

    if(
        currentRoomData.hostUid===
        currentUser.uid
    ){

        scheduleNextRound();

    }

}

function showRoundBreak(
    roundNumber,
    results
){

    roundBreak.classList.remove(
        "hidden"
    );

    breakTitle.textContent=
        `ROUND ${roundNumber} RESULTS`;

    roundResultList.innerHTML="";

    results.forEach(
        function(result,index){

            const row=
                document.createElement(
                    "div"
                );

            row.className=
                "round-result";

            const left=
                document.createElement(
                    "span"
                );

            left.textContent=
                `${index+1}. ${result.username}`;

            const right=
                document.createElement(
                    "strong"
                );

            right.textContent=
                result.correct
                    ?`+${result.points}`
                    :"+0";

            row.appendChild(left);
            row.appendChild(right);

            roundResultList.appendChild(
                row
            );

        }
    );

    startBreakCountdown();

}

function startBreakCountdown(){

    clearInterval(
        countdownTimer
    );

    const resultAt=
        Number(
            currentRoomData.roundResultAt
        );

    if(!resultAt){

        breakCountdown.textContent=
            "5";

        return;

    }

    function updateCountdown(){

        const elapsed=
            Date.now()-resultAt;

        const remaining=
            Math.max(
                0,
                BREAK_DURATION-elapsed
            );

        const seconds=
            Math.ceil(
                remaining/1000
            );

        breakCountdown.textContent=
            seconds;

        if(
            remaining<=0
        ){

            clearInterval(
                countdownTimer
            );

        }

    }

    updateCountdown();

    countdownTimer=
        setInterval(
            updateCountdown,
            100
        );

}

function scheduleNextRound(){

    if(
        !currentRoomData||
        !currentUser
    ){
        return;
    }

    if(
        currentRoomData.hostUid!==
        currentUser.uid
    ){
        return;
    }

    const roundNumber=
        Number(
            currentRoomData.currentRound
        );

    const resultAt=
        Number(
            currentRoomData.roundResultAt
        );

    if(
        !roundNumber||
        !resultAt
    ){
        return;
    }

    const key=
        `${roundNumber}-${resultAt}`;

    if(
        hostTransitionKey===
        key
    ){
        return;
    }

    hostTransitionKey=key;

    clearTimeout(
        hostTransitionTimer
    );

    const elapsed=
        Date.now()-resultAt;

    const remaining=
        Math.max(
            0,
            BREAK_DURATION-elapsed
        );

    hostTransitionTimer=
        setTimeout(
            function(){
                startNextRound();
            },
            remaining+100
        );

}

async function startNextRound(){

    if(
        !currentRoomData||
        !currentUser
    ){
        return;
    }

    if(
        currentRoomData.hostUid!==
        currentUser.uid
    ){
        return;
    }

    if(
        currentRoomData.status!==
        "roundResult"
    ){
        return;
    }

    const currentRound=
        Number(
            currentRoomData.currentRound
        );

    if(
        currentRound>=
        TOTAL_ROUNDS
    ){

        await finishGame();
        return;

    }

    const nextRound=
        currentRound+1;

    try{

        const snapshot=
            await get(
                getRoomRef()
            );

        if(
            !snapshot.exists()
        ){
            return;
        }

        const room=
            snapshot.val();

        if(
            room.hostUid!==
            currentUser.uid
        ){
            return;
        }

        if(
            room.status!==
            "roundResult"
        ){
            return;
        }

        if(
            Number(
                room.currentRound
            )!==
            currentRound
        ){
            return;
        }

        const round=
            generateRound();

        const now=Date.now();

        const updates={};

        const players=
            room.players||{};

        Object.keys(players)
            .forEach(
                function(uid){

                    updates[
                        `players/${uid}/currentRoundScore`
                    ]=0;

                    updates[
                        `players/${uid}/lastAnswer`
                    ]=null;

                    updates[
                        `players/${uid}/lastAnsweredRound`
                    ]=null;

                    updates[
                        `players/${uid}/submittedAt`
                    ]=null;

                }
            );

        updates[
            `rounds/${nextRound}`
        ]=round;

        updates[
            `answers/${nextRound}`
        ]=null;

        updates.currentRound=
            nextRound;

        updates.currentCode=
            round.code;

        updates.currentClues=
            round.clues;

        updates.roundStartAt=
            now;

        updates.roundEndAt=
            null;

        updates.roundResultAt=
            null;

        updates.status=
            "playing";

        await update(
            getRoomRef(),
            updates
        );

        hostTransitionKey=null;
        hostRoundKey=null;

        clearTimeout(
            hostTransitionTimer
        );

        hostTransitionTimer=null;

    }catch(error){

        console.error(
            "START NEXT ROUND ERROR:",
            error
        );

    }

}

submitButton.addEventListener(
    "click",
    submitAnswer
);

async function submitAnswer(){

    if(
        !currentUser||
        !currentRoomData
    ){
        return;
    }

    if(
        currentRoomData.status!==
        "playing"
    ){
        return;
    }

    const roundNumber=
        Number(
            currentRoomData.currentRound
        );

    const round=
        currentRoomData.rounds?.[
            roundNumber
        ];

    if(!round){
        return;
    }

    const existingAnswer=
        currentRoomData.answers?.[
            roundNumber
        ]?.[
            currentUser.uid
        ];

    if(
        existingAnswer?.correct===
        true
    ){
        return;
    }

    const answer=
        getAnswerFromInputs();

    if(
        answer.length!==
        CODE_LENGTH
    ){

        showAnswerStatus(
            "ENTER ALL 5 DIGITS.",
            "wrong"
        );

        return;

    }

    if(
        new Set(answer).size!==
        CODE_LENGTH
    ){

        showAnswerStatus(
            "THE CODE USES 5 DIFFERENT DIGITS.",
            "wrong"
        );

        return;

    }

    const availableDigits=
        round.displayDigits.map(
            function(digit){
                return String(digit);
            }
        );

    const validDigits=
        availableDigits.every(
            function(digit){
                return answer.includes(
                    digit
                );
            }
        );

    if(!validDigits){

        showAnswerStatus(
            "USE ONLY THE FIVE DIGITS SHOWN ABOVE.",
            "wrong"
        );

        return;

    }

    const codeString=
        round.code.join("");

    const isCorrect=
        answer===codeString;

    submitButton.disabled=true;

    try{

        const answerRef=
            ref(
                database,
                `chaosCodeRooms/${currentRoomCode}/answers/${roundNumber}/${currentUser.uid}`
            );

        const existingSnapshot=
            await get(
                answerRef
            );

        if(
            existingSnapshot.exists()&&
            existingSnapshot.val()?.correct===
            true
        ){

            return;

        }

        await set(
    answerRef,
    {
        answer,

        submittedAt:
            Date.now(),

        correct:
            isCorrect,

        points:
            0
    }
);

        if(!isCorrect){

            showAnswerStatus(
                "❌ NOT THE CODE. TRY AGAIN.",
                "wrong"
            );

            setTimeout(
                function(){

                    if(
                        currentRoomData&&
                        currentRoomData.status===
                        "playing"
                    ){

                        submitButton.disabled=
                            false;

                    }

                },
                200
            );

        }else{

            showAnswerStatus(
                "✅ CORRECT! CALCULATING SPEED...",
                "correct"
            );

        }

    }catch(error){

        console.error(
            "SUBMIT ANSWER ERROR:",
            error
        );

        submitButton.disabled=
            false;

        showAnswerStatus(
            "COULD NOT SUBMIT. TRY AGAIN.",
            "wrong"
        );

    }

}

function getAnswerFromInputs(){

    return digitInputs
        .map(
            function(input){
                return input.value.trim();
            }
        )
        .join("");

}

digitInputs.forEach(
    function(input,index){

        input.addEventListener(
            "input",
            function(){

                input.value=
                    input.value
                        .replace(
                            /[^0-9]/g,
                            ""
                        )
                        .slice(0,1);

                if(
                    input.value&&
                    index<
                    digitInputs.length-1
                ){

                    digitInputs[
                        index+1
                    ].focus();

                }

            }
        );

        input.addEventListener(
            "keydown",
            function(event){

                if(
                    event.key===
                    "Backspace"&&
                    !input.value&&
                    index>0
                ){

                    digitInputs[
                        index-1
                    ].focus();

                }

                if(
                    event.key===
                    "Enter"
                ){

                    submitAnswer();

                }

            }
        );

    }
);

function ensureAnswerProcessor(){

    if(
        answerProcessorStarted
    ){
        return;
    }

    if(
        !currentUser||
        !currentRoomCode
    ){
        return;
    }

    if(
        currentRoomData&&
        currentRoomData.hostUid!==
        currentUser.uid
    ){
        return;
    }

    answerProcessorStarted=
        true;

    const answersRef=
        ref(
            database,
            `chaosCodeRooms/${currentRoomCode}/answers`
        );

    onValue(
        answersRef,
        async function(){

            await processCorrectAnswers();

        }
    );

}

async function processCorrectAnswers(){

    if(
        !currentRoomData||
        !currentUser
    ){
        return;
    }

    if (
    currentRoomData.status !==
    "playing"
) {
    return;
}

    if(
        currentRoomData.hostUid!==
        currentUser.uid
    ){
        return;
    }

    if(
        currentRoomData.status!==
        "playing"
    ){
        return;
    }

    const roundNumber=
        Number(
            currentRoomData.currentRound
        );

    const round=
        currentRoomData.rounds?.[
            roundNumber
        ];

    if(!round){
        return;
    }

    const answers=
        currentRoomData.answers?.[
            roundNumber
        ]||{};

    for(
        const[uid,answer]
        of Object.entries(answers)
    ){

        if(
            !answer||
            answer.correct!==true||
            Number(answer.points||0)>0
        ){
            continue;
        }

        const submittedAt=
            getTimestamp(
                answer.submittedAt
            );

        const roundStartAt=
            Number(
                currentRoomData.roundStartAt
            );

        if(
            !submittedAt||
            !roundStartAt
        ){
            continue;
        }

        const elapsed=
            Math.max(
                0,
                submittedAt-
                roundStartAt
            );

        const progress=
            Math.max(
                0,
                Math.min(
                    1,
                    1-
                    (
                        elapsed/
                        ROUND_DURATION
                    )
                )
            );

        const points=
            Math.max(
                1,
                Math.round(
                    100*
                    Math.pow(
                        progress,
                        1.25
                    )
                )
            );

        const answerRef=
            ref(
                database,
                `chaosCodeRooms/${currentRoomCode}/answers/${roundNumber}/${uid}`
            );

        const transactionResult=
            await runTransaction(
                answerRef,
                function(current){

                    if(!current){
                        return current;
                    }

                    if(
                        Number(
                            current.points||0
                        )>0
                    ){
                        return;
                    }

                    current.points=
                        points;

                    current.processed=
                        true;

                    return current;

                }
            );

        if(
            !transactionResult.committed
        ){
            continue;
        }

        const playerRef=
            ref(
                database,
                `chaosCodeRooms/${currentRoomCode}/players/${uid}`
            );

        await runTransaction(
            playerRef,
            function(player){

                if(!player){
                    return player;
                }

                if(
                    Number(
                        player.lastAnsweredRound
                    )===
                    roundNumber
                ){
                    return;
                }

                player.score=
                    Number(
                        player.score||0
                    )+
                    points;

                player.currentRoundScore=
                    points;

                player.lastAnsweredRound=
                    roundNumber;

                player.lastAnswer=
                    answer.answer;

                player.submittedAt=
                    answer.submittedAt;

                return player;

            }
        );

    }

}

function renderStandings(
    room
){

    const players=
        room.players||{};

    const entries=
        Object.entries(players)
            .filter(
                function([,player]){
                    return !player.leftGame;
                }
            )
            .sort(
                function(a,b){

                    const scoreA=
                        Number(
                            a[1].score||0
                        );

                    const scoreB=
                        Number(
                            b[1].score||0
                        );

                    return scoreB-scoreA;

                }
            );

    standingsList.innerHTML="";

    if(
        entries.length===0
    ){

        standingsList.innerHTML=`
            <div class="empty-standing">
                Waiting for scores...
            </div>
        `;

        return;
    }

    entries.forEach(
        function([uid,player],index){

            const row=
                document.createElement(
                    "div"
                );

            row.className=
                "standing";

            const left=
                document.createElement(
                    "div"
                );

            left.className=
                "standing-left";

            const rank=
                document.createElement(
                    "span"
                );

            rank.className="rank";

            if(index===0){

                rank.textContent="🥇";

            }else if(index===1){

                rank.textContent="🥈";

            }else if(index===2){

                rank.textContent="🥉";

            }else{

                rank.textContent=
                    index+1;

            }

            const name=
                document.createElement(
                    "span"
                );

            name.className=
                "standing-name";

            name.textContent=
                player.username||
                "Player";

            if(
                currentUser&&
                uid===
                currentUser.uid
            ){

                const you=
                    document.createElement(
                        "span"
                    );

                you.className=
                    "standing-you";

                you.textContent="YOU";

                name.appendChild(
                    you
                );

            }

            left.appendChild(rank);
            left.appendChild(name);

            const score=
                document.createElement(
                    "span"
                );

            score.className=
                "standing-score";

            score.textContent=
                `${Number(
                    player.score||0
                )} PTS`;

            row.appendChild(left);
            row.appendChild(score);

            standingsList.appendChild(
                row
            );

        }
    );

}

async function finishGame(){

    if(
        !currentRoomData||
        !currentUser
    ){
        return;
    }

    if(
        currentRoomData.hostUid!==
        currentUser.uid
    ){
        return;
    }

    if(
        currentRoomData.status===
        "finished"
    ){
        return;
    }

    try{

        clearTimeout(
            hostRoundTimer
        );

        clearTimeout(
            hostTransitionTimer
        );

        const snapshot=
            await get(
                getRoomRef()
            );

        if(
            !snapshot.exists()
        ){
            return;
        }

        const room=
            snapshot.val();

        if(
            room.status===
            "finished"
        ){
            return;
        }

        const players=
            room.players||{};

        const entries=
            Object.entries(players)
                .filter(
                    ([,player])=>
                        !player.leftGame
                )
                .sort(
                    function(a,b){

                        const scoreA=
                            Number(
                                a[1].score||0
                            );

                        const scoreB=
                            Number(
                                b[1].score||0
                            );

                        return scoreB-scoreA;

                    }
                );

        const scoringPlayers=
            entries.filter(
                function([,player]){

                    return Number(
                        player.score||0
                    )>0;

                }
            );

        const updates={};

        entries.forEach(
            function([uid,player],index){

                const finalRank=
                    index+1;

                const scoringPosition=
                    scoringPlayers.findIndex(
                        function([scoringUid]){

                            return(
                                scoringUid===
                                uid
                            );

                        }
                    );

                let reward=0;

                if(
                    scoringPosition>=0&&
                    scoringPosition<3
                ){

                    reward=
                        TOP_REWARDS[
                            scoringPosition+1
                        ]||0;

                }

                updates[
                    `players/${uid}/finalRank`
                ]=
                    finalRank;

                updates[
                    `players/${uid}/finalReward`
                ]=
                    reward;

            }
        );

        updates.status=
            "finished";

        updates.finishedAt=
            Date.now();

        updates.rewardsCalculated=
            true;

        await update(
            getRoomRef(),
            updates
        );

        await distributeRewards(
            scoringPlayers
        );

    }catch(error){

        console.error(
            "FINISH GAME ERROR:",
            error
        );

    }

}

async function distributeRewards(
    scoringPlayers
){

    try{

        const roomRef=
            getRoomRef();

        const snapshot=
            await get(roomRef);

        if(
            !snapshot.exists()
        ){
            return;
        }

        const room=
            snapshot.val();

        if(
            room.rewardsDistributed===
            true
        ){
            return;
        }

        for(
            let index=0;
            index<
            scoringPlayers.length&&
            index<3;
            index++
        ){

            const uid=
                scoringPlayers[
                    index
                ][0];

            const player=
                scoringPlayers[
                    index
                ][1];

            const score=
                Number(
                    player.score||0
                );

            if(score<=0){
                continue;
            }

            const reward=
                TOP_REWARDS[
                    index+1
                ]||0;

            if(reward<=0){
                continue;
            }

            const chaosPointsRef=
                ref(
                    database,
                    `users/${uid}/chaosPoints`
                );

            await runTransaction(
                chaosPointsRef,
                function(current){

                    return Number(
                        current||0
                    )+
                    reward;

                }
            );

        }

        await update(
            roomRef,
            {
                rewardsDistributed:
                    true
            }
        );

    }catch(error){

        console.error(
            "DISTRIBUTE REWARDS ERROR:",
            error
        );

    }

}

function renderFinalResults(
    room
){

    clearInterval(
        timerInterval
    );

    clearInterval(
        countdownTimer
    );

    clearTimeout(
        hostRoundTimer
    );

    clearTimeout(
        hostTransitionTimer
    );

    gameSection.classList.add(
        "hidden"
    );

    roundBreak.classList.add(
        "hidden"
    );

    finalResults.classList.remove(
        "hidden"
    );

    const players=
        room.players||{};

    const entries=
        Object.entries(players)
            .filter(
                ([,player])=>
                    !player.leftGame
            )
            .sort(
                function(a,b){

                    return(
                        Number(
                            a[1].finalRank||
                            999
                        )-
                        Number(
                            b[1].finalRank||
                            999
                        )
                    );

                }
            );

    const winner=
        entries[0];

    if(winner){

        winnerDisplay.innerHTML=`

            <div class="winner-title">
                👑 WINNER
            </div>

            <div class="winner-name">
                ${escapeHtml(
                    winner[1].username||
                    "Player"
                )}
            </div>

            <div class="winner-score">
                ${Number(
                    winner[1].score||0
                )} POINTS
            </div>

        `;

    }

    finalLeaderboard.innerHTML="";

    entries.forEach(
        function([,player],index){

            const rank=
                Number(
                    player.finalRank||
                    index+1
                );

            const reward=
                Number(
                    player.finalReward||
                    0
                );

            const row=
                document.createElement(
                    "div"
                );

            row.className=
                "final-player";

            let rankDisplay;

            if(rank===1){

                rankDisplay="🥇";

            }else if(rank===2){

                rankDisplay="🥈";

            }else if(rank===3){

                rankDisplay="🥉";

            }else{

                rankDisplay=rank;

            }

            row.innerHTML=`

                <div class="final-player-left">

                    <span class="final-rank">
                        ${rankDisplay}
                    </span>

                    <span class="final-name">
                        ${escapeHtml(
                            player.username||
                            "Player"
                        )}
                    </span>

                </div>

                <div class="final-score">

                    ${Number(
                        player.score||0
                    )} PTS

                    ${
                        reward>0
                        ?`
                            <span class="reward">
                                +${reward} CP
                            </span>
                         `
                        :""
                    }

                </div>

            `;

            finalLeaderboard.appendChild(
                row
            );

        }
    );

}

exitButton.addEventListener(
    "click",
    async function(){

        if(
            !currentUser||
            !currentRoomCode
        ){

            window.location.href=
                "clobby.html";

            return;

        }

        try{

            const playerRef=
                ref(
                    database,
                    `chaosCodeRooms/${currentRoomCode}/players/${currentUser.uid}`
                );

            await update(
                playerRef,
                {
                    leftGame:true
                }
            );

            window.location.href=
                "clobby.html";

        }catch(error){

            console.error(
                "EXIT ERROR:",
                error
            );

        }

    }
);

lobbyButton.addEventListener(
    "click",
    function(){

        window.location.href=
            "clobby.html";

    }
);

dashboardButton.addEventListener(
    "click",
    function(){

        window.location.href=
            "dashboard.html";

    }
);

function clearAnswerInputs(){

    digitInputs.forEach(
        function(input){

            input.value="";
            input.disabled=false;

        }
    );

    submitButton.disabled=false;

}

function showAnswerStatus(
    message,
    type
){

    answerStatus.textContent=
        message;

    answerStatus.className=
        `answer-status ${type}`;

}

function resetAnswerStatus(){

    answerStatus.textContent="";

    answerStatus.className=
        "answer-status";

}


/* =========================================================
   SIMPLE DEPENDENT CLUE GENERATOR
========================================================= */

/*
   Rules:

   1. Five unique digits are generated.
   2. Those exact five digits are shown.
   3. Only the ORDER is hidden.
   4. Every clue uses only those five digits.
   5. No "number is not in the code" clue exists.
   6. Every clue is based on the remaining possibilities
      left by all clues before it.
   7. The final five clues must identify exactly one
      possible code.
*/

function generateRound(){

    for(
        let attempt=0;
        attempt<100;
        attempt++
    ){

        const digits=
            generateUniqueDigits(
                CODE_LENGTH
            );

        const secret=
            shuffle(
                [...digits]
            );

        const allSolutions=
            generatePermutations(
                digits
            );

        const clues=
            buildDependentClues(
                secret,
                allSolutions
            );

        if(
            clues.length===
            5
        ){

            return{

                code:
                    secret,

                displayDigits:
                    shuffle(
                        [...digits]
                    ),

                clues

            };

        }

    }

    throw new Error(
        "Unable to generate a valid Chaos Code puzzle."
    );

}

function buildDependentClues(
    secret,
    allSolutions
){

    /*
       Start with all 120 possible orders.
    */

    let possibleSolutions=
        [...allSolutions];

    const clues=[];
    const usedGuesses=
        new Set();

    /*
       Desired exact counts.

       This gives the player a clear progression
       without using "unavailable" numbers.

       0 exact / 5 misplaced
       1 exact / 4 misplaced
       2 exact / 3 misplaced
       3 exact / 2 misplaced
       2 exact / 3 misplaced

       The actual guesses are generated dynamically.
    */

    const targetExact=[
        0,
        1,
        2,
        3,
        2
    ];

    /*
       These are target sizes for the number of
       possible codes remaining after each clue.
    */

    const targetSizes=[
        60,
        20,
        8,
        3,
        1
    ];

    for(
        let clueIndex=0;
        clueIndex<5;
        clueIndex++
    ){

        const exactTarget=
            targetExact[
                clueIndex
            ];

        const candidates=[];

        for(
            const guess of allSolutions
        ){

            const key=
                guess.join("");

            if(
                usedGuesses.has(key)
            ){
                continue;
            }

            /*
               Never display the secret itself
               as a clue guess.
            */

            if(
                key===
                secret.join("")
            ){
                continue;
            }

            const feedback=
                evaluateGuess(
                    guess,
                    secret
                );

            if(
                feedback.exact!==
                exactTarget
            ){
                continue;
            }

            /*
               CRITICAL:

               This clue is tested ONLY against
               the solutions that survived all
               previous clues.
            */

            const remaining=
                possibleSolutions.filter(
                    function(candidate){

                        const result=
                            evaluateGuess(
                                guess,
                                candidate
                            );

                        return(
                            result.exact===
                                feedback.exact&&
                            result.misplaced===
                                feedback.misplaced
                        );

                    }
                );

            /*
               The actual secret must remain possible.
            */

            if(
                !remaining.some(
                    function(candidate){

                        return(
                            candidate.join("")===
                            secret.join("")
                        );

                    }
                )
            ){
                continue;
            }

            /*
               Don't let the puzzle become solved
               before Clue 5.
            */

            if(
                clueIndex<4&&
                remaining.length<=1
            ){
                continue;
            }

            const sizeDistance=
                Math.abs(
                    remaining.length-
                    targetSizes[
                        clueIndex
                    ]
                );

            candidates.push({

                guess,
                feedback,
                remaining,
                sizeDistance

            });

        }

        if(
            candidates.length===0
        ){

            return[];

        }

        candidates.sort(
            function(a,b){

                return(
                    a.sizeDistance-
                    b.sizeDistance
                );

            }
        );

        /*
           Try several of the best clues.
           We test the combined clue set,
           not just the newest clue.
        */

        const limit=
            Math.min(
                25,
                candidates.length
            );

        let chosen=null;

        for(
            let i=0;
            i<limit;
            i++
        ){

            const candidate=
                candidates[i];

            const testClues=[
                ...clues,
                {
                    guess:
                        candidate.guess,
                    exact:
                        candidate.feedback.exact,
                    misplaced:
                        candidate.feedback.misplaced
                }
            ];

            const finalSolutions=
                filterSolutions(
                    allSolutions,
                    testClues
                );

            /*
               Before the final clue:
               multiple answers must remain.
            */

            if(
                clueIndex<4
            ){

                if(
                    finalSolutions.length>1
                ){

                    chosen=
                        candidate;

                    break;

                }

            }else{

                /*
                   After all five clues:
                   exactly ONE answer must remain.
                */

                if(
                    finalSolutions.length===
                        1&&
                    finalSolutions[0].join("")===
                        secret.join("")
                ){

                    chosen=
                        candidate;

                    break;

                }

            }

        }

        if(!chosen){

            return[];

        }

        const clue={

            guess:
                [...chosen.guess],

            exact:
                chosen.feedback.exact,

            misplaced:
                chosen.feedback.misplaced,

            absent:
                0,

            text:
                buildSimpleClueText(
                    chosen.feedback
                )

        };

        clues.push(
            clue
        );

        usedGuesses.add(
            chosen.guess.join("")
        );

        /*
           THIS is the dependency:

           The next clue starts from the
           solutions left by this clue.
        */

        possibleSolutions=
            chosen.remaining;

    }

    const finalSolutions=
        filterSolutions(
            allSolutions,
            clues
        );

    if(
        finalSolutions.length!==
        1
    ){

        return[];

    }

    if(
        finalSolutions[0].join("")!==
        secret.join("")
    ){

        return[];

    }

    return clues;

}

function filterSolutions(
    solutions,
    clues
){

    return solutions.filter(
        function(candidate){

            return clues.every(
                function(clue){

                    const result=
                        evaluateGuess(
                            clue.guess,
                            candidate
                        );

                    return(
                        result.exact===
                            clue.exact&&
                        result.misplaced===
                            clue.misplaced
                    );

                }
            );

        }
    );

}

function evaluateGuess(
    guess,
    secret
){

    let exact=0;
    let totalCommon=0;

    for(
        let i=0;
        i<CODE_LENGTH;
        i++
    ){

        /*
           Correct number AND correct position.
        */

        if(
            guess[i]===
            secret[i]
        ){

            exact++;

        }

        /*
           Because every digit is unique,
           includes() is sufficient.
        */

        if(
            secret.includes(
                guess[i]
            )
        ){

            totalCommon++;

        }

    }

    const misplaced=
        totalCommon-
        exact;

    const absent=
        CODE_LENGTH-
        exact-
        misplaced;

    return{

        exact,
        misplaced,
        absent

    };

}

function buildSimpleClueText(
    feedback
){

    if(
        feedback.exact===
        0
    ){

        return(
            "None of the numbers are in the correct positions. " +
            "All five numbers are in the wrong positions."
        );

    }

    if(
        feedback.exact===
        1
    ){

        return(
            "One number is in the correct position. " +
            "The other four numbers are in the wrong positions."
        );

    }

    if(
        feedback.exact===
        2
    ){

        return(
            "Two numbers are in the correct positions. " +
            "The other three numbers are in the wrong positions."
        );

    }

    if(
        feedback.exact===
        3
    ){

        return(
            "Three numbers are in the correct positions. " +
            "The other two numbers are in the wrong positions."
        );

    }

    if(
        feedback.exact===
        4
    ){

        return(
            "Four numbers are in the correct positions. " +
            "One number is in the wrong position."
        );

    }

    return(
        `${feedback.exact} numbers are in the correct positions. `+
        `${feedback.misplaced} numbers are in the wrong positions.`
    );

}

function generateUniqueDigits(
    count
){

    const digits=[];

    while(
        digits.length<
        count
    ){

        const digit=
            Math.floor(
                Math.random()*
                10
            );

        if(
            !digits.includes(
                digit
            )
        ){

            digits.push(
                digit
            );

        }

    }

    return digits;

}

function generatePermutations(
    array
){

    if(
        array.length<=1
    ){

        return[
            array
        ];

    }

    const result=[];

    array.forEach(
        function(
            value,
            index
        ){

            const remaining=
                array
                    .slice(
                        0,
                        index
                    )
                    .concat(
                        array.slice(
                            index+1
                        )
                    );

            const smaller=
                generatePermutations(
                    remaining
                );

            smaller.forEach(
                function(
                    permutation
                ){

                    result.push([
                        value,
                        ...permutation
                    ]);

                }
            );

        }
    );

    return result;

}

function shuffle(
    array
){

    for(
        let i=
            array.length-1;

        i>0;

        i--
    ){

        const j=
            Math.floor(
                Math.random()*
                (i+1)
            );

        [
            array[i],
            array[j]
        ]=[
            array[j],
            array[i]
        ];

    }

    return array;

}

function getTimestamp(
    value
){

    if(
        typeof value===
        "number"
    ){

        return value;

    }

    if(
        value&&
        typeof value.toDate===
        "function"
    ){

        return value
            .toDate()
            .getTime();

    }

    if(
        value&&
        typeof value.seconds===
        "number"
    ){

        return(
            value.seconds*
            1000
        )+
        Math.floor(
            (
                value.nanoseconds||
                0
            )/
            1000000
        );

    }

    return null;

}

function escapeHtml(
    value
){

    return String(
        value
    )
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