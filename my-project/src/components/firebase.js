// firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBkwS2U6o9IO8Ys-tm59bILzpZ-rde5QGU",
  authDomain: "resume-e700a.firebaseapp.com",
  projectId: "resume-e700a",
  storageBucket: "resume-e700a.firebasestorage.app",
  messagingSenderId: "273120722669",
  appId: "1:273120722669:web:deed7fda2c526594ba56e4",
  measurementId: "G-VQD0KT7NK9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Initialize Analytics (optionnel, seulement en production)
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;

// Connexion aux émulateurs en développement (optionnel)
if (process.env.NODE_ENV === 'development') {
  // Décommentez ces lignes si vous utilisez les émulateurs Firebase
  // connectAuthEmulator(auth, "http://localhost:9099");
  // connectFirestoreEmulator(db, 'localhost', 8080);
}

export default app;