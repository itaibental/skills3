/**
 * Skills Practice - Central Logic v4.6
 * קובץ ה-JavaScript המרכזי המנהל את כל הפורטלים בתיקיית ה-Root.
 * מוודא סנכרון מלא מול Firebase ו-GitHub.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Firebase Configuration ---
// השאר את השדות ריקים; המערכת תזין את המפתח בזמן ריצה
const firebaseConfig = {
    apiKey: "",
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

// --- Global State ---
let activeSchoolId = null;
let activeTeacherName = "";
let teacherMode = 'login';
let myClasses = [];

// Helper: Secure ID generation (Hebrew compatible)
const getSafeId = (str) => str ? Array.from(str).map(c => c.charCodeAt(0).toString(16).padStart(4, '0')).join('') : "id_" + Date.now();

/** ==============================
 * 🛠️ ADMIN PORTAL LOGIC
 * ============================== */

window.loginAdmin = () => {
    const input = document.getElementById('adminPassInput');
    if (input && input.value === "1234") {
        document.getElementById('adminAuthArea').classList.add('hidden');
        document.getElementById('adminDashboard').classList.remove('hidden');
        window.syncAdminTasks();
    } else alert("סיסמת מנהל שגויה");
};

window.fetchGitHubFiles = async () => {
    const user = document.getElementById('ghUser').value.trim();
    const repo = document.getElementById('ghRepo').value.trim();
    const list = document.getElementById('ghFileList');
    if (!user || !repo) return alert("אנא הזן פרטי משתמש ומאגר GitHub");

    list.innerHTML = '<p class="text-xs italic text-blue-400 p-4">מתחבר ל-GitHub API...</p>';
    try {
        const res = await fetch(`https://api.github.com/repos/${user}/${repo}/contents/skills`);
        if (!res.ok) throw new Error();
        const files = await res.json();
        list.innerHTML = '';
        files.forEach(file => {
            if (file.name.endsWith('.html') || file.name.endsWith('.pdf')) {
                const div = document.createElement('div');
                div.className = "bg-slate-800/80 p-3 rounded-xl flex justify-between items-center border border-slate-700 animate-slide-up mb-2 hover:bg-slate-800 transition-colors";
                div.innerHTML = `
                    <span class="text-xs font-mono text-white/70">${file.name}</span>
                    <button onclick="window.addGHAsTask('${file.download_url}', '${file.name}')" class="bg-green-500/10 text-green-400 font-black text-xs hover:bg-green-500 hover:text-white px-3 py-1 rounded-lg transition-all">הוסף +</button>
                `;
                list.appendChild(div);
            }
        });
    } catch (e) { 
        list.innerHTML = '<p class="text-red-400 text-xs font-bold p-4 bg-red-500/10 rounded-xl">שגיאה: תיקיית skills לא נמצאה במאגר המצוין. וודא שהמאגר ציבורי.</p>'; 
    }
};

window.addGHAsTask = async (url, name) => {
    const taskId = getSafeId(name);
    try {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tasks', taskId), {
            title: name.split('.')[0].replace(/_/g, ' '),
            fileUrl: url,
            type: name.endsWith('.pdf') ? 'pdf' : 'html',
            icon: name.endsWith('.pdf') ? '📁' : '📄',
            createdAt: new Date().toISOString()
        });
        alert(`המטלה "${name}" סונכרנה בהצלחה לשרת!`);
    } catch (e) { alert("שגיאה בסנכרון מול השרת"); }
};

window.syncAdminTasks = () => {
    const list = document.getElementById('adminTaskList');
    if (!list) return;
    onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'tasks'), (snap) => {
        list.innerHTML = '';
        if (snap.empty) {
            list.innerHTML = '<p class="text-center text-gray-500 py-10 italic">אין מטלות פעילות במערכת</p>';
            return;
        }
        snap.forEach(d => {
            const task = d.data();
            const div = document.createElement('div');
            div.className = "bg-slate-800/60 p-5 rounded-2xl flex justify-between items-center border border-slate-700 shadow-xl";
            div.innerHTML = `
                <div class="flex items-center gap-4 text-right">
                    <span class="text-2xl">${task.icon}</span>
                    <div>
                        <span class="text-sm font-black text-white block">${task.title}</span>
                        <span class="text-[10px] text-gray-500 uppercase font-mono">${task.type}</span>
                    </div>
                </div>
                <button onclick="window.deleteTask('${d.id}')" class="bg-red-500/10 text-red-500 text-xs font-bold hover:bg-red-500 hover:text-white px-4 py-2 rounded-xl transition-all">מחק</button>
            `;
            list.appendChild(div);
        });
    });
};

window.deleteTask = async (id) => {
    if (confirm("האם להסיר את המטלה לצמיתות מהשרת? פעולה זו תסיר אותה מכל התלמידים.")) {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tasks', id));
    }
};

/** ==============================
 * 🔑 TEACHER PORTAL LOGIC
 * ============================== */

