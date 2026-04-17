// --- Application State ---
let state = {
    currentDate: new Date(),
    selectedDate: new Date(),
    planningDate: new Date(), // For the availability tab
    selectedPlanningDates: [], // Multi-select days
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
        bio: "Experto en nutrición deportiva y planes personalizados.",
        availability: {
            weekly: ["office", "office", "office", "office", "online", "off", "off"],
            blocked: "",
            overrides: {} // Specific days exceptions: { '2024-04-16': 'online' }
        }
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
    renderAvailabilityConfig();
    renderPlanningCalendar();
    setupEventListeners();
    updateDateDisplay();
    if (window.lucide) lucide.createIcons();
}

// --- Navigation ---
window.showView = (viewId) => {
    const sections = document.querySelectorAll('.view-section');
    sections.forEach(v => v.classList.remove('active'));
    const target = document.getElementById(viewId);
    if (target) target.classList.add('active');
    document.querySelectorAll('.nav-item').forEach(i => {
        i.classList.toggle('active', i.dataset.view === viewId);
    });
};

// --- Planning Logic (Availability Tab) ---
function renderPlanningCalendar() {
    const grid = document.getElementById('planning-grid');
    if (!grid) return;

    const year = state.planningDate.getFullYear();
    const month = state.planningDate.getMonth();
    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    document.getElementById('plan-month-name').innerText = `${monthNames[month]} ${year}`;

    // Headers with click action to select columns
    grid.innerHTML = '';
    const dayNames = ["LU", "MA", "MI", "JU", "VI", "SA", "DO"];
    dayNames.forEach((name, i) => {
        const h = document.createElement('div');
        h.className = 'day-name';
        h.style.cursor = 'pointer';
        h.innerText = name;
        h.title = `Seleccionar todos los ${name} del mes`;
        h.onclick = () => selectColumn(i);
        grid.appendChild(h);
    });

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let startOffset = firstDay === 0 ? 6 : firstDay - 1;

    for (let i = 0; i < startOffset; i++) {
        grid.appendChild(Object.assign(document.createElement('div'), {className: 'calendar-day empty'}));
    }

    const overrides = state.profile.availability?.overrides || {};
    const weekly = state.profile.availability?.weekly || ["office", "office", "office", "office", "online", "off", "off"];

    let isDragging = false;
    let dragMode = true;

    grid.onmouseleave = () => { isDragging = false; };

    // Function to update visual state without full re-render
    const updateDayUI = (dateStr, shouldSelect) => {
        const dayDiv = grid.querySelector(`[data-date="${dateStr}"]`);
        if (dayDiv) {
            dayDiv.classList.toggle('selected', shouldSelect);
        }
        updateSelectionStatus();
    };

    const setSelection = (dateStr, shouldSelect) => {
        const isIncluded = state.selectedPlanningDates.includes(dateStr);
        if (shouldSelect && !isIncluded) {
            state.selectedPlanningDates.push(dateStr);
            updateDayUI(dateStr, true);
        } else if (!shouldSelect && isIncluded) {
            state.selectedPlanningDates = state.selectedPlanningDates.filter(id => id !== dateStr);
            updateDayUI(dateStr, false);
        }
    };

    window.onmouseup = () => { isDragging = false; };

    for (let day = 1; day <= daysInMonth; day++) {
        const d = new Date(year, month, day);
        const dateStr = formatDate(d);
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day planning-day';
        dayDiv.innerText = day;
        dayDiv.dataset.date = dateStr;
        
        let dayIdx = d.getDay();
        let schIdx = dayIdx === 0 ? 6 : dayIdx - 1;
        const modality = overrides[dateStr] || weekly[schIdx];
        
        if (modality === 'office') dayDiv.style.borderLeft = '4px solid var(--primary)';
        if (modality === 'online') dayDiv.style.borderLeft = '4px solid #3b82f6';
        if (modality === 'off') dayDiv.style.borderLeft = '4px solid #94a3b8';
        if (state.selectedPlanningDates.includes(dateStr)) dayDiv.classList.add('selected');

        dayDiv.onmousedown = (e) => { 
            e.preventDefault(); 
            isDragging = true;
            dragMode = !state.selectedPlanningDates.includes(dateStr);
            setSelection(dateStr, dragMode);
        };

        dayDiv.onmouseenter = () => { 
            if (isDragging) setSelection(dateStr, dragMode); 
        };
        
        grid.appendChild(dayDiv);
    }
}

