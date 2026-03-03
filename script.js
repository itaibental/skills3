/**
 * Skills Practice - Project Logic v4.0
 * Fixed: Explicit window binding for GitHub Pages compatibility
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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
const appId = 'skills-practice-v2';

// --- State ---
let isAuthReady = false;
let activeSchoolId = null;
let activeTeacherName = "";
let activeTZ = null;
let teacherMode = 'login';
let myClasses = [];

// --- Helpers ---
const getSafeId = (str) => str ? Array.from(str).map(c => c.charCodeAt(0).toString(16).padStart(4, '0')).join('') : "";

const showMsg = (txt, isError = false) => {
    const t = document.createElement('div');
    t.className = `fixed top-8 left-1/2 -translate-x-1/2 ${isError ? 'bg-red-600' : 'bg-blue-600'} text-white px-8 py-4 rounded-xl z-[999] font-bold shadow-2xl transition-all text-center border-2 border-white/20`;
    t.innerText = txt;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 4000);
};

// --- Shared Window Functions (Fixed Binding) ---

window.openLoginModal = (type) => {
    if (type === 'student') {
        // Redirect to student page if on index.html
        if (!window.location.href.includes('student.html')) {
            window.location.href = 'student.html';
        }
    } else {
        const modal = document.getElementById('teacherLoginModal');
        if (modal) {
            modal.classList.remove('hidden');
            document.getElementById('teacherGate').classList.remove('hidden');
            document.getElementById('teacherAuthFields').classList.add('hidden');
        }
    }
};

window.closeLoginModals = () => {
    const tModal = document.getElementById('teacherLoginModal');
    if (tModal) tModal.classList.add('hidden');
};

window.togglePass = (id) => {
    const el = document.getElementById(id);
    if (el) el.type = el.type === 'password' ? 'text' : 'password';
};

// --- Teacher Logic ---

window.checkTeacherGate = () => {
    const pass = document.getElementById('globalTeacherPass').value;
    if (pass === "1234") {
        document.getElementById('teacherGate').classList.add('hidden');
        document.getElementById('teacherAuthFields').classList.remove('hidden');
        window.initTeacherAuthListeners();
    } else showMsg("סיסמת גישה שגויה", true);
};

window.initTeacherAuthListeners = () => {
    const schoolInput = document.getElementById('teacherUser');
    if (!schoolInput) return;
    schoolInput.onblur = async () => {
        if (teacherMode !== 'login') return;
        const schoolId = getSafeId(schoolInput.value.trim());
        if (!schoolId) return;
        const snap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'school_profiles', schoolId));
        if (snap.exists()) {
            const names = snap.data().teacherNames || [];
            const select = document.getElementById('teacherIndexSelect');
            select.innerHTML = names.map(n => `<option value="${n}">${n}</option>`).join('');
            document.getElementById('teacherLoginSelectContainer').classList.remove('hidden');
        }
    };
};

window.switchTeacherMode = (mode) => {
    teacherMode = mode;
    const tabLogin = document.getElementById('tabLogin');
    const tabSignup = document.getElementById('tabSignup');
    const newFields = document.getElementById('newTeacherFields');
    const loginSelection = document.getElementById('teacherLoginSelectContainer');

    if (mode === 'login') {
        tabLogin.className = "flex-1 py-3 text-white font-bold border-b-2 border-blue-500 transition";
        tabSignup.className = "flex-1 py-3 text-gray-500 font-bold border-b-2 border-transparent transition";
        newFields.classList.add('hidden');
    } else {
        tabSignup.className = "flex-1 py-3 text-white font-bold border-b-2 border-blue-500 transition";
        tabLogin.className = "flex-1 py-3 text-gray-500 font-bold border-b-2 border-transparent transition";
        newFields.classList.remove('hidden');
        if (loginSelection) loginSelection.classList.add('hidden');
    }
};

window.loginTeacher = async () => {
    const schoolName = document.getElementById('teacherUser').value.trim();
    const pass = document.getElementById('teacherPass').value;
    const schoolId = getSafeId(schoolName);
    const schoolRef = doc(db, 'artifacts', appId, 'public', 'data', 'school_profiles', schoolId);

    try {
        const snap = await getDoc(schoolRef);
        if (teacherMode === 'login') {
            if (!snap.exists() || snap.data().password !== pass) return showMsg("פרטי גישה שגויים", true);
            activeTeacherName = document.getElementById('teacherIndexSelect').value;
        } else {
            const names = document.getElementById('teacherNamesInput').value.split('\n').map(n => n.trim()).filter(n => n);
            const dept = document.getElementById('deptHead').value.trim();
            if (!dept || names.length === 0) return showMsg("מלא שדות חובה", true);
            await setDoc(schoolRef, { schoolName, password: pass, departmentHead: dept, teacherNames: names });
            activeTeacherName = names[0];
        }
        activeSchoolId = schoolId;
        window.closeLoginModals();
        window.initTeacherDashboard(schoolName);
    } catch (e) { showMsg("שגיאת חיבור", true); }
};

window.initTeacherDashboard = async (schoolName) => {
    const tKey = `${activeSchoolId}_${getSafeId(activeTeacherName)}`;
    const tRef = doc(db, 'artifacts', appId, 'public', 'data', 'teacher_private_data', tKey);
    const tSnap = await getDoc(tRef);
    myClasses = tSnap.exists() ? tSnap.data().classes || [] : [];
    
    document.getElementById('teacherProfileInfo').innerText = `${schoolName} | מורה: ${activeTeacherName}`;
    document.getElementById('landingScreen').classList.add('hidden-section');
    document.getElementById('teacherDashboard').classList.remove('hidden-section');
    
    window.updateClassUI();
    window.loadTeacherRoster();
};

window.updateClassUI = () => {
    const s = document.getElementById('activeClassSelector');
    if (s) {
        s.innerHTML = '<option value="all">כל התלמידים שלי</option>' + 
                      myClasses.map(c => `<option value="${c}">${c}</option>`).join('');
    }
};

window.loadTeacherRoster = async () => {
    const table = document.getElementById('rosterTableBody');
    if (!table) return;
    const selectedClass = document.getElementById('activeClassSelector').value;
    const tScope = `${activeSchoolId}_${getSafeId(activeTeacherName)}`;
    
    table.innerHTML = '<tr><td colspan="5" class="p-4 text-center">טוען רשימה...</td></tr>';
    const snap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'access_list'));
    table.innerHTML = '';
    
    snap.forEach(d => {
        const data = d.data();
        if (data.teacherScopeId === tScope && (selectedClass === 'all' || data.className === selectedClass)) {
            table.innerHTML += `<tr class="border-b border-slate-800">
                <td class="p-4">${data.studentName}</td>
                <td class="p-4 font-mono">${data.tz}</td>
                <td class="p-4 text-blue-400">${data.className}</td>
                <td class="p-4 text-center"><button onclick="window.viewStudentWork('${data.tz}')" class="text-blue-500 underline">צפה</button></td>
                <td class="p-4 text-center"><button onclick="window.deleteStudent('${data.tz}')" class="text-red-500">🗑️</button></td>
            </tr>`;
        }
    });
};

// --- Student Logic ---

window.loginStudent = async () => {
    const tz = document.getElementById('studentTZ').value.trim();
    if (!tz) return showMsg("הזן תעודת זהות", true);
    
    try {
        const snap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'access_list', tz));
        if (snap.exists()) {
            const data = snap.data();
            activeTZ = tz;
            document.getElementById('studentLoginArea').classList.add('hidden');
            document.getElementById('studentWorkspace').classList.remove('hidden');
            document.getElementById('welcomeStudent').innerText = `שלום, ${data.studentName}`;
            document.getElementById('studentClassInfo').innerText = `כיתה: ${data.className}`;
            // Here you would call fetchGitHubTasks()
        } else showMsg("תעודת זהות לא קיימת", true);
    } catch (e) { showMsg("שגיאת אימות", true); }
};

// --- Initialization ---
onAuthStateChanged(auth, (user) => {
    isAuthReady = !!user;
    console.log("Firebase Auth Ready:", isAuthReady);
});

(async () => {
    try { await signInAnonymously(auth); } catch (e) { console.error(e); }
})();
