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
try {
    firebase.initializeApp(firebaseConfig);
    console.log('✅ Firebase initialisé avec succès');
} catch (error) {
    console.error('❌ Erreur initialisation Firebase:', error);
}

// Références aux services
const db = firebase.firestore();
const auth = firebase.auth();

// Test de connexion
db.collection('test').doc('connection').set({
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    status: 'connected'
}).then(() => {
    console.log('✅ Connexion Firestore réussie');
}).catch((error) => {
    console.error('❌ Erreur connexion Firestore:', error);
});
