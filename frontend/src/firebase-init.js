const firebaseConfig =
  window.EDUKIDS_FIREBASE_CONFIG ||
  window.edukidsFirebaseConfig ||
  window.firebaseConfig ||
  window.FIREBASE_CONFIG || {
    apiKey: "AIzaSyAh8Z4XViwotv4qqmqAdZvUi5367oyy6GI",
    authDomain: "edukids2-9d610.firebaseapp.com",
    projectId: "edukids2-9d610",
    storageBucket: "edukids2-9d610.firebasestorage.app",
    messagingSenderId: "677877400441",
    appId: "1:677877400441:web:ae1d355163ab7934f665a8",
    measurementId: "G-5TPKSY2ZPH",
  };

window.EDUKIDS_FIREBASE_CONFIG = firebaseConfig;

if (window.firebase && !window.firebase.apps?.length) {
  window.firebase.initializeApp(firebaseConfig);
}

if (window.firebase?.app) {
  window.EduKidsFirebaseApp = window.firebase.app();
  console.log("Firebase Project:", firebaseConfig.projectId);
}
