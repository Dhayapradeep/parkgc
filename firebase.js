// Firebase App
import { initializeApp } from
    "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";

// Firebase Realtime Database
import { getDatabase } from
    "https://www.gstatic.com/firebasejs/12.17.1/firebase-database.js";


const firebaseConfig = {

    apiKey: "AIzaSyB4k-5T-SE7FKOMEW4wNAyALkdOQ3X93I8",

    authDomain: "abusement-park.firebaseapp.com",

    databaseURL:
        "https://abusement-park-default-rtdb.asia-southeast1.firebasedatabase.app",

    projectId: "abusement-park",

    storageBucket:
        "abusement-park.firebasestorage.app",

    messagingSenderId: "173380786273",

    appId:
        "1:173380786273:web:43793a3d56696296c17220"

};


// Initialize Firebase
const app =
    initializeApp(firebaseConfig);


// Initialize Realtime Database
const database =
    getDatabase(app);


// Export
export {
    app,
    database
};