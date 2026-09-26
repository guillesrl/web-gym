// --- State ---
// Se detectaron casos (algunos móviles/navegadores) donde la clave principal
// 'entreno-brutal' se vacía sola sin tocar el resto de localStorage. Como red
// de seguridad local (sin depender de red), se mantiene una copia espejo en
// otra clave; si la principal aparece vacía pero el espejo tiene datos reales,
// se restaura desde ahí automáticamente.
const STATE_KEY = 'entreno-brutal';
const STATE_MIRROR_KEY = 'entreno-brutal-mirror';

let currentWeek = 1, currentTab = localStorage.getItem('rutina-genero') === 'hombre' ? 'hombre' : 'tonificar';

// Fecha con la que trabaja la app: por defecto hoy. La semana del programa ya no
// se elige a mano, se deduce de esta fecha.
// IMPORTANTE: selectedDate se declara ANTES de loadState() porque loadState()
// -> normalizeState() -> getCurrentWeekCount() la necesita para calcular la
// semana. Si se declara después, la lectura ocurre en temporal dead zone.
let selectedDate = getLocalDateKey();
// Mes que se está mostrando en la tira de días (día 1 del mes)
let stripMonth = new Date();

let state = loadState();

// Semana del programa (1-4) que cicla: tras la 4 vuelve a la 1
function programWeekFromDays(diffDays) {
    if (diffDays < 0) return 1;
    return (Math.floor(diffDays / 7) % 4) + 1;
}

// Semana del programa a la que corresponde una fecha concreta
function getWeekForDate(dateStr) {
    const startDate = localStorage.getItem('program-start-date');
    if (!startDate || !dateStr) return 1;
    const start = new Date(startDate + 'T12:00:00');
    const d = new Date(dateStr + 'T12:00:00');
    const diffDays = Math.floor((d - start) / (1000 * 60 * 60 * 24));
    return programWeekFromDays(diffDays);
}

// Ejercicios de una sesión: los guardados en el entreno o, si no, los del día de la rutina
function getWorkoutExercises(w) {
    if (Array.isArray(w.exercises)) return w.exercises;
    const week = getWeekForDate(w.date);
    const day = routines[w.type]?.[String(week)]?.[w.notes]
        || routines[w.type]?.['1']?.[w.notes] || [];
    return day.map(e => ({ name: e.name, detail: e.detail || '' }));
}

const GIF_CDN = 'https://static.exercisedb.dev/media/';
const exerciseImageMap = {
    'Remo':                      'fUBheHs',
    'Jalón al pecho':            'eYnzaCm',
    'Pullover en polea':         'PskORrA',
    'Plancha':                   'VBAWRPG',
    'Hip Thrust':                'SNFfUff',
    'Peso muerto':               'ila4NZS',
    'Sentadilla rumana':         'ila4NZS',
    'Abducciones':               'CHpahtl',
    'Isquios en máquina':        'Zg3XY7P',
    'Vuelos laterales':          'DsgkuIt',
    'Press de hombro':           'CggQhII',
    'Pecho en máquina':          'T0yTjgW',
    'Bíceps en polea':           'G08RZcQ',
    'Tríceps en polea':          '3ZflifB',
    'Sentadilla':                'qXTaZnJ',
    'Cuádriceps en máquina':     'V07qpXy',
    'Pájaros con mancuernas':    'DsgkuIt',
    'Patada de glúteo':          'Kpajagk',
    'Press de banca':            'EIeI8Vf',
    'Press inclinado mancuernas':'ns0SIbU',
    'Curl con barra':            '25GPyDY',
    'Bíceps con mancuernas':     'NbVPDMW',
    'Jalón cerrado':            '4c9BhzB',
    'Tríceps con mancuerna':    'PdmaD0N',
    'Gemelos':                   'bOOdeyc',
    'Cardio':                    'oLrKqDH',
    'Prensa de piernas':         '10Z2DXU',
    'Extensiones de columna en banco': 'zkgRrbK',
    'Zancadas':                  'SSsBDwB',
    'Aducciones':                'oHsrypV',
    'Abs en banco inclinado':    'QLL2gdc',
    'Vuelos frontales':          '3eGE2JC',
};

// Fallback estático (JPG) cuando no hay GIF en exercisedb.
// Fuente: yuhonas/free-exercise-db (dominio público).
const JPG_CDN = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';
const exerciseFallbackImageMap = {
    'Face pull':                       'Face_Pull',
    'Extensiones de columna en banco': 'Hyperextensions',
    'Vuelos frontales':                'Front_Dumbbell_Raise',
    'Zancadas':                        'Dumbbell_Lunges',
    'Aducciones':                      'Thigh_Adductor',
    'Cuádriceps en máquina':           'Leg_Extensions',
    'Pájaros con mancuernas':          'Dumbbell_Rear_Lateral_Raise',
    'Bíceps con mancuernas':            'Dumbbell_Bicep_Curl',
    'Jalón cerrado':                  'Close-Grip_Front_Lat_Pulldown',
    'Tríceps con mancuerna':           'Standing_Dumbbell_Triceps_Extension',
};

// GIFs alternativos para cuando ExerciseDB no tenga una referencia equivalente.
const exerciseDirectImageMap = {
    'Remo':                            'https://fitcron.com/wp-content/uploads/2021/04/08611301-Cable-seated-row_Back_720.gif',
    'Jalón al pecho':                  'https://fitcron.com/wp-content/uploads/2021/04/01981301-Cable-Pulldown_Back_720.gif',
    'Pullover en polea':               'https://fitcron.com/wp-content/uploads/2021/03/01841301-Cable-Lying-Extension-Pullover-with-rope-attachment_Back_720.gif',
    'Face pull':                       'https://burnfit.io/en/wp-content/uploads/sites/3/2026/01/FACE_PULL-1.gif',
    'Extensiones de columna en banco': 'https://fitcron.com/wp-content/uploads/2021/04/04891301-Hyperextension_Waist_720.gif',
    'Pájaros con mancuernas':          'https://fitcron.com/wp-content/uploads/2021/04/03801301-Dumbbell-Rear-Lateral-Raise_Shoulders_720.gif',
    'Hip Thrust':                      'https://fitcron.com/wp-content/uploads/2021/04/10601301-Barbell-Hip-Thrust_Hips_720.gif',
    'Peso muerto':                     'https://fitcron.com/wp-content/uploads/2021/04/00321301-Barbell-Deadlift_Hips-FIX_720.gif',
    'Zancadas':                        'https://fitcron.com/wp-content/uploads/2021/04/03811301-Dumbbell-Rear-Lunge_Thighs_720.gif',
    'Sentadilla rumana':               'https://fitcron.com/wp-content/uploads/2021/04/14591301-Dumbbell-Romanian-Deadlift_Hips_720.gif',
    'Abducciones':                     'https://fitcron.com/wp-content/uploads/2021/04/05971301-Lever-Seated-Hip-Abduction_Hips-FIX_720.gif',
    'Aducciones':                      'https://fitcron.com/wp-content/uploads/2021/04/05981301-Lever-Seated-Hip-Adduction_Thighs_720.gif',
    'Isquios en máquina':              'https://fitcron.com/wp-content/uploads/2021/04/05861301-Lever-Lying-Leg-Curl_Thighs_720.gif',
    'Vuelos frontales':                'https://fitcron.com/wp-content/uploads/2021/04/03101301-Dumbbell-Front-Raise_Shoulders_720.gif',
    'Vuelos laterales':                'https://fitcron.com/wp-content/uploads/2021/04/33431301-Lever-Lateral-Raise-VERSION-2_Shoulders_720.gif',
    'Press de hombro':                 'https://fitcron.com/wp-content/uploads/2021/04/11651301-Barbell-Standing-Military-Press-without-rack_Shoulders_720.gif',
    'Bíceps en polea':                 'https://fitcron.com/wp-content/uploads/2021/04/01951301-Cable-Preacher-Curl_Upper-Arms_720.gif',
    'Tríceps en polea':                'https://fitcron.com/wp-content/uploads/2021/04/37191301-Cable-Standing-High-Cross-Triceps-Extension_Upper-Arms_720.gif',
    'Sentadilla':                      'https://fitcron.com/wp-content/uploads/2021/04/00431301-Barbell-Full-Squat_Thighs_720.gif',
    'Cuádriceps en máquina':           'https://fitcron.com/wp-content/uploads/2021/04/05851301-Lever-Leg-Extension_Thighs_720.gif',
};

function getExerciseImageUrl(name) {
    const customImage = getExerciseMeta(name).image;
    if (customImage) return customImage;
    const hash = exerciseImageMap[name];
    if (hash) return `${GIF_CDN}${hash}.gif`;
    const direct = exerciseDirectImageMap[name];
    if (direct) return direct;
    const slug = exerciseFallbackImageMap[name];
    if (slug) return `${JPG_CDN}${slug}/0.jpg`;
    return null;
}