window.checkTeacherGate = () => {
    const pass = document.getElementById('globalTeacherPass');
    if (pass && pass.value === "1234") {
        document.getElementById('teacherGate').classList.add('hidden');
        document.getElementById('teacherAuthFields').classList.remove('hidden');
        window.initTeacherSearch();
    } else alert("סיסמת צוות שגויה");
};

window.initTeacherSearch = () => {
    const input = document.getElementById('teacherUser');
    if(!input) return;
    input.onblur = async () => {
        if (teacherMode !== 'login') return;
        const schoolId = getSafeId(input.value.trim());
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
    
    if(newFields) newFields.classList.toggle('hidden', mode === 'login');
    if(tabLogin) tabLogin.className = mode === 'login' ? 'flex-1 py-3 text-white font-bold border-b-2 border-blue-500 transition' : 'flex-1 py-3 text-gray-500 transition';
    if(tabSignup) tabSignup.className = mode === 'signup' ? 'flex-1 py-3 text-white font-bold border-b-2 border-blue-500 transition' : 'flex-1 py-3 text-gray-500 transition';
    
    if (mode === 'signup') document.getElementById('teacherLoginSelectContainer').classList.add('hidden');
};

window.loginTeacher = async () => {
    const userEl = document.getElementById('teacherUser');
    const passEl = document.getElementById('teacherPass');
    if(!userEl || !passEl) return;
    
    const schoolName = userEl.value.trim();
    const pass = passEl.value;
    const schoolId = getSafeId(schoolName);
    const schoolRef = doc(db, 'artifacts', appId, 'public', 'data', 'school_profiles', schoolId);

    try {
        const snap = await getDoc(schoolRef);
        if (teacherMode === 'login') {
            if (!snap.exists() || snap.data().password !== pass) return alert("פרטי גישה שגויים לבית הספר");
            activeTeacherName = document.getElementById('teacherIndexSelect').value;
        } else {
            const names = document.getElementById('teacherNamesInput').value.split('\n').filter(n => n.trim());
            const dept = document.getElementById('deptHead').value.trim();
            if(!dept || names.length === 0) return alert("יש למלא את כל שדות החובה ברישום המוסד");
            await setDoc(schoolRef, { schoolName, password: pass, departmentHead: dept, teacherNames: names });
            activeTeacherName = names[0];
        }
        activeSchoolId = schoolId;
        const schoolData = (await getDoc(schoolRef)).data();
        document.getElementById('teacherAuthArea').classList.add('hidden');
        document.getElementById('teacherDashboard').classList.remove('hidden');
        window.initTeacherDashboard(schoolName, schoolData);
    } catch (e) { alert("שגיאת חיבור לשרת Firestore"); }
};

window.initTeacherDashboard = async (schoolName, schoolData) => {
    const tKey = `${activeSchoolId}_${getSafeId(activeTeacherName)}`;
    const tRef = doc(db, 'artifacts', appId, 'public', 'data', 'teacher_private_data', tKey);
    const tSnap = await getDoc(tRef);
    myClasses = tSnap.exists() ? tSnap.data().classes || [] : [];
    
    const switcher = document.getElementById('dashboardTeacherSwitcher');
    if(switcher) {
        switcher.innerHTML = (schoolData.teacherNames || []).map(n => `<option value="${n}" ${n===activeTeacherName?'selected':''}>${n}</option>`).join('');
    }
    
    const info = document.getElementById('teacherProfileInfo');
    if(info) info.innerText = `${schoolName} | רכז: ${schoolData.departmentHead} | מורה פעיל: ${activeTeacherName}`;
    
    window.updateClassUI();
    window.loadTeacherRoster();
};

window.switchAutonomousTeacher = () => {
    activeTeacherName = document.getElementById('dashboardTeacherSwitcher').value;
    window.loginTeacher(); 
};

window.loadTeacherRoster = async () => {
    const table = document.getElementById('rosterTableBody');
    if(!table) return;
    const selClass = document.getElementById('activeClassSelector').value;
    const tScope = `${activeSchoolId}_${getSafeId(activeTeacherName)}`;
    
    table.innerHTML = '<tr><td colspan="3" class="text-center p-8 italic text-white/40">טוען רשימת תלמידים...</td></tr>';
    const snap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'access_list'));
    table.innerHTML = '';
    let count = 0;
    snap.forEach(d => {
        const data = d.data();
        if (data.teacherScopeId === tScope && (selClass === 'all' || data.className === selClass)) {
            count++;
            const tr = document.createElement('tr');
            tr.className = "border-b border-slate-800 hover:bg-white/5 transition-all text-right";
            tr.innerHTML = `<td class="p-4 text-white font-bold">${data.studentName}</td><td class="p-4 font-mono text-gray-400">${data.tz}</td><td class="p-4 text-center"><button onclick="window.deleteStudent('${d.id}')" class="text-red-500 hover:underline font-black text-xs">הסר 🗑️</button></td>`;
            table.appendChild(tr);
        }
    });
    const cnt = document.getElementById('rosterCount');
    if(cnt) cnt.innerText = count;
};

