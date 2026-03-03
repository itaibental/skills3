/**
 * Skills Practice - Project Logic
 * גרסה 3.4: תמיכה במורים אוטונומיים, הזנה ידנית מופרדת, וייבוא מ-Google Sheets.
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

const showSection = (id) => {
    ['landingScreen', 'studentWorkspace', 'teacherDashboard'].forEach(s => {
        const el = document.getElementById(s);
        if (el) el.classList.add('hidden-section');
    });
    const target = document.getElementById(id);
    if (target) target.classList.remove('hidden-section');
};

// --- Dashboard autonomous control ---

window.switchAutonomousTeacher = () => {
    const selector = document.getElementById('dashboardTeacherSwitcher');
    if(!selector) return;
    activeTeacherName = selector.value;
    window.initTeacherEnvironment();
    showMsg(`עברת לשלוט בסביבה של: ${activeTeacherName}`);
};

window.initTeacherEnvironment = async () => {
    const tKey = `${activeSchoolId}_${getSafeId(activeTeacherName)}`;
    const tRef = doc(db, 'artifacts', appId, 'public', 'data', 'teacher_private_data', tKey);
    const tSnap = await getDoc(tRef);
    
    myClasses = tSnap.exists() ? tSnap.data().classes || [] : [];
    if(!tSnap.exists()) await setDoc(tRef, { classes: [] });
    
    window.updateClassUI();
    window.loadTeacherRoster();
};

// --- Student Import (Manual, Excel, Sheets) ---

window.addManualStudent = async () => {
    const name = document.getElementById('manualStudentName').value.trim();
    const tz = document.getElementById('manualStudentTZ').value.trim();
    const selClass = document.getElementById('activeClassSelector').value;

    if(!name || !tz) return showMsg("נא להזין שם ותעודת זהות", true);
    if(selClass === 'all') return showMsg("בחר כיתה להוספת התלמיד", true);

    const tScope = `${activeSchoolId}_${getSafeId(activeTeacherName)}`;
    try {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'access_list', tz), { 
            tz, studentName: name, className: selClass, teacherScopeId: tScope 
        });
        showMsg(`התלמיד ${name} נוסף בהצלחה`);
        document.getElementById('manualStudentName').value = "";
        document.getElementById('manualStudentTZ').value = "";
        window.loadTeacherRoster();
    } catch(e) { showMsg("שגיאת שמירה", true); }
};

window.importFromGoogleSheets = async () => {
    const url = document.getElementById('gsheetsUrl').value.trim();
    const selClass = document.getElementById('activeClassSelector').value;
    if(!url) return showMsg("הזן קישור לגוגל שיטס", true);
    if(selClass === 'all') return showMsg("בחר כיתה לייבוא", true);

    showMsg("מושך נתונים מגוגל...");
    try {
        // המרת קישור גוגל שיטס לייצוא CSV
        const fileId = url.match(/\/d\/(.+?)\//);
        if(!fileId) throw new Error("URL לא תקין");
        const csvUrl = `https://docs.google.com/spreadsheets/d/${fileId[1]}/export?format=csv`;
        
        const response = await fetch(csvUrl);
        const data = await response.text();
        const workbook = XLSX.read(data, { type: 'string' });
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });

        let count = 0;
        const tScope = `${activeSchoolId}_${getSafeId(activeTeacherName)}`;
        for (const row of rows) {
            if(row[0] && row[1]) { // שם ות"ז
                await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'access_list', row[1].toString().trim()), { 
                    tz: row[1].toString().trim(), 
                    studentName: row[0].toString().trim(), 
                    className: selClass, 
                    teacherScopeId: tScope 
                });
                count++;
            }
        }
        showMsg(`ייבוא הושלם! ${count} תלמידים נוספו.`);
        window.loadTeacherRoster();
    } catch(e) { showMsg("שגיאת ייבוא: וודא שהגיליון ציבורי", true); }
};

// --- Teacher UI Logic (Login/Signup) ---

window.switchTeacherMode = (mode) => {
    teacherMode = mode;
    const tabLogin = document.getElementById('tabLogin');
    const tabSignup = document.getElementById('tabSignup');
    const newFields = document.getElementById('newTeacherFields');
    const loginSelection = document.getElementById('teacherLoginSelectContainer');
    const mainBtn = document.getElementById('mainTeacherBtn');

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

window.initLoginListeners = () => {
    const schoolInput = document.getElementById('teacherUser');
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
            schoolTeachers = names;
        }
    };
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
            schoolTeachers = snap.data().teacherNames || [];
        } else {
            const names = document.getElementById('teacherNamesInput').value.split('\n').map(n => n.trim()).filter(n => n);
            const dept = document.getElementById('deptHead').value.trim();
            if(!dept || names.length === 0) return showMsg("מלא שדות חובה", true);
            await setDoc(schoolRef, { schoolName, password: pass, departmentHead: dept, teacherNames: names });
            activeTeacherName = names[0];
            schoolTeachers = names;
        }
        activeSchoolId = schoolId;
        
        // Populate switcher in dashboard
        const switcher = document.getElementById('dashboardTeacherSwitcher');
        switcher.innerHTML = schoolTeachers.map(n => `<option value="${n}" ${n === activeTeacherName ? 'selected' : ''}>${n}</option>`).join('');
        
        document.getElementById('teacherProfileInfo').innerText = `${schoolName} | רכז: ${(await getDoc(schoolRef)).data().departmentHead}`;
        await window.initTeacherEnvironment();
        window.closeLoginModals();
        showSection('teacherDashboard');
    } catch (e) { showMsg("שגיאה", true); }
};

// --- Base Logic (Roster, Modal, etc) ---

window.loadTeacherRoster = async () => {
    const table = document.getElementById('rosterTableBody');
    const selClass = document.getElementById('activeClassSelector').value;
    const tScope = `${activeSchoolId}_${getSafeId(activeTeacherName)}`;
    table.innerHTML = '<tr><td colspan="5" class="text-center p-4">טוען...</td></tr>';
    
    const snap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'access_list'));
    table.innerHTML = '';
    let count = 0;
    snap.forEach(d => {
        const data = d.data();
        if (data.teacherScopeId === tScope && (selClass === 'all' || data.className === selClass)) {
            count++;
            table.innerHTML += `<tr class="border-b border-slate-800">
                <td class="p-4">${data.studentName}</td>
                <td class="p-4 font-mono">${data.tz}</td>
                <td class="p-4 text-blue-400">${data.className}</td>
                <td class="p-4 text-center">
                    <button onclick="window.viewStudentWork('${data.tz}')" class="text-blue-500 font-bold hover:underline">פתח 👁️</button>
                </td>
                <td class="p-4 text-center">
                    <button onclick="window.deleteStudent('${data.tz}')" class="text-red-500 text-xs">מחק 🗑️</button>
                </td>
            </tr>`;
        }
    });
    document.getElementById('rosterCount').innerText = count;
};

window.deleteStudent = async (tz) => {
    if(!confirm("להסיר את התלמיד מהמערכת?")) return;
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'access_list', tz));
    window.loadTeacherRoster();
};

window.updateClassUI = () => {
    const s = document.getElementById('activeClassSelector');
    s.innerHTML = '<option value="all">כל התלמידים שלי</option>' + myClasses.map(c => `<option value="${c}">${c}</option>`).join('');
};

window.addNewClass = async () => {
    const n = document.getElementById('newClassNameInput').value.trim();
    if(!n || myClasses.includes(n)) return;
    myClasses.push(n);
    const tKey = `${activeSchoolId}_${getSafeId(activeTeacherName)}`;
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'teacher_private_data', tKey), { classes: myClasses }, { merge: true });
    window.updateClassUI();
    document.getElementById('newClassNameInput').value = "";
};

window.checkTeacherGate = () => {
    if (document.getElementById('globalTeacherPass').value === "1234") {
        document.getElementById('teacherGate').classList.add('hidden');
        document.getElementById('teacherAuthFields').classList.remove('hidden');
        window.initLoginListeners();
    } else showMsg("סיסמה שגויה", true);
};

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

window.loginStudent = async () => {
    const tz = document.getElementById('studentTZ').value.trim();
    const snap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'access_list', tz));
    if (snap.exists()) {
        const data = snap.data();
        document.getElementById('welcomeStudent').innerText = `שלום, ${data.studentName || tz} (${data.className})`;
        window.closeLoginModals();
        showSection('studentWorkspace');
    } else showMsg("לא רשום", true);
};

// Initial Auth
(async () => { await signInAnonymously(auth); })();
