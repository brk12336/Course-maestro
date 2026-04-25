import { initializeApp }                              from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot,
         doc, updateDoc, deleteDoc, query, orderBy,
         serverTimestamp }                             from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyB9sm8OtHszBSrVKsDN5Fgr2DR1FR9jOJI",
  authDomain:        "restomaestro-d0bdd.firebaseapp.com",
  projectId:         "restomaestro-d0bdd",
  storageBucket:     "restomaestro-d0bdd.firebasestorage.app",
  messagingSenderId: "387774765663",
  appId:             "1:387774765663:web:c59a4c2ea686d66083d9ea"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp };
