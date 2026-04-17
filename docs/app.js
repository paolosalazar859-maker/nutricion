// --- Application State ---
let state = {
    currentDate: new Date(),
    selectedDate: new Date(),
    appointments: JSON.parse(localStorage.getItem('nutriAppointments')) || [],
    profile: JSON.parse(localStorage.getItem('nutriProfile')) || {
        name: "Paolo Salazar",
        specialty: "Nutrición Deportiva",
        email: "contacto@paolo.cl",
        whatsapp: "56912345678",
        sis: "",
        university: "",
        address: "Consulta Virtual",
        price: "35000",
        bio: "Experto en nutrición deportiva y planes personalizados."
    },
    patients: JSON.parse(localStorage.getItem('nutriPatients')) || [],
    activePatientId: null
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("NutriSched initializing...");
    try {
        init();
        console.log("NutriSched ready!");
    } catch (e) {
        console.error("Initialization failed:", e);
    }
});

function init() {
    loadProfile();
    renderCalendar();
    renderAppointments();
    renderPatients();
    setupEventListeners();
    updateDateDisplay();
    if (window.lucide) lucide.createIcons();
}

// --- Navigation ---
window.showView = (viewId) => {
    console.log("Showing view:", viewId);
    const sections = document.querySelectorAll('.view-section');
    sections.forEach(v => v.classList.remove('active'));
    
    const target = document.getElementById(viewId);
    if (target) {
        target.classList.add('active');
    } else {
        console.error("Target view not found:", viewId);
    }
    
    document.querySelectorAll('.nav-item').forEach(i => {
        i.classList.toggle('active', i.dataset.view === viewId);
    });
};

// --- Profile Logic ---
function loadProfile() {
    const p = state.profile;
    const setters = {
        'header-name': p.name,
        'profile-name-display': p.name,
        'profile-specialty-display': p.specialty,
        'profile-name': p.name,
        'profile-specialty': p.specialty,
        'profile-sis': p.sis || "",
        'profile-university': p.university || "",
        'profile-whatsapp': p.whatsapp || "",
        'profile-price': p.price || "",
        'profile-email': p.email,
        'profile-address': p.address || "",
        'profile-bio': p.bio
    };

    Object.entries(setters).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) {
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.value = val;
            else el.innerText = val;
        }
    });

    const avatarText = p.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    ['header-avatar', 'profile-avatar-display'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = avatarText;
    });

    const welcome = document.getElementById('welcome-message');
    if (welcome) welcome.innerText = `Hola, ${p.name.split(' ')[0]} 👋`;
}

// --- Booking Link Generator ---
window.generateBookingLink = () => {
    const p = state.profile;
    if (!p.whatsapp) {
        alert("Por favor, ingresa tu número de WhatsApp en el perfil primero.");
        return;
    }
    
    // Base URL of your GitHub Pages site
    const baseUrl = `https://paolosalazar859-maker.github.io/nutricion/reserva.html`;
    
    // Construct dynamic parameters
    const params = new URLSearchParams({
        wa: p.whatsapp.replace('+', '').replace(/\s/g, ''),
        n: p.name,
        s: p.specialty,
        sis: p.sis || "",
        u: p.university || ""
    });

    const fullLink = `${baseUrl}?${params.toString()}`;
    
    // Fallback for clipboard
    const copyToClipboard = (text) => {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text);
        } else {
            const temp = document.createElement("input");
            temp.value = text;
            document.body.appendChild(temp);
            temp.select();
            document.execCommand("copy");
            document.body.removeChild(temp);
            return Promise.resolve();
        }
    };

    copyToClipboard(fullLink).then(() => {
        alert("¡Enlace dinámico copiado! Ya tiene tus datos de perfil actuales.");
    }).catch(err => {
        console.error("Copy failed:", err);
        alert("No se pudo copiar automáticamente. El link es: " + fullLink);
    });
};

