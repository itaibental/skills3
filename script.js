/**
 * Skills Practice - Project Logic v4.1
 * Shared logic for Admin, Teacher, and Student portals.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

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

// --- State ---
let isAuthReady = false;
let activeSchoolId = null;
let activeTeacherName = "";
let teacherMode = 'login';
let myClasses = [];

// --- Helpers ---
const getSafeId = (str) => str ? Array.from(str).map(c => c.charCodeAt(0).toString(16).padStart(4, '0')).join('') : "";

// --- Shared Window Functions ---
window.togglePass = (id) => { const el = document.getElementById(id); if(el) el.type = el.type === 'password' ? 'text' : 'password'; };

// --- Admin Logic ---
window.loginAdmin = () => {
    if (document.getElementById('adminPassInput').value === "1234") {
        document.getElementById('adminAuthArea').classList.add('hidden');
        document.getElementById('adminDashboard').classList.remove('hidden');
        window.loadAdminTasks();
    } else alert("סיסמה שגויה");
};

window.adminAddTask = async () => {
    const title = document.getElementById('taskTitleInput').value.trim();
    const icon = document.getElementById('taskIconInput').value.trim();
    const fileInput = document.getElementById('taskFileObject');
    const driveUrl = document.getElementById('taskDriveUrl').value.trim();
    const loader = document.getElementById('uploadLoader');

    if (!title) return alert("הזן שם למטלה");
    if (loader) loader.classList.remove('hidden');
    
    let fileUrl = ""; let type = "link";

    try {
        if (fileInput.files[0]) {
            const file = fileInput.files[0];
            const storageRef = ref(storage, `artifacts/${appId}/tasks/${Date.now()}_${file.name}`);
            const snapshot = await uploadBytes(storageRef, file);
            fileUrl = await getDownloadURL(snapshot.ref);
            type = file.name.endsWith('.pdf') ? "pdf" : "html";
        } else if (driveUrl) {
            fileUrl = driveUrl; type = "drive";
        } else {
            alert("בחר קובץ או קישור Drive"); if(loader) loader.classList.add('hidden'); return;
        }

        const taskId = getSafeId(title);
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tasks', taskId), {
            title, fileUrl, type, icon: icon || '📄', createdAt: new Date().toISOString()
        });
        alert("המטלה נוספה בהצלחה!");
        location.reload();
    } catch (e) { alert("שגיאה: " + e.message); }
    finally { if(loader) loader.classList.add('hidden'); }
};

window.loadAdminTasks = () => {
    onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'tasks'), (snap) => {
        const list = document.getElementById('adminTaskList');
        if(!list) return; list.innerHTML = '';
        snap.forEach(d => {
            const task = d.data();
            list.innerHTML += `<div class="bg-slate-800 p-4 rounded-xl flex justify-between items-center border border-slate-700">
                <span class="text-sm">${task.icon} ${task.title} <small class="text-gray-500">(${task.type})</small></span>
                <button onclick="window.adminDeleteTask('${d.id}')" class="text-red-500 text-xs font-bold hover:underline">מחק 🗑️</button>
            </div>`;
        });
    });
};

window.adminDeleteTask = async (id) => { if(confirm("למחוק מטלה זו?")) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tasks', id)); };

// --- Teacher Logic ---
window.checkTeacherGate = () => {
    if (document.getElementById('globalTeacherPass').value === "1234") {
        document.getElementById('teacherGate').classList.add('hidden');
        document.getElementById('teacherAuthFields').classList.remove('hidden');
        window.initTeacherAuthListeners();
    } else alert("סיסמה שגויה");
};

window.initTeacherAuthListeners = () => {
    const input = document.getElementById('teacherUser');
    input.onblur = async () => {
        if (teacherMode !== 'login') return;
        const schoolId = getSafeId(input.value.trim());
        if(!schoolId) return;
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
    document.getElementById('newTeacherFields').classList.toggle('hidden', mode === 'login');
    document.getElementById('tabLogin').classList.toggle('border-blue-500', mode === 'login');
    document.getElementById('tabSignup').classList.toggle('border-blue-500', mode === 'signup');
};

window.loginTeacher = async () => {
    const schoolName = document.getElementById('teacherUser').value.trim();
    const pass = document.getElementById('teacherPass').value;
    const schoolId = getSafeId(schoolName);
    const schoolRef = doc(db, 'artifacts', appId, 'public', 'data', 'school_profiles', schoolId);

    try {
        const snap = await getDoc(schoolRef);
        if (teacherMode === 'login') {
            if (!snap.exists() || snap.data().password !== pass) return alert("פרטי גישה שגויים");
            activeTeacherName = document.getElementById('teacherIndexSelect').value;
        } else {
            const names = document.getElementById('teacherNamesInput').value.split('\n').filter(n => n.trim());
            const dept = document.getElementById('deptHead').value.trim();
            if(!dept || names.length === 0) return alert("מלא שדות חובה");
            await setDoc(schoolRef, { schoolName, password: pass, departmentHead: dept, teacherNames: names });
            activeTeacherName = names[0];
        }
        activeSchoolId = schoolId;
        const schoolData = (await getDoc(schoolRef)).data();
        document.getElementById('teacherAuthArea').classList.add('hidden');
        document.getElementById('teacherDashboard').classList.remove('hidden');
        window.initTeacherDashboard(schoolName, schoolData);
    } catch (e) { alert("שגיאת חיבור"); }
};

window.initTeacherDashboard = async (schoolName, schoolData) => {
    const tKey = `${activeSchoolId}_${getSafeId(activeTeacherName)}`;
    const tRef = doc(db, 'artifacts', appId, 'public', 'data', 'teacher_private_data', tKey);
    const tSnap = await getDoc(tRef);
    myClasses = tSnap.exists() ? tSnap.data().classes || [] : [];
    
    const switcher = document.getElementById('dashboardTeacherSwitcher');
    switcher.innerHTML = (schoolData.teacherNames || []).map(n => `<option value="${n}" ${n===activeTeacherName?'selected':''}>${n}</option>`).join('');
    
    document.getElementById('teacherProfileInfo').innerText = `${schoolName} | רכז: ${schoolData.departmentHead}`;
    window.updateClassUI();
    window.loadTeacherRoster();
};

window.switchAutonomousTeacher = () => {
    activeTeacherName = document.getElementById('dashboardTeacherSwitcher').value;
    window.loginTeacher(); // Re-init environment
};

window.loadTeacherRoster = async () => {
    const table = document.getElementById('rosterTableBody');
    const selClass = document.getElementById('activeClassSelector').value;
    const tScope = `${activeSchoolId}_${getSafeId(activeTeacherName)}`;
    const snap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'access_list'));
    table.innerHTML = '';
    snap.forEach(d => {
        const data = d.data();
        if (data.teacherScopeId === tScope && (selClass === 'all' || data.className === selClass)) {
            table.innerHTML += `<tr class="border-b border-slate-800"><td class="p-4">${data.studentName}</td><td class="p-4 font-mono">${data.tz}</td><td class="p-4 text-center"><button onclick="window.deleteStudent('${data.tz}')" class="text-red-500 hover:underline">מחק 🗑️</button></td></tr>`;
        }
    });
};

window.addManualStudent = async () => {
    const name = document.getElementById('manualStudentName').value;
    const tz = document.getElementById('manualStudentTZ').value;
    const className = document.getElementById('activeClassSelector').value;
    if(!name || !tz || className === 'all') return alert("בחר כיתה והזן פרטים");
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'access_list', tz), {
        studentName: name, tz, className, teacherScopeId: `${activeSchoolId}_${getSafeId(activeTeacherName)}`
    });
    window.loadTeacherRoster();
};

window.addNewClass = async () => {
    const name = document.getElementById('newClassNameInput').value.trim();
    if(!name || myClasses.includes(name)) return;
    myClasses.push(name);
    const tKey = `${activeSchoolId}_${getSafeId(activeTeacherName)}`;
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'teacher_private_data', tKey), { classes: myClasses }, { merge: true });
    window.updateClassUI();
};

window.updateClassUI = () => {
    const s = document.getElementById('activeClassSelector');
    if(s) s.innerHTML = '<option value="all">כל התלמידים</option>' + myClasses.map(c => `<option value="${c}">${c}</option>`).join('');
};

window.deleteStudent = async (tz) => { if(confirm("למחוק?")) { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'access_list', tz)); window.loadTeacherRoster(); } };

// --- Student Logic ---
window.loginStudent = async () => {
    const tz = document.getElementById('studentTZ').value.trim();
    if(!tz) return alert("הזן תעודת זהות");
    const snap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'access_list', tz));
    if (snap.exists()) {
        document.getElementById('welcomeStudent').innerText = `שלום, ${snap.data().studentName}`;
        document.getElementById('studentLoginArea').classList.add('hidden');
        document.getElementById('studentWorkspace').classList.remove('hidden');
        window.loadStudentTasks();
    } else alert("תעודת זהות לא רשומה");
};

window.loadStudentTasks = () => {
    onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'tasks'), (snap) => {
        const list = document.getElementById('studentTaskList');
        if(!list) return; list.innerHTML = '';
        snap.forEach(d => {
            const task = d.data();
            list.innerHTML += `
                <div onclick="window.open( '${task.fileUrl}', '_blank')" class="glass p-6 rounded-2xl flex justify-between items-center cursor-pointer border-2 border-transparent hover:border-orange-500 transition shadow-lg">
                    <div class="flex items-center gap-4">
                        <span class="text-3xl">${task.icon}</span>
                        <span class="text-lg font-bold">${task.title}</span>
                    </div>
                    <span class="bg-orange-500 text-black px-6 py-2 rounded-xl text-xs font-black uppercase">${task.type === 'pdf' || task.type === 'drive' ? 'פתח' : 'בצע'}</span>
                </div>`;
        });
    });
};

// --- Initialization ---
onAuthStateChanged(auth, (u) => isAuthReady = !!u);
signInAnonymously(auth);
