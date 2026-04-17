// --- Supabase Config ---
const SUPABASE_URL = "https://mtrvicvbtasjzfsdegfa.supabase.co";
const SUPABASE_KEY = "sb_publishable_iP_hKoRhKHo4pRLph9JmJg_9PB0Lqct";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- Application State ---
let state = {
    currentDate: new Date(),
    selectedDate: new Date(),
    planningDate: new Date(),
    selectedPlanningDates: [],
    appointments: [],
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
            weekly: Array(7).fill({m: 'office', s: '09:00', e: '14:00'}),
            blocked: "",
            overrides: {}
        }
    },
    patients: [],
    activePatientId: null
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log("OptimizateNutri initializing...");
    try {
        await init();
        console.log("OptimizateNutri ready (Cloud Sync active)!");
    } catch (e) {
        console.error("Initialization failed:", e);
    }
});

async function init() {
    loadProfile();
    await loadInitialData();
    setupRealtime();
    
    renderCalendar();
    renderAppointments();
    renderPatients();
    renderAvailabilityConfig();
    renderPlanningCalendar();
    updatePlanningSummary(formatDate(state.planningDate));
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
    const weekly = state.profile.availability?.weekly || [];

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
        const config = overrides[dateStr] || weekly[schIdx] || {m: 'off'};
        const modality = config.m;
        
        if (modality === 'office') dayDiv.style.borderLeft = '4px solid var(--primary)';
        if (modality === 'online') dayDiv.style.borderLeft = '4px solid #3b82f6';
        if (modality === 'off') dayDiv.style.borderLeft = '4px solid #94a3b8';
        if (state.selectedPlanningDates.includes(dateStr)) dayDiv.classList.add('selected');

        // Dot indicator for appointments
        const hasApps = state.appointments.some(a => a.date === dateStr);
        if (hasApps) {
            const dot = document.createElement('div');
            dot.className = 'dot';
            dot.style.bottom = '4px';
            dot.style.right = '4px';
            dayDiv.appendChild(dot);
        }

        dayDiv.onmousedown = (e) => { 
            e.preventDefault(); 
            isDragging = true;
            dragMode = !state.selectedPlanningDates.includes(dateStr);
            setSelection(dateStr, dragMode);
            updatePlanningSummary(dateStr);
        };

        dayDiv.onmouseenter = () => { 
            if (isDragging) setSelection(dateStr, dragMode); 
        };

        dayDiv.onclick = (e) => {
            if (!isDragging) updatePlanningSummary(dateStr);
        };
        
        grid.appendChild(dayDiv);
    }
}

window.updatePlanningSummary = (dateStr) => {
    const p = state.profile;
    const d = new Date(dateStr + "T12:00:00"); // Avoid timezone shift
    const year = d.getFullYear();
    const month = d.getMonth();
    const day = d.getDate();
    
    document.getElementById('plan-selected-date').innerText = d.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // Get config for this day
    const overrides = p.availability?.overrides || {};
    const weekly = p.availability?.weekly || [];
    let dayIdx = d.getDay();
    let schIdx = dayIdx === 0 ? 6 : dayIdx - 1;
    const config = overrides[dateStr] || weekly[schIdx] || {m: 'off', s: '09:00', e: '14:00'};

    const apps = state.appointments.filter(a => a.date === dateStr);
    
    // Calculate availability
    const startH = parseInt(config.s.split(':')[0]);
    const endH = parseInt(config.e.split(':')[0]);
    const totalSlots = config.m === 'off' ? 0 : (endH - startH + 1);
    const availableSlots = Math.max(0, totalSlots - apps.length);

    const labels = { office: '🏢 Presencial', online: '💻 Online', off: '❌ Cerrado' };
    
    const stats = document.getElementById('plan-stats');
    stats.innerHTML = `
        <div class="glass-card" style="padding: 0.8rem; text-align: center;">
            <div style="font-size: 0.75rem; color: var(--text-muted);">Estado</div>
            <div style="font-weight: 700;">${labels[config.m]}</div>
        </div>
        <div class="glass-card" style="padding: 0.8rem; text-align: center;">
            <div style="font-size: 0.75rem; color: var(--text-muted);">Horas Libres</div>
            <div style="font-weight: 700; color: var(--primary);">${availableSlots} / ${totalSlots}</div>
        </div>
    `;

    const list = document.getElementById('plan-appointments-list');
    if (apps.length === 0) {
        list.innerHTML = '<p class="empty-msg">Sin citas en este día.</p>';
    } else {
        list.innerHTML = apps.sort((a,b)=>a.time.localeCompare(b.time)).map(a => `
            <div class="appointment-item" style="margin-bottom: 0.5rem; padding: 0.8rem;">
                <div class="info">
                    <div class="time">${a.time}</div>
                    <div class="pat">${a.patient}</div>
                </div>
            </div>
        `).join('');
    }
};

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
    if (!state.profile.availability) state.profile.availability = { weekly: [], blocked: "", overrides: {} };
    if (!state.profile.availability.overrides) state.profile.availability.overrides = {};

    if (state.selectedPlanningDates.length === 0) {
        alert("Primero selecciona algunos días en el calendario.");
        return;
    }
    
    const startTime = document.getElementById('bulk-start-time').value;
    const endTime = document.getElementById('bulk-end-time').value;

    state.selectedPlanningDates.forEach(dateStr => {
        state.profile.availability.overrides[dateStr] = {
            m: modality,
            s: startTime,
            e: endTime
        };
    });
    
    saveProfile();
    state.selectedPlanningDates = [];
    renderPlanningCalendar();
    updateSelectionStatus();
    
    const labels = { office: 'Presencial 🏢', online: 'Online 💻', off: 'Cerrado ❌' };
    alert(`¡Listo! Se ha aplicado la modalidad ${labels[modality]} (${startTime}-${endTime}) a los días seleccionados.`);
};