// --- Calendar Logic ---
function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    if (!grid) return;

    const year = state.currentDate.getFullYear();
    const month = state.currentDate.getMonth();
    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    
    const display = document.getElementById('current-month');
    if (display) display.innerText = `${monthNames[month]} ${year}`;

    const headers = Array.from(grid.querySelectorAll('.day-name'));
    grid.innerHTML = '';
    headers.forEach(h => grid.appendChild(h));

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let startOffset = firstDay === 0 ? 6 : firstDay - 1;

    for (let i = 0; i < startOffset; i++) {
        grid.appendChild(Object.assign(document.createElement('div'), {className: 'calendar-day empty'}));
    }

    const todayStr = formatDate(new Date());
    const selectedStr = formatDate(state.selectedDate);

    for (let day = 1; day <= daysInMonth; day++) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day';
        dayDiv.innerText = day;
        const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        if (dateString === todayStr) dayDiv.classList.add('today');
        if (dateString === selectedStr) {
            dayDiv.style.borderColor = 'var(--primary)';
            dayDiv.style.background = 'rgba(109, 40, 217, 0.1)';
        }

        if (state.appointments.some(a => a.date === dateString)) {
            dayDiv.style.fontWeight = '700';
            dayDiv.style.color = 'var(--primary)';
            dayDiv.innerHTML += '<div style="width:4px; height:4px; background:var(--secondary); border-radius:50%; margin-top:2px;"></div>';
        }

        dayDiv.onclick = () => {
            state.selectedDate = new Date(year, month, day);
            renderCalendar();
            renderAppointments();
            updateDateDisplay();
        };
        grid.appendChild(dayDiv);
    }
}

function renderAppointments() {
    const list = document.getElementById('appointments-list');
    if (!list) return;

    const dateStr = formatDate(state.selectedDate);
    const dayApps = state.appointments.filter(a => a.date === dateStr).sort((a, b) => a.time.localeCompare(b.time));

    if (dayApps.length === 0) {
        list.innerHTML = '<p style="color: var(--text-muted); text-align: center; margin-top: 2rem;">No hay citas para este día.</p>';
        return;
    }

    list.innerHTML = dayApps.map(app => `
        <div class="appointment-item">
            <div style="display: flex; justify-content: space-between;">
                <div>
                    <div style="font-weight:700; color:var(--primary);">${app.time}</div>
                    <div style="font-weight:600;">${app.patient}</div>
                </div>
                <button class="btn" style="padding: 5px; color: #ef4444;" onclick="deleteAppointment('${app.id}')"><i data-lucide="trash-2" size="16"></i></button>
            </div>
        </div>
    `).join('');
    if (window.lucide) lucide.createIcons();
}

// --- Patient Logic ---
function renderPatients() {
    const list = document.getElementById('patients-list');
    if (!list) return;

    if (state.patients.length === 0) {
        list.innerHTML = '<p style="text-align:center; color:var(--text-muted);">No hay pacientes registrados.</p>';
        return;
    }
    list.innerHTML = state.patients.map(p => `
        <div class="patient-row">
            <div>
                <h4 style="color:var(--primary);">${p.name}</h4>
                <p style="font-size:0.8rem; color:var(--text-muted);">${p.email}</p>
            </div>
            <div style="display:flex; gap:0.5rem;">
                <button class="btn" style="padding:0.5rem 1rem; background:rgba(109,40,217,0.1); color:var(--primary);" onclick="openHistory('${p.id}')">Ver Seguimiento</button>
                <button class="btn" style="padding:0.5rem; color:#ef4444;" onclick="deletePatient('${p.id}')"><i data-lucide="user-minus" size="18"></i></button>
            </div>
        </div>
    `).join('');
    if (window.lucide) lucide.createIcons();
}

window.openAddPatientModal = () => {
    const name = prompt("Nombre del nuevo paciente:");
    const email = prompt("Email del paciente:");
    if (name && email) {
        state.patients.push({ id: Date.now().toString(), name, email, records: [] });
        savePatients();
        renderPatients();
    }
};

window.deletePatient = (id) => {
    if (confirm('¿Eliminar paciente y todo su historial?')) {
        state.patients = state.patients.filter(p => p.id !== id);
        savePatients();
        renderPatients();
    }
};

// --- History Logic ---
window.openHistory = (patientId) => {
    state.activePatientId = patientId;
    const patient = state.patients.find(p => p.id === patientId);
    if (!patient) return;
    document.getElementById('history-patient-name').innerText = patient.name;
    document.getElementById('history-patient-meta').innerText = patient.email;
    renderHistoryRecords();
    document.getElementById('patient-history-overlay').style.display = 'flex';
};

window.closeHistoryModal = () => { document.getElementById('patient-history-overlay').style.display = 'none'; };

