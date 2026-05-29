// Firebase Configuration for Giza Land
const firebaseConfig = {
  apiKey: "AIzaSyA0Rhy5VkQbpDdwMrI3cCyHoUeid9avG94",
  authDomain: "giza-land.firebaseapp.com",
  projectId: "giza-land",
  storageBucket: "giza-land.firebasestorage.app",
  messagingSenderId: "920945993130",
  appId: "1:920945993130:web:4fc1e5cb871195ea16b7d3",
  measurementId: "G-FPJ28PZMJV"
};

// Initialize Firebase if it hasn't been initialized yet
if (!window.firebase.apps.length) {
  window.firebase.initializeApp(firebaseConfig);
}

// Make globally accessible
window.auth = window.firebase.auth();
window.db   = window.firebase.firestore();
