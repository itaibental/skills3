/**
 * Skills Practice - Project Logic
 * גרסה 3.3: תמיכה במטלות HTML מתיקיית skills
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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

// --- רשימת המטלות מתיקיית skills ---
// תוכל להוסיף כאן מטלות חדשות בכל פעם שתוסיף קובץ HTML לתיקיית skills
const availableSkills = [
    { id: 'composition', title: 'תרגול קומפוזיציה וזוויות', file: 'composition.html', icon: '📸' },
    { id: 'lighting', title: 'משימת תאורה מעשית', file: 'lighting.html', icon: '💡' },
    { id: 'sound', title: 'בוחן סאונד וציוד', file: 'sound.html', icon: '🎤' }
];

let isAuthReady = false;
let activeSchoolId = null; 
let activeTeacherName = ""; 
let teacherMode = 'login'; 
let myClasses = [];
let activeTZ = null;

const getSafeId = (str) => str ? Array.from(str).map(c => c.charCodeAt(0).toString(16).padStart(4, '0')).join('') : "";

const showMsg = (txt, isError = false) => {
    const t = document.createElement('div');
    t.className = `fixed top-8 left-1/2 -translate-x-1/2 ${isError ? 'bg-red-600' : 'bg-blue-600'} text-white px-8 py-4 rounded-xl z-[200] font-bold shadow-2xl transition-all text-center border-2 border-white/20`;
    t.innerText = txt;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 4000);
};

const showSection = (id) => {
    ['landingScreen', 'studentWorkspace', 'teacherDashboard'].forEach(s => {
        const el = document.getElementById(s);
        if (el) el.classList.add('hidden-section');
    });
    const target = document.getElementById(id);
    if (target) target.classList.remove('hidden-section');
};

// --- פונקציה לפתיחת מטלות ה-HTML ---
window.openSkillFile = (fileName) => {
    // פתיחת הקובץ מתיקיית skills בטאב חדש
    window.open(`skills/${fileName}`, '_blank');
};

// רינדור רשימת המטלות בממשק התלמיד
window.renderSkillTasks = () => {
    const container = document.getElementById('skillsTasksContainer');
    if (!container) return;
    
    container.innerHTML = '';
    availableSkills.forEach(task => {
        const div = document.createElement('div');
        div.className = "glass p-6 rounded-2xl flex justify-between items-center hover:bg-white/5 transition border-r-4 border-green-500";
        div.innerHTML = `
            <div>
                <span class="text-2xl ml-2">${task.icon}</span>
                <span class="text-white font-bold">${task.title}</span>
            </div>
            <button onclick="window.openSkillFile('${task.file}')" class="bg-green-600/20 text-green-400 px-6 py-2 rounded-xl text-sm font-black border border-green-600/30 hover:bg-green-600 hover:text-white transition">פתח מטלה 🚀</button>
        `;
        container.appendChild(div);
    });
};

// --- Teacher UI Logic ---
window.switchTeacherMode = (mode) => {
    teacherMode = mode;
    const tabLogin = document.getElementById('tabLogin');
    const tabSignup = document.getElementById('tabSignup');
    const newFields = document.getElementById('newTeacherFields');
    const mainBtn = document.getElementById('mainTeacherBtn');
    const loginSelection = document.getElementById('teacherSelectContainer');

    if (mode === 'login') {
        tabLogin.className = "flex-1 py-3 text-white font-bold border-b-2 border-blue-500 transition";
        tabSignup.className = "flex-1 py-3 text-gray-500 font-bold border-b-2 border-transparent transition";
        newFields.classList.add('hidden');
        mainBtn.innerText = "כניסה למערכת";
    } else {
        tabSignup.className = "flex-1 py-3 text-white font-bold border-b-2 border-blue-500 transition";
        tabLogin.className = "flex-1 py-3 text-gray-500 font-bold border-b-2 border-transparent transition";
        newFields.classList.remove('hidden');
        if(loginSelection) loginSelection.classList.add('hidden');
        mainBtn.innerText = "רישום בית ספר חדש";
    }
};

window.checkTeacherGate = () => {
    if (document.getElementById('globalTeacherPass').value === "1234") {
        document.getElementById('teacherGate').classList.add('hidden');
        document.getElementById('teacherAuthFields').classList.remove('hidden');
        window.initLoginListeners();
    } else showMsg("סיסמה שגויה", true);
};

window.initLoginListeners = () => {
    const schoolInput = document.getElementById('teacherUser');
    if (!schoolInput) return;
    schoolInput.onblur = async () => {
        if (teacherMode !== 'login') return;
        const schoolName = schoolInput.value.trim();
        if (!schoolName) return;
        const schoolId = getSafeId(schoolName);
        try {
            const snap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'school_profiles', schoolId));
            const teacherSelect = document.getElementById('teacherIndexSelect');
            if (snap.exists() && teacherSelect) {
                const names = snap.data().teacherNames || [];
                teacherSelect.innerHTML = '<option value="">-- בחר את שמך --</option>';
                names.forEach(name => {
                    const opt = document.createElement('option');
                    opt.value = name; opt.innerText = name;
                    teacherSelect.appendChild(opt);
                });
                document.getElementById('teacherSelectContainer')?.classList.remove('hidden');
            }
        } catch(e) { console.error("Error fetching school", e); }
    };
};

window.loginTeacher = async () => {
    const schoolName = document.getElementById('teacherUser').value.trim();
    const pass = document.getElementById('teacherPass').value;
    if (!schoolName || !pass) return showMsg("חסרים פרטים");
    const schoolId = getSafeId(schoolName);
    const schoolRef = doc(db, 'artifacts', appId, 'public', 'data', 'school_profiles', schoolId);
    
    try {
        const snap = await getDoc(schoolRef);
        if (teacherMode === 'login') {
            if (!snap.exists()) return showMsg("בית הספר לא רשום", true);
            if (snap.data().password !== pass) return showMsg("סיסמה שגויה", true);
            activeTeacherName = document.getElementById('teacherIndexSelect').value;
            if(!activeTeacherName) return showMsg("בחר מורה", true);
        } else {
            const deptHead = document.getElementById('deptHead').value.trim();
            const namesRaw = document.getElementById('teacherNamesInput').value;
            const teacherNames = namesRaw.split('\n').map(n => n.trim()).filter(n => n.length > 0);
            if (!deptHead || teacherNames.length === 0) return showMsg("מלא שדות חובה", true);
            await setDoc(schoolRef, { schoolName, password: pass, departmentHead: deptHead, teacherNames });
            activeTeacherName = teacherNames[0];
        }
        activeSchoolId = schoolId;
        const tKey = `${activeSchoolId}_${getSafeId(activeTeacherName)}`;
        const tRef = doc(db, 'artifacts', appId, 'public', 'data', 'teacher_private_data', tKey);
        const tSnap = await getDoc(tRef);
        myClasses = tSnap.exists() ? tSnap.data().classes || [] : [];
        if(!tSnap.exists()) await setDoc(tRef, { classes: [] });
        
        const finalData = (await getDoc(schoolRef)).data();
        document.getElementById('teacherProfileInfo').innerText = `${finalData.schoolName} | ${activeTeacherName}`;
        window.updateClassUI();
        window.closeLoginModals();
        window.loadTeacherRoster();
        showSection('teacherDashboard');
    } catch (e) { showMsg("שגיאת שרת", true); }
};

window.loadTeacherRoster = async () => {
    const table = document.getElementById('rosterTableBody');
    const selClass = document.getElementById('activeClassSelector').value;
    const tScope = `${activeSchoolId}_${getSafeId(activeTeacherName)}`;
    table.innerHTML = '<tr><td colspan="4">טוען...</td></tr>';
    const snap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'access_list'));
    table.innerHTML = '';
    let count = 0;
    snap.forEach(d => {
        const data = d.data();
        if (data.teacherScopeId === tScope && (selClass === 'all' || data.className === selClass)) {
            count++;
            table.innerHTML += `<tr class="border-b border-slate-800">
                <td class="p-3">${data.studentName || 'ללא שם'}</td>
                <td class="p-3 font-mono">${data.tz}</td>
                <td class="p-3 text-blue-400">${data.className}</td>
                <td class="p-3 text-center"><button onclick="window.viewStudentWork('${data.tz}')" class="text-blue-500">צפה 👁️</button></td>
            </tr>`;
        }
    });
    document.getElementById('rosterCount').innerText = count;
};

// --- Student Logic ---
window.loginStudent = async () => {
    const tz = document.getElementById('studentTZ').value.trim();
    const snap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'access_list', tz));
    if (snap.exists()) {
        activeTZ = tz;
        const data = snap.data();
        document.getElementById('welcomeStudent').innerText = `שלום, ${data.studentName || tz} (${data.className})`;
        window.renderSkillTasks(); // טעינת המטלות הדיגיטליות
        window.closeLoginModals();
        showSection('studentWorkspace');
    } else showMsg("לא רשום", true);
};

// --- Boilerplate shared ---
window.togglePass = (id) => { const el = document.getElementById(id); if(el) el.type = el.type === 'password' ? 'text' : 'password'; };
window.closeLoginModals = () => { ['studentLoginModal', 'teacherLoginModal'].forEach(id => document.getElementById(id)?.classList.add('hidden')); };
window.openLoginModal = (type) => {
    window.closeLoginModals();
    document.getElementById(type === 'student' ? 'studentLoginModal' : 'teacherLoginModal')?.classList.remove('hidden');
    if(type === 'teacher') {
        document.getElementById('teacherGate').classList.remove('hidden');
        document.getElementById('teacherAuthFields').classList.add('hidden');
        window.switchTeacherMode('login');
    }
};
window.updateClassUI = () => {
    const s = document.getElementById('activeClassSelector');
    s.innerHTML = '<option value="all">כל התלמידים</option>';
    myClasses.forEach(c => { const o = document.createElement('option'); o.value = c; o.innerText = c; s.appendChild(o); });
};
window.addNewClass = async () => {
    const n = document.getElementById('newClassNameInput').value.trim();
    if(!n || myClasses.includes(n)) return;
    myClasses.push(n);
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'teacher_private_data', `${activeSchoolId}_${getSafeId(activeTeacherName)}`), { classes: myClasses }, { merge: true });
    window.updateClassUI();
    document.getElementById('newClassNameInput').value = "";
};

window.openProjectModal = async (key, title) => {
    window.activeTaskKey = key;
    document.getElementById('modalTitle').innerText = title;
    document.getElementById('modalOverlay').classList.remove('hidden');
    const input = document.getElementById('workInput');
    input.value = "טוען...";
    const snap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'student_work', `${activeTZ}_${key}`));
    input.value = snap.exists() ? snap.data().content : "";
};

window.saveWork = async () => {
    const content = document.getElementById('workInput').value;
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'student_work', `${activeTZ}_${window.activeTaskKey}`), { content, updatedAt: new Date().toISOString() });
    const s = document.getElementById('saveStatus');
    s.style.opacity = '1'; setTimeout(() => s.style.opacity = '0', 2000);
};

window.closeModal = () => document.getElementById('modalOverlay').classList.add('hidden');
window.closeViewModal = () => document.getElementById('teacherViewModal').classList.add('hidden');

onAuthStateChanged(auth, (user) => { isAuthReady = !!user; });
(async () => { await signInAnonymously(auth); })();
