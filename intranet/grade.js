import { db, functions } from './firebase-config.js';
import { onAuthReady } from './auth.js';
import { httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { collection, getDocs, query, where, doc, getDoc, updateDoc, arrayUnion, arrayRemove, addDoc, Timestamp, setDoc, deleteDoc, orderBy, limit, documentId } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    // Elementos da Grade
    const unitFilter = document.getElementById('unit-filter');
    const copyPublicLinkBtn = document.getElementById('copy-public-link-btn');
    const dateRangeDisplay = document.getElementById('date-range-display');
    const scheduleGrid = document.getElementById('schedule-grid');
    const prevWeekBtn = document.getElementById('prev-week-btn');
    const nextWeekBtn = document.getElementById('next-week-btn');
    const addClassBtn = document.getElementById('add-class-btn');

    // Elementos do Modal de Presença
    const attendanceModal = document.getElementById('attendance-modal');
    const closeAttendanceModalBtn = document.getElementById('close-attendance-modal-btn');
    const modalClassTitle = document.getElementById('modal-class-title');
    const modalClassTime = document.getElementById('modal-class-time');
    const modalClassOccupation = document.getElementById('modal-class-occupation');
    const modalClassTeacher = document.getElementById('modal-class-teacher');
    const modalClassCategoryRow = document.getElementById('modal-class-category-row');
    const modalClassCategory = document.getElementById('modal-class-category');
    const studentList = document.getElementById('student-list');
    const deleteClassBtn = document.getElementById('delete-class-btn');

    // Elementos do Modal de Aula
    const classModal = document.getElementById('class-modal');
    const closeClassModalBtn = document.getElementById('close-class-modal-btn');
    const cancelClassBtn = document.getElementById('cancel-class-btn');
    const classForm = document.getElementById('class-form');
    const classModalTitle = document.getElementById('class-modal-title');
    const classTeacherSelect = document.getElementById('class-teacher');
    const classStudentsSelect = document.getElementById('class-students');
    const searchStudentsInput = document.getElementById('search-students');
    const classCategorySelect = document.getElementById('class-category');

    let currentClassId = null; // Armazena o ID da instância da aula (templateId_data)
    let currentClassData = null; // Armazena a referência para os dados completos da aula aberta
    let currentWeekStartDate = getStartOfWeek(new Date());
    let selectedUnitId = null;
    let currentStudents = [];
    let selectedStudentIds = new Set();
    let isEditingClass = false; // flag para modo edição de turma
    let editingTemplateId = null; // template sendo editado
    let currentUser = null;
    let allSchoolMembers = [];
    let isLoadingSchoolMembers = false;

    // Cache local para otimização de performance
    let cachedTemplates = [];
    let cachedClassInstances = new Map();
    let unitMembersCache = new Map();
    let allSchoolMembersPromise = null;

    let currentViewMode = 'week'; // 'week' ou 'day'
    let currentSelectedDate = new Date();

    const viewWeekBtn = document.getElementById('view-week-btn');
    const viewDayBtn = document.getElementById('view-day-btn');

    // --- Funções de Data ---
    function getStartOfWeek(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff));
    }

    function getLocalDateString(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function formatDate(date) {
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    }

    function getShortTeacherName(teacherName) {
        if (!teacherName) return 'Desconhecido';
        const parts = teacherName.trim().split(/\s+/);
        if (parts.length === 0) return '';
        if (parts.length === 1) return parts[0];
        
        const firstWordClean = parts[0].toLowerCase().replace(/\.$/, '');
        const prefixes = ['mr', 'mrs', 'ms', 'sr', 'sra', 'dr', 'dra', 'prof', 'professor', 'professora', 'mestre', 'instrutor', 'instrutora', 'sabonim', 'kyosanim'];
        
        if (prefixes.includes(firstWordClean)) {
            return `${parts[0]} ${parts[1]}`;
        }
        return parts[0];
    }

    function updateViewButtons() {
        if (!viewWeekBtn || !viewDayBtn) return;
        if (currentViewMode === 'week') {
            viewWeekBtn.className = 'px-4 py-1.5 text-xs font-bold rounded-xl bg-primary text-black shadow-sm';
            viewDayBtn.className = 'px-4 py-1.5 text-xs font-bold rounded-xl text-gray-550 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white';
        } else {
            viewWeekBtn.className = 'px-4 py-1.5 text-xs font-bold rounded-xl text-gray-550 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white';
            viewDayBtn.className = 'px-4 py-1.5 text-xs font-bold rounded-xl bg-primary text-black shadow-sm';
        }
    }

    function updateCopyLinkButtonVisibility() {
        if (!copyPublicLinkBtn) return;
        if (selectedUnitId && selectedUnitId !== 'staff') {
            copyPublicLinkBtn.classList.remove('hidden');
        } else {
            copyPublicLinkBtn.classList.add('hidden');
        }
    }

    function renderDayViewCard(classData, container) {
        const startTime = classData.startTime;
        const endTime = classData.endTime;
        const startStr = startTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const endStr = endTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        const category = (classData.category || '').toLowerCase();
        let colorClasses = {
            card: 'bg-yellow-500/10 dark:bg-yellow-500/15 border-primary hover:bg-yellow-500/20 dark:hover:bg-yellow-500/25',
            badge: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
        };

        if (category.includes('baby')) {
            colorClasses = {
                card: 'bg-sky-500/10 dark:bg-sky-500/15 border-sky-400 hover:bg-sky-500/20 dark:hover:bg-sky-500/25',
                badge: 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400'
            };
        } else if (category.includes('little')) {
            colorClasses = {
                card: 'bg-blue-500/10 dark:bg-blue-500/15 border-blue-500 hover:bg-blue-500/20 dark:hover:bg-blue-500/25',
                badge: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
            };
        } else if (category.includes('kid')) {
            colorClasses = {
                card: 'bg-orange-500/10 dark:bg-orange-500/15 border-orange-500 hover:bg-orange-500/20 dark:hover:bg-orange-500/25',
                badge: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
            };
        } else if (category.includes('adult')) {
            colorClasses = {
                card: 'bg-red-500/10 dark:bg-red-500/15 border-red-500 hover:bg-red-500/20 dark:hover:bg-red-500/25',
                badge: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
            };
        } else if (category.includes('famil') || category.includes('família')) {
            colorClasses = {
                card: 'bg-purple-500/10 dark:bg-purple-500/15 border-purple-500 hover:bg-purple-500/20 dark:hover:bg-purple-500/25',
                badge: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
            };
        }

        const card = document.createElement('div');
        card.className = `flex flex-col sm:flex-row items-start sm:items-center justify-between border-l-4 p-4 rounded-r-2xl cursor-pointer group z-10 backdrop-blur-md ${colorClasses.card}`;
        card.dataset.classId = classData.id;
        card.dataset.templateId = classData.templateId;

        const occupation = (classData.presentStudents || []).length;
        const capacity = classData.capacity || (classData.students || []).length || 1;
        const trialCount = (classData.trialStudents || []).length;
        const occupationPercentage = Math.min((occupation / capacity) * 100, 100);
        let occupationColor = 'bg-emerald-500';
        if (occupationPercentage > 80) occupationColor = 'bg-rose-500';
        else if (occupationPercentage > 50) occupationColor = 'bg-amber-500';

        const trialBadge = trialCount > 0
            ? `<span class="bg-amber-500 text-black text-[9px] font-extrabold px-1.5 py-0.5 rounded-md leading-tight tracking-wide shadow-sm">EXP</span>`
            : '';

        const categoryBadge = classData.category
            ? `<span class="${colorClasses.badge} px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider leading-none shadow-sm">${classData.category}</span>`
            : '';

        card.innerHTML = `
            <div class="flex items-center gap-4 w-full sm:w-auto">
                <div class="flex flex-col items-center justify-center bg-gray-100 dark:bg-black/30 px-3 py-2 rounded-xl text-center min-w-[70px]">
                    <span class="text-xs font-extrabold text-gray-800 dark:text-gray-200">${startStr}</span>
                    <span class="text-[9px] font-bold text-gray-400 dark:text-gray-500 mt-0.5">${endStr}</span>
                </div>
                <div>
                    <div class="flex items-center gap-2 flex-wrap">
                        <h4 class="font-extrabold text-sm text-gray-850 dark:text-white leading-tight group-hover:text-primary transition-colors">${classData.name}</h4>
                        ${categoryBadge}
                        ${trialBadge}
                    </div>
                    <div class="text-[10px] text-gray-550 dark:text-gray-400 mt-1.5 flex items-center gap-2">
                        <span class="flex items-center gap-1">
                            <i class="fas fa-user-tie text-[9px] opacity-75"></i> <span class="font-semibold">${getShortTeacherName(classData.teacherName)}</span>
                        </span>
                    </div>
                </div>
            </div>
            
            <div class="mt-3 sm:mt-0 w-full sm:w-48 flex flex-col justify-end">
                <div class="flex justify-between items-center text-[10px] text-gray-550 dark:text-gray-400 mb-1 font-bold">
                    <span>Ocupação: ${occupation}/${capacity}${trialCount > 0 ? ` <span class="text-amber-500">+${trialCount} exp</span>` : ''}</span>
                    <span>${Math.round(occupationPercentage)}%</span>
                </div>
                <div class="w-full bg-gray-200 dark:bg-black/30 rounded-full h-1.5 overflow-hidden">
                    <div class="${occupationColor} h-1.5 rounded-full transition-all duration-500" style="width: ${occupationPercentage}%"></div>
                </div>
            </div>
        `;

        card.addEventListener('click', () => openAttendanceModal(classData));
        container.appendChild(card);
    }

    // --- Funções de Renderização ---
    async function renderGrid(useCache = false) {
        if (!selectedUnitId) {
            scheduleGrid.innerHTML = `
                <div class="flex items-center justify-center h-full text-gray-400 dark:text-gray-500 flex-col gap-3">
                    <i class="fas fa-calendar-day text-4xl opacity-50"></i>
                    <p class="font-medium text-sm">Selecione uma unidade para visualizar a grade.</p>
                </div>`;
            return;
        }

        updateDateRangeDisplay();
        
        if (!useCache) {
            scheduleGrid.innerHTML = '';

            if (currentViewMode === 'week') {
                const days = Array.from({ length: 7 }).map((_, i) => {
                    const date = new Date(currentWeekStartDate);
                    date.setDate(date.getDate() + i);
                    return date;
                });

                const header = document.createElement('div');
                header.className = 'grid grid-cols-8 gap-px sticky top-0 bg-gray-100 dark:bg-[#1a1a1a] z-20 border-b border-gray-200 dark:border-gray-800/80';
                header.innerHTML = '<div class="p-2 bg-gray-50 dark:bg-[#161616]"></div>' + days.map(d => {
                    const isToday = d.toDateString() === new Date().toDateString();
                    return `
                    <div class="text-center p-3 bg-white dark:bg-[#1a1a1a] transition-colors hover:bg-gray-50 dark:hover:bg-[#222]/30 cursor-pointer ${isToday ? 'bg-primary/10 dark:bg-primary/5' : ''}" data-header-date="${getLocalDateString(d)}">
                        <div class="font-bold text-[10px] tracking-wider text-gray-400 dark:text-gray-500 mb-1 uppercase">${d.toLocaleDateString('pt-BR', { weekday: 'short' })}</div>
                        <div class="text-base font-extrabold ${isToday ? 'text-primary' : 'text-gray-800 dark:text-gray-200'}">${d.getDate()}</div>
                    </div>
                `}).join('');

                header.addEventListener('click', (e) => {
                    const dayDiv = e.target.closest('[data-header-date]');
                    if (dayDiv) {
                        const dateStr = dayDiv.dataset.headerDate;
                        const [y, m, d] = dateStr.split('-').map(Number);
                        currentSelectedDate = new Date(y, m - 1, d);
                        currentViewMode = 'day';
                        updateViewButtons();
                        renderGrid();
                    }
                });
                scheduleGrid.appendChild(header);

                const body = document.createElement('div');
                body.id = 'schedule-grid-body';
                body.className = 'flex flex-col bg-gray-200 dark:bg-gray-800/60 gap-px';
                scheduleGrid.appendChild(body);
            } else {
                // Day View
                const listContainer = document.createElement('div');
                listContainer.className = 'p-6 max-w-3xl mx-auto space-y-4';
                listContainer.id = 'day-view-list';
                scheduleGrid.appendChild(listContainer);
            }
        }

        const daysToRender = (currentViewMode === 'week')
            ? Array.from({ length: 7 }).map((_, i) => {
                const date = new Date(currentWeekStartDate);
                date.setDate(date.getDate() + i);
                return date;
              })
            : [currentSelectedDate];

        await fetchAndRenderClasses(daysToRender, useCache);
    }

    function updateDateRangeDisplay() {
        if (currentViewMode === 'week') {
            const endDate = new Date(currentWeekStartDate);
            endDate.setDate(endDate.getDate() + 6);
            const options = { day: 'numeric', month: 'short' };
            dateRangeDisplay.textContent = `${currentWeekStartDate.toLocaleDateString('pt-BR', options)} - ${endDate.toLocaleDateString('pt-BR', options)}`;
        } else {
            const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
            const formatted = currentSelectedDate.toLocaleDateString('pt-BR', options);
            dateRangeDisplay.textContent = formatted.charAt(0).toUpperCase() + formatted.slice(1);
        }
    }

    async function fetchAndRenderClasses(days, useCache = false) {
        try {
            if (!useCache) {
                console.log(`Buscando templates para unidade: ${selectedUnitId}`);
                const templatesQuery = query(collection(db, 'classTemplates'), where('unitId', '==', selectedUnitId));
                const templatesSnapshot = await getDocs(templatesQuery);
                cachedTemplates = [];
                templatesSnapshot.forEach(doc => {
                    cachedTemplates.push({ id: doc.id, ...doc.data() });
                });
                console.log(`Encontrados ${cachedTemplates.length} templates de aula.`);

                // Preparar busca paralela de todas as instâncias das aulas
                const instancesToFetch = [];
                for (const day of days) {
                    const dayOfWeek = day.getDay();
                    for (const template of cachedTemplates) {
                        if (template.daysOfWeek && template.daysOfWeek.includes(dayOfWeek) && template.time) {
                            const instanceId = `${template.id}_${getLocalDateString(day)}`;
                            const instanceRef = doc(db, 'classInstances', instanceId);
                            instancesToFetch.push({
                                template,
                                instanceId,
                                instanceRef
                            });
                        }
                    }
                }

                // Busca paralela para resolver N+1 queries
                const snaps = await Promise.all(instancesToFetch.map(item => getDoc(item.instanceRef)));
                
                cachedClassInstances.clear();

                for (let i = 0; i < instancesToFetch.length; i++) {
                    const item = instancesToFetch[i];
                    const instanceSnap = snaps[i];
                    const presentStudents = instanceSnap.exists() ? instanceSnap.data().presentStudents || [] : [];
                    const trialStudents = instanceSnap.exists() ? (instanceSnap.data().trialStudents || []) : [];

                    cachedClassInstances.set(item.instanceId, {
                        presentStudents,
                        trialStudents
                    });
                }
            }

            const classInstancesToRender = [];

            for (const day of days) {
                const dayOfWeek = day.getDay();
                for (const template of cachedTemplates) {
                    if (template.daysOfWeek && template.daysOfWeek.includes(dayOfWeek) && template.time) {
                        const [hour, minute] = template.time.split(':').map(Number);
                        const startTime = new Date(day);
                        startTime.setHours(hour, minute, 0, 0);

                        const endTime = new Date(startTime.getTime() + template.duration * 60000);
                        const instanceId = `${template.id}_${getLocalDateString(day)}`;

                        const cachedInst = cachedClassInstances.get(instanceId);
                        const presentStudents = cachedInst ? cachedInst.presentStudents || [] : [];
                        const trialStudents = cachedInst ? cachedInst.trialStudents || [] : [];

                        classInstancesToRender.push({
                            ...template,
                            templateId: template.id,
                            id: instanceId,
                            startTime: startTime,
                            endTime: endTime,
                            presentStudents: presentStudents,
                            trialStudents: trialStudents
                        });
                    }
                }
            }

            // Ordena cronologicamente por horário de início
            classInstancesToRender.sort((a, b) => a.startTime - b.startTime);

            if (currentViewMode === 'week') {
                // Limpa o corpo da grade semanal
                const body = scheduleGrid.querySelector('#schedule-grid-body');
                if (body) {
                    body.innerHTML = '';

                    // Extrai todos os horários únicos de início (formato HH:MM)
                    const uniqueTimes = new Set();
                    for (const inst of classInstancesToRender) {
                        if (inst.time) {
                            uniqueTimes.add(inst.time);
                        }
                    }

                    // Converte em array e ordena cronologicamente
                    const sortedTimes = Array.from(uniqueTimes).sort((a, b) => {
                        const [h1, m1] = a.split(':').map(Number);
                        const [h2, m2] = b.split(':').map(Number);
                        return (h1 * 60 + m1) - (h2 * 60 + m2);
                    });

                    // Se não houver aulas agendadas para esta semana, gera um visual vazio agradável
                    if (sortedTimes.length === 0) {
                        const emptyRow = document.createElement('div');
                        emptyRow.className = 'bg-white dark:bg-[#1a1a1a] p-8 text-center text-gray-400 dark:text-gray-500 font-medium text-sm flex items-center justify-center gap-2 border-b border-gray-150 dark:border-gray-800/30';
                        emptyRow.innerHTML = `
                            <i class="far fa-calendar-times text-xl opacity-60"></i>
                            <span>Nenhuma aula agendada para esta semana.</span>
                        `;
                        body.appendChild(emptyRow);
                    } else {
                        // Constrói as linhas da grade dinamicamente baseadas nos horários únicos
                        for (const timeStr of sortedTimes) {
                            const row = document.createElement('div');
                            row.className = 'grid grid-cols-8 gap-px bg-gray-200 dark:bg-gray-800/60';

                            // Célula do horário (rótulo esquerdo)
                            const timeLabel = document.createElement('div');
                            timeLabel.className = 'bg-gray-50 dark:bg-[#161616] p-3 text-xs font-extrabold text-gray-550 dark:text-gray-400 flex items-center justify-center min-h-[90px] border-b border-gray-150 dark:border-gray-800/30';
                            timeLabel.innerHTML = `<span>${timeStr}</span>`;
                            row.appendChild(timeLabel);

                            // Células de cada dia
                            for (let i = 0; i < 7; i++) {
                                const dateStr = getLocalDateString(days[i]);
                                const dayCell = document.createElement('div');
                                dayCell.className = 'bg-white dark:bg-[#1a1a1a] p-3 flex flex-col gap-2 min-h-[90px] transition-colors hover:bg-gray-50/50 dark:hover:bg-[#222]/10 border-b border-gray-100 dark:border-gray-850/20';
                                dayCell.dataset.date = dateStr;
                                dayCell.dataset.time = timeStr;
                                row.appendChild(dayCell);
                            }

                            body.appendChild(row);
                        }
                    }
                }
            } else {
                const dayViewList = scheduleGrid.querySelector('#day-view-list');
                if (dayViewList) dayViewList.innerHTML = '';
            }

            if (currentViewMode === 'day' && classInstancesToRender.length === 0) {
                const dayViewList = scheduleGrid.querySelector('#day-view-list');
                if (dayViewList) {
                    dayViewList.innerHTML = `
                        <div class="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500 gap-3">
                            <i class="far fa-calendar-times text-5xl opacity-40"></i>
                            <p class="font-medium text-sm">Nenhuma aula agendada para este dia.</p>
                        </div>`;
                }
                return;
            }

            // Remove cartões antigos em modo semanal (já limpo ao reiniciar a estrutura de linhas)
            if (currentViewMode === 'week') {
                scheduleGrid.querySelectorAll('.class-card').forEach(card => card.remove());
            }

            for (const classInstanceData of classInstancesToRender) {
                renderClassCard(classInstanceData);
            }

        } catch (error) {
            console.error("Erro ao buscar modelos de aula:", error);
        }
    }

    function renderClassCard(classData) {
        if (currentViewMode === 'day') {
            const dayViewList = scheduleGrid.querySelector('#day-view-list');
            if (dayViewList) {
                renderDayViewCard(classData, dayViewList);
            }
            return;
        }

        const startTime = classData.startTime;
        const dayDateStr = getLocalDateString(startTime);
        const timeStr = classData.time; // formato "HH:MM"

        const cell = scheduleGrid.querySelector(`[data-date="${dayDateStr}"][data-time="${timeStr}"]`);
        if (!cell) return;

        const category = (classData.category || '').toLowerCase();
        let colorClasses = {
            card: 'bg-yellow-500/10 dark:bg-yellow-500/15 border-primary hover:bg-yellow-500/20 dark:hover:bg-yellow-500/25',
            badge: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
        };

        if (category.includes('baby')) {
            colorClasses = {
                card: 'bg-sky-500/10 dark:bg-sky-500/15 border-sky-400 hover:bg-sky-500/20 dark:hover:bg-sky-500/25',
                badge: 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400'
            };
        } else if (category.includes('little')) {
            colorClasses = {
                card: 'bg-blue-500/10 dark:bg-blue-500/15 border-blue-500 hover:bg-blue-500/20 dark:hover:bg-blue-500/25',
                badge: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
            };
        } else if (category.includes('kid')) {
            colorClasses = {
                card: 'bg-orange-500/10 dark:bg-orange-500/15 border-orange-500 hover:bg-orange-500/20 dark:hover:bg-orange-500/25',
                badge: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
            };
        } else if (category.includes('adult')) {
            colorClasses = {
                card: 'bg-red-500/10 dark:bg-red-500/15 border-red-500 hover:bg-red-500/20 dark:hover:bg-red-500/25',
                badge: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
            };
        } else if (category.includes('famil') || category.includes('família')) {
            colorClasses = {
                card: 'bg-purple-500/10 dark:bg-purple-500/15 border-purple-500 hover:bg-purple-500/20 dark:hover:bg-purple-500/25',
                badge: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
            };
        }

        const card = document.createElement('div');
        // Card flexível, sem posicionamento absoluto
        card.className = `class-card border-l-4 p-2.5 rounded-r-xl cursor-pointer overflow-hidden shadow-sm group z-10 backdrop-blur-md w-full relative ${colorClasses.card}`;
        card.dataset.classId = classData.id;
        card.dataset.templateId = classData.templateId;

        const occupation = (classData.presentStudents || []).length;
        const capacity = classData.capacity || (classData.students || []).length || 1;
        const trialCount = (classData.trialStudents || []).length;
        const occupationPercentage = Math.min((occupation / capacity) * 100, 100);
        let occupationColor = 'bg-emerald-500';
        if (occupationPercentage > 80) occupationColor = 'bg-rose-500';
        else if (occupationPercentage > 50) occupationColor = 'bg-amber-500';

        const trialBadge = trialCount > 0
            ? `<span class="absolute top-1.5 right-1.5 bg-amber-500 text-black text-[8px] font-extrabold px-1.5 py-0.5 rounded-md leading-tight tracking-wide z-20">EXP</span>`
            : '';

        const categoryBadge = classData.category
            ? `<span class="${colorClasses.badge} px-1.5 py-0.5 rounded text-[7px] font-extrabold uppercase tracking-wider leading-none shadow-sm">${classData.category}</span>`
            : '';

        const endStr = classData.endTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const timeRangeBadge = `<span class="text-[9px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-wider mr-2">${classData.time} - ${endStr}</span>`;

        card.innerHTML = `
            ${trialBadge}
            <div class="flex flex-col h-full justify-between gap-1.5">
                <div>
                    <div class="flex items-center justify-between mb-0.5 flex-wrap gap-1">
                        ${timeRangeBadge}
                        ${categoryBadge}
                    </div>
                    <div class="font-bold text-[11px] text-gray-800 dark:text-white leading-tight group-hover:text-primary transition-colors line-clamp-2 ${trialCount > 0 ? 'pr-8' : ''}">${classData.name}</div>
                    <div class="text-[9px] text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                        <i class="fas fa-user-tie text-[8px] opacity-75"></i> <span class="font-medium">${getShortTeacherName(classData.teacherName)}</span>
                    </div>
                </div>
                <div class="mt-0.5">
                    <div class="flex justify-between items-center text-[9px] text-gray-550 dark:text-gray-400 mb-0.5 font-bold">
                        <span>Ocupação: ${occupation}/${capacity}${trialCount > 0 ? ` <span class="text-amber-500">+${trialCount} exp</span>` : ''}</span>
                        <span>${Math.round(occupationPercentage)}%</span>
                    </div>
                    <div class="w-full bg-gray-200 dark:bg-black/30 rounded-full h-1 overflow-hidden">
                        <div class="${occupationColor} h-1 rounded-full" style="width: ${occupationPercentage}%"></div>
                    </div>
                </div>
            </div>
        `;

        card.addEventListener('click', () => openAttendanceModal(classData));
        cell.appendChild(card);
    }

    async function openClassModal() {
        classForm.reset();
        if (searchStudentsInput) searchStudentsInput.value = '';
        selectedStudentIds.clear();
        isEditingClass = false;
        editingTemplateId = null;
        classModalTitle.innerHTML = '<i class="fas fa-calendar-plus text-primary mr-2"></i> Agendar Nova Aula';

        // Reset day buttons to inactive state
        document.querySelectorAll('#class-days-of-week .day-toggle').forEach(btn => {
            btn.className = 'day-toggle flex-1 min-w-[3rem] py-2 rounded-xl text-sm font-semibold border bg-gray-50 dark:bg-[#222]/40 border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#333]/40 hover:text-gray-800 dark:hover:text-white';
        });

        if (selectedUnitId) {
            await populateTeacherAndStudentSelectors(selectedUnitId);
            classModal.classList.remove('hidden');
        } else {
            alert("Por favor, selecione uma unidade primeiro.");
        }
    }

    async function openEditClassModal(classData) {
        classForm.reset();
        if (searchStudentsInput) searchStudentsInput.value = '';
        selectedStudentIds.clear();
        isEditingClass = true;
        editingTemplateId = classData.templateId;
        classModalTitle.innerHTML = '<i class="fas fa-pen text-primary mr-2"></i> Editar Turma';

        // Carrega o template completo do Firestore
        const templateRef = doc(db, 'classTemplates', classData.templateId);
        const templateSnap = await getDoc(templateRef);
        if (!templateSnap.exists()) {
            alert('Template de aula não encontrado.');
            return;
        }
        const template = templateSnap.data();

        await populateTeacherAndStudentSelectors(selectedUnitId);

        // Pré-preenche o formulário
        document.getElementById('class-name').value = template.name || '';
        if (classCategorySelect) classCategorySelect.value = template.category || '';
        document.getElementById('class-time').value = template.time || '';
        document.getElementById('class-duration').value = template.duration || 60;
        document.getElementById('class-capacity').value = template.capacity || 10;

        // Seleciona o professor
        for (const opt of classTeacherSelect.options) {
            if (opt.value === template.teacherId) { opt.selected = true; break; }
        }

        // Seleciona os dias da semana
        document.querySelectorAll('#class-days-of-week .day-toggle').forEach(btn => {
            const day = parseInt(btn.dataset.day);
            if (template.daysOfWeek && template.daysOfWeek.includes(day)) {
                btn.className = 'day-toggle flex-1 min-w-[3rem] py-2 rounded-xl text-sm font-bold border bg-primary border-primary text-black';
            } else {
                btn.className = 'day-toggle flex-1 min-w-[3rem] py-2 rounded-xl text-sm font-semibold border bg-gray-50 dark:bg-[#222]/40 border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#333]/40 hover:text-gray-800 dark:hover:text-white';
            }
        });

        // Seleciona os alunos
        selectedStudentIds = new Set((template.students || []).map(s => s.toString()));
        renderStudentsList();

        closeAttendanceModal();
        classModal.classList.remove('hidden');
    }

    function closeClassModal() {
        classModal.classList.add('hidden');
    }

    async function populateTeacherAndStudentSelectors(unitId) {
        classTeacherSelect.innerHTML = '<option value="">Carregando...</option>';
        classStudentsSelect.innerHTML = '<option value="">Carregando...</option>';

        try {
            classTeacherSelect.innerHTML = '<option value="">Selecione um Professor</option>';
            const instructorsQuery = query(collection(db, 'users'), where('isInstructor', '==', true));
            const instructorsSnapshot = await getDocs(instructorsQuery);
            if (instructorsSnapshot.empty) {
                classTeacherSelect.innerHTML = '<option value="">Nenhum professor encontrado</option>';
            } else {
                instructorsSnapshot.forEach((doc) => {
                    const instructor = doc.data();
                    const option = new Option(instructor.name, doc.id);
                    classTeacherSelect.add(option);
                });
            }

            const listAllMembers = httpsCallable(functions, 'listAllMembers');
            const result = await listAllMembers({ unitId });
            const members = result.data;

            currentStudents = members.filter(m => !m.isInstructor);
            selectedStudentIds.clear();
            renderStudentsList();

        } catch (error) {
            console.error("Erro ao carregar dados para o modal:", error);
            classTeacherSelect.innerHTML = '<option value="">Erro ao carregar</option>';
            classStudentsSelect.innerHTML = '<option value="">Erro ao carregar</option>';
        }
    }

    function renderSelectedStudents() {
        const selectedContainer = document.getElementById('selected-students-container');
        if (!selectedContainer) return;

        selectedContainer.innerHTML = '';
        
        const selectedMembers = currentStudents.filter(student => 
            selectedStudentIds.has(student.idMember.toString())
        );

        // Ordenar os selecionados em ordem alfabética
        selectedMembers.sort((a, b) => {
            const aName = `${a.firstName} ${a.lastName || ''}`.toLowerCase();
            const bName = `${b.firstName} ${b.lastName || ''}`.toLowerCase();
            return aName.localeCompare(bName);
        });

        if (selectedMembers.length === 0) {
            selectedContainer.innerHTML = '<p class="text-xs text-gray-400 dark:text-gray-500 font-semibold italic p-1">Nenhum aluno inscrito ainda.</p>';
            return;
        }

        selectedMembers.forEach(student => {
            const fullName = `${student.firstName} ${student.lastName || ''}`;
            const pill = document.createElement('div');
            // Estilo moderno de pill premium, combinando com o tema
            pill.className = 'flex items-center gap-1.5 bg-yellow-500/10 dark:bg-yellow-500/20 text-gray-850 dark:text-white pl-3 pr-2 py-1.5 rounded-full text-xs font-bold border border-primary/20 shadow-sm transition-all hover:scale-[1.02]';
            pill.innerHTML = `
                <span>${fullName}</span>
                <button type="button" class="remove-student-btn hover:bg-rose-500/20 text-gray-400 hover:text-rose-500 rounded-full w-4 h-4 flex items-center justify-center transition-all" data-student-id="${student.idMember}">
                    <i class="fas fa-times text-[9px] pointer-events-none"></i>
                </button>
            `;
            selectedContainer.appendChild(pill);
        });
    }

    function renderStudentsList(filterText = '') {
        classStudentsSelect.innerHTML = '';
        
        // Filtrar alunos que NÃO estão selecionados e batem com a busca
        const filtered = currentStudents.filter(student => {
            const isSelected = selectedStudentIds.has(student.idMember.toString());
            if (isSelected) return false; // Sai da caixa de opções
            
            const fullName = `${student.firstName} ${student.lastName || ''}`.toLowerCase();
            return fullName.includes(filterText.toLowerCase());
        });

        // Ordenar os candidatos em ordem alfabética
        filtered.sort((a, b) => {
            const aName = `${a.firstName} ${a.lastName || ''}`.toLowerCase();
            const bName = `${b.firstName} ${b.lastName || ''}`.toLowerCase();
            return aName.localeCompare(bName);
        });

        if (filtered.length > 0) {
            filtered.forEach(student => {
                const option = new Option(`${student.firstName} ${student.lastName || ''}`, student.idMember);
                classStudentsSelect.add(option);
            });
        } else {
            classStudentsSelect.innerHTML = '<option value="" disabled>Nenhum aluno encontrado</option>';
        }

        // Renderiza os pills dos selecionados
        renderSelectedStudents();
    }

    async function handleClassFormSubmit(e) {
        e.preventDefault();
        if (!selectedUnitId) {
            alert("Unidade não selecionada.");
            return;
        }

        const activeDays = Array.from(document.querySelectorAll('#class-days-of-week .day-toggle'))
            .filter(btn => btn.classList.contains('bg-primary'))
            .map(btn => parseInt(btn.dataset.day));

        if (activeDays.length === 0) {
            alert("Selecione pelo menos um dia da semana.");
            return;
        }

        const formData = new FormData(classForm);
        const selectedStudents = Array.from(selectedStudentIds);

        const classTemplate = {
            name: formData.get('class-name'),
            category: formData.get('class-category') || '',
            teacherId: formData.get('class-teacher'),
            teacherName: classTeacherSelect.options[classTeacherSelect.selectedIndex].text,
            daysOfWeek: activeDays,
            time: formData.get('class-time'),
            duration: parseInt(formData.get('class-duration'), 10),
            capacity: parseInt(formData.get('class-capacity'), 10),
            students: selectedStudents,
            unitId: selectedUnitId
        };

        try {
            if (isEditingClass && editingTemplateId) {
                // MODO EDIÇÃO: atualiza o template existente
                const templateRef = doc(db, 'classTemplates', editingTemplateId);
                await updateDoc(templateRef, classTemplate);
            } else {
                // MODO CRIAÇÃO: adiciona novo template
                await addDoc(collection(db, 'classTemplates'), classTemplate);
            }
            closeClassModal();
            renderGrid();
        } catch (error) {
            console.error("Erro ao salvar modelo de aula:", error);
            alert("Falha ao salvar a aula.");
        }
    }

    async function openAttendanceModal(classData, useCache = false) {
        currentClassId = classData.id;
        currentClassData = classData;
        
        if (!useCache) {
            studentList.innerHTML = '<div class="flex justify-center p-8"><i class="fas fa-spinner fa-spin text-primary text-3xl"></i></div>';
        }
        attendanceModal.classList.remove('hidden');

        try {
            // Apenas administradores podem excluir turmas
            if (currentUser && currentUser.isAdmin) {
                deleteClassBtn.classList.remove('hidden');
            } else {
                deleteClassBtn.classList.add('hidden');
            }

            const startTime = classData.startTime;
            const endTime = classData.endTime;
            modalClassTitle.textContent = classData.name;
            modalClassTime.textContent = `${startTime.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })} • ${startTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} - ${endTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
            modalClassTeacher.textContent = classData.teacherName;

            if (modalClassCategory && modalClassCategoryRow) {
                if (classData.category) {
                    modalClassCategory.textContent = classData.category;
                    modalClassCategoryRow.classList.remove('hidden');
                } else {
                    modalClassCategoryRow.classList.add('hidden');
                }
            }

            let presentStudents = [];
            let trialStudents = [];

            const cachedInst = cachedClassInstances.get(classData.id);
            if (cachedInst) {
                presentStudents = cachedInst.presentStudents || [];
                trialStudents = cachedInst.trialStudents || [];
            } else {
                const instanceRef = doc(db, 'classInstances', classData.id);
                const instanceSnap = await getDoc(instanceRef);
                presentStudents = instanceSnap.exists() ? instanceSnap.data().presentStudents || [] : [];
                trialStudents = instanceSnap.exists() ? instanceSnap.data().trialStudents || [] : [];
                cachedClassInstances.set(classData.id, {
                    presentStudents,
                    trialStudents
                });
            }

            modalClassOccupation.textContent = `${presentStudents.length}/${classData.students ? classData.students.length : 0}`;

            studentList.innerHTML = '';

            // ─── Seção 1: Alunos Regulares ────────────────────────────────────
            if (!classData.students || classData.students.length === 0) {
                studentList.innerHTML += '<p class="text-gray-500 dark:text-gray-400 text-center py-6 text-sm font-medium">Nenhum aluno inscrito nesta turma.</p>';
            } else {
                let allUnitMembers = unitMembersCache.get(classData.unitId);
                if (!allUnitMembers) {
                    const listAllMembers = httpsCallable(functions, 'listAllMembers');
                    const result = await listAllMembers({ unitId: classData.unitId });
                    allUnitMembers = result.data || [];
                    unitMembersCache.set(classData.unitId, allUnitMembers);
                }
                const membersMap = new Map(allUnitMembers.map(m => [m.idMember.toString(), m]));

                const presentStudentIds = presentStudents.map(id => id.toString());
                const enrolledStudentIds = (classData.students || []).map(id => id.toString());
                const unionStudentIds = Array.from(new Set([...enrolledStudentIds, ...presentStudentIds]));

                for (const studentId of unionStudentIds) {
                    const studentData = membersMap.get(studentId);
                    const isPresent = presentStudents.includes(studentId) || presentStudents.includes(Number(studentId));

                    const studentElement = document.createElement('div');
                    studentElement.className = `flex items-center justify-between p-3.5 rounded-2xl border transition-all duration-300 ${isPresent ? 'bg-emerald-50/80 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40' : 'bg-gray-50/80 dark:bg-[#1a1a1a]/50 border-gray-150 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'}`;

                    const photoUrl = studentData?.photoUrl || 'default-profile.svg';
                    const nameText = studentData ? `${studentData.firstName} ${studentData.lastName || ''}` : `Aluno #${studentId}`;

                    studentElement.innerHTML = `
                        <div class="flex items-center gap-3">
                            <div class="relative">
                                <img src="${photoUrl}" alt="Foto" class="w-10 h-10 rounded-full object-cover border border-gray-200 dark:border-gray-700">
                                ${isPresent ? '<div class="absolute -bottom-1 -right-1 bg-emerald-500 text-white text-[9px] w-4 h-4 flex items-center justify-center rounded-full shadow-md"><i class="fas fa-check"></i></div>' : ''}
                            </div>
                            <div>
                                <div class="font-bold text-gray-850 dark:text-white text-sm">${nameText}</div>
                                <div class="text-xs font-semibold ${isPresent ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'} status-text">${isPresent ? 'Presente' : 'Ausente'}</div>
                            </div>
                        </div>
                        <button data-student-id="${studentId}" data-present="${isPresent}" class="toggle-presence-btn w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 ${isPresent ? 'bg-rose-500/10 text-rose-500 hover:bg-rose-500/20' : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'}">
                            <i class="fas ${isPresent ? 'fa-times' : 'fa-check'} pointer-events-none"></i>
                        </button>
                    `;
                    studentList.appendChild(studentElement);
                }
            }

            // ─── Seção 2: Alunos Experimentais ────────────────────────────────
            if (trialStudents.length > 0) {
                const divider = document.createElement('div');
                divider.className = 'mt-4 mb-3 flex items-center gap-3';
                divider.innerHTML = `
                    <div class="flex-grow h-px bg-amber-200 dark:bg-amber-800/40"></div>
                    <span class="text-xs font-extrabold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                        <i class="fas fa-star text-[10px]"></i> Aulas Experimentais (${trialStudents.length})
                    </span>
                    <div class="flex-grow h-px bg-amber-200 dark:bg-amber-800/40"></div>
                `;
                studentList.appendChild(divider);

                trialStudents.forEach((trial, idx) => {
                    const trialEl = document.createElement('div');
                    trialEl.className = `flex items-center justify-between p-3.5 rounded-2xl border transition-all duration-300 ${
                        trial.compareceu
                            ? 'bg-amber-50/80 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700/50'
                            : 'bg-amber-50/40 dark:bg-amber-950/10 border-amber-200/60 dark:border-amber-800/30'
                    }`;

                    const agendadoEm = trial.agendadoEm?.toDate ? trial.agendadoEm.toDate().toLocaleDateString('pt-BR') : '';
                    const whatsappLink = trial.telefone ? `https://wa.me/55${trial.telefone.replace(/\D/g, '')}` : null;

                    trialEl.innerHTML = `
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 border-2 border-amber-400 dark:border-amber-600 flex items-center justify-center text-amber-600 dark:text-amber-400 font-extrabold text-sm flex-shrink-0">
                                ${(trial.nome || '?')[0].toUpperCase()}
                            </div>
                            <div>
                                <div class="font-bold text-gray-850 dark:text-white text-sm">${trial.nome || 'Visitante'}</div>
                                <div class="text-[10px] font-semibold text-amber-600 dark:text-amber-400">${trial.programa || ''} ${trial.telefone ? '· ' + trial.telefone : ''}</div>
                                ${agendadoEm ? `<div class="text-[9px] text-gray-400">Agendado em ${agendadoEm}</div>` : ''}
                            </div>
                        </div>
                        <div class="flex items-center gap-2">
                            ${whatsappLink ? `<a href="${whatsappLink}" target="_blank" class="w-8 h-8 rounded-xl flex items-center justify-center bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-all" title="Contato WhatsApp"><i class="fab fa-whatsapp text-sm"></i></a>` : ''}
                            <button data-trial-idx="${idx}" data-compareceu="${trial.compareceu ? 'true' : 'false'}" class="toggle-trial-btn w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300 ${
                                trial.compareceu
                                    ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-rose-500/20 hover:text-rose-500'
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-400 hover:bg-amber-500/20 hover:text-amber-600'
                            }" title="${trial.compareceu ? 'Marcar como ausente' : 'Confirmar comparecimento'}">
                                <i class="fas ${trial.compareceu ? 'fa-star' : 'fa-star'} text-xs pointer-events-none"></i>
                            </button>
                            <button data-trial-idx="${idx}" class="delete-trial-btn w-8 h-8 rounded-xl flex items-center justify-center bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-all duration-300" title="Excluir aula experimental">
                                <i class="fas fa-trash-alt text-xs pointer-events-none"></i>
                            </button>
                        </div>
                    `;
                    studentList.appendChild(trialEl);
                });
            }

        } catch (error) {
            console.error("Erro ao abrir modal de presença:", error);
            studentList.innerHTML = '<p class="text-red-500 dark:text-red-400 text-center py-4 font-semibold text-sm">Erro ao carregar dados.</p>';
        }
    }

    function closeAttendanceModal() {
        attendanceModal.classList.add('hidden');
        currentClassId = null;
        // Limpar busca e resultados do check-in avulso
        const searchInput = document.getElementById('quick-checkin-search');
        if (searchInput) searchInput.value = '';
        const resultsContainer = document.getElementById('quick-checkin-results');
        if (resultsContainer) resultsContainer.classList.add('hidden');
        const clearBtn = document.getElementById('clear-quick-checkin-btn');
        if (clearBtn) clearBtn.classList.add('hidden');
    }

    async function syncStudentStreak(studentId) {
        try {
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('evoMemberId', '==', Number(studentId)));
            let querySnapshot = await getDocs(q);
            let userDocRef = null;
            let userData = null;

            if (!querySnapshot.empty) {
                userDocRef = querySnapshot.docs[0].ref;
                userData = querySnapshot.docs[0].data();
            } else {
                const q2 = query(usersRef, where('evoMemberId', '==', studentId.toString()));
                querySnapshot = await getDocs(q2);
                if (!querySnapshot.empty) {
                    userDocRef = querySnapshot.docs[0].ref;
                    userData = querySnapshot.docs[0].data();
                }
            }

            if (userDocRef && userData) {
                const instancesCol = collection(db, 'classInstances');
                const qNum = query(instancesCol, where('presentStudents', 'array-contains', Number(studentId)));
                const qStr = query(instancesCol, where('presentStudents', 'array-contains', studentId.toString()));
                
                const [snapNum, snapStr] = await Promise.all([getDocs(qNum), getDocs(qStr)]);
                
                const uniqueDates = new Set();
                snapNum.forEach(docSnap => {
                    const d = docSnap.data().date;
                    if (d) uniqueDates.add(d);
                });
                snapStr.forEach(docSnap => {
                    const d = docSnap.data().date;
                    if (d) uniqueDates.add(d);
                });
                
                const sortedDates = Array.from(uniqueDates).sort();
                
                let currentStreak = 0;
                let longestStreak = 0;
                let lastAttendanceDate = null;
                
                if (sortedDates.length > 0) {
                    let current = 0;
                    let longest = 0;
                    let prevDateStr = null;
                    
                    for (const dateStr of sortedDates) {
                        if (!prevDateStr) {
                            current = 1;
                        } else {
                            const prev = new Date(prevDateStr + 'T12:00:00');
                            const curr = new Date(dateStr + 'T12:00:00');
                            const diffTime = Math.abs(curr.getTime() - prev.getTime());
                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                            
                            if (diffDays <= 5) {
                                current += 1;
                            } else {
                                current = 1;
                            }
                        }
                        
                        if (current > longest) {
                            longest = current;
                        }
                        
                        prevDateStr = dateStr;
                    }
                    
                    const lastDateStr = sortedDates[sortedDates.length - 1];
                    const lastDate = new Date(lastDateStr + 'T12:00:00');
                    const todayStr = getLocalDateString(new Date());
                    const todayDate = new Date(todayStr + 'T12:00:00');
                    const diffTimeToday = todayDate.getTime() - lastDate.getTime();
                    const diffDaysToday = Math.floor(diffTimeToday / (1000 * 60 * 60 * 24));
                    
                    currentStreak = current;
                    if (diffDaysToday > 5) {
                        currentStreak = 0;
                    }
                    longestStreak = longest;
                    lastAttendanceDate = lastDateStr;
                }
                
                await updateDoc(userDocRef, {
                    currentStreak,
                    longestStreak,
                    lastAttendanceDate
                });
                console.log(`Streak recalculado na intranet para o usuário: ${userDocRef.id}, atual: ${currentStreak}, recorde: ${longestStreak}`);
            }
        } catch (err) {
            console.error("Erro ao sincronizar streak do aluno na intranet:", err);
        }
    }

    async function ensureAllSchoolMembersLoaded() {
        if (allSchoolMembers.length > 0) return allSchoolMembers;
        if (allSchoolMembersPromise) return allSchoolMembersPromise;

        allSchoolMembersPromise = (async () => {
            isLoadingSchoolMembers = true;
            try {
                const resultsDiv = document.getElementById('quick-checkin-results');
                if (resultsDiv) {
                    resultsDiv.innerHTML = '<div class="p-3 text-xs text-gray-500 text-center"><i class="fas fa-spinner fa-spin mr-2"></i>Carregando alunos do sistema...</div>';
                    resultsDiv.classList.remove('hidden');
                }

                const listAllMembers = httpsCallable(functions, 'listAllMembers');
                const result = await listAllMembers({ unitId: 'all' });
                allSchoolMembers = (result.data || []).filter(m => !m.isInstructor);
                return allSchoolMembers;
            } catch (err) {
                console.error("Erro ao carregar alunos de todas as unidades:", err);
                const resultsDiv = document.getElementById('quick-checkin-results');
                if (resultsDiv) {
                    resultsDiv.innerHTML = '<div class="p-3 text-xs text-red-500 text-center">Erro ao carregar alunos. Recarregue a página.</div>';
                }
                allSchoolMembersPromise = null; // Permite tentar novamente em caso de erro
                throw err;
            } finally {
                isLoadingSchoolMembers = false;
            }
        })();

        return allSchoolMembersPromise;
    }

    async function performQuickCheckin(studentId) {
        if (!currentClassId) return;
        const instanceRef = doc(db, 'classInstances', currentClassId);
        const studentIdToSave = typeof studentId === 'string' ? studentId : studentId.toString();

        try {
            const instanceSnap = await getDoc(instanceRef);
            if (instanceSnap.exists()) {
                await updateDoc(instanceRef, {
                    presentStudents: arrayUnion(studentIdToSave)
                });
                
                // Atualizar cache em memória
                const cachedInst = cachedClassInstances.get(currentClassId);
                if (cachedInst) {
                    const present = cachedInst.presentStudents || [];
                    if (!present.map(x => x.toString()).includes(studentIdToSave)) {
                        cachedInst.presentStudents = [...present, studentIdToSave];
                    }
                }
            } else {
                const [templateId, date] = currentClassId.split('_');
                await setDoc(instanceRef, {
                    templateId: templateId,
                    date: date,
                    unitId: selectedUnitId,
                    presentStudents: [studentIdToSave]
                });
                
                // Criar cache em memória
                cachedClassInstances.set(currentClassId, {
                    presentStudents: [studentIdToSave],
                    trialStudents: []
                });
            }

            // Sync streak
            await syncStudentStreak(studentIdToSave);

            // Limpa a busca
            const searchInput = document.getElementById('quick-checkin-search');
            if (searchInput) searchInput.value = '';
            const resultsDiv = document.getElementById('quick-checkin-results');
            if (resultsDiv) resultsDiv.classList.add('hidden');
            const clearBtn = document.getElementById('clear-quick-checkin-btn');
            if (clearBtn) clearBtn.classList.add('hidden');

            // Recarrega modal e grade usando cache para rapidez instantânea
            if (currentClassData) await openAttendanceModal(currentClassData, true);
            renderGrid(true);
        } catch (err) {
            console.error("Erro ao realizar checkin avulso:", err);
        }
    }

    function handleQuickCheckinSearch(e) {
        const queryText = e.target.value.toLowerCase().trim();
        const resultsContainer = document.getElementById('quick-checkin-results');
        const clearBtn = document.getElementById('clear-quick-checkin-btn');

        if (queryText.length === 0) {
            if (clearBtn) clearBtn.classList.add('hidden');
        } else {
            if (clearBtn) clearBtn.classList.remove('hidden');
        }

        if (queryText.length < 2) {
            if (resultsContainer) {
                resultsContainer.classList.add('hidden');
                resultsContainer.innerHTML = '';
            }
            return;
        }

        ensureAllSchoolMembersLoaded().then(() => {
            const matches = allSchoolMembers.filter(m => {
                const fullName = `${m.firstName || ''} ${m.lastName || ''}`.toLowerCase();
                return fullName.includes(queryText);
            }).slice(0, 15);

            if (resultsContainer) {
                if (matches.length === 0) {
                    resultsContainer.innerHTML = '<div class="p-3 text-xs text-gray-500 text-center">Nenhum aluno encontrado</div>';
                } else {
                    resultsContainer.innerHTML = matches.map(student => {
                        const unitNameText = student.branchName || student.unitId || '';
                        return `
                            <div class="quick-checkin-item flex justify-between items-center p-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer border-b border-gray-100 dark:border-gray-800/40 text-xs font-semibold" data-student-id="${student.idMember}">
                                <div class="flex flex-col">
                                    <span class="text-gray-900 dark:text-white font-bold">${student.firstName} ${student.lastName || ''}</span>
                                    <span class="text-[9px] text-gray-400 uppercase font-extrabold">${unitNameText}</span>
                                </div>
                                <button class="bg-primary text-black font-extrabold px-2.5 py-1 rounded-lg text-[10px] uppercase shadow-sm pointer-events-none">Check-in</button>
                            </div>
                        `;
                    }).join('');
                }
                resultsContainer.classList.remove('hidden');
            }
        });
    }

    async function handlePresenceToggle(e) {
        // Trial student delete
        const deleteTrialBtn = e.target.closest('.delete-trial-btn');
        if (deleteTrialBtn && currentClassId) {
            const idx = parseInt(deleteTrialBtn.dataset.trialIdx);
            if (confirm('Tem certeza de que deseja excluir esta aula experimental?')) {
                const instanceRef = doc(db, 'classInstances', currentClassId);
                try {
                    const snap = await getDoc(instanceRef);
                    if (snap.exists()) {
                        const trials = snap.data().trialStudents || [];
                        trials.splice(idx, 1);
                        await updateDoc(instanceRef, { trialStudents: trials });
                        
                        // Atualizar cache em memória
                        const cachedInst = cachedClassInstances.get(currentClassId);
                        if (cachedInst) cachedInst.trialStudents = trials;
                    }
                    if (currentClassData) await openAttendanceModal(currentClassData, true);
                    renderGrid(true);
                } catch (err) {
                    console.error('Erro ao excluir experimental:', err);
                }
            }
            return;
        }

        // Trial student toggle
        const trialBtn = e.target.closest('.toggle-trial-btn');
        if (trialBtn && currentClassId) {
            const idx = parseInt(trialBtn.dataset.trialIdx);
            const compareceu = trialBtn.dataset.compareceu === 'true';
            const instanceRef = doc(db, 'classInstances', currentClassId);
            try {
                const snap = await getDoc(instanceRef);
                if (snap.exists()) {
                    const trials = snap.data().trialStudents || [];
                    if (trials[idx]) {
                        trials[idx] = { ...trials[idx], compareceu: !compareceu };
                        await updateDoc(instanceRef, { trialStudents: trials });
                        
                        // Atualizar cache em memória
                        const cachedInst = cachedClassInstances.get(currentClassId);
                        if (cachedInst) cachedInst.trialStudents = trials;
                    }
                }
                if (currentClassData) await openAttendanceModal(currentClassData, true);
                renderGrid(true);
            } catch (err) {
                console.error('Erro ao atualizar experimental:', err);
            }
            return;
        }

        // Regular student toggle
        const button = e.target.closest('.toggle-presence-btn');
        if (!button) return;
        const studentId = button.dataset.studentId;
        if (!studentId || !currentClassId) return;

        const instanceRef = doc(db, 'classInstances', currentClassId);
        try {
            const instanceSnap = await getDoc(instanceRef);
            const isPresent = button.dataset.present === 'true';

            const presentStudents = instanceSnap.exists() ? instanceSnap.data().presentStudents || [] : [];
            const isExistingNumber = presentStudents.some(x => typeof x === 'number');
            const studentIdToSave = isExistingNumber ? Number(studentId) : studentId;

            if (instanceSnap.exists()) {
                await updateDoc(instanceRef, {
                    presentStudents: isPresent ? arrayRemove(studentIdToSave) : arrayUnion(studentIdToSave)
                });
                
                // Atualizar cache em memória
                const cachedInst = cachedClassInstances.get(currentClassId);
                if (cachedInst) {
                    cachedInst.presentStudents = isPresent 
                        ? cachedInst.presentStudents.filter(id => id.toString() !== studentId.toString() && id !== Number(studentId))
                        : [...cachedInst.presentStudents, studentIdToSave];
                }
            } else if (!isPresent) {
                const [templateId, date] = currentClassId.split('_');
                await setDoc(instanceRef, {
                    templateId: templateId,
                    date: date,
                    unitId: selectedUnitId,
                    presentStudents: [studentIdToSave]
                });
                
                // Criar cache em memória
                cachedClassInstances.set(currentClassId, {
                    presentStudents: [studentIdToSave],
                    trialStudents: []
                });
            }

            // Sync streak to user document (recalculation)
            await syncStudentStreak(studentIdToSave);

            if (currentClassData) {
                await openAttendanceModal(currentClassData, true);
            }
            renderGrid(true);
        } catch (error) {
            console.error("Erro ao atualizar presença:", error);
        }
    }

    async function handleDeleteClass() {
        if (!currentClassData || !currentClassData.templateId) return;

        const confirmDelete = confirm(`Tem certeza que deseja excluir a aula "${currentClassData.name}" de forma permanente de toda a grade de horários da unidade?`);
        if (!confirmDelete) return;

        try {
            const templateRef = doc(db, 'classTemplates', currentClassData.templateId);
            await deleteDoc(templateRef);
            
            alert("Aula excluída com sucesso!");
            closeAttendanceModal();
            renderGrid();
        } catch (error) {
            console.error("Erro ao excluir aula:", error);
            alert("Não foi possível excluir a aula.");
        }
    }

    async function initialize() {
        try {
            const getPublicEvoUnits = httpsCallable(functions, 'getPublicEvoUnits');
            const result = await getPublicEvoUnits();
            const units = result.data;

            unitFilter.innerHTML = '<option value="">Selecione a Unidade</option>';
            
            const staffOption = document.createElement('option');
            staffOption.value = 'staff';
            staffOption.textContent = 'Staff / Corporativo';
            unitFilter.appendChild(staffOption);

            units.forEach(unitId => {
                const option = document.createElement('option');
                option.value = unitId;
                option.textContent = unitId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                unitFilter.appendChild(option);
            });

            // Popula também o filtro de unidades do relatório
            const reportUnitFilterEl = document.getElementById('report-unit-filter');
            if (reportUnitFilterEl) {
                reportUnitFilterEl.innerHTML = '<option value="all">Todas as Unidades</option>';
                
                const reportStaffOption = document.createElement('option');
                reportStaffOption.value = 'staff';
                reportStaffOption.textContent = 'Staff / Corporativo';
                reportUnitFilterEl.appendChild(reportStaffOption);

                units.forEach(unitId => {
                    const option = document.createElement('option');
                    option.value = unitId;
                    option.textContent = unitId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    reportUnitFilterEl.appendChild(option);
                });
            }
        } catch (error) {
            console.error("Erro ao carregar unidades do EVO:", error);
            unitFilter.innerHTML = '<option value="">Erro ao carregar</option>';
        }
        updateViewButtons();
        renderGrid();
    }

    // --- Ranking de Ofensivas Logic ---
    let activeTab = 'grade'; // 'grade' | 'ranking' | 'reports'
    let rankingFilter = 'current'; // 'current' | 'longest'
    let rankingSearchQuery = '';

    const tabGradeBtn = document.getElementById('tab-grade-btn');
    const tabRankingBtn = document.getElementById('tab-ranking-btn');
    const rankingViewContainer = document.getElementById('ranking-view-container');
    const rankingTableBody = document.getElementById('ranking-table-body');
    const calendarControlsWrapper = document.getElementById('calendar-controls-wrapper');
    const rankFilterCurrent = document.getElementById('rank-filter-current');
    const rankFilterLongest = document.getElementById('rank-filter-longest');
    const searchRankingInput = document.getElementById('search-ranking-input');

    async function renderRanking() {
        rankingTableBody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center py-12">
                    <i class="fas fa-spinner fa-spin text-primary text-3xl mb-3"></i>
                    <p class="text-sm text-gray-400 dark:text-gray-500 font-medium">Carregando placar de líderes...</p>
                </td>
            </tr>`;

        try {
            const orderField = rankingFilter === 'current' ? 'currentStreak' : 'longestStreak';
            
            // Query top 150 users with active streaks
            const q = query(
                collection(db, 'users'),
                where(orderField, '>', 0),
                orderBy(orderField, 'desc'),
                limit(150)
            );
            
            const snapshot = await getDocs(q);
            let usersList = [];
            snapshot.forEach(docSnap => {
                usersList.push({ id: docSnap.id, ...docSnap.data() });
            });

            // Filter by selected unit (selectedUnitId) in JavaScript
            if (selectedUnitId) {
                usersList = usersList.filter(u => {
                    const uUnit = (u.unitId || u.unidadeId || u.unit || u.unidade || '').toLowerCase();
                    return uUnit === selectedUnitId.toLowerCase();
                });
            }

            // Filter by search query in JavaScript
            if (rankingSearchQuery) {
                const s = rankingSearchQuery.toLowerCase();
                usersList = usersList.filter(u => {
                    const name = (u.name || u.nome || '').toLowerCase();
                    return name.includes(s);
                });
            }

            rankingTableBody.innerHTML = '';
            if (usersList.length === 0) {
                rankingTableBody.innerHTML = `
                    <tr>
                        <td colspan="4" class="text-center py-12 text-gray-400 dark:text-gray-500 font-medium">
                            <i class="fas fa-trophy text-3xl mb-3 opacity-30"></i>
                            <p class="text-sm">Nenhum aluno encontrado com ofensiva.</p>
                        </td>
                    </tr>`;
                return;
            }

            usersList.forEach((user, index) => {
                let rankBadge = '';
                if (index === 0) rankBadge = '🥇';
                else if (index === 1) rankBadge = '🥈';
                else if (index === 2) rankBadge = '🥉';
                else rankBadge = `#${index + 1}`;

                let photoUrl = user.photoURL || user.profilePicture || user.photoUrl || user.avatar || 'default-profile.svg';
                if (photoUrl && photoUrl.startsWith('/')) {
                    photoUrl = `https://kihap.com.br${photoUrl}`;
                }

                const displayUnit = user.unitId || user.unidadeId || user.unit || user.unidade || 'KIHAP';
                const capitalizedUnit = displayUnit.charAt(0).toUpperCase() + displayUnit.slice(1).replace(/-/g, ' ');

                const tr = document.createElement('tr');
                tr.className = 'hover:bg-gray-50/50 dark:hover:bg-[#222]/30 transition-colors border-b border-gray-150/40 dark:border-gray-800/30';
                tr.innerHTML = `
                    <td class="py-3.5 px-4 text-center font-extrabold ${index < 3 ? 'text-2xl' : 'text-xs text-gray-400 dark:text-gray-500'}">${rankBadge}</td>
                    <td class="py-3.5 px-4">
                        <div class="flex items-center gap-3">
                            <img src="${photoUrl}" alt="Foto" class="w-9 h-9 rounded-full object-cover border border-gray-200 dark:border-gray-700">
                            <span class="font-bold text-gray-800 dark:text-gray-200 text-sm">${user.name || user.nome || 'Aluno'}</span>
                        </div>
                    </td>
                    <td class="py-3.5 px-4">
                        <span class="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">${capitalizedUnit}</span>
                    </td>
                    <td class="py-3.5 px-4 text-right font-black text-orange-500 pr-6 text-sm">
                        <i class="fas fa-fire text-xs mr-1"></i> ${user[orderField] || 0}
                    </td>
                `;
                rankingTableBody.appendChild(tr);
            });
        } catch (error) {
            console.error("Erro ao renderizar ranking:", error);
            rankingTableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center py-12 text-rose-500 dark:text-rose-400 font-semibold">
                        <i class="fas fa-exclamation-triangle text-3xl mb-3"></i>
                        <p class="text-sm">Erro ao carregar o ranking. Verifique o console.</p>
                    </td>
                </tr>`;
        }
    }

    // --- Relatórios de Presenças Logic ---
    let timelineChart = null;
    let distributionChart = null;
    let cachedReportsData = null;

    const tabReportsBtn = document.getElementById('tab-reports-btn');
    const reportsViewContainer = document.getElementById('reports-view-container');
    const reportPeriodFilter = document.getElementById('report-period-filter');
    const reportCustomDates = document.getElementById('report-custom-dates');
    const reportStartDate = document.getElementById('report-start-date');
    const reportEndDate = document.getElementById('report-end-date');
    const reportUnitFilter = document.getElementById('report-unit-filter');
    const generateReportBtn = document.getElementById('generate-report-btn');
    const searchReportsRankingInput = document.getElementById('search-reports-ranking-input');
    const reportsRankingTableBody = document.getElementById('reports-ranking-table-body');
    const reportsClassesTableBody = document.getElementById('reports-classes-table-body');

    function formatLocalDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function getReportPeriodDates(period) {
        const now = new Date();
        let start = new Date();
        let end = new Date();

        if (period === 'today') {
            start = now;
            end = now;
        } else if (period === 'week') {
            const day = now.getDay();
            const diff = now.getDate() - day + (day === 0 ? -6 : 1);
            start = new Date(now.setDate(diff));
            end = new Date(start);
            end.setDate(end.getDate() + 6);
        } else if (period === 'month') {
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        } else if (period === 'last30') {
            start = new Date();
            start.setDate(now.getDate() - 30);
            end = now;
        } else if (period === 'last90') {
            start = new Date();
            start.setDate(now.getDate() - 90);
            end = now;
        } else if (period === 'custom') {
            let startVal = reportStartDate.value;
            let endVal = reportEndDate.value;
            if (!startVal) {
                const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
                reportStartDate.value = formatLocalDate(defaultStart);
                startVal = reportStartDate.value;
            }
            if (!endVal) {
                const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                reportEndDate.value = formatLocalDate(defaultEnd);
                endVal = reportEndDate.value;
            }
            start = new Date(startVal + 'T12:00:00');
            end = new Date(endVal + 'T12:00:00');
        }

        return { startStr: formatLocalDate(start), endStr: formatLocalDate(end) };
    }

    function setReportsLoading(isLoading) {
        if (isLoading) {
            document.getElementById('kpi-total-classes').innerHTML = '<i class="fas fa-spinner fa-spin text-sm"></i>';
            document.getElementById('kpi-total-presences').innerHTML = '<i class="fas fa-spinner fa-spin text-sm"></i>';
            document.getElementById('kpi-unique-students').innerHTML = '<i class="fas fa-spinner fa-spin text-sm"></i>';
            document.getElementById('kpi-avg-occupation').innerHTML = '<i class="fas fa-spinner fa-spin text-sm"></i>';
            document.getElementById('kpi-avg-students').innerHTML = '<i class="fas fa-spinner fa-spin text-sm"></i>';

            reportsRankingTableBody.innerHTML = `
                <tr>
                    <td colspan="3" class="text-center py-8">
                        <i class="fas fa-spinner fa-spin text-primary text-2xl mb-2"></i>
                        <p class="text-xs text-gray-400 dark:text-gray-500 font-semibold">Carregando alunos...</p>
                    </td>
                </tr>`;
            reportsClassesTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-8">
                        <i class="fas fa-spinner fa-spin text-primary text-2xl mb-2"></i>
                        <p class="text-xs text-gray-400 dark:text-gray-500 font-semibold">Processando histórico de aulas...</p>
                    </td>
                </tr>`;
        }
    }

    async function resolveStudentNames(studentIds) {
        const membersMap = new Map();
        if (!studentIds || studentIds.length === 0) return membersMap;

        // Limita a busca em lotes de 30 devido ao limite do operador 'in' do Firestore
        const chunks = [];
        for (let i = 0; i < studentIds.length; i += 30) {
            chunks.push(studentIds.slice(i, i + 30));
        }

        const promises = chunks.map(async (chunk) => {
            const stringIds = chunk.map(id => id.toString());
            const q = query(
                collection(db, 'evo_students'),
                where(documentId(), 'in', stringIds)
            );
            const snap = await getDocs(q);
            snap.forEach(docSnap => {
                membersMap.set(docSnap.id, docSnap.data());
            });
        });

        await Promise.all(promises);
        return membersMap;
    }

    async function loadReports() {
        setReportsLoading(true);

        const period = reportPeriodFilter.value;
        const { startStr, endStr } = getReportPeriodDates(period);
        const selectedUnit = reportUnitFilter.value;

        try {
            // 1. Carrega todos os templates de aula
            const templatesQuery = query(collection(db, 'classTemplates'));
            const templatesSnap = await getDocs(templatesQuery);
            const templatesMap = new Map();
            templatesSnap.forEach(docSnap => {
                templatesMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
            });

            // 2. Consulta instâncias de aulas no período
            const instancesQuery = query(
                collection(db, 'classInstances'),
                where('date', '>=', startStr),
                where('date', '<=', endStr)
            );
            const instancesSnap = await getDocs(instancesQuery);
            let instances = [];
            instancesSnap.forEach(docSnap => {
                instances.push({ id: docSnap.id, ...docSnap.data() });
            });

            // Filtragem local por unidade
            if (selectedUnit !== 'all') {
                instances = instances.filter(inst => inst.unitId === selectedUnit);
            }

            let totalClasses = instances.length;
            let totalPresences = 0;
            let totalCapacitySum = 0;

            const timelineMap = new Map();
            const distributionMap = new Map();
            const studentPresencesCount = new Map();
            const detailedClasses = [];

            // Ordenar por data crescente para o gráfico de linha
            instances.sort((a, b) => a.date.localeCompare(b.date));

            instances.forEach(inst => {
                const template = templatesMap.get(inst.templateId);
                const className = template ? template.name : 'Aula Removida';
                const teacherName = template ? template.teacherName : 'Desconhecido';
                const capacity = template ? template.capacity : 10;

                const presences = inst.presentStudents ? inst.presentStudents.length : 0;
                totalPresences += presences;
                totalCapacitySum += capacity;

                // Gráfico 1: Timeline
                timelineMap.set(inst.date, (timelineMap.get(inst.date) || 0) + presences);

                // Gráfico 2: Distribuição por Unidade ou por Instrutor
                if (selectedUnit === 'all') {
                    const label = inst.unitId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    distributionMap.set(label, (distributionMap.get(label) || 0) + presences);
                } else {
                    distributionMap.set(teacherName, (distributionMap.get(teacherName) || 0) + presences);
                }

                // Ranking de Frequência de Alunos
                if (inst.presentStudents) {
                    inst.presentStudents.forEach(sid => {
                        const sidStr = sid.toString();
                        studentPresencesCount.set(sidStr, (studentPresencesCount.get(sidStr) || 0) + 1);
                    });
                }

                detailedClasses.push({
                    id: inst.id,
                    date: inst.date,
                    name: className,
                    teacherName: teacherName,
                    unitId: inst.unitId,
                    presences: presences,
                    capacity: capacity,
                    classData: template ? {
                        ...template,
                        templateId: template.id,
                        id: inst.id,
                        startTime: new Date(inst.date + 'T' + (template.time || '12:00')),
                        endTime: new Date(new Date(inst.date + 'T' + (template.time || '12:00')).getTime() + template.duration * 60000),
                        presentStudents: inst.presentStudents || [],
                        trialStudents: inst.trialStudents || []
                    } : null
                });
            });

            // Calcula KPIs de experimentais (separado, não afeta regulares)
            let trialsScheduled = 0;
            let trialsAttended = 0;
            instancesSnap.forEach(docSnap => {
                const inst = { id: docSnap.id, ...docSnap.data() };
                if (selectedUnit !== 'all' && inst.unitId !== selectedUnit) return;
                const trials = inst.trialStudents || [];
                trialsScheduled += trials.length;
                trialsAttended += trials.filter(t => t.compareceu).length;
            });

            // 3. Carrega nomes dos alunos sob demanda apenas para os IDs que têm presenças no período
            const studentIds = Array.from(studentPresencesCount.keys());
            const membersMap = await resolveStudentNames(studentIds);

            const avgOccupation = totalCapacitySum > 0 ? Math.round((totalPresences / totalCapacitySum) * 100) : 0;
            const avgStudents = totalClasses > 0 ? (totalPresences / totalClasses).toFixed(1) : '0.0';

            cachedReportsData = {
                studentPresencesCount,
                membersMap,
                detailedClasses,
                totalClasses,
                totalPresences,
                avgOccupation,
                avgStudents,
                timelineMap,
                distributionMap,
                selectedUnit,
                trialsScheduled,
                trialsAttended
            };

            renderReportDashboard();

        } catch (err) {
            console.error("Erro ao carregar relatórios:", err);
            alert("Não foi possível processar o relatório de presenças.");
            setReportsLoading(false);
        }
    }

    function renderReportDashboard() {
        if (!cachedReportsData) return;

        const {
            totalClasses,
            totalPresences,
            avgOccupation,
            avgStudents,
            timelineMap,
            distributionMap,
            selectedUnit,
            studentPresencesCount,
            trialsScheduled = 0,
            trialsAttended = 0
        } = cachedReportsData;

        document.getElementById('kpi-total-classes').textContent = totalClasses;
        document.getElementById('kpi-total-presences').textContent = totalPresences;
        document.getElementById('kpi-unique-students').textContent = studentPresencesCount.size;
        document.getElementById('kpi-avg-occupation').textContent = `${avgOccupation}%`;
        document.getElementById('kpi-avg-students').textContent = avgStudents;

        // KPIs de experimentais (separados, nunca afetam os regulares acima)
        const trialsScheduledEl = document.getElementById('kpi-trials-scheduled');
        const trialsAttendedEl = document.getElementById('kpi-trials-attended');
        const trialsConversionEl = document.getElementById('kpi-trials-conversion');
        if (trialsScheduledEl) trialsScheduledEl.textContent = trialsScheduled;
        if (trialsAttendedEl) trialsAttendedEl.textContent = trialsAttended;
        if (trialsConversionEl) {
            trialsConversionEl.textContent = trialsScheduled > 0
                ? `${Math.round((trialsAttended / trialsScheduled) * 100)}%`
                : '-%';
        }

        renderTimelineChart(timelineMap);
        renderDistributionChart(distributionMap, selectedUnit);
        renderReportsRanking();
        renderDetailedClasses();
    }

    function renderTimelineChart(timelineMap) {
        const ctx = document.getElementById('chart-attendance-timeline').getContext('2d');
        if (timelineChart) {
            timelineChart.destroy();
        }

        const sortedDates = Array.from(timelineMap.keys()).sort();
        const labels = sortedDates.map(dateStr => {
            const [y, m, d] = dateStr.split('-');
            return `${d}/${m}`;
        });
        const data = sortedDates.map(dateStr => timelineMap.get(dateStr));

        const isDark = document.documentElement.classList.contains('dark');
        const textColor = isDark ? '#9ca3af' : '#4b5563';
        const gridColor = isDark ? '#27272a' : '#e4e4e7';

        timelineChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels.length > 0 ? labels : ['Sem dados'],
                datasets: [{
                    label: 'Presenças',
                    data: data.length > 0 ? data : [0],
                    borderColor: '#eab308',
                    backgroundColor: 'rgba(234, 179, 8, 0.08)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.3,
                    pointBackgroundColor: '#eab308',
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: isDark ? '#18181b' : '#ffffff',
                        titleColor: isDark ? '#ffffff' : '#18181b',
                        bodyColor: isDark ? '#a1a1aa' : '#71717a',
                        borderColor: isDark ? '#27272a' : '#e4e4e7',
                        borderWidth: 1,
                        titleFont: { family: 'Inter', weight: 'bold' },
                        bodyFont: { family: 'Inter' }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: textColor, font: { family: 'Inter', size: 10, weight: '500' } }
                    },
                    y: {
                        grid: { color: gridColor },
                        ticks: { color: textColor, stepSize: 1, font: { family: 'Inter', size: 10, weight: '505' } },
                        min: 0
                    }
                }
            }
        });
    }

    function renderDistributionChart(distributionMap, selectedUnit) {
        const titleEl = document.getElementById('distribution-chart-title');
        if (selectedUnit === 'all') {
            titleEl.innerHTML = '<i class="fas fa-chart-pie text-primary"></i> Distribuição por Unidade';
        } else {
            titleEl.innerHTML = '<i class="fas fa-user-tie text-primary"></i> Distribuição por Professor';
        }

        const ctx = document.getElementById('chart-attendance-distribution').getContext('2d');
        if (distributionChart) {
            distributionChart.destroy();
        }

        const labels = Array.from(distributionMap.keys());
        const data = Array.from(distributionMap.values());

        const isDark = document.documentElement.classList.contains('dark');
        const textColor = isDark ? '#9ca3af' : '#4b5563';

        const palette = [
            '#eab308', // Amarelo
            '#10b981', // Verde
            '#3b82f6', // Azul
            '#8b5cf6', // Roxo
            '#ec4899', // Rosa
            '#f97316', // Laranja
            '#06b6d4'  // Ciano
        ];

        distributionChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels.length > 0 ? labels : ['Sem dados'],
                datasets: [{
                    data: data.length > 0 ? data : [0],
                    backgroundColor: data.length > 0 ? palette.slice(0, data.length) : ['#e4e4e7'],
                    borderWidth: isDark ? 2 : 1,
                    borderColor: isDark ? '#1a1a1a' : '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: textColor,
                            font: { family: 'Inter', size: 10, weight: '600' },
                            boxWidth: 10,
                            padding: 12
                        }
                    },
                    tooltip: {
                        backgroundColor: isDark ? '#18181b' : '#ffffff',
                        titleColor: isDark ? '#ffffff' : '#18181b',
                        bodyColor: isDark ? '#a1a1aa' : '#71717a',
                        borderColor: isDark ? '#27272a' : '#e4e4e7',
                        borderWidth: 1
                    }
                },
                cutout: '70%'
            }
        });
    }

    function renderReportsRanking() {
        if (!cachedReportsData) return;

        const { studentPresencesCount, membersMap } = cachedReportsData;
        const searchQuery = searchReportsRankingInput.value.toLowerCase().trim();

        const rankList = [];
        studentPresencesCount.forEach((count, sid) => {
            const member = membersMap.get(sid);
            const name = member ? `${member.firstName} ${member.lastName || ''}`.trim() : `Aluno #${sid}`;
            const photoUrl = member?.photoUrl || 'default-profile.svg';
            const unit = member?.branchName || member?.unitId || 'KIHAP';

            if (!searchQuery || name.toLowerCase().includes(searchQuery)) {
                rankList.push({ sid, name, count, photoUrl, unit });
            }
        });

        rankList.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

        reportsRankingTableBody.innerHTML = '';
        if (rankList.length === 0) {
            reportsRankingTableBody.innerHTML = `
                <tr>
                    <td colspan="3" class="text-center py-8 text-gray-400 dark:text-gray-500 font-medium">
                        <i class="fas fa-users-slash text-2xl mb-1.5 opacity-30"></i>
                        <p class="text-xs">Nenhum aluno com presenças encontrado.</p>
                    </td>
                </tr>`;
            return;
        }

        rankList.forEach((item, index) => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50/50 dark:hover:bg-[#222]/30 transition-colors border-b border-gray-150/40 dark:border-gray-800/30';

            let posBadge = '';
            if (index === 0) posBadge = '🥇';
            else if (index === 1) posBadge = '🥈';
            else if (index === 2) posBadge = '🥉';
            else posBadge = `#${index + 1}`;

            const displayUnit = item.unit.charAt(0).toUpperCase() + item.unit.slice(1).replace(/-/g, ' ');

            tr.innerHTML = `
                <td class="py-2.5 px-2 text-center font-extrabold ${index < 3 ? 'text-lg' : 'text-xs text-gray-400 dark:text-gray-500'}">${posBadge}</td>
                <td class="py-2.5 px-2">
                    <div class="flex items-center gap-2">
                        <img src="${item.photoUrl}" alt="Foto" class="w-7 h-7 rounded-full object-cover border border-gray-200 dark:border-gray-700">
                        <div>
                            <span class="font-bold text-gray-800 dark:text-gray-200 text-xs">${item.name}</span>
                            <span class="block text-[9px] font-bold text-gray-400 uppercase tracking-wider">${displayUnit}</span>
                        </div>
                    </div>
                </td>
                <td class="py-2.5 px-2 text-right font-black text-orange-500 pr-4 text-xs">
                    <i class="fas fa-fire-alt text-[10px] mr-0.5"></i> ${item.count}
                </td>
            `;
            reportsRankingTableBody.appendChild(tr);
        });
    }

    function renderDetailedClasses() {
        if (!cachedReportsData) return;

        const { detailedClasses } = cachedReportsData;

        const sortedClasses = [...detailedClasses].sort((a, b) => b.date.localeCompare(a.date));

        reportsClassesTableBody.innerHTML = '';
        if (sortedClasses.length === 0) {
            reportsClassesTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-8 text-gray-400 dark:text-gray-500 font-medium">
                        <i class="fas fa-calendar-times text-2xl mb-1.5 opacity-30"></i>
                        <p class="text-xs">Nenhuma aula realizada no período.</p>
                    </td>
                </tr>`;
            return;
        }

        sortedClasses.forEach(item => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50/50 dark:hover:bg-[#222]/30 transition-colors border-b border-gray-150/40 dark:border-gray-800/30 text-xs font-semibold';

            const [y, m, d] = item.date.split('-');
            const dateStr = `${d}/${m}/${y}`;

            const unitLabel = item.unitId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            const percent = item.capacity > 0 ? Math.round((item.presences / item.capacity) * 100) : 0;
            let barColor = 'bg-emerald-500';
            if (percent > 80) barColor = 'bg-rose-500';
            else if (percent > 50) barColor = 'bg-amber-500';

            tr.innerHTML = `
                <td class="py-3 px-3 text-gray-550 dark:text-gray-450">${dateStr}</td>
                <td class="py-3 px-3 font-bold text-gray-800 dark:text-white">${item.name}</td>
                <td class="py-3 px-3 text-gray-550 dark:text-gray-400">${getShortTeacherName(item.teacherName)}</td>
                <td class="py-3 px-3 text-gray-550 dark:text-gray-400">${unitLabel}</td>
                <td class="py-3 px-3 w-28">
                    <div class="flex items-center gap-2">
                        <span class="w-8 font-bold">${item.presences}/${item.capacity}</span>
                        <div class="flex-grow bg-gray-200 dark:bg-black/35 rounded-full h-1.5 overflow-hidden">
                            <div class="${barColor} h-1.5 rounded-full" style="width: ${Math.min(percent, 100)}%"></div>
                        </div>
                    </div>
                </td>
                <td class="py-3 px-3 text-center">
                    <button class="open-class-attendance-btn bg-primary hover:bg-primary-dark text-black font-bold px-2.5 py-1 rounded-lg text-[10px] transition-all duration-200 hover:scale-105 active:scale-95 flex items-center gap-1 mx-auto shadow-sm" data-idx="${item.id}">
                        <i class="fas fa-clipboard-list"></i> Presença
                    </button>
                </td>
            `;

            tr.querySelector('.open-class-attendance-btn').addEventListener('click', () => {
                if (item.classData) {
                    openAttendanceModal(item.classData);
                } else {
                    alert("Dados desta aula não disponíveis.");
                }
            });

            reportsClassesTableBody.appendChild(tr);
        });
    }

    // Tab switching event listeners
    tabGradeBtn.addEventListener('click', () => {
        tabGradeBtn.className = 'px-6 py-3 border-b-2 border-primary text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 transition-all';
        tabRankingBtn.className = 'px-6 py-3 border-b-2 border-transparent text-sm font-semibold text-gray-400 dark:text-gray-500 flex items-center gap-2 hover:text-gray-700 dark:hover:text-gray-300 transition-all';
        tabReportsBtn.className = 'px-6 py-3 border-b-2 border-transparent text-sm font-semibold text-gray-400 dark:text-gray-500 flex items-center gap-2 hover:text-gray-700 dark:hover:text-gray-300 transition-all';

        calendarControlsWrapper.classList.remove('hidden');
        scheduleGrid.classList.remove('hidden');
        rankingViewContainer.classList.add('hidden');
        reportsViewContainer.classList.add('hidden');
        activeTab = 'grade';
    });

    tabRankingBtn.addEventListener('click', () => {
        tabRankingBtn.className = 'px-6 py-3 border-b-2 border-primary text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 transition-all';
        tabGradeBtn.className = 'px-6 py-3 border-b-2 border-transparent text-sm font-semibold text-gray-400 dark:text-gray-500 flex items-center gap-2 hover:text-gray-700 dark:hover:text-gray-300 transition-all';
        tabReportsBtn.className = 'px-6 py-3 border-b-2 border-transparent text-sm font-semibold text-gray-400 dark:text-gray-500 flex items-center gap-2 hover:text-gray-700 dark:hover:text-gray-300 transition-all';

        calendarControlsWrapper.classList.add('hidden');
        scheduleGrid.classList.add('hidden');
        rankingViewContainer.classList.remove('hidden');
        reportsViewContainer.classList.add('hidden');
        activeTab = 'ranking';
        
        renderRanking();
    });

    tabReportsBtn.addEventListener('click', () => {
        tabReportsBtn.className = 'px-6 py-3 border-b-2 border-primary text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 transition-all';
        tabGradeBtn.className = 'px-6 py-3 border-b-2 border-transparent text-sm font-semibold text-gray-400 dark:text-gray-500 flex items-center gap-2 hover:text-gray-700 dark:hover:text-gray-300 transition-all';
        tabRankingBtn.className = 'px-6 py-3 border-b-2 border-transparent text-sm font-semibold text-gray-400 dark:text-gray-500 flex items-center gap-2 hover:text-gray-700 dark:hover:text-gray-300 transition-all';

        calendarControlsWrapper.classList.add('hidden');
        scheduleGrid.classList.add('hidden');
        rankingViewContainer.classList.add('hidden');
        reportsViewContainer.classList.remove('hidden');
        activeTab = 'reports';

        loadReports();
    });

    // Ranking filter event listeners
    rankFilterCurrent.addEventListener('click', () => {
        rankFilterCurrent.className = 'px-5 py-2 text-xs font-bold rounded-xl bg-primary text-black transition-all';
        rankFilterLongest.className = 'px-5 py-2 text-xs font-bold rounded-xl text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all ml-1';
        rankingFilter = 'current';
        renderRanking();
    });

    rankFilterLongest.addEventListener('click', () => {
        rankFilterLongest.className = 'px-5 py-2 text-xs font-bold rounded-xl bg-primary text-black transition-all ml-1';
        rankFilterCurrent.className = 'px-5 py-2 text-xs font-bold rounded-xl text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all';
        rankingFilter = 'longest';
        renderRanking();
    });

    searchRankingInput.addEventListener('input', (e) => {
        rankingSearchQuery = e.target.value;
        renderRanking();
    });

    unitFilter.addEventListener('change', (e) => {
        selectedUnitId = e.target.value;
        updateCopyLinkButtonVisibility();
        renderGrid();
        if (activeTab === 'ranking') {
            renderRanking();
        }
    });

    if (copyPublicLinkBtn) {
        copyPublicLinkBtn.addEventListener('click', () => {
            if (!selectedUnitId || selectedUnitId === 'staff') return;

            const publicUrl = `https://kihap.com.br/grade?unidade=${selectedUnitId}`;
            navigator.clipboard.writeText(publicUrl).then(() => {
                const icon = copyPublicLinkBtn.querySelector('i');
                icon.className = 'fas fa-check text-emerald-500';
                copyPublicLinkBtn.title = 'Link Copiado!';
                
                setTimeout(() => {
                    icon.className = 'fas fa-link text-sm';
                    copyPublicLinkBtn.title = 'Copiar Link da Grade Pública';
                }, 2000);
            }).catch(err => {
                console.error('Erro ao copiar link:', err);
                alert('Erro ao copiar o link. Por favor, copie manualmente: ' + publicUrl);
            });
        });
    }

    prevWeekBtn.addEventListener('click', () => {
        if (currentViewMode === 'week') {
            currentWeekStartDate.setDate(currentWeekStartDate.getDate() - 7);
        } else {
            currentSelectedDate.setDate(currentSelectedDate.getDate() - 1);
            currentWeekStartDate = getStartOfWeek(currentSelectedDate);
        }
        renderGrid();
    });
    nextWeekBtn.addEventListener('click', () => {
        if (currentViewMode === 'week') {
            currentWeekStartDate.setDate(currentWeekStartDate.getDate() + 7);
        } else {
            currentSelectedDate.setDate(currentSelectedDate.getDate() + 1);
            currentWeekStartDate = getStartOfWeek(currentSelectedDate);
        }
        renderGrid();
    });

    if (viewWeekBtn) {
        viewWeekBtn.addEventListener('click', () => {
            currentViewMode = 'week';
            updateViewButtons();
            renderGrid();
        });
    }

    if (viewDayBtn) {
        viewDayBtn.addEventListener('click', () => {
            currentViewMode = 'day';
            updateViewButtons();
            renderGrid();
        });
    }

    closeAttendanceModalBtn.addEventListener('click', closeAttendanceModal);
    studentList.addEventListener('click', handlePresenceToggle);

    // Listeners do Check-in Avulso
    const quickSearchInput = document.getElementById('quick-checkin-search');
    const quickResultsContainer = document.getElementById('quick-checkin-results');
    const quickClearBtn = document.getElementById('clear-quick-checkin-btn');

    if (quickSearchInput) {
        quickSearchInput.addEventListener('focus', ensureAllSchoolMembersLoaded);
        quickSearchInput.addEventListener('click', ensureAllSchoolMembersLoaded);
        quickSearchInput.addEventListener('input', handleQuickCheckinSearch);
    }

    if (quickClearBtn && quickSearchInput && quickResultsContainer) {
        quickClearBtn.addEventListener('click', () => {
            quickSearchInput.value = '';
            quickResultsContainer.classList.add('hidden');
            quickResultsContainer.innerHTML = '';
            quickClearBtn.classList.add('hidden');
        });
    }

    if (quickResultsContainer) {
        quickResultsContainer.addEventListener('click', (e) => {
            const item = e.target.closest('.quick-checkin-item');
            if (item) {
                const studentId = item.dataset.studentId;
                if (studentId) performQuickCheckin(studentId);
            }
        });
    }

    document.addEventListener('click', (e) => {
        if (quickResultsContainer && quickSearchInput) {
            if (!quickResultsContainer.contains(e.target) && e.target !== quickSearchInput) {
                quickResultsContainer.classList.add('hidden');
            }
        }
    });

    deleteClassBtn.addEventListener('click', handleDeleteClass);

    const editClassBtn = document.getElementById('edit-class-btn');
    if (editClassBtn) {
        editClassBtn.addEventListener('click', () => {
            if (currentClassData) openEditClassModal(currentClassData);
        });
    }

    addClassBtn.addEventListener('click', openClassModal);
    closeClassModalBtn.addEventListener('click', closeClassModal);
    cancelClassBtn.addEventListener('click', closeClassModal);
    classForm.addEventListener('submit', handleClassFormSubmit);

    if (searchStudentsInput) {
        searchStudentsInput.addEventListener('input', (e) => {
            renderStudentsList(e.target.value);
        });
    }

    classStudentsSelect.addEventListener('change', () => {
        const val = classStudentsSelect.value;
        if (val) {
            selectedStudentIds.add(val.toString());
            // Limpar busca para facilitar próxima adição
            if (searchStudentsInput) searchStudentsInput.value = '';
            // Atualizar lista e pills
            renderStudentsList();
        }
    });

    const selectedStudentsContainer = document.getElementById('selected-students-container');
    if (selectedStudentsContainer) {
        selectedStudentsContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.remove-student-btn');
            if (btn) {
                const studentId = btn.dataset.studentId;
                if (studentId) {
                    selectedStudentIds.delete(studentId.toString());
                    renderStudentsList(searchStudentsInput ? searchStudentsInput.value : '');
                }
            }
        });
    }

    document.getElementById('class-days-of-week').addEventListener('click', (e) => {
        const btn = e.target.closest('.day-toggle');
        if (!btn) return;
        
        const isActive = btn.classList.contains('bg-primary');
        if (isActive) {
            btn.className = 'day-toggle flex-1 min-w-[3rem] py-2 rounded-xl text-sm font-semibold border bg-gray-50 dark:bg-[#222]/40 border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#333]/40 hover:text-gray-800 dark:hover:text-white';
        } else {
            btn.className = 'day-toggle flex-1 min-w-[3rem] py-2 rounded-xl text-sm font-bold border bg-primary border-primary text-black';
        }
    });

    // Event listeners para relatórios
    if (reportPeriodFilter) {
        reportPeriodFilter.addEventListener('change', (e) => {
            if (e.target.value === 'custom') {
                reportCustomDates.classList.remove('hidden');
            } else {
                reportCustomDates.classList.add('hidden');
                loadReports();
            }
        });
    }

    if (reportUnitFilter) {
        reportUnitFilter.addEventListener('change', () => {
            loadReports();
        });
    }

    if (generateReportBtn) {
        generateReportBtn.addEventListener('click', () => {
            loadReports();
        });
    }

    if (searchReportsRankingInput) {
        searchReportsRankingInput.addEventListener('input', () => {
            renderReportsRanking();
        });
    }

    onAuthReady(user => {
        if (user) {
            currentUser = user;
            initialize();
        } else {
            console.log("Usuário não autenticado.");
        }
    });
});
