// firebase-config.js - Version corrigée avec Firebase v9+
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';

const firebaseConfig = {
  apiKey: "AIzaSyCbzW8zQkUPH4JY9Qc-DAboH2XER_IJQjI",
  authDomain: "luna-gestion.firebaseapp.com",
  projectId: "luna-gestion",
  storageBucket: "luna-gestion.firebasestorage.app",
  messagingSenderId: "5549836438",
  appId: "1:5549836438:web:be38e0d9a3a9b458635ab7"
};

// Initialiser Firebase
let app, db, auth;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  console.log('✅ Firebase initialisé avec succès');
} catch (error) {
  console.error('❌ Erreur initialisation Firebase:', error);
}

// Test de connexion
async function testConnection() {
  try {
    await db.collection('test').doc('connection').set({
      timestamp: new Date(),
      status: 'connected',
      deviceId: localStorage.getItem('lunagestio_device_id')
    });
    console.log('✅ Connexion Firestore réussie');
  } catch (error) {
    console.error('❌ Erreur connexion Firestore:', error);
  }
}

testConnection();

export { db, auth };
