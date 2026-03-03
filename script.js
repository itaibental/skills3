/**
 * Skills Practice - Project Logic
 * גרסה 3.2: ניהול ריבוי מורים לפי כמות מוגדרת, אזור פרטי לכל מורה, והסרת תצוגת בתי ספר ציבורית.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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
let activeTeacherIndex = 1; // המורה הנבחר מתוך הרשימה
let teacherMode = 'login'; 
let myClasses = [];

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

// --- Teacher UI Logic ---

window.switchTeacherMode = (mode) => {
    teacherMode = mode;
    const tabLogin = document.getElementById('tabLogin');
    const tabSignup = document.getElementById('tabSignup');
    const newFields = document.getElementById('newTeacherFields');
    const mainBtn = document.getElementById('mainTeacherBtn');
    const loginFields = document.getElementById('loginTeacherSelection');

    if (mode === 'login') {
        tabLogin.className = "flex-1 py-3 text-white font-bold border-b-2 border-blue-500 transition";
        tabSignup.className = "flex-1 py-3 text-gray-500 font-bold border-b-2 border-transparent transition";
        newFields.classList.add('hidden');
        if(loginFields) loginFields.classList.remove('hidden');
        mainBtn.innerText = "כניסה למערכת";
    } else {
        tabSignup.className = "flex-1 py-3 text-white font-bold border-b-2 border-blue-500 transition";
        tabLogin.className = "flex-1 py-3 text-gray-500 font-bold border-b-2 border-transparent transition";
        newFields.classList.remove('hidden');
        if(loginFields) loginFields.classList.add('hidden');
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

// מאזין לשדה שם בית הספר בזמן התחברות כדי להציג את רשימת המורים
window.initLoginListeners = () => {
    const schoolInput = document.getElementById('teacherUser'); // משתמשים בשדה הקיים כשם בי"ס
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
                const count = snap.data().teacherCount || 1;
                teacherSelect.innerHTML = '';
                for (let i = 1; i <= count; i++) {
                    const opt = document.createElement('option');
                    opt.value = i;
                    opt.innerText = `מורה ${i}`;
                    teacherSelect.appendChild(opt);
                }
                document.getElementById('teacherSelectContainer')?.classList.remove('hidden');
            }
        } catch(e) { console.error("Error fetching school info", e); }
    };
};

window.loginTeacher = async () => {
    if (!isAuthReady) return showMsg("מתחבר...");
    const schoolName = document.getElementById('teacherUser').value.trim();
    const pass = document.getElementById('teacherPass').value;
    
    if (!schoolName || !pass) return showMsg("נא למלא את כל השדות");

    const schoolId = getSafeId(schoolName);
    const schoolRef = doc(db, 'artifacts', appId, 'public', 'data', 'school_profiles', schoolId);
    
    try {
        const snap = await getDoc(schoolRef);
        
        if (teacherMode === 'login') {
            if (!snap.exists()) return showMsg("בית הספר לא רשום במערכת", true);
            if (snap.data().password !== pass) return showMsg("סיסמה שגויה", true);
            
            activeTeacherIndex = document.getElementById('teacherIndexSelect').value || 1;
        } else {
            // רישום חדש
            const deptHead = document.getElementById('deptHead').value.trim();
            const count = parseInt(document.getElementById('teacherCountInput')?.value || "1");
            
            if (!deptHead || !count) return showMsg("יש למלא כמות מורים ושם רכז", true);
            if (snap.exists()) return showMsg("שם בית הספר כבר תפוס", true);
            
            await setDoc(schoolRef, { 
                schoolName: schoolName, 
                password: pass, 
                departmentHead: deptHead, 
                teacherCount: count,
                createdAt: new Date().toISOString()
            });
            activeTeacherIndex = 1;
        }
        
        const finalData = (await getDoc(schoolRef)).data();
        activeSchoolId = schoolId;
        
        // יצירת מזהה ייחודי למורה בתוך בית הספר לצורך בידוד נתונים
        const teacherDataKey = `${activeSchoolId}_T${activeTeacherIndex}`;
        const teacherDataRef = doc(db, 'artifacts', appId, 'public', 'data', 'teacher_private_data', teacherDataKey);
        
        const teacherSnap = await getDoc(teacherDataRef);
        if (teacherSnap.exists()) {
            myClasses = teacherSnap.data().classes || [];
        } else {
            // אתחול אזור פרטי למורה חדש בבית ספר קיים
            await setDoc(teacherDataRef, { classes: [] });
            myClasses = [];
        }

        document.getElementById('teacherProfileInfo').innerText = `${finalData.schoolName} | מורה ${activeTeacherIndex} | רכז: ${finalData.departmentHead}`;
        
        window.updateClassUI();
        window.closeLoginModals();
        window.loadTeacherRoster();
        showSection('teacherDashboard');
        showMsg(`כניסה בוצעה למורה ${activeTeacherIndex}`);
    } catch (e) { showMsg("שגיאת תקשורת עם השרת", true); }
};

// --- Class Management & Scoping ---

window.addNewClass = async () => {
    const name = document.getElementById('newClassNameInput').value.trim();
    if(!name || myClasses.includes(name)) return;
    
    myClasses.push(name);
    const teacherDataKey = `${activeSchoolId}_T${activeTeacherIndex}`;
    const teacherDataRef = doc(db, 'artifacts', appId, 'public', 'data', 'teacher_private_data', teacherDataKey);
    
    await setDoc(teacherDataRef, { classes: myClasses }, { merge: true });
    
    window.updateClassUI();
    document.getElementById('newClassNameInput').value = "";
    showMsg(`כיתה ${name} נוספה לאזור הפרטי שלך`);
};

window.updateClassUI = () => {
    const selector = document.getElementById('activeClassSelector');
    if (!selector) return;
    selector.innerHTML = '<option value="all">כל התלמידים שלי</option>';
    myClasses.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.innerText = c;
        selector.appendChild(opt);
    });
};

window.saveRoster = async () => {
    if (!activeSchoolId) return;
    const activeClass = document.getElementById('activeClassSelector').value;
    if(activeClass === 'all') return showMsg("אנא בחר כיתה ספציפית", true);
    
    const raw = document.getElementById('studentIdsList').value;
    const lines = raw.split('\n').filter(l => l.trim());
    
    // מזהה המורה המשולב לסינון תלמידים
    const teacherScopeId = `${activeSchoolId}_T${activeTeacherIndex}`;
    
    try {
        for (const line of lines) {
            const parts = line.split(',').map(p => p.trim());
            const name = parts[0];
            const tz = parts[1];
            if(tz) {
                await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'access_list', tz), { 
                    tz, 
                    studentName: name, 
                    className: activeClass, 
                    teacherScopeId: teacherScopeId // משויך למורה הספציפי
                });
            }
        }
        showMsg("התלמידים נוספו בהצלחה");
        document.getElementById('studentIdsList').value = "";
        window.loadTeacherRoster();
    } catch (e) { showMsg("שגיאת כתיבה", true); }
};

window.loadTeacherRoster = async () => {
    if (!activeSchoolId) return;
    const table = document.getElementById('rosterTableBody');
    const selectedClass = document.getElementById('activeClassSelector').value;
    const teacherScopeId = `${activeSchoolId}_T${activeTeacherIndex}`;
    
    table.innerHTML = '<tr><td colspan="4" class="text-center p-4">טוען נתונים אישיים...</td></tr>';
    
    try {
        const snap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'access_list'));
        table.innerHTML = '';
        let count = 0;
        snap.forEach(d => {
            const data = d.data();
            // סינון לפי המורה הספציפי בתוך בית הספר
            if (data.teacherScopeId === teacherScopeId && (selectedClass === 'all' || data.className === selectedClass)) {
                count++;
                const tr = document.createElement('tr');
                tr.className = "border-b border-slate-800 hover:bg-white/5 transition";
                tr.innerHTML = `
                    <td class="p-3">${data.studentName || 'ללא שם'}</td>
                    <td class="p-3 font-mono">${data.tz}</td>
                    <td class="p-3 text-blue-400">${data.className}</td>
                    <td class="p-3 text-center">
                        <button onclick="window.viewStudentWork('${data.tz}')" class="bg-blue-600/20 text-blue-400 px-3 py-1 rounded-lg text-xs font-bold">צפה 👁️</button>
                    </td>
                `;
                table.appendChild(tr);
            }
        });
        document.getElementById('rosterCount').innerText = count;
    } catch(e) { table.innerHTML = '<tr><td colspan="4">שגיאה בטעינה</td></tr>'; }
};

// --- Shared / UI ---

window.togglePass = (id) => {
    const el = document.getElementById(id);
    if(el) el.type = el.type === 'password' ? 'text' : 'password';
};

window.closeLoginModals = () => {
    ['studentLoginModal', 'teacherLoginModal'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
};

window.openLoginModal = (type) => {
    window.closeLoginModals();
    const modal = document.getElementById(type === 'student' ? 'studentLoginModal' : 'teacherLoginModal');
    if(modal) {
        modal.classList.remove('hidden');
        if(type === 'teacher') {
            document.getElementById('teacherGate').classList.remove('hidden');
            document.getElementById('teacherAuthFields').classList.add('hidden');
            window.switchTeacherMode('login');
        }
    }
};

window.loginStudent = async () => {
    const tz = document.getElementById('studentTZ').value.trim();
    if(!tz) return showMsg("נא להזין תעודת זהות", true);
    
    try {
        const snap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'access_list', tz));
        if (snap.exists()) {
            const data = snap.data();
            document.getElementById('welcomeStudent').innerText = `שלום, ${data.studentName || tz} (${data.className})`;
            showSection('studentWorkspace');
        } else showMsg("תעודת זהות לא נמצאה", true);
    } catch(e) { showMsg("שגיאת אימות", true); }
};

// --- Init ---
(async () => { 
    try {
        await signInAnonymously(auth); 
        onAuthStateChanged(auth, (user) => { isAuthReady = !!user; });
    } catch(e) { console.error("Auth failed", e); }
})();