window.selectColumn = (dayIndex) => {
    const year = state.planningDate.getFullYear();
    const month = state.planningDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    for (let day = 1; day <= daysInMonth; day++) {
        const d = new Date(year, month, day);
        let currentDayIdx = d.getDay();
        let schIdx = currentDayIdx === 0 ? 6 : currentDayIdx - 1;
        
        if (schIdx === dayIndex) {
            const dateStr = formatDate(d);
            if (!state.selectedPlanningDates.includes(dateStr)) {
                state.selectedPlanningDates.push(dateStr);
            }
        }
    }
    renderPlanningCalendar();
    updateSelectionStatus();
};

function updateSelectionStatus() {
    const el = document.getElementById('selection-status');
    const count = state.selectedPlanningDates.length;
    el.innerText = count === 0 ? "Sin días seleccionados" : `${count} días seleccionados`;
}

window.applyBulkModality = (modality) => {
    // Safety check for profile structure
    if (!state.profile.availability) {
        state.profile.availability = {
            weekly: ["office", "office", "office", "office", "online", "off", "off"],
            blocked: "",
            overrides: {}
        };
    }
    if (!state.profile.availability.overrides) {
        state.profile.availability.overrides = {};
    }

    if (state.selectedPlanningDates.length === 0) {
        alert("Primero selecciona algunos días en el calendario.");
        return;
    }
    
    state.selectedPlanningDates.forEach(dateStr => {
        state.profile.availability.overrides[dateStr] = modality;
    });
    
    saveProfile();
    state.selectedPlanningDates = [];
    renderPlanningCalendar();
    updateSelectionStatus();
    
    const labels = { office: 'Presencial 🏢', online: 'Online 💻', off: 'Cerrado ❌' };
    alert(`¡Listo! Se ha aplicado la modalidad ${labels[modality]} a los días seleccionados.`);
};

window.resetMonthPlanning = () => {
    const p = state.profile;
    if (!p.availability || !p.availability.overrides) {
        alert("No hay cambios personalizados que borrar en este mes.");
        return;
    }

    if (!confirm('¿Seguro quieres borrar todas las excepciones de este mes y volver a tu horario base?')) return;
    
    const year = state.planningDate.getFullYear();
    const month = state.planningDate.getMonth();
    const datePrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    
    // Create a new object excluding the current month's overrides
    const currentOverrides = p.availability.overrides;
    const newOverrides = {};
    let count = 0;

    Object.entries(currentOverrides).forEach(([dateStr, modality]) => {
        if (dateStr.startsWith(datePrefix)) {
            count++;
        } else {
            newOverrides[dateStr] = modality;
        }
    });

    if (count === 0) {
        alert("No tenías cambios realizados específicamente en este mes.");
        return;
    }

    state.profile.availability.overrides = newOverrides;
    saveProfile();
    
    state.selectedPlanningDates = [];
    renderPlanningCalendar();
    updateSelectionStatus();
    alert(`Se han borrado ${count} días personalizados. Ahora el mes sigue tu horario base.`);
};

window.clearSelection = () => {
    state.selectedPlanningDates = [];
    renderPlanningCalendar();
    updateSelectionStatus();
};

// --- Profile & Persistence ---
function saveProfile() {
    localStorage.setItem('nutriProfile', JSON.stringify(state.profile));
    loadProfile();
}

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
        'profile-bio': p.bio,
        'blocked-dates': p.availability?.blocked || ""
    };
    Object.entries(setters).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) {
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.value = val;
            else el.innerText = val;
        }
    });
    const avatar = p.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    ['header-avatar', 'profile-avatar-display'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = avatar;
    });
    const welcome = document.getElementById('welcome-message');
    if (welcome) welcome.innerText = `Hola, ${p.name.split(' ')[0]} 👋`;
}

function renderAvailabilityConfig() {
    const container = document.getElementById('availability-config');
    if (!container) return;
    const days = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
    const current = state.profile.availability?.weekly || ["office", "office", "office", "office", "online", "off", "off"];
    container.innerHTML = days.map((day, i) => `
        <div class="glass-card" style="padding: 1rem; background: rgba(255,255,255,0.5);">
            <div style="font-weight: 700; margin-bottom: 0.5rem; color: var(--primary);">${day}</div>
            <select class="availability-select" data-index="${i}" style="width: 100%; padding: 0.4rem; border-radius: 8px; border: 1px solid #ddd;">
                <option value="office" ${current[i] === 'office' ? 'selected' : ''}>🏢 Presencial</option>
                <option value="online" ${current[i] === 'online' ? 'selected' : ''}>💻 Online</option>
                <option value="off" ${current[i] === 'off' ? 'selected' : ''}>❌ Cerrado</option>
            </select>
        </div>
    `).join('');
}