function getDayMapFor(program) {
    if (program === 'hombre') return { 1: 'Día 1', 3: 'Día 2', 5: 'Día 3' };
    return { 1: 'Día 1', 2: 'Día 2', 3: 'Día 3', 4: 'Día 4', 5: 'Día 5' };
}
function getDayMap() {
    return getDayMapFor(currentTab);
}

function getDayLabelFor(program, dayKey) {
    const muscle = routines.labels?.[program]?.[dayKey];
    const parts = [dayKey, muscle].filter(Boolean);
    return parts.length ? parts.join(' · ') : dayKey;
}
function getDayLabel(dayKey) {
    return getDayLabelFor(currentTab, dayKey);
}
function programLabel(program) {
    return program === 'hombre' ? 'Hombre' : (program === 'tonificar' ? 'Mujer' : program);
}

function getProgramDays() {
    const wk = routines[currentTab]?.['1'] || routines[currentTab]?.[1];
    const n = wk ? Object.keys(wk).length : 0;
    return n || (currentTab === 'hombre' ? 3 : 5);
}

function parseDetail(detail) {
    const m = String(detail || '').match(/^(\d+)\s*x\s*(\d+)(.*)$/i);
    if (!m) return { series: '', reps: '', suffix: detail || '' };
    return { series: m[1], reps: m[2], suffix: m[3].trim() };
}

function setRepKey(field, name, week) {
    return `${field}:w${week}:${name}`;
}

function renderDetailInputs(name, detail) {
    const parsed = parseDetail(detail);
    const week = currentWeek;
    const isBlankWomenRoutine = currentTab === 'tonificar' && parsed.series === '0' && parsed.reps === '0';
    const savedSeries = localStorage.getItem(setRepKey('series', name, week));
    const savedReps = localStorage.getItem(setRepKey('reps', name, week));
    const seriesValue = savedSeries === null ? (isBlankWomenRoutine ? '0' : '') : savedSeries;
    const repsValue = savedReps === null ? (isBlankWomenRoutine ? '0' : '') : savedReps;
    const safeName = escapeHtml(name);
    const suffix = parsed.suffix ? `<span class="suffix">${escapeHtml(parsed.suffix)}</span>` : '';
    const repsPh = parsed.reps + (parsed.suffix ? parsed.suffix.replace(/\s+/g, '') : '');
    return `<span class="exercise-detail">
        <input type="number" min="0" max="20" inputmode="numeric"
            data-exercise="${safeName}" data-week="${week}" data-field="series"
            placeholder="${escapeHtml(parsed.series)}" value="${escapeHtml(seriesValue)}"
            title="Series" onchange="handleSetRepChange(this)">
        <span class="sep">x</span>
        <input type="number" min="0" max="200" inputmode="numeric"
            data-exercise="${safeName}" data-week="${week}" data-field="reps"
            placeholder="${escapeHtml(repsPh)}" value="${escapeHtml(repsValue)}"
            title="Repeticiones" onchange="handleSetRepChange(this)">
        ${suffix}
    </span>`;
}

window.handleSetRepChange = function(input) {
    const key = setRepKey(input.dataset.field, input.dataset.exercise, input.dataset.week);
    if (input.value === '') localStorage.removeItem(key);
    else localStorage.setItem(key, input.value);
};

function defaultState() {
    return { streak: 0, weekCount: 0, total: 0, workouts: [], lastDate: null };
}

function getLocalDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getWeekStartKey(date = new Date()) {
    const weekStart = new Date(date);
    const day = weekStart.getDay() || 7;
    weekStart.setDate(weekStart.getDate() - day + 1);
    return getLocalDateKey(weekStart);
}

// Día anterior a una fecha dada (clave YYYY-MM-DD)
function getPrevDayKey(dateKey) {
    const d = new Date(dateKey + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    return getLocalDateKey(d);
}

// "vie 8 ago" — etiqueta corta de la fecha seleccionada
function formatSelectedDate() {
    const d = getSelectedDateObj();
    return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
}

function getWeekEndKey(date = new Date()) {
    const weekEnd = new Date(date);
    const day = weekEnd.getDay() || 7;
    weekEnd.setDate(weekEnd.getDate() + (7 - day));
    return getLocalDateKey(weekEnd);
}

// "3 - 9 ago": el rango de la semana natural de la fecha seleccionada
function getWeekRangeLabel() {
    const from = dateFromKey(getWeekStartKey(getSelectedDateObj()));
    const to = dateFromKey(getWeekEndKey(getSelectedDateObj()));
    const fmt = (d, withMonth) => d.toLocaleDateString('es-ES',
        withMonth ? { day: 'numeric', month: 'short' } : { day: 'numeric' });
    const sameMonth = from.getMonth() === to.getMonth();
    return `${fmt(from, !sameMonth)} - ${fmt(to, true)}`;
}

function getYesterdayKey() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return getLocalDateKey(yesterday);
}

