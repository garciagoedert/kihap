import { db, functions } from './firebase-config.js';
import { onAuthReady } from './auth.js';
import { httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { collection, getDocs, query, where, doc, getDoc, updateDoc, arrayUnion, arrayRemove, addDoc, Timestamp, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    // Elementos da Grade
    const unitFilter = document.getElementById('unit-filter');
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
    const studentList = document.getElementById('student-list');

    // Elementos do Modal de Aula
    const classModal = document.getElementById('class-modal');
    const closeClassModalBtn = document.getElementById('close-class-modal-btn');
    const cancelClassBtn = document.getElementById('cancel-class-btn');
    const classForm = document.getElementById('class-form');
    const classModalTitle = document.getElementById('class-modal-title');
    const classTeacherSelect = document.getElementById('class-teacher');
    const classStudentsSelect = document.getElementById('class-students');

    let currentClassId = null; // Armazena o ID da instância da aula (templateId_data)
    let currentClassData = null; // Armazena a referência para os dados completos da aula aberta
    let currentWeekStartDate = getStartOfWeek(new Date());
    let selectedUnitId = null;

    // --- Funções de Data ---
    function getStartOfWeek(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff));
    }

    function formatDate(date) {
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    }

    // --- Funções de Renderização ---
    async function renderGrid() {
        if (!selectedUnitId) {
            scheduleGrid.innerHTML = `
                <div class="flex items-center justify-center h-full text-gray-400 dark:text-gray-500 flex-col gap-3">
                    <i class="fas fa-calendar-day text-4xl opacity-50"></i>
                    <p class="font-medium text-sm">Selecione uma unidade para visualizar a grade.</p>
                </div>`;
            return;
        }

        updateDateRangeDisplay();
        scheduleGrid.innerHTML = '';

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
            <div class="text-center p-3 bg-white dark:bg-[#1a1a1a] transition-colors ${isToday ? 'bg-primary/10 dark:bg-primary/5' : ''}">
                <div class="font-bold text-[10px] tracking-wider text-gray-400 dark:text-gray-500 mb-1 uppercase">${d.toLocaleDateString('pt-BR', { weekday: 'short' })}</div>
                <div class="text-base font-extrabold ${isToday ? 'text-primary' : 'text-gray-800 dark:text-gray-200'}">${d.getDate()}</div>
            </div>
        `}).join('');
        scheduleGrid.appendChild(header);

        const body = document.createElement('div');
        body.className = 'grid grid-cols-8 gap-px bg-gray-200 dark:bg-gray-800/60 relative'; // Gap creates the grid lines

        const timeColumn = document.createElement('div');
        timeColumn.className = 'bg-gray-50 dark:bg-[#161616]';
        for (let hour = 7; hour < 22; hour++) {
            timeColumn.innerHTML += `
                <div class="hour-label flex items-start justify-center pt-2 text-xs font-semibold text-gray-400 dark:text-gray-500 border-b border-gray-150 dark:border-gray-800/30 relative">
                    <span class="-mt-2.5 bg-gray-50 dark:bg-[#161616] px-1.5">${String(hour).padStart(2, '0')}:00</span>
                </div>`;
        }
        body.appendChild(timeColumn);

        for (let i = 0; i < 7; i++) {
            const dayColumn = document.createElement('div');
            dayColumn.className = 'relative bg-white dark:bg-[#1a1a1a] hover:bg-gray-50/50 dark:hover:bg-[#222]/30 transition-colors';
            dayColumn.dataset.date = days[i].toISOString().split('T')[0];
            for (let hour = 7; hour < 22; hour++) {
                dayColumn.innerHTML += `
                    <div class="time-slot border-b border-gray-100 dark:border-gray-850/20"></div>
                    <div class="time-slot border-b border-gray-200 dark:border-gray-800/60"></div>
                `;
            }
            body.appendChild(dayColumn);
        }
        scheduleGrid.appendChild(body);

        await fetchAndRenderClasses(days);
    }

    function updateDateRangeDisplay() {
        const endDate = new Date(currentWeekStartDate);
        endDate.setDate(endDate.getDate() + 6);
        const options = { day: 'numeric', month: 'short' };
        dateRangeDisplay.textContent = `${currentWeekStartDate.toLocaleDateString('pt-BR', options)} - ${endDate.toLocaleDateString('pt-BR', options)}`;
    }

    async function fetchAndRenderClasses(days) {
        try {
            console.log(`Buscando templates para unidade: ${selectedUnitId}`);
            const templatesQuery = query(collection(db, 'classTemplates'), where('unitId', '==', selectedUnitId));
            const templatesSnapshot = await getDocs(templatesQuery);
            const templates = [];
            templatesSnapshot.forEach(doc => {
                templates.push({ id: doc.id, ...doc.data() });
            });
            console.log(`Encontrados ${templates.length} templates de aula.`);

            for (const day of days) {
                const dayOfWeek = day.getDay();
                for (const template of templates) {
                    if (template.daysOfWeek && template.daysOfWeek.includes(dayOfWeek) && template.time) {
                        const [hour, minute] = template.time.split(':').map(Number);
                        const startTime = new Date(day);
                        startTime.setHours(hour, minute, 0, 0);

                        const endTime = new Date(startTime.getTime() + template.duration * 60000);
                        const instanceId = `${template.id}_${day.toISOString().split('T')[0]}`;

                        const instanceRef = doc(db, 'classInstances', instanceId);
                        const instanceSnap = await getDoc(instanceRef);
                        const presentStudents = instanceSnap.exists() ? instanceSnap.data().presentStudents : [];

                        const classInstanceData = {
                            ...template,
                            templateId: template.id,
                            id: instanceId,
                            startTime: startTime,
                            endTime: endTime,
                            presentStudents: presentStudents
                        };
                        renderClassCard(classInstanceData);
                    }
                }
            }

        } catch (error) {
            console.error("Erro ao buscar modelos de aula:", error);
        }
    }

    function renderClassCard(classData) {
        const startTime = classData.startTime;
        const endTime = classData.endTime;
        const dayDateStr = startTime.toISOString().split('T')[0];

        const dayColumn = scheduleGrid.querySelector(`[data-date="${dayDateStr}"]`);
        if (!dayColumn) return;

        const startHour = 7;
        const pixelsPerHour = 120;
        const pixelsPerMinute = pixelsPerHour / 60;

        const startMinutes = (startTime.getHours() - startHour) * 60 + startTime.getMinutes();
        const durationMinutes = (endTime - startTime) / 60000;

        const top = startMinutes * pixelsPerMinute;
        const height = durationMinutes * pixelsPerMinute;

        const card = document.createElement('div');
        // Premium Card Styling
        card.className = 'class-card absolute w-[94%] left-[3%] bg-yellow-500/10 dark:bg-yellow-500/15 border-l-4 border-primary p-2.5 rounded-r-xl cursor-pointer overflow-hidden shadow-sm hover:shadow-md hover:scale-[1.01] transition-all duration-300 group z-10 backdrop-blur-md hover:bg-yellow-500/20 dark:hover:bg-yellow-500/25';
        card.style.top = `${top}px`;
        card.style.height = `${height - 2}px`;
        card.dataset.classId = classData.id;
        card.dataset.templateId = classData.templateId;

        const occupation = classData.presentStudents.length;
        const capacity = classData.students.length; // Or capacity if available
        const occupationPercentage = Math.min((occupation / capacity) * 100, 100);
        let occupationColor = 'bg-emerald-500';
        if (occupationPercentage > 80) occupationColor = 'bg-rose-500';
        else if (occupationPercentage > 50) occupationColor = 'bg-amber-500';

        card.innerHTML = `
            <div class="flex flex-col h-full justify-between">
                <div>
                    <div class="font-bold text-[11px] text-gray-800 dark:text-white leading-tight group-hover:text-primary transition-colors line-clamp-2">${classData.name}</div>
                    <div class="text-[9px] text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1.5">
                        <i class="fas fa-user-tie text-[8px] opacity-75"></i> <span class="font-medium">${classData.teacherName.split(' ')[0]}</span>
                    </div>
                </div>
                <div class="mt-1">
                    <div class="flex justify-between items-center text-[9px] text-gray-550 dark:text-gray-400 mb-0.5 font-bold">
                        <span>${occupation}/${capacity}</span>
                        <span>${Math.round(occupationPercentage)}%</span>
                    </div>
                    <div class="w-full bg-gray-200 dark:bg-black/30 rounded-full h-1 overflow-hidden">
                        <div class="${occupationColor} h-1 rounded-full transition-all duration-500" style="width: ${occupationPercentage}%"></div>
                    </div>
                </div>
            </div>
        `;

        card.addEventListener('click', () => openAttendanceModal(classData));
        dayColumn.appendChild(card);
    }

    async function openClassModal() {
        classForm.reset();
        classModalTitle.innerHTML = '<i class="fas fa-calendar-plus text-primary mr-2"></i> Agendar Nova Aula';

        // Reset day buttons to inactive state
        document.querySelectorAll('#class-days-of-week .day-toggle').forEach(btn => {
            btn.className = 'day-toggle flex-1 min-w-[3rem] py-2 rounded-xl text-sm font-semibold transition-all border bg-gray-50 dark:bg-[#222]/40 border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#333]/40 hover:text-gray-800 dark:hover:text-white';
        });

        if (selectedUnitId) {
            await populateTeacherAndStudentSelectors(selectedUnitId);
            classModal.classList.remove('hidden');
        } else {
            alert("Por favor, selecione uma unidade primeiro.");
        }
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

            classStudentsSelect.innerHTML = '';
            const studentsOfUnit = members.filter(m => !m.isInstructor);
            if (studentsOfUnit.length > 0) {
                studentsOfUnit.forEach(student => {
                    const option = new Option(`${student.firstName} ${student.lastName || ''}`, student.idMember);
                    classStudentsSelect.add(option);
                });
            } else {
                classStudentsSelect.innerHTML = '<option value="">Nenhum aluno encontrado</option>';
            }

        } catch (error) {
            console.error("Erro ao carregar dados para o modal:", error);
            classTeacherSelect.innerHTML = '<option value="">Erro ao carregar</option>';
            classStudentsSelect.innerHTML = '<option value="">Erro ao carregar</option>';
        }
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
        const selectedStudents = Array.from(classStudentsSelect.selectedOptions).map(opt => opt.value);

        const classTemplate = {
            name: formData.get('class-name'),
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
            await addDoc(collection(db, 'classTemplates'), classTemplate);
            closeClassModal();
            renderGrid();
        } catch (error) {
            console.error("Erro ao salvar modelo de aula:", error);
            alert("Falha ao salvar a aula.");
        }
    }

    async function openAttendanceModal(classData) {
        currentClassId = classData.id;
        currentClassData = classData;
        studentList.innerHTML = '<div class="flex justify-center p-8"><i class="fas fa-spinner fa-spin text-primary text-3xl"></i></div>';
        attendanceModal.classList.remove('hidden');

        try {
            const startTime = classData.startTime;
            const endTime = classData.endTime;
            modalClassTitle.textContent = classData.name;
            modalClassTime.textContent = `${startTime.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })} • ${startTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} - ${endTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
            modalClassTeacher.textContent = classData.teacherName;

            const instanceRef = doc(db, 'classInstances', classData.id);
            const instanceSnap = await getDoc(instanceRef);
            const presentStudents = instanceSnap.exists() ? instanceSnap.data().presentStudents || [] : [];

            modalClassOccupation.textContent = `${presentStudents.length}/${classData.students.length}`;

            studentList.innerHTML = '';
            if (!classData.students || classData.students.length === 0) {
                studentList.innerHTML = '<p class="text-gray-500 dark:text-gray-400 text-center py-6 text-sm font-medium">Nenhum aluno inscrito nesta turma.</p>';
                return;
            }

            const listAllMembers = httpsCallable(functions, 'listAllMembers');
            const result = await listAllMembers({ unitId: classData.unitId });
            const allUnitMembers = result.data;
            const membersMap = new Map(allUnitMembers.map(m => [m.idMember.toString(), m]));

            for (const studentId of classData.students) {
                const studentData = membersMap.get(studentId.toString());
                if (studentData) {
                    const isPresent = presentStudents.includes(studentId.toString()) || presentStudents.includes(Number(studentId));
                    const studentElement = document.createElement('div');
                    studentElement.className = `flex items-center justify-between p-3.5 rounded-2xl border transition-all duration-300 ${isPresent ? 'bg-emerald-50/80 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40' : 'bg-gray-50/80 dark:bg-[#1a1a1a]/50 border-gray-150 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'}`;
                    studentElement.innerHTML = `
                        <div class="flex items-center gap-3">
                            <div class="relative">
                                <img src="${studentData.photoUrl || 'default-profile.svg'}" alt="Foto" class="w-10 h-10 rounded-full object-cover border border-gray-200 dark:border-gray-700">
                                ${isPresent ? '<div class="absolute -bottom-1 -right-1 bg-emerald-500 text-white text-[9px] w-4 h-4 flex items-center justify-center rounded-full shadow-md"><i class="fas fa-check"></i></div>' : ''}
                            </div>
                            <div>
                                <div class="font-bold text-gray-850 dark:text-white text-sm">${studentData.firstName} ${studentData.lastName || ''}</div>
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
        } catch (error) {
            console.error("Erro ao abrir modal de presença:", error);
            studentList.innerHTML = '<p class="text-red-500 dark:text-red-400 text-center py-4 font-semibold text-sm">Erro ao carregar dados.</p>';
        }
    }

    function closeAttendanceModal() {
        attendanceModal.classList.add('hidden');
        currentClassId = null;
    }

    async function handlePresenceToggle(e) {
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
            } else if (!isPresent) {
                const [templateId, date] = currentClassId.split('_');
                await setDoc(instanceRef, {
                    templateId: templateId,
                    date: date,
                    unitId: selectedUnitId,
                    presentStudents: [studentIdToSave]
                });
            }

            if (currentClassData) {
                await openAttendanceModal(currentClassData);
            }
            renderGrid();
        } catch (error) {
            console.error("Erro ao atualizar presença:", error);
        }
    }

    async function initialize() {
        try {
            const getPublicEvoUnits = httpsCallable(functions, 'getPublicEvoUnits');
            const result = await getPublicEvoUnits();
            const units = result.data;

            unitFilter.innerHTML = '<option value="">Selecione a Unidade</option>';
            units.forEach(unitId => {
                const option = document.createElement('option');
                option.value = unitId;
                option.textContent = unitId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                unitFilter.appendChild(option);
            });
        } catch (error) {
            console.error("Erro ao carregar unidades do EVO:", error);
            unitFilter.innerHTML = '<option value="">Erro ao carregar</option>';
        }
        renderGrid();
    }

    unitFilter.addEventListener('change', (e) => {
        selectedUnitId = e.target.value;
        renderGrid();
    });
    prevWeekBtn.addEventListener('click', () => {
        currentWeekStartDate.setDate(currentWeekStartDate.getDate() - 7);
        renderGrid();
    });
    nextWeekBtn.addEventListener('click', () => {
        currentWeekStartDate.setDate(currentWeekStartDate.getDate() + 7);
        renderGrid();
    });

    closeAttendanceModalBtn.addEventListener('click', closeAttendanceModal);
    studentList.addEventListener('click', handlePresenceToggle);

    addClassBtn.addEventListener('click', openClassModal);
    closeClassModalBtn.addEventListener('click', closeClassModal);
    cancelClassBtn.addEventListener('click', closeClassModal);
    classForm.addEventListener('submit', handleClassFormSubmit);

    document.getElementById('class-days-of-week').addEventListener('click', (e) => {
        const btn = e.target.closest('.day-toggle');
        if (!btn) return;
        
        const isActive = btn.classList.contains('bg-primary');
        if (isActive) {
            btn.className = 'day-toggle flex-1 min-w-[3rem] py-2 rounded-xl text-sm font-semibold transition-all border bg-gray-50 dark:bg-[#222]/40 border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#333]/40 hover:text-gray-800 dark:hover:text-white';
        } else {
            btn.className = 'day-toggle flex-1 min-w-[3rem] py-2 rounded-xl text-sm font-bold transition-all border bg-primary border-primary text-black shadow-md shadow-yellow-500/10 scale-[1.03]';
        }
    });

    onAuthReady(user => {
        if (user) {
            initialize();
        } else {
            console.log("Usuário não autenticado.");
        }
    });
});
