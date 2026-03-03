/**
 * Skills Practice - Project Logic
 * גרסה 3.8: תמיכה ב-student.html וסנכרון מטלות מתיקיית skills ב-GitHub.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- הגדרות הפרויקט ---
const firebaseConfig = {
    apiKey: "AIzaSyCte4D5lS6eHAZbNvcKHY0I07yr2llh-HI",
    authDomain: "webpages-4aacb.firebaseapp.com",
    projectId: "webpages-4aacb",
    storageBucket: "webpages-4aacb.firebasestorage.app",
    messagingSenderId: "421209892208",
    appId: "1:421209892208:web:53e3ac2d7976975f579bb5"
};

// הגדרות GitHub - שנה את אלו לפרטי המאגר שלך
const GITHUB_USER = "YOUR_USERNAME"; // שם המשתמש שלך ב-GitHub
const GITHUB_REPO = "YOUR_REPO_NAME"; // שם המאגר (Repository)

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'skills-practice-v2';

// --- State ---
let isAuthReady = false;
let activeTZ = null;
let activeSchoolId = null;
let activeTeacherName = "";
let teacherMode = 'login';
let myClasses = [];
let schoolTeachers = [];

// --- Helpers ---
const getSafeId = (str) => str ? Array.from(str).map(c => c.charCodeAt(0).toString(16).padStart(4, '0')).join('') : "";

const showMsg = (txt, isError = false) => {
    const t = document.createElement('div');
    t.className = `fixed top-8 left-1/2 -translate-x-1/2 ${isError ? 'bg-red-600' : 'bg-blue-600'} text-white px-8 py-4 rounded-xl z-[200] font-bold shadow-2xl transition-all text-center border-2 border-white/20`;
    t.innerText = txt;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 4000);
};

const waitForAuth = async () => {
    if (isAuthReady) return true;
    for (let i = 0; i < 20; i++) {
        if (isAuthReady) return true;
        await new Promise(r => setTimeout(r, 250));
    }
    return isAuthReady;
};

// --- GitHub Integration: Fetch Tasks ---

window.fetchGitHubTasks = async () => {
    const container = document.getElementById('skillsTasksContainer');
    if (!container) return;

    try {
        // שואב את רשימת הקבצים מתיקיית skills דרך ה-API של GitHub
        // שים לב: אם המאגר פרטי, תצטרך להשתמש ב-Token, אבל עבור מאגר ציבורי זה יעבוד ללא הזדהות.
        const response = await fetch(`https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/skills`);
        if (!response.ok) throw new Error("GitHub folder not found");
        
        const files = await response.json();
        const htmlFiles = files.filter(f => f.name.endsWith('.html'));

        container.innerHTML = '';
        if (htmlFiles.length === 0) {
            container.innerHTML = '<p class="col-span-full text-center text-gray-500">לא נמצאו מטלות בתיקייה.</p>';
            return;
        }

        htmlFiles.forEach(file => {
            const taskName = file.name.replace('.html', '').replace(/_/g, ' ');
            const div = document.createElement('div');
            div.className = "glass p-6 rounded-2xl flex justify-between items-center hover:bg-white/5 transition border-r-4 border-green-500";
            div.innerHTML = `
                <div class="text-right">
                    <h4 class="text-white font-bold text-lg">${taskName}</h4>
                    <p class="text-xs text-gray-500">קובץ: ${file.name}</p>
                </div>
                <button onclick="window.openTaskModal('${file.download_url}', '${taskName}')" class="bg-green-600 text-black px-6 py-2 rounded-xl text-sm font-black hover:bg-green-500 transition">בצע מטלה 🚀</button>
            `;
            container.appendChild(div);
        });
    } catch (e) {
        console.error("GitHub Fetch Error:", e);
        container.innerHTML = '<p class="col-span-full text-center text-red-400">שגיאה בחיבור ל-GitHub. וודא שהתיקייה skills קיימת.</p>';
    }
};

// --- Task Execution & Result Sync ---

window.openTaskModal = (url, title) => {
    const modal = document.getElementById('taskIframeModal');
    const iframe = document.getElementById('taskIframe');
    const titleEl = document.getElementById('currentTaskTitle');
    
    if (modal && iframe) {
        titleEl.innerText = title;
        // מעביר את תעודת הזהות כפרמטר למטלה למקרה שהיא צריכה לדעת מי התלמיד
        iframe.src = `${url}?tz=${activeTZ}`;
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
};

window.closeTaskModal = () => {
    const modal = document.getElementById('taskIframeModal');
    if (modal) modal.classList.add('hidden');
};

// האזנה להודעות מה-Iframe (כדי לקבל תוצאות מהמטלה)
window.addEventListener('message', async (event) => {
    // מצפה לאובייקט: { type: 'SUBMIT_TASK', payload: { data: ... } }
    if (event.data.type === 'SUBMIT_TASK' && activeTZ) {
        const result = event.data.payload;
        try {
            const taskTitle = document.getElementById('currentTaskTitle').innerText;
            const resRef = doc(db, 'artifacts', appId, 'public', 'data', 'student_work', `${activeTZ}_${getSafeId(taskTitle)}`);
            await setDoc(resRef, {
                content: JSON.stringify(result),
                updatedAt: new Date().toISOString(),
                status: 'submitted'
            }, { merge: true });
            
            showMsg("המטלה הוגשה בהצלחה והועברה למורה!");
            window.closeTaskModal();
        } catch (e) { showMsg("שגיאה בשמירת תוצאות המטלה", true); }
    }
});

// --- Student Login Logic ---

window.loginStudent = async () => {
    const ready = await waitForAuth();
    if (!ready) return showMsg("מתחבר לשרת...", true);

    const tzInput = document.getElementById('studentTZ');
    const tz = tzInput ? tzInput.value.trim() : "";
    if(!tz) return showMsg("נא להזין תעודת זהות", true);
    
    try {
        const snap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'access_list', tz));
        if (snap.exists()) {
            const data = snap.data();
            activeTZ = tz;
            
            // עדכון ממשק
            const loginArea = document.getElementById('studentLoginArea');
            const workspace = document.getElementById('studentWorkspace');
            const welcome = document.getElementById('welcomeStudent');
            const classInfo = document.getElementById('studentClassInfo');

            if(loginArea) loginArea.classList.add('hidden');
            if(workspace) workspace.classList.remove('hidden');
            if(welcome) welcome.innerText = `שלום, ${data.studentName || tz}`;
            if(classInfo) classInfo.innerText = `כיתה: ${data.className}`;

            // טעינת מטלות מ-GitHub
            window.fetchGitHubTasks();
            
            // בדיקת משוב מהמורה
            window.checkStudentFeedback();
        } else {
            showMsg("תעודת הזהות אינה רשומה במערכת.", true);
        }
    } catch(e) { showMsg("שגיאת תקשורת", true); }
};

window.checkStudentFeedback = async () => {
    if (!activeTZ) return;
    const snap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'student_feedback', activeTZ));
    if (snap.exists() && snap.data().text) {
        const box = document.getElementById('studentFeedbackBox');
        const txt = document.getElementById('feedbackText');
        if(box && txt) {
            txt.innerText = snap.data().text;
            box.classList.remove('hidden');
        }
    }
};

// --- (מכאן והלאה: לוגיקת המורה הקיימת בגרסאות הקודמות ללא שינוי מהותי) ---
// (switchTeacherMode, loginTeacher, loadTeacherRoster, etc...)

// ... (שאר הפונקציות מהגרסה הקודמת נשארות כאן כדי שקובץ ה-JS יהיה מאוחד)

window.togglePass = (id) => { const el = document.getElementById(id); if(el) el.type = el.type === 'password' ? 'text' : 'password'; };

// Initial Auth Initialization
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    isAuthReady = true;
});

(async () => { 
    try { await signInAnonymously(auth); } catch(e) { console.error("Auth failed", e); }
})();
