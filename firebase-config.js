// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCrIM5bHfNG9FB6v9GTlQiMKQWPUXnifgY",
    authDomain: "india-rain-map.firebaseapp.com",
    databaseURL: "https://india-rain-map-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "india-rain-map",
    storageBucket: "india-rain-map.firebasestorage.app",
    messagingSenderId: "1060331408507",
    appId: "1:1060331408507:web:03e6bc6c0b73d1ea82a6de",
    measurementId: "G-3RCW9KYBY8"
  };

// Initialize Firebase
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getDatabase, ref, onValue, set } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js';

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { db, ref, onValue, set }; 