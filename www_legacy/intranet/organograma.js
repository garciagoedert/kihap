import { loadComponents } from './common-ui.js';

document.addEventListener('DOMContentLoaded', () => {
    loadComponents(() => {
        initOrganogram();
    });
});

function initOrganogram() {
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

    const width = document.getElementById('organogram-container').offsetWidth;
    const height = document.getElementById('organogram-container').offsetHeight;
    const margin = { top: 20, right: 120, bottom: 20, left: 120 };

    const svg = d3.select("#organogram-container")
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Zoom and Pan
    const zoom = d3.zoom()
        .scaleExtent([0.1, 5])
        .on("zoom", (event) => {
            g.attr("transform", event.transform);
        });

    svg.call(zoom);

    // Initial zoom state
    const initialTransform = d3.zoomIdentity.translate(width * 0.1, height / 2).scale(0.7);
    svg.call(zoom.transform, initialTransform);

    // Zoom buttons
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
        director: "#007BFF",
        supervisor: "#DC3545",
        coordinator: "#28A745",
        default: "#6c757d"
    };

    // Collapse helper
    function collapse(d) {
        if (d.children) {
            d._children = d.children;
            d._children.forEach(collapse);
            d.children = null;
        }
    }

    // Collapse children of directors and deeper levels initially
    if (root.children) {
        root.children.forEach(d => {
            if (d.children) {
                d.children.forEach(collapse);
            }
        });
    }

    update(root);

    function update(source) {
        const treeData = treemap(root);
        const nodes = treeData.descendants();
        const links = treeData.descendants().slice(1);

        nodes.forEach(d => { d.y = d.depth * 280 });

        // Nodes section
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
            });

        nodeEnter.append('circle')
            .attr('class', 'node-circle')
            .attr('r', 1e-6)
            .style("fill", d => d._children ? (colors[d.data.type] || colors.default) : "#111")
            .attr("stroke", d => colors[d.data.type] || colors.default)
            .attr("stroke-width", 2)
            .style("cursor", "pointer");

        nodeEnter.append('text')
            .attr("dy", ".35em")
            .attr("x", d => d.children || d._children ? -15 : 15)
            .attr("text-anchor", d => d.children || d._children ? "end" : "start")
            .text(d => d.data.name)
            .style("fill", "#fff")
            .style("font-size", "13px")
            .style("font-weight", d => d.depth < 2 ? "bold" : "normal")
            .style("cursor", "pointer")
            .attr("paint-order", "stroke")
            .attr("stroke", "#111")
            .attr("stroke-width", 4);

        const nodeUpdate = nodeEnter.merge(node);

        nodeUpdate.transition()
            .duration(500)
            .attr("transform", d => `translate(${d.y},${d.x})`);

        nodeUpdate.select('circle.node-circle')
            .attr('r', 8)
            .style("fill", d => d._children ? (colors[d.data.type] || colors.default) : "#111")
            .attr("stroke", d => colors[d.data.type] || colors.default);

        const nodeExit = node.exit().transition()
            .duration(500)
            .attr("transform", d => `translate(${source.y},${source.x})`)
            .remove();

        nodeExit.select('circle')
            .attr('r', 1e-6);

        nodeExit.select('text')
            .style('fill-opacity', 1e-6);

        // Links section
        const link = g.selectAll('path.link')
            .data(links, d => d.id);

        const linkEnter = link.enter().insert('path', "g")
            .attr("class", "link")
            .attr("fill", "none")
            .attr("stroke", "#444")
            .attr("stroke-width", "1.5px")
            .attr('d', d => {
                const o = { x: source.x0, y: source.y0 };
                return diagonal(o, o);
            });

        const linkUpdate = linkEnter.merge(link);

        linkUpdate.transition()
            .duration(500)
            .attr('d', d => diagonal(d, d.parent));

        const linkExit = link.exit().transition()
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

    // Handle Resize
    window.addEventListener('resize', () => {
        const newWidth = document.getElementById('organogram-container').offsetWidth;
    });
}