// --- Dynamic Link ---
window.generateBookingLink = () => {
    const p = state.profile;
    if (!p.whatsapp) { alert("Por favor, ingresa tu número de WhatsApp."); return; }
    
    // Weekly
    const weeklyRaw = Array.from(document.querySelectorAll('.availability-select'))
        .sort((a,b) => a.dataset.index - b.dataset.index).map(s => s.value);
    const mapping = { off: '0', online: '1', office: '2' };
    const schEncoded = weeklyRaw.map(v => mapping[v]).join('');

    // Overrides
    const overrides = p.availability?.overrides || {};
    const ovEncoded = Object.entries(overrides).map(([d, m]) => `${d.replace(/-/g,'')}:${mapping[m]}`).join(',');

    const baseUrl = `https://paolosalazar859-maker.github.io/nutricion/reserva.html`;
    const params = new URLSearchParams({
        wa: p.whatsapp.replace(/\D/g, ''),
        n: p.name,
        s: p.specialty,
        sis: p.sis || "",
        u: p.university || "",
        sch: schEncoded,
        blk: document.getElementById('blocked-dates').value.replace(/\s/g, ''),
        ov: ovEncoded
    });

    const link = `${baseUrl}?${params.toString()}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(link).then(() => alert("¡Planificador Mensual sincronizado! Enlace copiado."));
    } else {
        alert("Enlace: " + link);
    }
};

// --- Standard Calendar Logic ---
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
    for (let i = 0; i < startOffset; i++) grid.appendChild(Object.assign(document.createElement('div'), {className: 'calendar-day empty'}));
    const todayStr = formatDate(new Date());
    const selectedStr = formatDate(state.selectedDate);
    for (let day = 1; day <= daysInMonth; day++) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day';
        dayDiv.innerText = day;
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        if (dateStr === todayStr) dayDiv.classList.add('today');
        if (dateStr === selectedStr) { dayDiv.style.borderColor = 'var(--primary)'; dayDiv.style.background = 'rgba(109, 40, 217, 0.1)'; }
        if (state.appointments.some(a => a.date === dateStr)) { dayDiv.style.fontWeight = '700'; dayDiv.style.color = 'var(--primary)'; dayDiv.innerHTML += '<div class="dot"></div>'; }
        dayDiv.onclick = () => { state.selectedDate = new Date(year, month, day); renderCalendar(); renderAppointments(); updateDateDisplay(); };
        grid.appendChild(dayDiv);
    }
}

function renderAppointments() {
    const list = document.getElementById('appointments-list');
    if (!list) return;
    const dateStr = formatDate(state.selectedDate);
    const dayApps = state.appointments.filter(a => a.date === dateStr).sort((a, b) => a.time.localeCompare(b.time));
    if (dayApps.length === 0) { list.innerHTML = '<p class="empty-msg">No hay citas.</p>'; return; }
    list.innerHTML = dayApps.map(app => `
        <div class="appointment-item">
            <div class="info">
                <div class="time">${app.time}</div>
                <div class="pat">${app.patient}</div>
            </div>
            <button class="btn del" onclick="deleteAppointment('${app.id}')"><i data-lucide="trash-2" size="16"></i></button>
        </div>
    `).join('');
    if (window.lucide) lucide.createIcons();
}

// --- Patient & History ---
function renderPatients() {
    const list = document.getElementById('patients-list');
    if (!list) return;
    if (state.patients.length === 0) { list.innerHTML = '<p class="empty-msg">Sin pacientes.</p>'; return; }
    list.innerHTML = state.patients.map(p => `
        <div class="patient-row">
            <div class="info"><h4>${p.name}</h4><p>${p.email}</p></div>
            <div class="btns">
                <button class="btn" onclick="openHistory('${p.id}')">Historial</button>
                <button class="btn del" onclick="deletePatient('${p.id}')"><i data-lucide="user-minus" size="18"></i></button>
            </div>
        </div>
    `).join('');
    if (window.lucide) lucide.createIcons();
}

window.openAddPatientModal = () => { const n = prompt("Nombre:"); const e = prompt("Email:"); if (n && e) { state.patients.push({ id: Date.now().toString(), name: n, email: e, records: [] }); savePatients(); renderPatients(); } };
window.deletePatient = (id) => { if (confirm('¿Eliminar?')) { state.patients = state.patients.filter(p => p.id !== id); savePatients(); renderPatients(); } };
window.openHistory = (pid) => { state.activePatientId = pid; const p = state.patients.find(x => x.id === pid); if (!p) return; document.getElementById('history-patient-name').innerText = p.name; document.getElementById('history-patient-meta').innerText = p.email; renderHistoryRecords(); document.getElementById('patient-history-overlay').style.display = 'flex'; };
window.closeHistoryModal = () => { document.getElementById('patient-history-overlay').style.display = 'none'; };
function renderHistoryRecords() {
    const p = state.patients.find(x => x.id === state.activePatientId);
    const list = document.getElementById('history-records-list');
    if (!list || !p) return;
    if (p.records.length === 0) { list.innerHTML = '<p class="empty-msg">Sin registros.</p>'; return; }
    list.innerHTML = p.records.sort((a,b) => b.date.localeCompare(a.date)).map(r => `
        <div class="history-card">
            <div class="date">${r.date}</div>
            <div class="stats">Peso: ${r.weight}kg | Grasa: ${r.fat || '-'}%</div>
            <p>${r.notes}</p>
        </div>
    `).join('');
}

// --- Global Event Listeners ---
function setupEventListeners() {
    document.querySelectorAll('.nav-item').forEach(item => { item.onclick = () => showView(item.dataset.view); });
    const addClick = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
    
    // Dashboard Months
    addClick('prev-month', () => { state.currentDate.setMonth(state.currentDate.getMonth() - 1); renderCalendar(); });
    addClick('next-month', () => { state.currentDate.setMonth(state.currentDate.getMonth() + 1); renderCalendar(); });
    
    // Planning Months
    addClick('plan-prev-month', () => { state.planningDate.setMonth(state.planningDate.getMonth() - 1); renderPlanningCalendar(); });
    addClick('plan-next-month', () => { state.planningDate.setMonth(state.planningDate.getMonth() + 1); renderPlanningCalendar(); });

    addClick('open-booking', () => { const i = document.getElementById('appointment-date'); if (i) i.value = formatDate(state.selectedDate); const m = document.getElementById('modal-overlay'); if (m) m.style.display = 'flex'; });
    addClick('close-modal', () => { const m = document.getElementById('modal-overlay'); if (m) m.style.display = 'none'; });

    const bForm = document.getElementById('booking-form');
    if (bForm) bForm.onsubmit = (e) => {
        e.preventDefault();
        state.appointments.push({ id: Date.now().toString(), patient: document.getElementById('patient-name').value, date: document.getElementById('appointment-date').value, time: document.getElementById('appointment-time').value, type: document.getElementById('appointment-type').value });
        saveAppointments();
        document.getElementById('modal-overlay').style.display = 'none';
        bForm.reset(); renderCalendar(); renderAppointments();
    };

    const pForm = document.getElementById('profile-form');
    if (pForm) pForm.onsubmit = (e) => {
        e.preventDefault();
        const weekly = Array.from(document.querySelectorAll('.availability-select')).sort((a,b) => a.dataset.index - b.dataset.index).map(s => s.value);
        state.profile = { ...state.profile, name: document.getElementById('profile-name').value, specialty: document.getElementById('profile-specialty').value, sis: document.getElementById('profile-sis').value, university: document.getElementById('profile-university').value, whatsapp: document.getElementById('profile-whatsapp').value, price: document.getElementById('profile-price').value, email: document.getElementById('profile-email').value, address: document.getElementById('profile-address').value, bio: document.getElementById('profile-bio').value, availability: { ...state.profile.availability, weekly: weekly, blocked: document.getElementById('blocked-dates').value.trim() } };
        saveProfile();
        alert('Perfil actualizado.');
    };

    const hForm = document.getElementById('history-form');
    if (hForm) hForm.onsubmit = (e) => {
        e.preventDefault();
        const p = state.patients.find(x => x.id === state.activePatientId);
        if (!p) return;
        p.records.push({ id: Date.now().toString(), date: new Date().toISOString().split('T')[0], weight: document.getElementById('hist-weight').value, fat: document.getElementById('hist-fat').value, notes: document.getElementById('hist-notes').value });
        savePatients(); renderHistoryRecords(); hForm.reset();
    };
}

// --- Helpers ---
function formatDate(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function saveAppointments() { localStorage.setItem('nutriAppointments', JSON.stringify(state.appointments)); }
function savePatients() { localStorage.setItem('nutriPatients', JSON.stringify(state.patients)); }
window.deleteAppointment = (id) => { if (confirm('¿Eliminar?')) { state.appointments = state.appointments.filter(a => a.id !== id); saveAppointments(); renderCalendar(); renderAppointments(); } };
function updateDateDisplay() { const el = document.getElementById('selected-date-text'); if (el) el.innerText = state.selectedDate.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }); }

init();
