import { httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { app, functions } from "./firebase-config.js";

// functions is already configured with emulator in firebase-config.js
const sendMassMessage = httpsCallable(functions, 'sendMassMessage');
const getEvoUnits = httpsCallable(functions, 'getEvoUnits');

const unitSelect = document.getElementById('unitSelect');
const audienceSelect = document.getElementById('audienceSelect');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const testModeToggle = document.getElementById('testModeToggle');
const statusConsole = document.getElementById('statusConsole');
const consoleOutput = document.getElementById('consoleOutput');
const confirmModal = document.getElementById('confirmModal');
const confirmAudience = document.getElementById('confirmAudience');
const testWarning = document.getElementById('testWarning');
const realWarning = document.getElementById('realWarning');
const cancelConfirm = document.getElementById('cancelConfirm');
const confirmSend = document.getElementById('confirmSend');
const charCount = document.getElementById('charCount');

// Logger helper
function log(msg, type = 'info') {
    const p = document.createElement('p');
    p.classList.add('font-mono', 'text-xs');
    const time = new Date().toLocaleTimeString();

    if (type === 'error') p.classList.add('text-red-400');
    else if (type === 'success') p.classList.add('text-green-400');
    else p.classList.add('text-gray-400');

    p.innerHTML = `<span class="opacity-50">[${time}]</span> ${msg}`;
    consoleOutput.appendChild(p);
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

// Load Units
async function loadUnits() {
    try {
        const units = [
            // Hardcoded list as fallback or expected list
            { id: "centro", name: "Centro (Matriz)" },
            { id: "coqueiros", name: "Coqueiros" },
            { id: "asa-sul", name: "Asa Sul" },
            { id: "sudoeste", name: "Sudoeste" },
            { id: "lago-sul", name: "Lago Sul" },
            { id: "pontos-de-ensino", name: "Pontos de Ensino" },
            { id: "jardim-botanico", name: "Jardim Botânico" },
            { id: "dourados", name: "Dourados" },
            { id: "santa-monica", name: "Santa Mônica" },
            { id: "noroeste", name: "Noroeste" }
        ];

        // Try fetching dynamic list if possible (optional)
        // const result = await getEvoUnits();
        // const dynamicUnits = result.data; 

        units.forEach(u => {
            const opt = document.createElement('option');
            opt.value = u.id;
            opt.textContent = u.name;
            unitSelect.appendChild(opt);
        });
    } catch (e) {
        console.error("Error loading units", e);
        log("Erro ao carregar unidades.", 'error');
    }
}

// Event Listeners
messageInput.addEventListener('input', () => {
    charCount.textContent = `${messageInput.value.length} caracteres`;
});

testModeToggle.addEventListener('change', () => {
    if (testModeToggle.checked) {
        sendBtn.innerHTML = '<i class="fas fa-flask mr-2"></i> Simular Envio';
        sendBtn.classList.remove('from-red-600', 'to-red-500', 'hover:from-red-500', 'hover:to-red-400');
        sendBtn.classList.add('from-yellow-600', 'to-yellow-500', 'hover:from-yellow-500', 'hover:to-yellow-400');
    } else {
        sendBtn.innerHTML = '<i class="fas fa-paper-plane mr-2"></i> Enviar REAL';
        sendBtn.classList.remove('from-yellow-600', 'to-yellow-500', 'hover:from-yellow-500', 'hover:to-yellow-400');
        sendBtn.classList.add('from-red-600', 'to-red-500', 'hover:from-red-500', 'hover:to-red-400');
    }
});

sendBtn.addEventListener('click', () => {
    const audience = audienceSelect.value;
    const unit = unitSelect.options[unitSelect.selectedIndex].text;
    const isTest = testModeToggle.checked;

    if (!audience) {
        alert("Selecione um público-alvo.");
        return;
    }
    if (!messageInput.value.trim()) {
        alert("Digite uma mensagem.");
        return;
    }

    let audienceLabel = '';
    if (audience === 'students') audienceLabel = 'Alunos';
    else if (audience === 'evo_prospects') audienceLabel = 'Oportunidades (EVO)';
    else if (audience === 'crm_prospects') audienceLabel = 'Oportunidades (CRM Local)';

    confirmAudience.textContent = `${audienceLabel} - ${unit}`;

    if (isTest) {
        testWarning.classList.remove('hidden');
        realWarning.classList.add('hidden');
    } else {
        testWarning.classList.add('hidden');
        realWarning.classList.remove('hidden');
    }

    confirmModal.classList.remove('hidden');
});

cancelConfirm.addEventListener('click', () => confirmModal.classList.add('hidden'));

confirmSend.addEventListener('click', async () => {
    confirmModal.classList.add('hidden');
    statusConsole.classList.remove('hidden');
    consoleOutput.innerHTML = ''; // Clear logs
    log("Iniciando processo...");

    const audience = audienceSelect.value;
    const unitId = unitSelect.value;
    const message = messageInput.value;
    const testMode = testModeToggle.checked;

    log(`Config: Audience=${audience}, Unit=${unitId}, TestMode=${testMode}`);

    sendBtn.disabled = true;

    try {
        log("Enviando requisição ao servidor (pode demorar)...");

        const result = await sendMassMessage({
            audience,
            unitId,
            message,
            testMode
        });

        const data = result.data;
        if (data.success) {
            log(data.message, 'success');
            if (data.details) {
                log(`Sucessos: ${data.details.successCount}`);
                log(`Erros: ${data.details.errorCount}`);
                if (data.details.errors.length > 0) {
                    data.details.errors.forEach(e => log(`Falha (${e.recipient}): ${e.error}`, 'error'));
                }
            }
        } else {
            log("O servidor retornou erro.", 'error');
        }

    } catch (error) {
        console.error(error);
        log(`Erro fatal: ${error.message}`, 'error');
    } finally {
        sendBtn.disabled = false;
        log("Processo finalizado.");
    }
});

// Init
document.addEventListener('DOMContentLoaded', () => {
    loadUnits();
    // Default to test mode
    testModeToggle.checked = true;
});
