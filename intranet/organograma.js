import { loadComponents } from './common-ui.js';
import { db } from './firebase-config.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAllUsers, getCurrentUser } from './auth.js';

document.addEventListener('DOMContentLoaded', () => {
    loadComponents(async () => {
        await initOrganogram();
    });
});

async function initOrganogram() {
    // Load users and current user session in parallel; assignments may fail due to permissions
    let allUsers = [], currentUser = null, assignments = {};

    try {
        const [users, user, assignmentsSnap] = await Promise.all([
            getAllUsers(),
            getCurrentUser(),
            getDoc(doc(db, 'organograma_config', 'main'))
        ]);
        allUsers = users;
        currentUser = user;
        assignments = assignmentsSnap.exists() ? (assignmentsSnap.data().nodes || {}) : {};
    } catch (err) {
        console.warn('[Organograma] Erro ao carregar dados iniciais (continuando sem vínculos):', err.message);
        // Try to load at least users and current user
        try {
            [allUsers, currentUser] = await Promise.all([getAllUsers(), getCurrentUser()]);
        } catch (e2) {
            console.error('[Organograma] Erro crítico ao carregar usuários:', e2);
        }
    }

    const isAdmin = currentUser?.isAdmin === true;
    // Staff users only (filter out students who have an evoMemberId)
    const staffUsers = allUsers.filter(u => !u.evoMemberId);

    // ─── Organogram data ────────────────────────────────────────────────────────
    const data = {
        "name": "KIHAP",
        "type": "root",
        "children": [
            {
                "name": "DIRETOR EVENTOS",
                "type": "director",
                "children": [
                    {
                        "name": "COORDENADOR DE EVENTOS",
                        "type": "coordinator",
                        "children": [
                            { "name": "Fornecedores" },
                            { "name": "Parceiros" },
                            { "name": "Pré-alunos e Parceiros" },
                            { "name": "Data/Local Cronograma" },
                            { "name": "Calendário" }
                        ]
                    }
                ]
            },
            {
                "name": "DIRETOR ADM",
                "type": "director",
                "children": [
                    {
                        "name": "SUPERVISOR DE RH",
                        "type": "supervisor",
                        "children": [
                            {
                                "name": "COORDENADOR DE RH",
                                "type": "coordinator",
                                "children": [
                                    { "name": "Recrutamento e Seleção" },
                                    { "name": "Ouvidoria e Alunos" },
                                    { "name": "Pesquisa e Desenvolvimento" },
                                    { "name": "Desligamento" },
                                    { "name": "Avaliação de Desempenho" },
                                    { "name": "Documentação" }
                                ]
                            },
                            {
                                "name": "COORDENADOR DP",
                                "type": "coordinator",
                                "children": [
                                    { "name": "Ponto" },
                                    { "name": "Folha de Pagamento" },
                                    { "name": "Treinamento de Pessoal" },
                                    { "name": "Documentação" },
                                    { "name": "Férias" },
                                    { "name": "Rescisão" },
                                    { "name": "VT/VR" },
                                    { "name": "Benefícios" }
                                ]
                            }
                        ]
                    },
                    {
                        "name": "COORDENADOR CONFECÇÃO",
                        "type": "coordinator",
                        "children": [
                            { "name": "Produção" },
                            { "name": "Estoque" },
                            { "name": "Logística" },
                            { "name": "Produtos Terceirizados" },
                            { "name": "Compra de Insumos" },
                            { "name": "Desenvolvimento de Produto" }
                        ]
                    },
                    { "name": "COORDENADOR CONTÁBIL", "type": "coordinator" },
                    {
                        "name": "COORDENADOR JURÍDICO",
                        "type": "coordinator",
                        "children": [
                            { "name": "Contratos" },
                            { "name": "Soluções Jurídicas" },
                            { "name": "Fiscal" },
                            { "name": "Certificado Digital" }
                        ]
                    }
                ]
            },
            {
                "name": "DIRETOR FINANCEIRO",
                "type": "director",
                "children": [
                    {
                        "name": "COORDENADOR VENDAS",
                        "type": "coordinator",
                        "children": [
                            { "name": "Leads" },
                            { "name": "Pesquisa de Mercado" },
                            { "name": "NPS" },
                            { "name": "Captação de Leads" },
                            { "name": "Qualificação de Leads" },
                            { "name": "Parceiros" }
                        ]
                    },
                    {
                        "name": "COORDENADOR FINANCEIRO",
                        "type": "coordinator",
                        "children": [
                            { "name": "Contas (Fluxo)" },
                            { "name": "Notas Fiscais" },
                            { "name": "Cobranças Recorrentes" },
                            { "name": "DRE" }
                        ]
                    }
                ]
            },
            {
                "name": "DIRETOR MARKETING",
                "type": "director",
                "children": [
                    {
                        "name": "COORDENADOR MARKETING",
                        "type": "coordinator",
                        "children": [
                            { "name": "Designer" },
                            { "name": "Social Media" },
                            { "name": "E-commerce" },
                            { "name": "Assessoria de Imprensa" },
                            { "name": "Copy" },
                            { "name": "Vídeo" },
                            { "name": "Site" },
                            { "name": "Tráfego" }
                        ]
                    }
                ]
            },
            {
                "name": "DIRETOR OPERAÇÃO",
                "type": "director",
                "children": [
                    {
                        "name": "SUPERVISOR DIAMANTE",
                        "type": "supervisor",
                        "children": [
                            {
                                "name": "SUPERVISOR OURO",
                                "type": "supervisor",
                                "children": [
                                    {
                                        "name": "SUPERVISOR PRATA",
                                        "type": "supervisor",
                                        "children": [
                                            {
                                                "name": "SUPERVISOR BRONZE",
                                                "type": "supervisor",
                                                "children": [
                                                    {
                                                        "name": "SUPERVISOR JUNIOR",
                                                        "type": "supervisor",
                                                        "children": [
                                                            {
                                                                "name": "INSTRUTOR",
                                                                "type": "coordinator",
                                                                "children": [
                                                                    { "name": "Lista de Exames" },
                                                                    { "name": "Presença Aulas" },
                                                                    { "name": "Aulas (Coletiva e Individual)" },
                                                                    { "name": "Contato Alunos" },
                                                                    {
                                                                        "name": "ADM",
                                                                        "type": "coordinator",
                                                                        "children": [
                                                                            { "name": "Contas (Pagar/Receber)" },
                                                                            { "name": "Materiais (Almoxarifado)" },
                                                                            { "name": "EVO (Cadastro, Contas e Adensamento)" },
                                                                            {
                                                                                "name": "Atendimento",
                                                                                "children": [
                                                                                    { "name": "Novos" },
                                                                                    { "name": "Manutenção" }
                                                                                ]
                                                                            },
                                                                            {
                                                                                "name": "Comercial",
                                                                                "children": [
                                                                                    { "name": "Cobranças Recorrentes" },
                                                                                    { "name": "WhatsApp/Email" },
                                                                                    { "name": "Agenda (Agendar, Confirmar e Reagendar)" }
                                                                                ]
                                                                            }
                                                                        ]
                                                                    }
                                                                ]
                                                            }
                                                        ]
                                                    }
                                                ]
                                            }
                                        ]
                                    }
                                ]
                            }
                        ]
                    },
                    { "name": "COORDENADOR DOURADOS", "type": "coordinator" },
                    { "name": "COORDENADOR ASA SUL", "type": "coordinator" },
                    { "name": "COORDENADOR SUDOESTE", "type": "coordinator" },
                    { "name": "COORDENADOR LAGO SUL", "type": "coordinator" },
                    { "name": "COORDENADOR P. ENSINO", "type": "coordinator" },
                    { "name": "COORDENADOR J. BOTÂNICO", "type": "coordinator" },
                    { "name": "COORDENADOR NOROESTE", "type": "coordinator" },
                    { "name": "COORDENADOR S. MÔNICA", "type": "coordinator" },
                    { "name": "COORDENADOR CENTRO", "type": "coordinator" },
                    { "name": "COORDENADOR COQUEIROS", "type": "coordinator" }
                ]
            },
            {
                "name": "DIRETOR INSTRUÇÃO",
                "type": "director",
                "children": [
                    {
                        "name": "COORDENADOR DE INSTRUÇÃO",
                        "type": "coordinator",
                        "children": [
                            { "name": "Academy" },
                            { "name": "Qualidade de Criação" },
                            { "name": "Treinar Instrutores" },
                            { "name": "Gamificação" }
                        ]
                    }
                ]
            }
        ]
    };

    // ─── D3 Setup ────────────────────────────────────────────────────────────────
    const width = document.getElementById('organogram-container').offsetWidth;
    const height = document.getElementById('organogram-container').offsetHeight;
    const margin = { top: 20, right: 120, bottom: 20, left: 120 };

    const svg = d3.select("#organogram-container")
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const zoom = d3.zoom()
        .scaleExtent([0.1, 5])
        .on("zoom", (event) => {
            g.attr("transform", event.transform);
        });

    svg.call(zoom);

    const initialTransform = d3.zoomIdentity.translate(width * 0.1, height / 2).scale(0.7);
    svg.call(zoom.transform, initialTransform);

    d3.select("#zoom-in").on("click", () => svg.transition().call(zoom.scaleBy, 1.3));
    d3.select("#zoom-out").on("click", () => svg.transition().call(zoom.scaleBy, 1 / 1.3));
    d3.select("#reset-zoom").on("click", () => svg.transition().duration(750).call(zoom.transform, initialTransform));

    const treemap = d3.tree().nodeSize([40, 250]);

    let i = 0;
    let root = d3.hierarchy(data, d => d.children);
    root.x0 = height / 2;
    root.y0 = 0;

    const colors = {
        root: "#FFC107",
        director: "#3b82f6",
        supervisor: "#f43f5e",
        coordinator: "#10b981",
        default: "#9ca3af"
    };

    // ─── Collapse helpers ────────────────────────────────────────────────────────
    function collapse(d) {
        if (d.children) {
            d._children = d.children;
            d._children.forEach(collapse);
            d.children = null;
        }
    }

    if (root.children) {
        root.children.forEach(d => {
            if (d.children) d.children.forEach(collapse);
        });
    }

    update(root);

    // ─── Main render function ─────────────────────────────────────────────────────
    function update(source) {
        const treeData = treemap(root);
        const nodes = treeData.descendants();
        const links = treeData.descendants().slice(1);

        nodes.forEach(d => { d.y = d.depth * 280; });

        // ── Nodes ──
        const node = g.selectAll('g.node')
            .data(nodes, d => d.id || (d.id = ++i));

        const nodeEnter = node.enter().append('g')
            .attr('class', 'node')
            .attr("transform", d => `translate(${source.y0},${source.x0})`)
            .on('click', (event, d) => {
                if (d.children) {
                    d._children = d.children;
                    d.children = null;
                } else {
                    d.children = d._children;
                    d._children = null;
                }
                update(d);
            })
            .on('mouseover', (event, d) => {
                showNodeInfo(d.data.name, assignments[d.data.name] || [], staffUsers, isAdmin);
            })
            .on('mouseout', () => {
                // Small delay so user can move to the info panel without it disappearing
                scheduleHideNodeInfo();
            });

        // Main node circle
        nodeEnter.append('circle')
            .attr('class', d => d._children ? 'node-circle' : 'node-circle expanded')
            .attr('r', 1e-6)
            .style("fill", d => d._children ? (colors[d.data.type] || colors.default) : null)
            .attr("stroke", d => colors[d.data.type] || colors.default)
            .attr("stroke-width", 2)
            .style("cursor", "pointer");

        // Gold assignment ring (outer glow ring for nodes with assigned people)
        nodeEnter.append('circle')
            .attr('class', 'assignment-ring')
            .attr('r', 0)
            .style('fill', 'none')
            .style('stroke', '#FFC107')
            .style('stroke-width', 2.5)
            .style('opacity', 0)
            .style('pointer-events', 'none');

        // Assignment count badge
        const badgeEnter = nodeEnter.append('g')
            .attr('class', 'assignment-badge')
            .attr('transform', 'translate(9, -9)')
            .style('opacity', 0)
            .style('pointer-events', 'none');

        badgeEnter.append('circle')
            .attr('r', 6)
            .style('fill', '#FFC107')
            .style('stroke', 'none');

        badgeEnter.append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', '0.35em')
            .style('font-size', '8px')
            .style('font-weight', '700')
            .style('fill', '#1a1a1a');

        // Node label
        nodeEnter.append('text')
            .attr("dy", ".35em")
            .attr("x", d => d.children || d._children ? -15 : 15)
            .attr("text-anchor", d => d.children || d._children ? "end" : "start")
            .text(d => d.data.name)
            .style("font-size", "13px")
            .style("font-weight", d => d.depth < 2 ? "700" : "500")
            .style("cursor", "pointer");

        const nodeUpdate = nodeEnter.merge(node);

        nodeUpdate.transition()
            .duration(500)
            .attr("transform", d => `translate(${d.y},${d.x})`);

        nodeUpdate.select('circle.node-circle')
            .attr('r', 8)
            .attr('class', d => d._children ? 'node-circle' : 'node-circle expanded')
            .style("fill", d => d._children ? (colors[d.data.type] || colors.default) : null)
            .attr("stroke", d => colors[d.data.type] || colors.default);

        // Update assignment rings
        nodeUpdate.select('.assignment-ring')
            .transition().duration(500)
            .attr('r', d => (assignments[d.data.name]?.length > 0) ? 12 : 0)
            .style('opacity', d => (assignments[d.data.name]?.length > 0) ? 1 : 0);

        // Update assignment badges
        nodeUpdate.select('.assignment-badge')
            .transition().duration(500)
            .style('opacity', d => (assignments[d.data.name]?.length > 0) ? 1 : 0);

        nodeUpdate.select('.assignment-badge text')
            .text(d => {
                const count = assignments[d.data.name]?.length;
                return count > 0 ? count : '';
            });

        // ── Node exit ──
        const nodeExit = node.exit().transition()
            .duration(500)
            .attr("transform", d => `translate(${source.y},${source.x})`)
            .remove();

        nodeExit.select('circle').attr('r', 1e-6);
        nodeExit.select('text').style('fill-opacity', 1e-6);

        // ── Links ──
        const link = g.selectAll('path.link')
            .data(links, d => d.id);

        const linkEnter = link.enter().insert('path', "g")
            .attr("class", "link")
            .attr('d', d => {
                const o = { x: source.x0, y: source.y0 };
                return diagonal(o, o);
            });

        const linkUpdate = linkEnter.merge(link);
        linkUpdate.transition().duration(500).attr('d', d => diagonal(d, d.parent));

        link.exit().transition()
            .duration(500)
            .attr('d', d => {
                const o = { x: source.x, y: source.y };
                return diagonal(o, o);
            })
            .remove();

        nodes.forEach(d => {
            d.x0 = d.x;
            d.y0 = d.y;
        });

        function diagonal(s, d) {
            return `M ${s.y} ${s.x}
                    C ${(s.y + d.y) / 2} ${s.x},
                      ${(s.y + d.y) / 2} ${d.x},
                      ${d.y} ${d.x}`;
        }
    }

    // ─── Node Info Panel ─────────────────────────────────────────────────────────
    const nodeInfoPanel = document.getElementById('node-info');
    const nodeNameEl = document.getElementById('node-name');
    const nodeDescEl = document.getElementById('node-desc');
    const nodePeopleEl = document.getElementById('node-people');
    const nodeEditBtn = document.getElementById('node-edit-btn');
    let hideTimer = null;
    let currentHoverNode = null;

    if (nodeInfoPanel) {
        nodeInfoPanel.addEventListener('mouseenter', () => {
            clearTimeout(hideTimer);
        });
        nodeInfoPanel.addEventListener('mouseleave', () => {
            scheduleHideNodeInfo();
        });
    }

    function scheduleHideNodeInfo() {
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => {
            if (nodeInfoPanel) nodeInfoPanel.classList.add('hidden');
        }, 300);
    }

    function showNodeInfo(nodeName, assignedUIDs, staffUsers, isAdmin) {
        clearTimeout(hideTimer);
        currentHoverNode = nodeName;

        if (!nodeInfoPanel || !nodeNameEl) return;

        nodeNameEl.textContent = nodeName;

        // People list
        if (nodePeopleEl) {
            if (assignedUIDs.length === 0) {
                nodePeopleEl.innerHTML = `<p class="text-gray-400 dark:text-gray-600 text-xs italic mt-1">Nenhuma pessoa vinculada</p>`;
            } else {
                const people = assignedUIDs
                    .map(uid => staffUsers.find(u => u.id === uid))
                    .filter(Boolean);

                nodePeopleEl.innerHTML = people.map(p => {
                    const initials = (p.name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
                    const photoURL = p.photoURL || p.photoUrl || p.profilePic || p.profilePicture;
                    return `
                        <div class="flex items-center gap-2 mt-2">
                            <div class="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white text-[10px] font-bold shrink-0 relative overflow-hidden shadow-sm">
                                ${photoURL ? `<img src="${photoURL}" class="absolute inset-0 w-full h-full object-cover" onerror="this.style.display='none'">` : ''}
                                <span class="relative z-10">${initials}</span>
                            </div>
                            <div class="flex flex-col min-w-0">
                                <span class="text-gray-800 dark:text-gray-200 text-xs font-semibold truncate">${p.name || 'Sem nome'}</span>
                                ${p.email ? `<span class="text-gray-400 dark:text-gray-500 text-[10px] truncate">${p.email}</span>` : ''}
                            </div>
                        </div>`;
                }).join('');
            }
        }

        // Edit button visibility
        if (nodeEditBtn) {
            if (isAdmin) {
                nodeEditBtn.classList.remove('hidden');
                nodeEditBtn.onclick = () => openAssignModal(nodeName, assignedUIDs, staffUsers);
            } else {
                nodeEditBtn.classList.add('hidden');
            }
        }

        // Subtitle
        if (nodeDescEl) {
            nodeDescEl.textContent = assignedUIDs.length > 0
                ? `${assignedUIDs.length} pessoa${assignedUIDs.length > 1 ? 's' : ''} vinculada${assignedUIDs.length > 1 ? 's' : ''}`
                : 'Cargo';
        }

        nodeInfoPanel.classList.remove('hidden');
    }

    // ─── Assignment Modal ────────────────────────────────────────────────────────
    const assignModal = document.getElementById('assign-modal');
    const assignModalTitle = document.getElementById('assign-modal-title');
    const assignSearch = document.getElementById('assign-search');
    const assignUsersList = document.getElementById('assign-users-list');
    const assignSaveBtn = document.getElementById('assign-save-btn');
    const assignCancelBtn = document.getElementById('assign-cancel-btn');
    const assignModalBackdrop = document.getElementById('assign-modal-backdrop');

    let currentAssignNode = null;
    let selectedUIDs = new Set();

    function openAssignModal(nodeName, currentUIDs, staffUsers) {
        currentAssignNode = nodeName;
        selectedUIDs = new Set(currentUIDs);

        if (assignModalTitle) assignModalTitle.textContent = nodeName;
        if (assignSearch) assignSearch.value = '';
        renderAssignUsersList(staffUsers, '');

        if (assignModal) assignModal.classList.remove('hidden');
    }

    function renderAssignUsersList(staffUsers, filter) {
        if (!assignUsersList) return;
        const lc = filter.toLowerCase();
        const filtered = staffUsers.filter(u =>
            (u.name || '').toLowerCase().includes(lc) ||
            (u.email || '').toLowerCase().includes(lc)
        );

        assignUsersList.innerHTML = filtered.map(u => {
            const initials = (u.name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
            const photoURL = u.photoURL || u.photoUrl || u.profilePic || u.profilePicture;
            const checked = selectedUIDs.has(u.id) ? 'checked' : '';
            return `
                <label class="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group" data-uid="${u.id}">
                    <div class="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold shrink-0 relative overflow-hidden shadow-sm">
                        ${photoURL ? `<img src="${photoURL}" class="absolute inset-0 w-full h-full object-cover" onerror="this.style.display='none'">` : ''}
                        <span class="relative z-10">${initials}</span>
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-semibold text-gray-900 dark:text-white truncate">${u.name || 'Sem nome'}</p>
                        <p class="text-xs text-gray-400 dark:text-gray-500 truncate">${u.email || ''}</p>
                    </div>
                    <input type="checkbox" ${checked} class="assign-checkbox w-4 h-4 accent-[#FFC107] rounded shrink-0" data-uid="${u.id}">
                </label>`;
        }).join('');

        // Bind checkbox change events
        assignUsersList.querySelectorAll('.assign-checkbox').forEach(cb => {
            cb.addEventListener('change', () => {
                if (cb.checked) {
                    selectedUIDs.add(cb.dataset.uid);
                } else {
                    selectedUIDs.delete(cb.dataset.uid);
                }
            });
        });
    }

    if (assignSearch) {
        assignSearch.addEventListener('input', () => {
            renderAssignUsersList(staffUsers, assignSearch.value);
        });
    }

    function closeAssignModal() {
        if (assignModal) assignModal.classList.add('hidden');
        currentAssignNode = null;
        selectedUIDs = new Set();
    }

    if (assignCancelBtn) assignCancelBtn.addEventListener('click', closeAssignModal);
    if (assignModalBackdrop) assignModalBackdrop.addEventListener('click', closeAssignModal);

    if (assignSaveBtn) {
        assignSaveBtn.addEventListener('click', async () => {
            if (!currentAssignNode) return;

            assignSaveBtn.disabled = true;
            assignSaveBtn.textContent = 'Salvando...';

            try {
                assignments[currentAssignNode] = [...selectedUIDs];
                await setDoc(doc(db, 'organograma_config', 'main'), { nodes: assignments });
                closeAssignModal();
                update(root); // Re-render to update rings and badges
            } catch (err) {
                console.error('Erro ao salvar vínculos:', err);
                alert('Erro ao salvar. Tente novamente.');
            } finally {
                assignSaveBtn.disabled = false;
                assignSaveBtn.textContent = 'Salvar';
            }
        });
    }

    // ─── Resize handler ───────────────────────────────────────────────────────────
    window.addEventListener('resize', () => {
        // Could re-render SVG here if needed
    });
}