window.markAllMonthOff = () => {
    if (!confirm('¿Seguro quieres poner TODO el mes como "CERRADO" para empezar a planificar desde cero?')) return;
    if (!state.profile.availability) state.profile.availability = { weekly: [], blocked: "", overrides: {} };
    if (!state.profile.availability.overrides) state.profile.availability.overrides = {};

    const year = state.planningDate.getFullYear();
    const month = state.planningDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    for (let day = 1; day <= daysInMonth; day++) {
        const d = new Date(year, month, day);
        const dateStr = formatDate(d);
        state.profile.availability.overrides[dateStr] = { m: 'off', s: '09:00', e: '14:00' };
    }

    saveProfile();
    state.selectedPlanningDates = [];
    renderPlanningCalendar();
    updateSelectionStatus();
    alert('Todo el mes se ha marcado como CERRADO.');
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
        'profile-bio': p.bio
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
    
    // Migration check
    if (!Array.isArray(state.profile.availability?.weekly) || typeof state.profile.availability.weekly[0] === 'string') {
        state.profile.availability.weekly = Array(7).fill({m: 'office', s: '09:00', e: '14:00'});
    }

    const current = state.profile.availability.weekly;
    
    container.innerHTML = days.map((day, i) => `
        <div class="glass-card" style="padding: 1rem; background: rgba(255,255,255,0.5);">
            <div style="font-weight: 700; margin-bottom: 0.5rem; color: var(--primary);">${day}</div>
            <select class="avail-mod" data-index="${i}" style="width: 100%; padding: 0.4rem; border-radius: 8px; border: 1px solid #ddd; margin-bottom: 0.5rem;">
                <option value="office" ${current[i].m === 'office' ? 'selected' : ''}>🏢 Presencial</option>
                <option value="online" ${current[i].m === 'online' ? 'selected' : ''}>💻 Online</option>
                <option value="off" ${current[i].m === 'off' ? 'selected' : ''}>❌ Cerrado</option>
            </select>
            <div style="display: flex; align-items: center; gap: 0.3rem;">
                <input type="text" class="avail-start" data-index="${i}" value="${current[i].s || '09:00'}" style="width: 50px; padding: 0.2rem; font-size: 0.8rem; border-radius: 4px; border: 1px solid #ddd;">
                <span style="font-size: 0.7rem;">a</span>
                <input type="text" class="avail-end" data-index="${i}" value="${current[i].e || '14:00'}" style="width: 50px; padding: 0.2rem; font-size: 0.8rem; border-radius: 4px; border: 1px solid #ddd;">
            </div>
        </div>
    `).join('');
}

