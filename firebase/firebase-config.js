/**
 * إعداد Firebase - مشروعك chatmax-5c4e3
 * https://console.firebase.google.com
 */
const firebaseConfig = {
  apiKey: "AIzaSyB0Bfx2B8vSJtdAA2svJ-LwyYcJzQawvWw",
  authDomain: "chatmax-5c4e3.firebaseapp.com",
  projectId: "chatmax-5c4e3",
  storageBucket: "chatmax-5c4e3.firebasestorage.app",
  messagingSenderId: "444348732354",
  appId: "1:444348732354:web:8a607da1eacbe065737c5b"
};

if (typeof firebase !== 'undefined') {
  firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore();
  const auth = firebase.auth();
}
