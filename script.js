/**
 * Skills Practice - Project Logic v4.3
 * Added: Admin Delete functionality (Firestore + Storage cleanup)
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

// --- Firebase Config ---
const firebaseConfig = {
    apiKey: "AIzaSyCte4D5lS6eHAZbNvcKHY0I07yr2llh-HI",
    authDomain: "webpages-4aacb.firebaseapp.com",
    projectId: "webpages-4aacb",
    storageBucket: "webpages-4aacb.firebasestorage.app",
    messagingSenderId: "421209892208",
    appId: "1:421209892208:web:53e3ac2d7976975f579bb5"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const appId = 'skills-practice-v2';

// --- Global State ---
let isAuthReady = false;
let activeSchoolId = null;
let activeTeacherName = "";
let activeTZ = null;

// Helper: Safe ID generation
const getSafeId = (str) => str ? Array.from(str).map(c => c.charCodeAt(0).toString(16).padStart(4, '0')).join('') : "id_" + Date.now();

// --- Admin Logic ---

window.loginAdmin = () => {
    const pass = document.getElementById('adminPassInput').value;
    if (pass === "1234") {
        document.getElementById('adminAuthArea').classList.add('hidden');
        document.getElementById('adminDashboard').classList.remove('hidden');
        window.loadAdminTasks();
    } else {
        alert("סיסמה שגויה");
    }
};

window.adminAddTask = async () => {
    const title = document.getElementById('taskTitleInput').value.trim();
    const icon = document.getElementById('taskIconInput').value.trim() || '📄';
    const fileInput = document.getElementById('taskFileObject');
    const driveUrl = document.getElementById('taskDriveUrl').value.trim();
    const loader = document.getElementById('uploadLoader');
    const btn = document.getElementById('addTaskBtn');

    if (!title) return alert("חובה להזין שם למטלה");
    if (!fileInput.files[0] && !driveUrl) return alert("אנא העלה קובץ או הדבק קישור ל-Drive");

    if (loader) loader.classList.remove('hidden');
    if (btn) btn.disabled = true;

    try {
        let fileUrl = "";
        let type = "link";
        let storagePath = "";

        if (fileInput.files[0]) {
            const file = fileInput.files[0];
            storagePath = `artifacts/${appId}/tasks/${Date.now()}_${file.name}`;
            const storageRef = ref(storage, storagePath);
            
            const snapshot = await uploadBytes(storageRef, file);
            fileUrl = await getDownloadURL(snapshot.ref);
            type = file.name.toLowerCase().endsWith('.pdf') ? "pdf" : "html";
        } else {
            fileUrl = driveUrl;
            type = "drive";
        }

        const taskId = getSafeId(title);
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tasks', taskId), {
            title,
            fileUrl,
            type,
            icon,
            storagePath, 
            createdAt: new Date().toISOString()
        });

        alert("המטלה עלתה לשרת בהצלחה!");
        
        // Reset form
        document.getElementById('taskTitleInput').value = "";
        document.getElementById('taskIconInput').value = "";
        document.getElementById('taskDriveUrl').value = "";
        fileInput.value = "";

    } catch (e) {
        alert("שגיאה בהעלאה: " + e.message);
    } finally {
        if (loader) loader.classList.add('hidden');
        if (btn) btn.disabled = false;
    }
};

window.loadAdminTasks = () => {
    const list = document.getElementById('adminTaskList');
    if (!list) return;

    onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'tasks'), (snap) => {
        list.innerHTML = '';
        if (snap.empty) {
            list.innerHTML = '<p class="text-gray-500 text-center text-sm italic">אין מטלות פעילות במערכת</p>';
            return;
        }

        snap.forEach(d => {
            const task = d.data();
            const div = document.createElement('div');
            div.className = "bg-slate-800/50 p-4 rounded-xl flex justify-between items-center border border-slate-700 hover:bg-slate-800 transition-all";
            div.innerHTML = `
                <div class="flex items-center gap-3">
                    <span class="text-2xl">${task.icon}</span>
                    <div class="text-right">
                        <p class="text-sm font-bold text-white">${task.title}</p>
                        <p class="text-[10px] text-gray-500 uppercase">${task.type}</p>
                    </div>
                </div>
                <button onclick="window.adminDeleteTask('${d.id}', '${task.storagePath || ''}')" class="bg-red-900/20 text-red-500 hover:bg-red-600 hover:text-white px-3 py-1 rounded-lg text-xs font-bold transition-all border border-red-500/30">
                    מחק 🗑️
                </button>
            `;
            list.appendChild(div);
        });
    });
};

window.adminDeleteTask = async (id, storagePath) => {
    if (!confirm("האם אתה בטוח שברצונך למחוק מטלה זו? פעולה זו תסיר את המטלה מכל המורים והתלמידים.")) return;

    try {
        // 1. Delete document from Firestore
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tasks', id));

        // 2. If there's a file in Storage, delete it too
        if (storagePath && storagePath !== "") {
            const fileRef = ref(storage, storagePath);
            await deleteObject(fileRef).catch(e => console.log("Storage file already gone or error:", e));
        }

        alert("המטלה נמחקה בהצלחה.");
    } catch (e) {
        alert("שגיאה במחיקת המטלה: " + e.message);
    }
};

// --- Shared Init ---
onAuthStateChanged(auth, (user) => { isAuthReady = !!user; });
(async () => { 
    try { await signInAnonymously(auth); } catch(e) { console.error("Firebase Initialization Failed", e); }
})();

// --- Re-bind common functions for HTML ---
window.togglePass = (id) => { const el = document.getElementById(id); if(el) el.type = el.type === 'password' ? 'text' : 'password'; };
