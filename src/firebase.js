import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAY2sQVTQZ5o9BLzb3CTnagqiICVtP6jDY",
  authDomain: "family-cookbook-7e949.firebaseapp.com",
  projectId: "family-cookbook-7e949",
  storageBucket: "family-cookbook-7e949.firebasestorage.app",
  messagingSenderId: "925126394771",
  appId: "1:925126394771:web:21c4f7f86265d119361e66",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export { collection, doc, setDoc, deleteDoc, onSnapshot };