// --- Dynamic Link ---
window.generateBookingLink = () => {
    const p = state.profile;
    if (!p.whatsapp) { alert("Por favor, ingresa tu número de WhatsApp."); return; }
    
    const mapping = { off: '0', online: '1', office: '2' };
    
    // Weekly
    const weeklyData = daysArray().map(i => {
        const m = document.querySelector(`.avail-mod[data-index="${i}"]`).value;
        const s = document.querySelector(`.avail-start[data-index="${i}"]`).value.replace(':', '');
        const e = document.querySelector(`.avail-end[data-index="${i}"]`).value.replace(':', '');
        return `${mapping[m]}${s}${e}`;
    });
    const schEncoded = weeklyData.join(',');

    // Overrides
    const overrides = p.availability?.overrides || {};
    const ovEncoded = Object.entries(overrides).map(([d, val]) => {
        const dateKey = d.replace(/-/g,'');
        const s = val.s.replace(':', '');
        const e = val.e.replace(':', '');
        return `${dateKey}_${mapping[val.m]}${s}${e}`;
    }).join(',');

    const baseUrl = `https://paolosalazar859-maker.github.io/nutricion/reserva.html`;
    const params = new URLSearchParams({
        wa: p.whatsapp.replace(/\D/g, ''),
        n: p.name,
        s: p.specialty,
        sis: p.sis || "",
        u: p.university || "",
        sch: schEncoded,
        ov: ovEncoded
    });

    const link = `${baseUrl}?${params.toString()}`;
    
    // Copy to clipboard with visual feedback
    const dummy = document.createElement('textarea');
    document.body.appendChild(dummy);
    dummy.value = link;
    dummy.select();
    document.execCommand('copy');
    document.body.removeChild(dummy);
    
    alert("¡Enlace copiado con éxito! Ya puedes pegarlo donde desees.");
};