function getDownloadDateLabel(date = new Date()) {
    return `${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}`;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function normalizeState(saved) {
    const base = defaultState();
    const next = { ...base, ...(saved || {}) };
    next.workouts = Array.isArray(next.workouts) ? next.workouts : [];
    next.total = next.workouts.length;
    next.weekCount = getCurrentWeekCount(next.workouts);
    const today = getLocalDateKey();
    const yesterday = getYesterdayKey();
    if (next.lastDate && next.lastDate !== today && next.lastDate !== yesterday) {
        next.streak = 0;
    }
    return next;
}

// Entrenos hechos en la semana natural (lunes-domingo) de la fecha seleccionada.
// Antes se contaba por semana del programa (1-4), que dura lo mismo pero no
// empieza en lunes: el número no cuadraba con lo que uno tiene en la cabeza.
function getCurrentWeekCount(workouts = state.workouts) {
    const from = getWeekStartKey(getSelectedDateObj());
    const to = getWeekEndKey(getSelectedDateObj());
    return workouts.filter(w => w.date >= from && w.date <= to).length;
}

function loadState() {
    let primary = null;
    try { primary = JSON.parse(localStorage.getItem(STATE_KEY)); } catch { primary = null; }

    if (!primary || !Array.isArray(primary.workouts) || primary.workouts.length === 0) {
        let mirror = null;
        try { mirror = JSON.parse(localStorage.getItem(STATE_MIRROR_KEY)); } catch { mirror = null; }
        if (mirror && Array.isArray(mirror.workouts) && mirror.workouts.length > 0) {
            const restored = normalizeState(mirror);
            localStorage.setItem(STATE_KEY, JSON.stringify(restored));
            localStorage.setItem(STATE_MIRROR_KEY, JSON.stringify(restored));
            return restored;
        }
    }
    return normalizeState(primary);
}

function saveState() {
    const json = JSON.stringify(state);
    localStorage.setItem(STATE_KEY, json);
    localStorage.setItem(STATE_MIRROR_KEY, json);
}

function updateUI() {
    state.total = state.workouts.length;
    state.weekCount = getCurrentWeekCount();
    document.getElementById('streak-days').textContent = state.streak;
    document.getElementById('week-count').textContent = state.weekCount;
    document.getElementById('total-workouts').textContent = state.total;
    updateWeekProgress();
}

function updateWeekProgress() {
    const el = document.getElementById('week-progress');
    if (!el) return;
    const totalDays = getProgramDays();
    const done = Math.min(state.weekCount, totalDays);
    let dots = '';
    for (let i = 0; i < totalDays; i++) {
        dots += `<div class="week-dot${i < done ? ' filled' : ''}"></div>`;
    }
    el.innerHTML = `<span class="week-progress-label">Entrenos ${getWeekRangeLabel()}</span>`
        + `<div class="week-dots">${dots}</div>`
        + `<span class="week-progress-count">${done}/${totalDays}</span>`;
}

function buildHistoryHtml() {
    const downloadDate = getDownloadDateLabel();
    const workouts = [...state.workouts].reverse();
    const rows = workouts.length
        ? workouts.map((w, index) => {
            const exs = getWorkoutExercises(w);
            const dayLabel = w.notes ? getDayLabelFor(w.type, w.notes) : '-';
            const exList = exs.length
                ? `<div style="margin-top:6px;color:#6b6b62;font-size:12px;">${exs.map(e => escapeHtml(e.name) + (e.detail ? ` (${escapeHtml(e.detail)})` : '')).join(', ')}</div>`
                : '';
            return `
            <tr>
                <td>${workouts.length - index}</td>
                <td>${escapeHtml(w.date)}</td>
                <td>${escapeHtml(programLabel(w.type))}</td>
                <td>${escapeHtml(w.duration)} min</td>
                <td>${escapeHtml(w.intensity)}</td>
                <td>${escapeHtml(dayLabel)}${exList}</td>
            </tr>
        `;
        }).join('')
        : '<tr><td colspan="6" class="empty">No hay entrenos registrados todavia.</td></tr>';

    return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Historial ${downloadDate}</title>
    <style>
        * { box-sizing: border-box; }
        body { margin: 0; padding: 32px 18px; background: #fafaf7; color: #000; font-family: Inter, Arial, sans-serif; }
        main { max-width: 920px; margin: 0 auto; }
        header { border-bottom: 4px solid #000; padding-bottom: 18px; margin-bottom: 24px; }
        h1 { margin: 0 0 8px; font-size: 30px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase; }
        .date { color: #6b6b62; font-size: 13px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; }
        .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 24px; }
        .card { background: #fff; border: 2px solid #000; box-shadow: 6px 6px 0 #000; padding: 16px; }
        .value { font-size: 30px; font-weight: 900; }
        .label { font-size: 11px; font-weight: 800; color: #6b6b62; letter-spacing: 1px; text-transform: uppercase; }
        table { width: 100%; border-collapse: collapse; background: #fff; border: 2px solid #000; box-shadow: 6px 6px 0 #000; }
        th, td { border-bottom: 1px solid #d8d6cc; padding: 12px; text-align: left; vertical-align: top; font-size: 14px; }
        th { background: #ffee00; border-bottom: 2px solid #000; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; }
        tr:last-child td { border-bottom: none; }
        .empty { text-align: center; color: #6b6b62; padding: 28px; }
        @media (max-width: 720px) {
            .summary { grid-template-columns: 1fr; }
            table { display: block; overflow-x: auto; white-space: nowrap; }
        }
    </style>
</head>
<body>
    <main>
        <header>
            <h1>Historial de Entrenamiento</h1>
            <div class="date">Descargado el ${downloadDate}</div>
        </header>
        <section class="summary">
            <div class="card"><div class="value">${state.streak}</div><div class="label">Dias racha</div></div>
            <div class="card"><div class="value">${state.weekCount}</div><div class="label">Esta semana</div></div>
            <div class="card"><div class="value">${state.total}</div><div class="label">Total entrenos</div></div>
        </section>
        <table>
            <thead>
                <tr><th>#</th><th>Fecha</th><th>Tipo</th><th>Duracion</th><th>Intensidad</th><th>Notas</th></tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    </main>
</body>
</html>`;
}

function downloadHistory() {
    updateUI();
    const html = buildHistoryHtml();
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Historial-${getDownloadDateLabel()}.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

// --- Utils ---
// ¿Ya hay un entreno registrado de ese día de rutina en la fecha seleccionada?
function isDayRegisteredToday(day, dateKey = selectedDate) {
    return state.workouts.some(w => w.date === dateKey && w.notes === day && w.type === currentTab);
}

function getExplosionRoot() {
    let r = document.getElementById('explosion-root');
    if (!r) {
        r = document.createElement('div');
        r.id = 'explosion-root';
        r.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:99999;';
        document.body.appendChild(r);
    }
    return r;
}

// --- Haptics & Explosion ---
function triggerWorkoutExplosion(originEl) {
    if (navigator.vibrate) navigator.vibrate([80, 40, 120, 40, 80]);

    const container = document.querySelector('.app-container');
    container.classList.remove('shake');
    void container.offsetWidth;
    container.classList.add('shake');
    container.addEventListener('animationend', () => container.classList.remove('shake'), { once: true });

    const root = getExplosionRoot();

    const flash = document.createElement('div');
    flash.className = 'flash-burst';
    flash.style.position = 'absolute';
    root.appendChild(flash);
    flash.addEventListener('animationend', () => flash.remove());

    const colors = ['#ffd700','#ff2d00','#f9c4d2','#00a859','#000','#fff','#ffd700','#ff2d00'];
    const rect = originEl ? originEl.getBoundingClientRect() : { left: window.innerWidth/2, top: window.innerHeight/2, width: 0, height: 0 };
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    for (let i = 0; i < 20; i++) {
        const p = document.createElement('div');
        p.className = 'confetti-particle';
        p.style.position = 'absolute';
        const angle = (i / 20) * Math.PI * 2 + Math.random() * 0.4;
        const dist = 70 + Math.random() * 110;
        p.style.cssText += `left:${cx}px;top:${cy}px;background:${colors[i % colors.length]};border-radius:${Math.random()>.5?'50%':'2px'};`;
        p.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
        p.style.setProperty('--dy', Math.sin(angle) * dist + 'px');
        p.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg');
        p.style.animationDelay = (Math.random() * 60) + 'ms';
        root.appendChild(p);
        p.addEventListener('animationend', () => p.remove());
    }
}

// --- Personal Records ---
function getPR(name) {
    const val = parseFloat(localStorage.getItem('pr:' + name));
    return isNaN(val) ? null : val;
}
function getPRDate(name) { return localStorage.getItem('pr-date:' + name) || ''; }
function checkAndSetPR(name, weight) {
    weight = parseFloat(weight);
    if (!weight || weight <= 0) return false;
    const current = getPR(name);
    if (current === null || weight > current) {
        localStorage.setItem('pr:' + name, weight);
        localStorage.setItem('pr-date:' + name, getLocalDateKey());
        return true;
    }
    return false;
}
let toastTimeout = null;
function showToast(message) {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove('show'), 3200);
}

window.handleWeightChange = function(input) {
    const name = input.dataset.exercise;
    const weight = parseFloat(input.value);
    localStorage.setItem('peso:' + name, input.value);
    const isNewPR = checkAndSetPR(name, weight);
    const badge = input.closest('.exercise-weight').querySelector('.pr-badge');
    if (badge) {
        const pr = getPR(name);
        if (pr !== null) {
            badge.style.display = '';
            badge.textContent = isNewPR ? '🏆 NUEVO PR!' : 'PR: ' + pr + 'kg';
            if (isNewPR) {
                badge.classList.add('pr-new');
                setTimeout(() => { badge.classList.remove('pr-new'); badge.textContent = 'PR: ' + pr + 'kg'; }, 2500);
            }
        }
    }
    // Cambiar un peso no registra el entreno: avisar si el día aún no está registrado,
    // para que no crean que ya quedó guardado en el Historial.
    const registerBtn = input.closest('.routine-day')?.querySelector('.day-register-btn');
    if (registerBtn && !registerBtn.classList.contains('done')) {
        showToast('Peso guardado. No olvides "Registrar entreno" para que quede en el Historial.');
    }
};
function getAllExerciseNames() {
    const names = new Set();
    ['tonificar', 'hombre'].forEach(key => {
        const prog = routines[key];
        if (!prog) return;
        Object.values(prog).forEach(week =>
            Object.values(week).forEach(exs => exs.forEach(ex => names.add(ex.name)))
        );
    });
    Object.keys(exerciseMeta).forEach(name => names.add(name));
    return [...names];
}

function getAllExerciseImageUrls() {
    const urls = {};
    getAllExerciseNames().forEach(name => {
        const url = getExerciseImageUrl(name);
        if (url) urls[name] = url;
    });
    return urls;
}

function prefetchExerciseImages() {
    const urls = getAllExerciseImageUrls();
    Object.values(urls).forEach(url => {
        const img = new Image();
        img.src = url;
    });
}

// --- Frases motivacionales: 7 por día, rotan por semana del año ---
const DAILY_PHRASES = [
    [ // Domingo
        'Domingo de fuerza: lo que siembras hoy, lo cosechas mañana.',
        'Hoy descansa quien quiera ser promedio. Tú no.',
        'El domingo perfecto: una serie más que la semana pasada.',
        'Cierra la semana con la misma intensidad con la que la abriste.',
        'No esperes al lunes para empezar lo que puedes hacer hoy.',
        'Lo difícil de hoy es lo fácil de mañana.',
        'Cada domingo es la base de la próxima semana brutal.'
    ],
    [ // Lunes
        'Lunes brutal: empieza la semana rompiendo límites.',
        'Lunes: el día favorito de los que ganan.',
        'La excusa más fácil es el lunes. Ignórala.',
        'Empieza fuerte, termina más fuerte.',
        'Un lunes entrenado vale por toda la semana planeada.',
        'Hoy decides quién serás el viernes.',
        'Sin lunes no hay viernes. Hazlo contar.'
    ],
    [ // Martes
        'Martes de hierro: cada repetición cuenta.',
        'Hoy nadie te ve, pero el espejo del viernes sí.',
        'Suma una repetición más. Solo una. Siempre.',
        'No bajes el peso, sube tu mentalidad.',
        'El martes separa a los constantes del resto.',
        'La técnica primero. La gloria después.',
        'Lo que no te reta, no te cambia.'
    ],
    [ // Miércoles
        'Miércoles imparable: el dolor es temporal, el orgullo eterno.',
        'Mitad de semana, doble de actitud.',
        'Si llegaste hasta acá, no aflojes ahora.',
        'El miércoles premia a los que no se rindieron el lunes.',
        'No cuentes los días, haz que los días cuenten.',
        'La constancia vence al talento que no entrena.',
        'Hoy es el día perfecto para superarte.'
    ],
    [ // Jueves
        'Jueves de fuego: hoy mejoras la versión de ayer.',
        'Casi viernes. Casi no sirve. Entrena.',
        'El jueves es el ensayo final del campeón.',
        'No busques motivación, crea disciplina.',
        'Una sesión más cerca del cuerpo que quieres.',
        'Cuando duela, sonríe: estás creciendo.',
        'No se trata de tener tiempo, se trata de hacerlo.'
    ],
    [ // Viernes
        'Viernes salvaje: termina la semana sin excusas.',
        'Cierra la semana con la mejor sesión.',
        'El viernes premia lo hecho de lunes a jueves.',
        'No celebres antes de terminar el trabajo.',
        'El viernes del débil es descanso, el del fuerte es PR.',
        'La fiesta espera. La rutina, no.',
        'Salí del gym sintiendo que ganaste la semana.'
    ],
    [ // Sábado
        'Sábado guerrero: el descanso también se entrena.',
        'Sábado activo, semana ganada.',
        'Hoy mueve el cuerpo aunque sea por placer.',
        'El sábado del disciplinado es leyenda.',
        'Recuperar también es progresar.',
        'No todo es peso: hoy estira, respira, vuelve más fuerte.',
        'El esfuerzo del sábado se nota el lunes.'
    ]
];
function getWeekOfYear(date = new Date()) {
    const start = new Date(date.getFullYear(), 0, 1);
    const diff = (date - start) / 86400000;
    return Math.floor((diff + start.getDay()) / 7);
}
function renderDailyMotivation() {
    const el = document.getElementById('daily-motivation');
    if (!el) return;
    const now = new Date();
    const pool = DAILY_PHRASES[now.getDay()];
    el.textContent = pool[getWeekOfYear(now) % pool.length];
}

// --- Calendario: selección por fecha ---
const DAY_INITIALS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                     'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function dateFromKey(key) { return new Date(key + 'T12:00:00'); }
function isSelectedToday() { return selectedDate === getLocalDateKey(); }
function getSelectedDateObj() { return dateFromKey(selectedDate); }

// Día de rutina (Día 1/2/3...) que toca en la fecha seleccionada, o null si es descanso
function getSelectedDayKey() {
    return getDayMap()[getSelectedDateObj().getDay()] || null;
}

function setSelectedDate(key) {
    if (key > getLocalDateKey()) return;   // no se puede ir al futuro
    selectedDate = key;
    const d = dateFromKey(key);
    stripMonth = new Date(d.getFullYear(), d.getMonth(), 1);
    updateWeek();
    updateUI();
}

// Pinta los días del mes visible. El seleccionado queda marcado y centrado.
function renderDateStrip() {
    const strip = document.getElementById('date-strip');
    if (!strip) return;
    const year = stripMonth.getFullYear(), month = stripMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayKey = getLocalDateKey();

    document.getElementById('date-month').textContent = `${MONTH_NAMES[month]} ${year}`;

    let html = '';
    for (let day = 1; day <= daysInMonth; day++) {
        const d = new Date(year, month, day);
        const key = getLocalDateKey(d);
        const classes = ['date-cell'];
        if (key === selectedDate) classes.push('selected');
        if (key === todayKey) classes.push('today');
        if (key > todayKey) classes.push('future');
        html += `<button type="button" class="${classes.join(' ')}" data-date="${key}"${key > todayKey ? ' disabled' : ''}>
            <span class="date-cell-dow">${DAY_INITIALS[d.getDay()]}</span>
            <span class="date-cell-num">${day}</span>
        </button>`;
    }
    strip.innerHTML = html;

    const sel = strip.querySelector('.date-cell.selected');
    if (sel) strip.scrollLeft = sel.offsetLeft - (strip.clientWidth / 2) + (sel.clientWidth / 2);
}

function shiftStripMonth(delta) {
    stripMonth = new Date(stripMonth.getFullYear(), stripMonth.getMonth() + delta, 1);
    renderDateStrip();
}

document.getElementById('prev-month').addEventListener('click', () => shiftStripMonth(-1));
document.getElementById('next-month').addEventListener('click', () => shiftStripMonth(1));
document.getElementById('date-today').addEventListener('click', () => setSelectedDate(getLocalDateKey()));
document.getElementById('date-strip').addEventListener('click', (e) => {
    const cell = e.target.closest('.date-cell');
    if (cell && !cell.disabled) setSelectedDate(cell.dataset.date);
});

// La semana del programa se deriva siempre de la fecha seleccionada
function updateWeek() {
    currentWeek = getWeekForDate(selectedDate);
    // La semana del programa ya no se muestra en pantalla, pero se sigue usando
    // internamente para elegir el bloque de rutina y contar los entrenos.

    const dayKey = getSelectedDayKey();
    const dayLabel = document.getElementById('date-day-label');
    if (dayLabel) dayLabel.textContent = dayKey ? getDayLabel(dayKey) : 'Descanso';
    dayLabel?.parentElement?.classList.toggle('is-rest-day', !dayKey);

    const todayBtn = document.getElementById('date-today');
    if (todayBtn) todayBtn.style.display = isSelectedToday() ? 'none' : '';

    renderDateStrip();
}

// --- Género (Mujer / Hombre) ---
// Ambos programas comparten la dirección brutal refinada; la selección sigue
// controlando las rutinas y el color del navegador acompaña el tema activo.
function applyGenderTheme() {
    document.body.classList.toggle('hombre', currentTab === 'hombre');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', '#000000');
}
function updateGenderUI() {
    document.querySelectorAll('.gender-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.gender === currentTab);
    });
    applyGenderTheme();
    updateUI();
}
applyGenderTheme();   // cuanto antes, para no pintar con la paleta equivocada
function setGender(gender) {
    if (gender !== 'hombre' && gender !== 'tonificar') return;
    if (gender === currentTab) return;
    currentTab = gender;
    localStorage.setItem('rutina-genero', currentTab);
    updateGenderUI();
}
document.querySelectorAll('.gender-btn').forEach(btn => {
    btn.addEventListener('click', () => setGender(btn.dataset.gender));
});

// --- Routines Data ---
let routines = {};
const CUSTOM_ROUTINES_KEY = "entreno-brutal-routines-v1";
const EXERCISE_META_KEY = "entreno-brutal-exercise-meta-v1";
let baseRoutines = {};
let customRoutines = {};
let exerciseMeta = {};
function readLocalJson(key, fallback) { try { const value = JSON.parse(localStorage.getItem(key) || "null"); return value && typeof value === "object" ? value : fallback; } catch { return fallback; } }
function mergeCustomRoutines(base, overrides) {
    const merged = JSON.parse(JSON.stringify(base || {}));
    ["tonificar", "hombre"].forEach(program => Object.entries(overrides[program] || {}).forEach(([week, days]) => {
        if (!merged[program]) merged[program] = {}; if (!merged[program][week]) merged[program][week] = {};
        Object.entries(days || {}).forEach(([day, exercises]) => { if (Array.isArray(exercises)) merged[program][week][day] = exercises.filter(e => e && String(e.name || "").trim()).map(e => ({ name: String(e.name).trim(), detail: String(e.detail || "") })); });
    }));
    return merged;
}
function saveCustomization() { localStorage.setItem(CUSTOM_ROUTINES_KEY, JSON.stringify(customRoutines)); localStorage.setItem(EXERCISE_META_KEY, JSON.stringify(exerciseMeta)); }
function getExerciseMeta(name) { return exerciseMeta[name] || {}; }
async function loadRoutines() {
    try {
        const res = await fetch('./data/routines.json?v=52', { cache: 'no-store' });
        baseRoutines = await res.json();
        customRoutines = readLocalJson(CUSTOM_ROUTINES_KEY, {});
        exerciseMeta = readLocalJson(EXERCISE_META_KEY, {});
        routines = mergeCustomRoutines(baseRoutines, customRoutines);
    } catch (e) {
        console.warn('No se pudo cargar routines.json', e);
    }
    if (!localStorage.getItem('program-start-date')) {
        localStorage.setItem('program-start-date', getLocalDateKey());
    }
    // Cada arranque empieza en el día de hoy; la semana se deduce de la fecha.
    localStorage.removeItem('selected-week');
    localStorage.removeItem('selected-week-date');
    selectedDate = getLocalDateKey();
    stripMonth = new Date();
    updateWeek();
    updateGenderUI();
    updateTodayBanner();
    prefetchExerciseImages();
    autoBackupIfNeeded();
}
loadRoutines();

function getRoutines() {
    const currentRoutine = routines[currentTab]?.[currentWeek];
    return currentRoutine && Object.keys(currentRoutine).length
        ? currentRoutine
        : (routines[currentTab]?.['1'] || routines[currentTab]?.[1] || { 'Día 1': [] });
}

// --- Modal helpers ---
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }
function getExerciseImageCandidates(name) { const candidates = []; const custom = getExerciseMeta(name).image; const hash = exerciseImageMap[name]; const direct = exerciseDirectImageMap[name]; const slug = exerciseFallbackImageMap[name]; [custom, hash ? GIF_CDN + hash + ".gif" : null, direct, slug ? JPG_CDN + slug + "/0.jpg" : null].forEach(url => { if (url && !candidates.includes(url)) candidates.push(url); }); return candidates; }
function openExercisePreview(name) { const candidates = getExerciseImageCandidates(name); const anim = document.getElementById("exercise-anim"); document.getElementById("exercise-modal-title").textContent = name; let index = 0; anim.onerror = () => { index += 1; if (index < candidates.length) { anim.src = candidates[index]; return; } anim.onerror = null; anim.removeAttribute("src"); anim.style.display = "none"; }; anim.alt = `Animación de ${name}`; if (candidates.length) { anim.src = candidates[0]; anim.style.display = ""; } else { anim.removeAttribute("src"); anim.style.display = "none"; } openModal("modal-exercise"); }


document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
});
document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.remove('active');
    });
});

// --- Action: Rutina ---
document.getElementById('btn-routine').addEventListener('click', () => {
    const dateEl = document.getElementById('routine-date');
    if (dateEl) dateEl.textContent = formatSelectedDate();
    const body = document.getElementById('routine-body');
    const days = getRoutines();
    // El día que se despliega es el que toca en la FECHA seleccionada, no en hoy
    const todayName = getSelectedDayKey();
    const marker = isSelectedToday() ? ' (Hoy)' : ` (${formatSelectedDate()})`;
    body.innerHTML = Object.entries(days).map(([day, exercises]) => {
        const isToday = day === todayName;
        const alreadyDone = isDayRegisteredToday(day);
        const registeredWorkout = state.workouts.find(w => w.date === selectedDate && w.notes === day && w.type === currentTab);
        const completionByExercise = new Map((registeredWorkout?.exercises || []).map(exercise => [exercise.name, exercise.completed]));
        return `
        <div class="routine-day">
            <div class="routine-day-header${isToday ? ' open' : ''}" onclick="this.classList.toggle('open'); this.nextElementSibling.classList.toggle('open')">
                <span>${getDayLabel(day)}${isToday ? marker : ''}</span>
                <span class="arrow">&#8250;</span>
            </div>
            <div class="routine-day-content${isToday ? ' open' : ''}">
                ${exercises.map(ex => `
                    <div class="exercise-item${completionByExercise.get(ex.name) === false ? ' exercise-incomplete' : ''}">
                        <span class="exercise-name">${escapeHtml(ex.name)}</span>
                        ${renderDetailInputs(ex.name, ex.detail)}
                        <div class="exercise-weight">
                            <input type="number" min="0" step="0.5" placeholder="0" title="Peso en kg"
                                data-exercise="${escapeHtml(ex.name)}"
                                value="${localStorage.getItem('peso:' + ex.name) ?? (currentTab === 'tonificar' ? '0' : '')}"
                                onchange="handleWeightChange(this)">
                            <span>kg</span>
                            <span class="pr-badge"${getPR(ex.name) === null ? ' style="display:none"' : ''}>${getPR(ex.name) !== null ? 'PR: ' + getPR(ex.name) + 'kg' : ''}</span>
                        </div>
                        <button class="exercise-preview-btn" type="button" data-exercise="${escapeHtml(ex.name)}"><span class="btn-label-desktop">Ver ejercicio</span><span class="btn-label-mobile">Ejemplo</span></button>
                    </div>
                `).join('')}
                <div class="day-register-row">
                    <input type="number" class="day-duration-input" placeholder="Minutos" min="5" max="180" data-day="${day}"${alreadyDone ? ' disabled' : ''}>
                    <button class="day-register-btn${alreadyDone ? ' done' : ''}" data-day="${day}"${alreadyDone ? ' disabled' : ''}>${alreadyDone ? (isSelectedToday() ? '&#10003; Entrenado hoy' : '&#10003; Entrenado el ' + formatSelectedDate()) : '&#10003; Registrar entreno'}</button>
                </div>
            </div>
        </div>
    `;
    }).join('');
    openModal('modal-routine');
});

document.getElementById('routine-body').addEventListener('click', (e) => {
    const btn = e.target.closest('.exercise-preview-btn');
    if (btn) { openExercisePreview(btn.dataset.exercise); return; }

    const regBtn = e.target.closest('.day-register-btn');
    if (regBtn) {
        const day = regBtn.dataset.day;
        const input = document.querySelector(`.day-duration-input[data-day="${day}"]`);
        const duration = parseInt(input.value);
        if (!duration || duration < 5) { input.focus(); input.style.borderColor = 'red'; return; }
        input.style.borderColor = '';

        // El entreno se registra en la FECHA SELECCIONADA, no necesariamente hoy
        const today = selectedDate;
        const prev = state.workouts.length > 0 ? state.workouts[state.workouts.length - 1] : null;
        // La racha solo avanza si el registro es más reciente que el último
        if (!state.lastDate || today > state.lastDate) {
            state.streak = (state.lastDate === getPrevDayKey(today)) ? state.streak + 1 : 1;
            state.lastDate = today;
        }
        // Solo se registran pesos de los ejercicios del dia que se completa.
        regBtn.closest('.routine-day').querySelectorAll('.exercise-weight input').forEach(inp => {
            const name = inp.dataset.exercise;
            const weight = parseFloat(inp.value);
            if (weight && weight > 0) {
                let history = JSON.parse(localStorage.getItem('peso-history:' + name) || '[]');
                history.push({ date: today, weight });
                localStorage.setItem('peso-history:' + name, JSON.stringify(history));
            }
        });
        const registeredExercises = [...regBtn.closest('.routine-day').querySelectorAll('.exercise-item')].map(row => {
            const series = row.querySelector('[data-field="series"]')?.value.trim() || '';
            const reps = row.querySelector('[data-field="reps"]')?.value.trim() || '';
            return { name: row.querySelector('.exercise-name').textContent, detail: row.querySelector('.exercise-detail')?.textContent.trim() || '', completed: Number(series) > 0 && Number(reps) > 0 };
        });
        registeredExercises.forEach((exercise, index) => {
            exercise.detail = getRoutines()[day]?.[index]?.detail || exercise.detail;
        });
        state.workouts.push({ date: today, type: currentTab, duration, intensity: "media", notes: day, exercises: registeredExercises });
        state.total = state.workouts.length;
        state.weekCount = getCurrentWeekCount();
        saveState();
        void sendBackup({ notify: true });
        updateUI();
        regBtn.closest('.routine-day').querySelectorAll('.exercise-item').forEach((row, index) => row.classList.toggle('exercise-incomplete', !registeredExercises[index].completed));
        triggerWorkoutExplosion(regBtn);

        regBtn.textContent = '✓ Registrado!';
        regBtn.disabled = true;
        input.disabled = true;
        setTimeout(() => {
            regBtn.innerHTML = isSelectedToday() ? '&#10003; Entrenado hoy' : '&#10003; Entrenado el ' + formatSelectedDate();
            regBtn.classList.add('done');
            input.value = '';
        }, 1200);
    }
});

// --- Action: Progreso ---

function getExerciseWeightHistory(exerciseName) {
    const rawHistory = JSON.parse(localStorage.getItem('peso-history:' + exerciseName) || '[]')
        .filter(entry => entry && typeof entry.date === 'string' && Number.isFinite(Number(entry.weight)))
        .map(entry => ({ date: entry.date, weight: Number(entry.weight) }));

    // Las versiones anteriores anotaban pesos de todos los dias al registrar uno.
    // Solo conservamos referencias de fechas donde el ejercicio figura en un entreno real.
    const workoutDates = new Set(state.workouts
        .filter(workout => (workout.exercises || []).some(exercise => exercise.name === exerciseName))
        .map(workout => workout.date));
    const history = workoutDates.size > 0
        ? rawHistory.filter(entry => workoutDates.has(entry.date))
        : rawHistory;

    return history.sort((a, b) => a.date.localeCompare(b.date));
}

function getProgressLightStatus(exerciseName) {
    const history = getExerciseWeightHistory(exerciseName);
    if (history.length < 2) return 'orange';

    const currentSession = history[history.length - 1];
    // No se compara la sesion actual consigo misma ni con duplicados del mismo dia.
    const previousHistory = history.filter(entry => entry.date < currentSession.date);
    if (previousHistory.length === 0) return 'orange';

    const currentDate = dateFromKey(currentSession.date);
    const oneWeekAgo = new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourWeeksAgo = new Date(currentDate.getTime() - 28 * 24 * 60 * 60 * 1000);
    const recentSessions = previousHistory.filter(entry => dateFromKey(entry.date) >= oneWeekAgo);
    const fourWeekSessions = previousHistory.filter(entry => dateFromKey(entry.date) >= fourWeeksAgo);
    if (fourWeekSessions.length === 0) return 'orange';

    const fourWeekMax = fourWeekSessions.reduce((max, entry) => Math.max(max, entry.weight), 0);
    if (currentSession.weight > fourWeekMax) return 'green';

    const recentMax = recentSessions.length > 0
        ? recentSessions.reduce((max, entry) => Math.max(max, entry.weight), 0)
        : previousHistory[previousHistory.length - 1].weight;
    if (currentSession.weight === recentMax) return 'orange';

    return 'red';
}

function getWorkoutGroupLabel(workout) {
    return routines.labels?.[workout.type]?.[workout.notes]
        || getDayLabelFor(workout.type, workout.notes)
        || 'Otros ejercicios';
}

function getExerciseGroupLabel(exerciseName) {
    const latestWorkout = [...state.workouts].reverse().find(workout =>
        getWorkoutExercises(workout).some(exercise => exercise.name === exerciseName)
    );
    return latestWorkout ? getWorkoutGroupLabel(latestWorkout) : 'Otros ejercicios';
}

function getSetsAndReps(detail) {
    const match = String(detail || '').match(/(\d+)\s*[x×]\s*(\d+)/i);
    return match ? { sets: Number(match[1]), reps: Number(match[2]) } : null;
}

function getWorkoutVolume(workout) {
    return getWorkoutExercises(workout).reduce((total, exercise) => {
        const prescription = getSetsAndReps(exercise.detail);
        if (!prescription) return total;
        const weight = getExerciseWeightHistory(exercise.name)
            .filter(entry => entry.date === workout.date)
            .at(-1)?.weight;
        return weight ? total + weight * prescription.sets * prescription.reps : total;
    }, 0);
}

function getVolumeHistory() {
    return state.workouts
        .map(workout => ({ date: workout.date, volume: getWorkoutVolume(workout) }))
        .filter(entry => entry.volume > 0)
        .sort((a, b) => a.date.localeCompare(b.date));
}

function renderVolumeChart(entries) {
    if (entries.length < 2) return '';
    const width = 480, height = 150, padding = 20;
    const max = Math.max(...entries.map(entry => entry.volume));
    const min = Math.min(...entries.map(entry => entry.volume));
    const range = max - min || max || 1;
    const x = index => padding + (index * (width - padding * 2)) / (entries.length - 1);
    const y = entry => height - padding - ((entry.volume - min) / range) * (height - padding * 2);
    const points = entries.map((entry, index) => `${x(index).toFixed(1)},${y(entry).toFixed(1)}`).join(' ');
    const last = entries[entries.length - 1];
    return `<section class="volume-chart-section" aria-labelledby="volume-chart-title">
        <div class="section-label" id="volume-chart-title">Volumen levantado</div>
        <p class="volume-chart-summary">${last.volume.toLocaleString('es-ES')} kg en tu última sesión con pesos registrados</p>
        <svg class="volume-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Evolución del volumen total levantado por sesión">
            <line class="volume-chart-axis" x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}"></line>
            <polyline class="volume-chart-line" points="${points}"></polyline>
            ${entries.map((entry, index) => `<circle class="volume-chart-point" cx="${x(index).toFixed(1)}" cy="${y(entry).toFixed(1)}" r="4"><title>${entry.date}: ${entry.volume.toLocaleString('es-ES')} kg</title></circle>`).join('')}
        </svg>
        <div class="volume-chart-labels"><span>${entries[0].date}</span><span>${last.date}</span></div>
        <p class="volume-chart-note">Peso × series × repeticiones. Solo se incluyen ejercicios con carga y una pauta como 3x12.</p>
    </section>`;
}

function renderProgress() {
    const body = document.getElementById('progress-body');
    const weekGoal = getProgramDays();
    const pct = Math.min(100, Math.round((state.weekCount / weekGoal) * 100));
    const prs = getAllExerciseNames()
        .map(name => ({ name, weight: getPR(name), date: getPRDate(name) }))
        .filter(e => e.weight !== null)
        .sort((a, b) => b.weight - a.weight);

    let html = `
        <div class="section-label">Objetivo semanal</div>
        <div class="progress-bar-container">
            <div class="progress-bar-label">
                <span>${state.weekCount} / ${weekGoal} entrenos</span>
                <span>${pct}%</span>
            </div>
            <div class="progress-bar-track">
                <div class="progress-bar-fill" style="width:${pct}%"></div>
            </div>
        </div>
    `;

    const volumeHistory = getVolumeHistory();
    html += renderVolumeChart(volumeHistory);

    if (prs.length > 0) {
        html += `<div class="section-label" style="margin-top:20px">Records Personales</div>`;
        let hasLights = false;
        const groups = new Map();
        prs.forEach(pr => {
            const group = getExerciseGroupLabel(pr.name);
            if (!groups.has(group)) groups.set(group, []);
            groups.get(group).push(pr);
        });
        groups.forEach((groupPrs, group) => {
            html += `<section class="progress-group"><h3>${escapeHtml(group)}</h3>`;
            groupPrs.forEach(pr => {
            // Semáforo en la misma fila que el récord (solo si hay historial de peso)
            const history = getExerciseWeightHistory(pr.name);
            let lightHtml = '';
            if (history.length > 0) {
                hasLights = true;
                const lightStatus = getProgressLightStatus(pr.name);
                const lightClass = lightStatus === 'green' ? 'progress-light-green' : lightStatus === 'orange' ? 'progress-light-orange' : 'progress-light-red';
                const lightEmoji = lightStatus === 'green' ? '🟢' : lightStatus === 'orange' ? '🟠' : '🔴';
                const lightText = lightStatus === 'green' ? 'Superado esta semana' : lightStatus === 'orange' ? 'Sin cambios' : '4 semanas estancado';
                lightHtml = `<span class="pr-item-light ${lightClass}" title="${lightText}">${lightEmoji}</span>`;
            }
            html += `<div class="pr-item"><span class="pr-item-name">${escapeHtml(pr.name)}</span><span class="pr-item-weight">${pr.weight} kg</span><span class="pr-item-date">${pr.date}</span>${lightHtml}</div>`;
            });
            html += '</section>';
        });

        if (hasLights) {
            html += `<div class="pr-legend">🟢 Superado esta semana · 🟠 Sin cambios · 🔴 4 semanas estancado</div>`;
        }
    }

    body.innerHTML = html;
}

function renderHistory() {
    const body = document.getElementById('history-body');
    if (!body) return;
    if (state.workouts.length === 0) {
        body.innerHTML = '<div class="empty-state">No hay entrenos registrados todavia.</div>';
        return;
    }
    const allReversed = [...state.workouts].reverse();
    body.innerHTML = allReversed.map((w, ri) => {
        const realIdx = state.workouts.length - 1 - ri;
        const dayOptions = Object.values(getDayMapFor(w.type)).map(dk =>
            `<option value="${escapeHtml(dk)}"${w.notes === dk ? ' selected' : ''}>${escapeHtml(getDayLabelFor(w.type, dk))}</option>`
        ).join('');
        const exs = getWorkoutExercises(w);
        const exSummary = exs.length
            ? `<div class="history-exercises">${exs.map(e => escapeHtml(e.name) + (e.detail ? ` <em>${escapeHtml(e.detail)}</em>` : '')).join(' · ')}</div>`
            : '';
        const exRows = exs.map(e => exerciseEditRowHtml(e.name, e.detail)).join('');
        return `
        <div class="history-item" data-idx="${realIdx}">
            <span class="history-date">${w.date}</span>
            <span class="history-type">${escapeHtml(programLabel(w.type))}</span>
            <span class="history-duration">${w.duration}min${w.notes ? ' · ' + escapeHtml(getDayLabelFor(w.type, w.notes)) : ''}</span>
            <div class="history-item-actions">
                <button class="btn-edit-workout" data-idx="${realIdx}">✏ Modificar</button>
                <button class="btn-del-workout" data-idx="${realIdx}">✕</button>
            </div>
            ${exSummary}
            <div class="history-edit-row" id="edit-row-${realIdx}" style="display:none">
                <label>Fecha<input type="date" id="edit-date-${realIdx}" value="${escapeHtml(w.date)}"></label>
                <label>Min<input type="number" id="edit-dur-${realIdx}" value="${w.duration}" min="5" max="180" placeholder="min"></label>
                <label>Día<select id="edit-day-${realIdx}">${dayOptions}</select></label>
                <div class="edit-ex-block">
                    <div class="edit-ex-title">Ejercicios</div>
                    <div class="edit-ex-list" id="edit-ex-${realIdx}">${exRows}</div>
                    <button type="button" class="edit-ex-add" onclick="addExerciseRow(${realIdx})">+ Añadir ejercicio</button>
                </div>
                <button onclick="saveEditWorkout(${realIdx})">Guardar</button>
                <button onclick="document.getElementById('edit-row-${realIdx}').style.display='none'" style="background:var(--card);color:var(--foreground)">Cancelar</button>
            </div>
        </div>`;
    }).join('');

    body.querySelectorAll('.btn-del-workout').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx);
            if (!confirm('¿Eliminar este entreno?')) return;
            state.workouts.splice(idx, 1);
            state.total = state.workouts.length;
            state.weekCount = getCurrentWeekCount();
            saveState(); updateUI(); renderHistory();
        });
    });

    body.querySelectorAll('.btn-edit-workout').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = btn.dataset.idx;
            const row = document.getElementById(`edit-row-${idx}`);
            row.style.display = row.style.display === 'none' ? 'flex' : 'none';
        });
    });
}

function exerciseEditRowHtml(name, detail) {
    return `<div class="edit-ex-row">
        <input class="edit-ex-name" placeholder="Ejercicio" value="${escapeHtml(name || '')}">
        <input class="edit-ex-detail" placeholder="3x12" value="${escapeHtml(detail || '')}">
        <button type="button" class="edit-ex-del" onclick="this.closest('.edit-ex-row').remove()">✕</button>
    </div>`;
}

window.addExerciseRow = (idx) => {
    const list = document.getElementById(`edit-ex-${idx}`);
    if (list) list.insertAdjacentHTML('beforeend', exerciseEditRowHtml('', ''));
};

window.saveEditWorkout = (idx) => {
    const durEl = document.getElementById(`edit-dur-${idx}`);
    const dateEl = document.getElementById(`edit-date-${idx}`);
    const dayEl = document.getElementById(`edit-day-${idx}`);
    const val = parseInt(durEl.value);
    if (!val || val < 5) { durEl.focus(); durEl.style.borderColor = 'red'; return; }
    const w = state.workouts[idx];
    if (dateEl && dateEl.value) w.date = dateEl.value;
    w.duration = val;
    if (dayEl && dayEl.value) w.notes = dayEl.value;
    const list = document.getElementById(`edit-ex-${idx}`);
    if (list) {
        w.exercises = [...list.querySelectorAll('.edit-ex-row')].map(r => ({
            name: r.querySelector('.edit-ex-name').value.trim(),
            detail: r.querySelector('.edit-ex-detail').value.trim()
        })).filter(e => e.name);
    }
    state.total = state.workouts.length;
    state.weekCount = getCurrentWeekCount();
    saveState(); updateUI(); renderHistory();
};

document.getElementById('btn-progress').addEventListener('click', () => {
    renderProgress();
    openModal('modal-progress');
});

document.getElementById('btn-historial').addEventListener('click', () => {
    renderHistory();
    openModal('modal-historial');
});

document.getElementById('btn-export-history').addEventListener('click', downloadHistory);

function getBackupUserName() {
    let name = localStorage.getItem('backup-user-name');
    if (name) return name;
    name = (prompt('¿Cómo te llamas? (para identificar tus backups en el servidor)') || '').trim();
    if (name) localStorage.setItem('backup-user-name', name);
    return name;
}

function buildBackup() {
    const backup = {
        version: 1,
        date: getLocalDateKey(),
        user: getBackupUserName(),
        state: state,
        prs: {},
        prDates: {},
        pesoHistory: {},
        pesoCurrent: {},
        setsReps: {},
        programStartDate: localStorage.getItem('program-start-date'),
        darkMode: localStorage.getItem('dark-mode'),
        customRoutines: customRoutines,
        exerciseMeta: exerciseMeta
    };
    getAllExerciseNames().forEach(name => {
        const pr = localStorage.getItem('pr:' + name);
        if (pr) backup.prs[name] = pr;
        const prd = localStorage.getItem('pr-date:' + name);
        if (prd) backup.prDates[name] = prd;
        const ph = localStorage.getItem('peso-history:' + name);
        if (ph) backup.pesoHistory[name] = ph;
        const pc = localStorage.getItem('peso:' + name);
        if (pc) backup.pesoCurrent[name] = pc;
    });
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('series:') || k.startsWith('reps:'))) {
            backup.setsReps[k] = localStorage.getItem(k);
        }
    }
    return backup;
}

// Backup automático. El registro local siempre termina primero; el envío remoto
// queda marcado como pendiente si no hay red y se reintenta en el próximo arranque.
// Backup remoto deshabilitado hasta configurar autenticación por usuario en n8n.
// Un token incluido en una PWA pública no puede proteger datos privados.
const AUTO_BACKUP_ENABLED = false;
const AUTO_BACKUP_BASE_URL = 'https://n8n.guillers.es/webhook/entreno-brutal-backup';
const AUTO_BACKUP_INTERVAL_DAYS = 7;
const AUTO_BACKUP_PENDING_KEY = 'auto-backup-pending';

// keepalive evita que el navegador cancele el POST si la PWA pasa a segundo plano
// justo después de registrar. Nunca se espera esta promesa para guardar el entreno.
async function sendBackup({ notify = false } = {}) {
    if (!AUTO_BACKUP_ENABLED) return false;
    const user = getBackupUserName();
    if (!user) return false;

    localStorage.setItem(AUTO_BACKUP_PENDING_KEY, '1');
    try {
        const res = await fetch(AUTO_BACKUP_BASE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buildBackup()),
            keepalive: true
        });
        if (!res.ok) throw new Error('El servidor no aceptó la copia.');
        localStorage.setItem('auto-backup-last', getLocalDateKey());
        localStorage.removeItem(AUTO_BACKUP_PENDING_KEY);
        if (notify) showToast('Entreno guardado y copia en servidor actualizada.');
        return true;
    } catch {
        // El estado ya está en localStorage y en su espejo. Esta marca hace que
        // la próxima apertura priorice una nueva copia con el estado más reciente.
        if (notify) showToast('Entreno guardado. Copia en servidor pendiente de conexión.');
        return false;
    }
}

// Al abrir la app se reintenta una copia pendiente o la copia semanal. No se
// pide el nombre en segundo plano: se solicitará al registrar el primer entreno.
function autoBackupIfNeeded() {
    if (!AUTO_BACKUP_ENABLED) return;
    if (!localStorage.getItem('backup-user-name')) return;
    if (localStorage.getItem(AUTO_BACKUP_PENDING_KEY) === '1') {
        sendBackup();
        return;
    }
    const lastRaw = localStorage.getItem('auto-backup-last');
    if (lastRaw) {
        const daysSince = (dateFromKey(getLocalDateKey()) - dateFromKey(lastRaw)) / 86400000;
        if (daysSince < AUTO_BACKUP_INTERVAL_DAYS) return;
    }
    sendBackup();
}

document.getElementById('btn-backup-export').addEventListener('click', () => {
    const backup = buildBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `entreno-brutal-backup-${getLocalDateKey()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
});

document.getElementById('btn-backup-import').addEventListener('click', () => {
    document.getElementById('backup-file-input').click();
});

// Aplica un objeto de backup (venga de un archivo importado o del servidor) y
// recarga la app en limpio. Usado por la importación manual y por la
// restauración desde servidor.
function applyBackup(backup) {
    if (!backup.state || !backup.state.workouts) throw new Error('Invalid backup');
    localStorage.setItem(STATE_KEY, JSON.stringify(backup.state));
    localStorage.setItem(STATE_MIRROR_KEY, JSON.stringify(backup.state));
    state = loadState();
    updateUI();
    if (backup.programStartDate) localStorage.setItem('program-start-date', backup.programStartDate);
    if (backup.darkMode !== null) localStorage.setItem('dark-mode', backup.darkMode);
    if (backup.customRoutines) customRoutines = backup.customRoutines;
    if (backup.exerciseMeta) exerciseMeta = backup.exerciseMeta;
    saveCustomization();
    Object.entries(backup.prs || {}).forEach(([name, val]) => localStorage.setItem('pr:' + name, val));
    Object.entries(backup.prDates || {}).forEach(([name, val]) => localStorage.setItem('pr-date:' + name, val));
    Object.entries(backup.pesoHistory || {}).forEach(([name, val]) => localStorage.setItem('peso-history:' + name, val));
    Object.entries(backup.pesoCurrent || {}).forEach(([name, val]) => localStorage.setItem('peso:' + name, val));
    Object.entries(backup.setsReps || {}).forEach(([key, val]) => localStorage.setItem(key, val));
    alert('Backup restaurado correctamente.');
    // Forzar recarga totalmente limpia: borrar cachés, quitar el SW y
    // navegar con un query nuevo para que el navegador pida un index.html
    // fresco (location.reload(true) es ignorado en móviles).
    const hardReload = () => location.replace(location.pathname + '?r=' + Date.now());
    const clearCaches = ('caches' in window)
        ? caches.keys().then(names => Promise.all(names.map(n => caches.delete(n))))
        : Promise.resolve();
    const unregisterSW = (navigator.serviceWorker)
        ? navigator.serviceWorker.getRegistrations().then(rs => Promise.all(rs.map(r => r.unregister())))
        : Promise.resolve();
    Promise.all([clearCaches, unregisterSW]).catch(() => {}).then(hardReload);
}

document.getElementById('backup-file-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const backup = JSON.parse(ev.target.result);
            if (!confirm('Esto reemplazara todos tus datos actuales. ¿Continuar?')) return;
            applyBackup(backup);
        } catch (err) {
            alert('Error: archivo de backup invalido.');
        }
    };
    reader.readAsText(file);
    e.target.value = '';
});

if ('serviceWorker' in navigator && ['http:', 'https:'].includes(window.location.protocol)) {
    // Si al cargar no hay controller es la primera visita (o se acaba de borrar
    // el SW): el claim inicial NO debe recargar. Solo recargamos cuando un SW
    // nuevo releva a uno que ya controlaba la página, y una sola vez.
    const hadController = !!navigator.serviceWorker.controller;
    let swRefreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadController || swRefreshing) return;
        swRefreshing = true;
        location.reload();
    });
    navigator.serviceWorker.register('./sw.js').then(reg => reg.update()).catch(() => {});
}

function updateTodayBanner() { renderDailyMotivation(); }

// Init
updateUI();

(function initDark() {
    const saved = localStorage.getItem('dark-mode');
    if (saved === '1' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.body.classList.add('dark');
    }
    const btn = document.getElementById('dark-toggle');
    if (btn) {
        btn.addEventListener('click', () => {
            document.body.classList.toggle('dark');
            localStorage.setItem('dark-mode', document.body.classList.contains('dark') ? '1' : '0');
            applyGenderTheme();   // refresca el theme-color del navegador
        });
    }
})();

// --- Routine and exercise editor ---
let editorProgram = currentTab;
let editorWeek = String(currentWeek);
let editorDay = "Día 1";
function editorWeeks() { return Object.keys(routines[editorProgram] || {}).filter(k => k !== "labels").sort((a, b) => Number(a) - Number(b)); }
function editorDays() { return Object.keys(routines[editorProgram]?.[editorWeek] || {}); }
function getExerciseCatalogNames() { return [...new Set([...getAllExerciseNames(), ...Object.keys(exerciseMeta)])].sort((a, b) => a.localeCompare(b)); }
function editorRowHtml(exercise, index) {
    const meta = getExerciseMeta(exercise.name);
    return `<div class="routine-editor-item" data-index="${index}"><div class="routine-editor-item-head"><strong>Ejercicio ${index + 1}</strong><span><button type="button" class="editor-move" data-direction="up" aria-label="Subir ejercicio">↑</button><button type="button" class="editor-move" data-direction="down" aria-label="Bajar ejercicio">↓</button><button type="button" class="editor-remove" aria-label="Quitar ejercicio">Quitar</button></span></div><div class="routine-editor-item-grid"><label>Nombre<input class="editor-name" value="${escapeHtml(exercise.name || "")}" required></label><label>Series x repeticiones<input class="editor-detail" value="${escapeHtml(exercise.detail || "")}" placeholder="3x12"></label><label class="full">Instrucciones<textarea class="editor-instructions" rows="2">${escapeHtml(meta.instructions || "")}</textarea></label><label>Grupos/músculos<input class="editor-muscles" value="${escapeHtml(meta.muscles || "")}" placeholder="Pecho, tríceps"></label><label>Imagen URL<input class="editor-image" type="url" value="${escapeHtml(meta.image || "")}" placeholder="https://..."></label></div></div>`;
}
function renderRoutineEditor() {
    const program = document.getElementById("editor-program"), week = document.getElementById("editor-week"), day = document.getElementById("editor-day"), body = document.getElementById("routine-editor-body");
    if (!program || !body) return;
    program.innerHTML = ["hombre", "tonificar"].map(p => `<option value="${p}"${p === editorProgram ? " selected" : ""}>${programLabel(p)}</option>`).join("");
    const weeks = editorWeeks(); if (!weeks.includes(editorWeek)) editorWeek = weeks[0] || "1";
    week.innerHTML = weeks.map(w => `<option value="${w}"${w === editorWeek ? " selected" : ""}>Semana ${w}</option>`).join("");
    const days = editorDays(); if (!days.includes(editorDay)) editorDay = days[0] || "Día 1";
    day.innerHTML = days.map(d => `<option value="${escapeHtml(d)}"${d === editorDay ? " selected" : ""}>${escapeHtml(getDayLabelFor(editorProgram, d))}</option>`).join("");
    const exercises = routines[editorProgram]?.[editorWeek]?.[editorDay] || [];
    body.innerHTML = `<div class="routine-editor-list">${exercises.map(editorRowHtml).join("")}</div><div class="routine-editor-add"><strong>Añadir ejercicio</strong><select id="editor-catalog"><option value="">Ejercicio existente...</option>${getExerciseCatalogNames().map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join("")}</select><input id="editor-new-name" placeholder="Nombre de ejercicio nuevo"><button type="button" id="editor-add">+ Añadir</button></div>`;
}
function openRoutineEditor() { editorProgram = currentTab; editorWeek = String(currentWeek); editorDay = getSelectedDayKey(); renderRoutineEditor(); openModal("modal-routine-editor"); }
function renumberEditorRows() { document.querySelectorAll(".routine-editor-item").forEach((row, i) => { row.dataset.index = i; row.querySelector("strong").textContent = `Ejercicio ${i + 1}`; }); }
document.getElementById("btn-edit-routines")?.addEventListener("click", openRoutineEditor);
document.getElementById("editor-program")?.addEventListener("change", e => { editorProgram = e.target.value; editorWeek = "1"; editorDay = "Día 1"; renderRoutineEditor(); });
document.getElementById("editor-week")?.addEventListener("change", e => { editorWeek = e.target.value; editorDay = "Día 1"; renderRoutineEditor(); });
document.getElementById("editor-day")?.addEventListener("change", e => { editorDay = e.target.value; renderRoutineEditor(); });
document.getElementById("routine-editor-body")?.addEventListener("click", e => {
    const row = e.target.closest(".routine-editor-item");
    if (e.target.id === "editor-add") { const select = document.getElementById("editor-catalog"), input = document.getElementById("editor-new-name"), name = (select.value || input.value).trim(); if (!name) { (select.value ? input : select).focus(); return; } const list = document.querySelector(".routine-editor-list"); list.insertAdjacentHTML("beforeend", editorRowHtml({ name, detail: "3x12" }, list.children.length)); select.value = ""; input.value = ""; renumberEditorRows(); return; }
    if (!row) return;
    if (e.target.closest(".editor-remove")) { row.remove(); renumberEditorRows(); return; }
    const move = e.target.closest(".editor-move"); if (!move) return;
    const sibling = move.dataset.direction === "up" ? row.previousElementSibling : row.nextElementSibling; if (sibling) { move.dataset.direction === "up" ? row.parentNode.insertBefore(row, sibling) : row.parentNode.insertBefore(sibling, row); renumberEditorRows(); }
});
document.getElementById("editor-save")?.addEventListener("click", () => {
    const rows = [...document.querySelectorAll(".routine-editor-item")];
    const exercises = rows.map(row => ({ name: row.querySelector(".editor-name").value.trim(), detail: row.querySelector(".editor-detail").value.trim() })).filter(e => e.name);
    const nextMeta = { ...exerciseMeta };
    rows.forEach(row => { const name = row.querySelector(".editor-name").value.trim(); if (!name) return; const meta = { instructions: row.querySelector(".editor-instructions").value.trim(), muscles: row.querySelector(".editor-muscles").value.trim(), image: row.querySelector(".editor-image").value.trim() }; if (meta.instructions || meta.muscles || meta.image) nextMeta[name] = meta; else delete nextMeta[name]; });
    if (!customRoutines[editorProgram]) customRoutines[editorProgram] = {}; if (!customRoutines[editorProgram][editorWeek]) customRoutines[editorProgram][editorWeek] = {}; customRoutines[editorProgram][editorWeek][editorDay] = exercises; exerciseMeta = nextMeta; saveCustomization(); routines = mergeCustomRoutines(baseRoutines, customRoutines); closeModal("modal-routine-editor"); updateUI(); showToast("Rutina guardada en este dispositivo");
});