function renderHistoryRecords() {
    const patient = state.patients.find(p => p.id === state.activePatientId);
    const list = document.getElementById('history-records-list');
    if (!list || !patient) return;
    
    if (patient.records.length === 0) {
        list.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:2rem;">Sin registros históricos.</p>';
        return;
    }
    list.innerHTML = patient.records.sort((a,b) => b.date.localeCompare(a.date)).map(r => `
        <div class="history-card">
            <div style="font-weight:700; font-size:0.85rem; color:var(--primary);">${r.date}</div>
            <div class="stat-grid">
                <div class="stat-item">Peso <b>${r.weight} kg</b></div>
                <div class="stat-item">% Grasa <b>${r.fat || '-'}%</b></div>
            </div>
            <p style="margin-top:0.5rem; font-size:0.85rem;">${r.notes}</p>
        </div>
    `).join('');
}

// --- Event Listeners ---
function setupEventListeners() {
    document.querySelectorAll('.nav-item').forEach(item => { 
        item.onclick = () => showView(item.dataset.view); 
    });

    const addClick = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
    
    addClick('prev-month', () => { state.currentDate.setMonth(state.currentDate.getMonth() - 1); renderCalendar(); });
    addClick('next-month', () => { state.currentDate.setMonth(state.currentDate.getMonth() + 1); renderCalendar(); });
    addClick('open-booking', () => { 
        const dateInput = document.getElementById('appointment-date');
        if (dateInput) dateInput.value = formatDate(state.selectedDate); 
        const modal = document.getElementById('modal-overlay');
        if (modal) modal.style.display = 'flex'; 
    });
    addClick('close-modal', () => { 
        const modal = document.getElementById('modal-overlay');
        if (modal) modal.style.display = 'none'; 
    });

    const form = document.getElementById('booking-form');
    if (form) form.onsubmit = (e) => {
        e.preventDefault();
        state.appointments.push({ 
            id: Date.now().toString(), 
            patient: document.getElementById('patient-name').value, 
            date: document.getElementById('appointment-date').value, 
            time: document.getElementById('appointment-time').value, 
            type: document.getElementById('appointment-type').value 
        });
        saveAppointments();
        document.getElementById('modal-overlay').style.display = 'none';
        form.reset();
        renderCalendar(); renderAppointments();
    };

    const profForm = document.getElementById('profile-form');
    if (profForm) profForm.onsubmit = (e) => {
        e.preventDefault();
        state.profile = {
            name: document.getElementById('profile-name').value,
            specialty: document.getElementById('profile-specialty').value,
            sis: document.getElementById('profile-sis').value,
            university: document.getElementById('profile-university').value,
            whatsapp: document.getElementById('profile-whatsapp').value,
            price: document.getElementById('profile-price').value,
            email: document.getElementById('profile-email').value,
            address: document.getElementById('profile-address').value,
            bio: document.getElementById('profile-bio').value
        };
        localStorage.setItem('nutriProfile', JSON.stringify(state.profile));
        loadProfile();
        alert('Perfil profesional actualizado correctamente.');
    };

    const histForm = document.getElementById('history-form');
    if (histForm) histForm.onsubmit = (e) => {
        e.preventDefault();
        const patient = state.patients.find(p => p.id === state.activePatientId);
        if (!patient) return;
        patient.records.push({ 
            id: Date.now().toString(), 
            date: new Date().toISOString().split('T')[0], 
            weight: document.getElementById('hist-weight').value, 
            fat: document.getElementById('hist-fat').value, 
            notes: document.getElementById('hist-notes').value 
        });
        savePatients();
        renderHistoryRecords();
        histForm.reset();
    };
}

// --- Helpers ---
function formatDate(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function saveAppointments() { localStorage.setItem('nutriAppointments', JSON.stringify(state.appointments)); }
function savePatients() { localStorage.setItem('nutriPatients', JSON.stringify(state.patients)); }
window.deleteAppointment = (id) => { if (confirm('¿Eliminar cita?')) { state.appointments = state.appointments.filter(a => a.id !== id); saveAppointments(); renderCalendar(); renderAppointments(); } };
function updateDateDisplay() { 
    const el = document.getElementById('selected-date-text');
    if (el) el.innerText = state.selectedDate.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }); 
}
