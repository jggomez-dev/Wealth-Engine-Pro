/// <reference types="vite/client" />
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyAiZtchP4dAaRbRe5x_WTTUXXCPTGlpMYE",
  authDomain: "wealth-engine-g.firebaseapp.com",
  projectId: "wealth-engine-g",
  storageBucket: "wealth-engine-g.firebasestorage.app",
  messagingSenderId: "1022727225590",
  appId: "1:1022727225590:web:07e0e0b2897bdfa194ecd7",
  measurementId: "G-KTVX8GFC80"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
