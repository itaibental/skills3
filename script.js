/**
 * Skills Practice - Project Logic
 * גרסה 3.1: תמיכה מלאה בריבוי מורים ובידוד סביבות עבודה.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
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
let activeTeacherId = null; // מזהה המורה המחובר כרגע
let teacherMode = 'login'; 
let myClasses = [];

// --- Helpers ---
// יצירת מזהה בטוח ל-Firestore שתומך בעברית (Unicode)
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

// --- Auth & Initial Data ---

onAuthStateChanged(auth, (user) => {
    isAuthReady = !!user;
    if(user) window.loadSchools();
});

// טעינת רשימת בתי הספר עבור "התחברות מהירה"
window.loadSchools = async () => {
    const list = document.getElementById('loginSchoolList');
    if(!list) return;
    try {
        const snap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'teacher_profiles'));
        const schools = new Set();
        snap.forEach(d => {
            const data = d.data();
            if (data.schoolName) schools.add(data.schoolName);
        });
        
        list.innerHTML = '<option value="">-- בחר בית ספר --</option>';
        schools.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s;
            opt.innerText = s;
            list.appendChild(opt);
        });
    } catch(e) { console.error("Schools load error", e); }
};

// --- Teacher UI Actions ---

window.switchTeacherMode = (mode) => {
    teacherMode = mode;
    const tabLogin = document.getElementById('tabLogin');
    const tabSignup = document.getElementById('tabSignup');
    const newFields = document.getElementById('newTeacherFields');
    const mainBtn = document.getElementById('mainTeacherBtn');
    const schoolSelect = document.getElementById('schoolSelectArea');

    if (mode === 'login') {
        tabLogin.className = "flex-1 py-3 text-white font-bold border-b-2 border-blue-500 transition";
        tabSignup.className = "flex-1 py-3 text-gray-500 font-bold border-b-2 border-transparent transition";
        newFields.classList.add('hidden');
        schoolSelect.classList.remove('hidden');
        mainBtn.innerText = "כניסה למערכת";
    } else {
        tabSignup.className = "flex-1 py-3 text-white font-bold border-b-2 border-blue-500 transition";
        tabLogin.className = "flex-1 py-3 text-gray-500 font-bold border-b-2 border-transparent transition";
        newFields.classList.remove('hidden');
        schoolSelect.classList.add('hidden');
        mainBtn.innerText = "רישום מורה חדש";
    }
};

window.checkTeacherGate = () => {
    if (document.getElementById('globalTeacherPass').value === "1234") {
        document.getElementById('teacherGate').classList.add('hidden');
        document.getElementById('teacherAuthFields').classList.remove('hidden');
    } else showMsg("סיסמה שגויה", true);
};

window.loginTeacher = async () => {
    if (!isAuthReady) return showMsg("מתחבר...");
    const userNm = document.getElementById('teacherUser').value.trim();
    const pass = document.getElementById('teacherPass').value;
    if (!userNm || !pass) return showMsg("נא להזין שם משתמש וסיסמה");

    const teacherId = getSafeId(userNm);
    const teacherRef = doc(db, 'artifacts', appId, 'public', 'data', 'teacher_profiles', teacherId);
    
    try {
        const snap = await getDoc(teacherRef);
        
        if (teacherMode === 'login') {
            if (!snap.exists()) return showMsg("המורה לא קיים במערכת. אנא בצע רישום.", true);
            if (snap.data().password !== pass) return showMsg("סיסמה שגויה", true);
        } else {
            // מצב רישום מורה חדש
            const school = document.getElementById('schoolName').value.trim();
            const head = document.getElementById('deptHead').value.trim();
            if (!school || !head) return showMsg("יש למלא את כל שדות החובה", true);
            if (snap.exists()) return showMsg("שם המשתמש כבר תפוס על ידי מורה אחר", true);
            
            await setDoc(teacherRef, { 
                username: userNm, 
                password: pass, 
                schoolName: school, 
                departmentHead: head, 
                classes: [],
                createdAt: new Date().toISOString()
            });
        }
        
        // טעינת נתוני המורה הספציפי
        const finalData = (await getDoc(teacherRef)).data();
        activeTeacherId = teacherId; // הגדרת המורה הפעיל לבידוד נתונים
        myClasses = finalData.classes || [];
        
        document.getElementById('teacherProfileInfo').innerText = `${finalData.schoolName} | רכז: ${finalData.departmentHead}`;
        
        window.updateClassUI();
        window.closeLoginModals();
        window.loadTeacherRoster();
        showSection('teacherDashboard');
        showMsg(`ברוך הבא, ${finalData.username}`);
    } catch (e) { showMsg("שגיאת תקשורת עם השרת", true); }
};

// --- Class Management ---

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

window.addNewClass = async () => {
    const name = document.getElementById('newClassNameInput').value.trim();
    if(!name) return;
    if(myClasses.includes(name)) return showMsg("הכיתה כבר קיימת", true);
    
    myClasses.push(name);
    const teacherRef = doc(db, 'artifacts', appId, 'public', 'data', 'teacher_profiles', activeTeacherId);
    await setDoc(teacherRef, { classes: myClasses }, { merge: true });
    
    window.updateClassUI();
    document.getElementById('newClassNameInput').value = "";
    showMsg(`כיתה ${name} נוספה לסביבה שלך`);
};

// --- Excel Import ---

document.getElementById('excelInput')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
        try {
            const data = evt.target.result;
            const workbook = XLSX.read(data, { type: 'binary' });
            const sheetName = workbook.SheetNames[0];
            const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
            
            let text = "";
            rows.forEach(row => {
                // מניח ששם בעמודה ראשונה ות"ז בשנייה
                if(row[0] && row[1]) text += `${row[0]}, ${row[1]}\n`;
            });
            document.getElementById('studentIdsList').value = text;
            showMsg("הקובץ נטען. בדוק את הרשימה ולחץ על עדכן.");
        } catch(err) { showMsg("שגיאה בקריאת הקובץ", true); }
    };
    reader.readAsBinaryString(file);
});

window.saveRoster = async () => {
    if (!activeTeacherId) return;
    const activeClass = document.getElementById('activeClassSelector').value;
    if(activeClass === 'all') return showMsg("אנא בחר כיתה ספציפית שאליה תרצה לייבא את התלמידים", true);
    
    const raw = document.getElementById('studentIdsList').value;
    const lines = raw.split('\n').filter(l => l.trim());
    
    try {
        for (const line of lines) {
            const parts = line.split(',').map(p => p.trim());
            const name = parts[0];
            const tz = parts[1];
            if(tz) {
                // שמירת התלמיד עם שיוך למזהה המורה הספציפי
                await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'access_list', tz), { 
                    tz, 
                    studentName: name, 
                    className: activeClass, 
                    teacherId: activeTeacherId 
                });
            }
        }
        showMsg("רשימת הכיתה עודכנה בהצלחה");
        document.getElementById('studentIdsList').value = "";
        window.loadTeacherRoster();
    } catch (e) { showMsg("שגיאת הרשאה בכתיבה", true); }
};

window.loadTeacherRoster = async () => {
    if (!activeTeacherId) return;
    const table = document.getElementById('rosterTableBody');
    const selectedClass = document.getElementById('activeClassSelector').value;
    table.innerHTML = '<tr><td colspan="4" class="text-center p-4 italic">טוען את התלמידים שלך...</td></tr>';
    
    try {
        const snap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'access_list'));
        table.innerHTML = '';
        let count = 0;
        snap.forEach(d => {
            const data = d.data();
            // סינון קפדני: רק תלמידים ששייכים למורה המחובר
            if (data.teacherId === activeTeacherId && (selectedClass === 'all' || data.className === selectedClass)) {
                count++;
                const tr = document.createElement('tr');
                tr.className = "border-b border-slate-800 hover:bg-white/5 transition";
                tr.innerHTML = `
                    <td class="p-3">${data.studentName || 'ללא שם'}</td>
                    <td class="p-3 font-mono text-gray-300">${data.tz}</td>
                    <td class="p-3 text-blue-400">${data.className}</td>
                    <td class="p-3 text-center">
                        <button onclick="window.viewStudentWork('${data.tz}')" class="bg-blue-600/20 text-blue-400 px-3 py-1 rounded-lg hover:bg-blue-600 hover:text-white transition text-xs font-bold">צפה בתוצרים 👁️</button>
                    </td>
                `;
                table.appendChild(tr);
            }
        });
        document.getElementById('rosterCount').innerText = count;
        if(count === 0) table.innerHTML = '<tr><td colspan="4" class="text-center p-8 text-gray-500">אין תלמידים רשומים בכיתה זו.</td></tr>';
    } catch(e) { table.innerHTML = '<tr><td colspan="4" class="text-center text-red-400 text-xs">שגיאת טעינה - וודא חיבור אינטרנט</td></tr>'; }
};

// --- Shared functions ---
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

window.closeLoginModals = () => {
    ['studentLoginModal', 'teacherLoginModal'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.classList.add('hidden');
    });
};

window.togglePass = (id) => {
    const el = document.getElementById(id);
    if(el) el.type = el.type === 'password' ? 'text' : 'password';
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
        } else {
            showMsg("תעודת הזהות אינה רשומה במערכת של אף מורה", true);
        }
    } catch(e) { showMsg("שגיאת אימות", true); }
};

// --- Init Auth ---
(async () => { 
    try {
        await signInAnonymously(auth); 
    } catch(e) { console.error("Firebase auth failed", e); }
})();
