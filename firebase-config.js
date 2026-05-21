// firebase-config.js
const firebaseConfig = {
  apiKey: "AIzaSyAaV4iJe0s2xpCxIjwiOPJQkfijoIjD68g",
  authDomain: "the-scoring-company-64fa9.firebaseapp.com",
  projectId: "the-scoring-company-64fa9",
  storageBucket: "the-scoring-company-64fa9.firebasestorage.app",
  messagingSenderId: "57710701062",
  appId: "1:57710701062:web:18879fda753d603ac17187"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();