window.addManualStudent = async () => {
    const name = document.getElementById('manualStudentName').value.trim();
    const tz = document.getElementById('manualStudentTZ').value.trim();
    const className = document.getElementById('activeClassSelector').value;
    if(!name || !tz || className === 'all') return alert("נא לבחור כיתה ולהזין את כל פרטי התלמיד");
    
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'access_list', tz), {
        studentName: name, tz, className, teacherScopeId: `${activeSchoolId}_${getSafeId(activeTeacherName)}`
    });
    
    document.getElementById('manualStudentName').value = "";
    document.getElementById('manualStudentTZ').value = "";
    window.loadTeacherRoster();
};

window.addNewClass = async () => {
    const nameInput = document.getElementById('newClassNameInput');
    const name = nameInput.value.trim();
    if(!name || myClasses.includes(name)) return alert("שם כיתה לא תקין או כבר קיים");
    
    myClasses.push(name);
    const tKey = `${activeSchoolId}_${getSafeId(activeTeacherName)}`;
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'teacher_private_data', tKey), { classes: myClasses }, { merge: true });
    
    nameInput.value = "";
    window.updateClassUI();
};

window.updateClassUI = () => {
    const s = document.getElementById('activeClassSelector');
    if(s) s.innerHTML = '<option value="all">כל התלמידים שלי</option>' + myClasses.map(c => `<option value="${c}">${c}</option>`).join('');
};

window.deleteStudent = async (tz) => { if(confirm("האם להסיר תלמיד זה מהמערכת?")) { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'access_list', tz)); window.loadTeacherRoster(); } };

/** ==============================
 * 🎓 STUDENT PORTAL LOGIC
 * ============================== */

window.loginStudent = async () => {
    const tzInput = document.getElementById('studentTZ');
    if(!tzInput) return;
    const tz = tzInput.value.trim();
    if(!tz) return alert("אנא הזן מספר תעודת זהות תקין");

    try {
        const snap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'access_list', tz));
        if (snap.exists()) {
            const data = snap.data();
            document.getElementById('welcomeStudent').innerText = `שלום, ${data.studentName || tz}`;
            document.getElementById('studentLoginArea').classList.add('hidden');
            document.getElementById('studentWorkspace').classList.remove('hidden');
            window.syncStudentTasks();
        } else alert("תעודת זהות לא רשומה במערכת. פנה למורה המקצועי שלך.");
    } catch (e) { alert("שגיאה בתקשורת עם השרת"); }
};

window.syncStudentTasks = () => {
    const list = document.getElementById('studentTaskList');
    if(!list) return;
    onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'tasks'), (snap) => {
        list.innerHTML = '';
        snap.forEach(d => {
            const task = d.data();
            const card = document.createElement('div');
            card.onclick = () => window.open(task.fileUrl, '_blank');
            card.className = "glass p-10 rounded-[2.5rem] flex justify-between items-center cursor-pointer border-2 border-transparent hover:border-orange-500 transition-all shadow-2xl group text-right animate-fade-in";
            card.innerHTML = `
                <div class="flex items-center gap-6">
                    <div class="text-5xl group-hover:scale-125 transition-transform duration-300">${task.icon}</div>
                    <div>
                        <h4 class="text-2xl font-black text-white italic">${task.title}</h4>
                        <p class="text-xs text-gray-500 font-bold uppercase tracking-widest">${task.type}</p>
                    </div>
                </div>
                <span class="bg-orange-500 text-black px-8 py-3 rounded-2xl text-xs font-black uppercase shadow-xl group-hover:bg-white group-hover:scale-105 transition-all">התחל</span>
            `;
            list.appendChild(card);
        });
    });
};

// --- Global UI Event Binding ---
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('doAdminLogin')?.addEventListener('click', window.loginAdmin);
    document.getElementById('btnFetchGH')?.addEventListener('click', window.fetchGitHubFiles);
    document.getElementById('doCheckGate')?.addEventListener('click', window.checkTeacherGate);
    document.getElementById('tabLogin')?.addEventListener('click', () => window.switchTeacherMode('login'));
    document.getElementById('tabSignup')?.addEventListener('click', () => window.switchTeacherMode('signup'));
    document.getElementById('doTeacherLogin')?.addEventListener('click', window.loginTeacher);
    document.getElementById('addManualBtn')?.addEventListener('click', window.addManualStudent);
    document.getElementById('addClassBtn')?.addEventListener('click', window.addNewClass);
    document.getElementById('doStudentLogin')?.addEventListener('click', window.loginStudent);
    document.getElementById('dashboardTeacherSwitcher')?.addEventListener('change', window.switchAutonomousTeacher);
});

window.togglePass = (id) => { const el = document.getElementById(id); if(el) el.type = el.type === 'password' ? 'text' : 'password'; };

// --- Auth Init ---
signInAnonymously(auth).catch(err => console.error("Firebase Auth Fail:", err));
