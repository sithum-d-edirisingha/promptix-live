import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* 🔥 FIREBASE CONFIG (replace with yours if needed) */
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* UI ELEMENTS */
const loginBox = document.getElementById("loginBox");
const adminPanel = document.getElementById("adminPanel");
const loginError = document.getElementById("loginError");
const status = document.getElementById("status");

/* LOGIN */
document.getElementById("loginBtn").onclick = () => {
  signInWithEmailAndPassword(
    auth,
    email.value,
    password.value
  ).catch(err => {
    loginError.textContent = err.message;
  });
};

/* AUTH STATE */
onAuthStateChanged(auth, user => {
  if (user && user.email === "sithumdedirisingha@gmail.com") {
    loginBox.style.display = "none";
    adminPanel.style.display = "block";
  } else {
    adminPanel.style.display = "none";
    loginBox.style.display = "block";
  }
});

/* LOGOUT */
document.getElementById("logoutBtn").onclick = () => {
  signOut(auth);
};

/* ADD PROMPT */
document.getElementById("addPromptBtn").onclick = async () => {
  status.textContent = "Saving...";

  try {
    await addDoc(collection(db, "prompts"), {
      title: title.value.trim(),
      prompt: prompt.value.trim(),
      category: category.value.trim(),
      imageUrl: "", // optional
      likeCount: 0,
      copyCount: 0,
      createdAt: serverTimestamp()
    });

    status.textContent = "Prompt added successfully ✔";
    title.value = "";
    prompt.value = "";
    category.value = "";

  } catch (err) {
    status.textContent = err.message;
  }
};
