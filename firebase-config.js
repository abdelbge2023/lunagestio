// firebase-config.js
const firebaseConfig = {
  apiKey: "AIzaSyCbzW8zQkUPH4JY9Qc-DAboH2XER_IJQjI",
  authDomain: "luna-gestion.firebaseapp.com",
  projectId: "luna-gestion",
  storageBucket: "luna-gestion.firebasestorage.app",
  messagingSenderId: "5549836438",
  appId: "1:5549836438:web:be38e0d9a3a9b458635ab7"
};

// Initialiser Firebase
firebase.initializeApp(firebaseConfig);

// Références aux services
const db = firebase.firestore();
const auth = firebase.auth();
