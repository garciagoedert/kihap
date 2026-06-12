import { db, functions } from './firebase-config.js';
import { onAuthReady } from './auth.js';
import { httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { collection, getDocs, query, where, doc, getDoc, updateDoc, arrayUnion, arrayRemove, addDoc, Timestamp, setDoc, deleteDoc, orderBy, limit, documentId } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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

    let currentClassId = null; // Armazena o ID da instância da aula (templateId_data)
    let currentClassData = null; // Armazena a referência para os dados completos da aula aberta
    let currentWeekStartDate = getStartOfWeek(new Date());
    let selectedUnitId = null;
    let currentStudents = [];
    let selectedStudentIds = new Set();

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
        if (searchStudentsInput) searchStudentsInput.value = '';
        selectedStudentIds.clear();
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

            currentStudents = members.filter(m => !m.isInstructor);
            selectedStudentIds.clear();
            renderStudentsList();

        } catch (error) {
            console.error("Erro ao carregar dados para o modal:", error);
            classTeacherSelect.innerHTML = '<option value="">Erro ao carregar</option>';
            classStudentsSelect.innerHTML = '<option value="">Erro ao carregar</option>';
        }
    }

    function renderStudentsList(filterText = '') {
        classStudentsSelect.innerHTML = '';
        const filtered = currentStudents.filter(student => {
            const fullName = `${student.firstName} ${student.lastName || ''}`.toLowerCase();
            return fullName.includes(filterText.toLowerCase());
        });

        if (filtered.length > 0) {
            filtered.forEach(student => {
                const isSelected = selectedStudentIds.has(student.idMember.toString());
                const option = new Option(`${student.firstName} ${student.lastName || ''}`, student.idMember);
                option.selected = isSelected;
                classStudentsSelect.add(option);
            });
        } else {
            classStudentsSelect.innerHTML = '<option value="" disabled>Nenhum aluno encontrado</option>';
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
        const selectedStudents = Array.from(selectedStudentIds);

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

            // Sync streak to user document if marking as present
            if (!isPresent) {
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
                        const todayStr = new Date().toISOString().split('T')[0];
                        const lastDateStr = userData.lastAttendanceDate;
                        let currentStreak = userData.currentStreak || 0;
                        let longestStreak = userData.longestStreak || 0;

                        if (lastDateStr !== todayStr) {
                            if (!lastDateStr) {
                                currentStreak = 1;
                            } else {
                                const lastDate = new Date(lastDateStr + 'T12:00:00');
                                const todayDate = new Date(todayStr + 'T12:00:00');
                                const diffTime = Math.abs(todayDate.getTime() - lastDate.getTime());
                                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                                if (diffDays <= 5) {
                                    currentStreak += 1;
                                } else {
                                    currentStreak = 1;
                                }
                            }

                            if (currentStreak > longestStreak) {
                                longestStreak = currentStreak;
                            }

                            await updateDoc(userDocRef, {
                                currentStreak,
                                longestStreak,
                                lastAttendanceDate: todayStr
                            });
                            console.log(`Streak updated on intranet for user: ${userDocRef.id}`);
                        }
                    }
                } catch (err) {
                    console.error("Erro ao sincronizar streak do aluno na intranet:", err);
                }
            }

            if (currentClassData) {
                await openAttendanceModal(currentClassData);
            }
            renderGrid();
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
                        presentStudents: inst.presentStudents || []
                    } : null
                });
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
                selectedUnit
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
            selectedUnit
        } = cachedReportsData;

        document.getElementById('kpi-total-classes').textContent = totalClasses;
        document.getElementById('kpi-total-presences').textContent = totalPresences;
        document.getElementById('kpi-avg-occupation').textContent = `${avgOccupation}%`;
        document.getElementById('kpi-avg-students').textContent = avgStudents;

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
                <td class="py-3 px-3 text-gray-550 dark:text-gray-400">${item.teacherName.split(' ')[0]}</td>
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
        renderGrid();
        if (activeTab === 'ranking') {
            renderRanking();
        }
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
    deleteClassBtn.addEventListener('click', handleDeleteClass);

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
        Array.from(classStudentsSelect.options).forEach(opt => {
            if (opt.value) {
                if (opt.selected) {
                    selectedStudentIds.add(opt.value.toString());
                } else {
                    selectedStudentIds.delete(opt.value.toString());
                }
            }
        });
    });

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
            initialize();
        } else {
            console.log("Usuário não autenticado.");
        }
    });
});
