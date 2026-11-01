document.addEventListener('DOMContentLoaded', async () => {
    const input = document.getElementById('crmUrlInput');
    const saveBtn = document.getElementById('saveUrlBtn');
    const linkKanban = document.getElementById('linkCrmKanban');
    const linkWhats = document.getElementById('linkCrmWhats');

    if (chrome?.storage?.local) {
        const data = await chrome.storage.local.get(['crmBaseUrl']);
        if (data.crmBaseUrl) {
            input.value = data.crmBaseUrl;
            updateLinks(data.crmBaseUrl);
        }
    }

    saveBtn.addEventListener('click', async () => {
        const url = input.value.trim().replace(/\/$/, '');
        if (chrome?.storage?.local) {
            await chrome.storage.local.set({ crmBaseUrl: url });
        }
        updateLinks(url);
        saveBtn.textContent = 'Salvo com sucesso!';
        setTimeout(() => {
            saveBtn.textContent = 'Salvar Configuração';
        }, 1500);
    });

    function updateLinks(base) {
        if (linkKanban) linkKanban.href = `${base}/prospeccao.html`;
        if (linkWhats) linkWhats.href = `${base}/whatsapp.html`;
    }
});