function daysArray() { return [0,1,2,3,4,5,6]; }

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
            <div class="info">
                <h4>${p.name}</h4>
                <p>${p.rut ? 'RUT: ' + p.rut + ' | ' : ''}${p.phone || p.email}</p>
            </div>
            <div class="btns">
                <button class="btn" onclick="openHistory('${p.id}')">Historial</button>
                <button class="btn del" onclick="deletePatient('${p.id}')"><i data-lucide="user-minus" size="18"></i></button>
            </div>
        </div>
    `).join('');
    if (window.lucide) lucide.createIcons();
}

window.openAddPatientModal = async () => { 
    const n = prompt("Nombre:"); 
    const r = prompt("RUT (sin puntos ni guion):");
    const p = prompt("WhatsApp:");
    const e = prompt("Email:"); 
    if (n) { 
        const { error } = await _supabase.from('patients').upsert([{ name: n, email: e, phone: p, rut: r }]);
        if (error) alert(error.message);
        loadInitialData();
    } 
};

window.deletePatient = async (id) => { 
    if (confirm('¿Eliminar paciente y todas sus citas?')) { 
        await _supabase.from('patients').delete().eq('id', id);
        loadInitialData();
    } 
};

window.openHistory = async (pid) => { 
    state.activePatientId = pid; 
    const p = state.patients.find(x => x.id === pid); 
    if (!p) return; 
    
    document.getElementById('history-patient-name').innerText = p.name; 
    document.getElementById('history-patient-meta').innerText = `${p.rut ? 'RUT: ' + p.rut + ' • ' : ''}${p.email || p.phone}`; 
    
    // Fetch records
    const { data: recs } = await _supabase.from('history_records').select('*').eq('patient_id', pid);
    p.records = recs || [];
    
    renderHistoryRecords(); 
    document.getElementById('patient-history-overlay').style.display = 'flex'; 
};

window.closeHistoryModal = () => { document.getElementById('patient-history-overlay').style.display = 'none'; };

function renderHistoryRecords() {
    const p = state.patients.find(x => x.id === state.activePatientId);
    const list = document.getElementById('history-records-list');
    if (!list || !p) return;
    if (!p.records || p.records.length === 0) { list.innerHTML = '<p class="empty-msg">Sin registros previos.</p>'; return; }
    list.innerHTML = p.records.sort((a,b) => b.date.localeCompare(a.date)).map(r => `
        <div class="history-card">
            <div class="date">${r.date}</div>
            <div class="stats">Peso: ${r.weight}kg | Grasa: ${r.fat || '-'}%</div>
            <p>${r.notes || ''}</p>
        </div>
    `).join('');
}

// --- Data Source Sync ---
async function loadInitialData() {
    const { data: apps } = await _supabase.from('appointments').select('*');
    const { data: pats } = await _supabase.from('patients').select('*');
    
    state.appointments = apps || [];
    state.patients = (pats || []).map(p => ({ ...p, records: [] })); // We fetch records on demand

    // Migrate LocalStorage if cloud is empty
    if (state.appointments.length === 0 && localStorage.getItem('nutriAppointments')) {
        migrateToCloud();
    }
}

function setupRealtime() {
    _supabase.channel('custom-all-channel')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, (payload) => {
        console.log('Realtime Update:', payload);
        handleExternalChange(payload);
    })
    .subscribe();
}

async function handleExternalChange(payload) {
    if (payload.eventType === 'INSERT') {
        state.appointments.push(payload.new);
    } else if (payload.eventType === 'DELETE') {
        state.appointments = state.appointments.filter(a => a.id !== payload.old.id);
    } else if (payload.eventType === 'UPDATE') {
        const idx = state.appointments.findIndex(a => a.id === payload.new.id);
        if (idx !== -1) state.appointments[idx] = payload.new;
    }
    renderCalendar();
    renderAppointments();
}

async function migrateToCloud() {
    const localApps = JSON.parse(localStorage.getItem('nutriAppointments')) || [];
    if (localApps.length > 0 && confirm("¿Deseas migrar tus citas locales a la nube para que sean visibles desde la web?")) {
        const toUpload = localApps.map(a => ({ patient_name: a.patient, date: a.date, time: a.time, modality: a.type }));
        await _supabase.from('appointments').insert(toUpload);
        loadInitialData();
    }
}

// --- Global Event Listeners ---
function setupEventListeners() {
    document.querySelectorAll('.nav-item').forEach(item => { item.onclick = () => showView(item.dataset.view); });
    const addClick = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
    
    addClick('prev-month', () => { state.currentDate.setMonth(state.currentDate.getMonth() - 1); renderCalendar(); });
    addClick('next-month', () => { state.currentDate.setMonth(state.currentDate.getMonth() + 1); renderCalendar(); });
    addClick('plan-prev-month', () => { state.planningDate.setMonth(state.planningDate.getMonth() - 1); renderPlanningCalendar(); });
    addClick('plan-next-month', () => { state.planningDate.setMonth(state.planningDate.getMonth() + 1); renderPlanningCalendar(); });

    addClick('open-booking', () => { const i = document.getElementById('appointment-date'); if (i) i.value = formatDate(state.selectedDate); const m = document.getElementById('modal-overlay'); if (m) m.style.display = 'flex'; });
    addClick('close-modal', () => { const m = document.getElementById('modal-overlay'); if (m) m.style.display = 'none'; });

    const hForm = document.getElementById('history-form');
    if (hForm) hForm.onsubmit = async (e) => {
        e.preventDefault();
        const record = { 
            patient_id: state.activePatientId,
            date: new Date().toISOString().split('T')[0], 
            weight: document.getElementById('hist-weight').value, 
            fat: document.getElementById('hist-fat').value, 
            notes: document.getElementById('hist-notes').value 
        };
        const { error } = await _supabase.from('history_records').insert([record]);
        if (error) alert(error.message);
        
        // Refresh local state and UI
        await window.openHistory(state.activePatientId);
        hForm.reset();
    };

    const bForm = document.getElementById('booking-form');
    if (bForm) bForm.onsubmit = async (e) => {
        e.preventDefault();
        const app = { 
            patient_name: document.getElementById('patient-name').value, 
            date: document.getElementById('appointment-date').value, 
            time: document.getElementById('appointment-time').value, 
            modality: document.getElementById('appointment-type').value 
        };
        const { error } = await _supabase.from('appointments').insert([app]);
        if (error) alert(error.message);
        document.getElementById('modal-overlay').style.display = 'none';
        bForm.reset();
    };

    const pForm = document.getElementById('profile-form');
    if (pForm) pForm.onsubmit = (e) => {
        e.preventDefault();
        const weekly = daysArray().map(i => ({
            m: document.querySelector(`.avail-mod[data-index="${i}"]`).value,
            s: document.querySelector(`.avail-start[data-index="${i}"]`).value,
            e: document.querySelector(`.avail-end[data-index="${i}"]`).value
        }));
        state.profile = { ...state.profile, name: document.getElementById('profile-name').value, specialty: document.getElementById('profile-specialty').value, sis: document.getElementById('profile-sis').value, university: document.getElementById('profile-university').value, whatsapp: document.getElementById('profile-whatsapp').value, price: document.getElementById('profile-price').value, email: document.getElementById('profile-email').value, address: document.getElementById('profile-address').value, bio: document.getElementById('profile-bio').value, availability: { ...state.profile.availability, weekly: weekly, blocked: "" } };
        saveProfile();
        alert('Perfil actualizado.');
    };
}

// --- Helpers ---
function formatDate(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function saveProfile() { localStorage.setItem('nutriProfile', JSON.stringify(state.profile)); }

window.deleteAppointment = async (id) => { 
    if (confirm('¿Eliminar cita?')) { 
        await _supabase.from('appointments').delete().eq('id', id);
    } 
};
function updateDateDisplay() { const el = document.getElementById('selected-date-text'); if (el) el.innerText = state.selectedDate.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }); }

init();
