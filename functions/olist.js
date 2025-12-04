const functions = require("firebase-functions/v1");
const axios = require("axios");
const qs = require("qs"); // Tiny API often requires form-urlencoded for some endpoints, but JSON is usually supported in V2/V3. Let's stick to JSON or query params as per docs.
const { getActiveStudentsFromUnit } = require("./evo");

// Token fornecido pelo usuário
const OLIST_TOKEN = "efb2bf1068997a0ca4c2ce9d5009482ddf86520fcfafaaafbc0d00b758299c39";
const TINY_API_BASE_URL = "https://api.tiny.com.br/api2";

/**
 * Cria ou atualiza um contato no Tiny ERP.
 * Documentação: https://tiny.com.br/ajuda/api/api2-contatos-incluir
 */
async function createOrUpdateContact(student) {
    // Extract email and phone from contacts array
    const emailContact = student.contacts?.find(c => c.idContactType === 4 || c.contactType === 'E-mail');
    const phoneContact = student.contacts?.find(c => c.idContactType === 1 || c.contactType === 'Celular');

    const nome = `${student.firstName || ''} ${student.lastName || ''}`.trim();
    const email = emailContact?.description || "";
    const cpf = student.document || "";
    const fone = phoneContact?.description || "";
    const endereco = student.address || "";
    const numero = student.addressNumber || "";
    const bairro = student.district || "";
    const cep = student.zipCode || "";
    const cidade = student.city || "";
    const uf = student.state || "";
    const obs = `Importado do EVO - Unidade Coqueiros - ID: ${student.idMember}`;

    // Estrutura correta conforme documentação:
    // { "contatos": [ { "contato": { ... } } ] }
    const contatoJSON = {
        contatos: [
            {
                contato: {
                    sequencia: "1", // Identificador sequencial para este lote (como enviamos 1 por vez, sempre 1)
                    nome: nome,
                    tipo_pessoa: "F",
                    email: email,
                    cpf_cnpj: cpf,
                    fone: fone,
                    endereco: endereco,
                    numero: numero,
                    bairro: bairro,
                    cep: cep,
                    cidade: cidade,
                    uf: uf,
                    obs: obs,
                    situacao: "A" // Ativo
                }
            }
        ]
    };

    const MAX_RETRIES = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const response = await axios.post(`${TINY_API_BASE_URL}/contato.incluir.php`, null, {
                params: {
                    token: OLIST_TOKEN,
                    contato: JSON.stringify(contatoJSON),
                    formato: "json" // formato do RETORNO
                },
                timeout: 10000
            });

            // Verifica erro geral da requisição
            if (response.data && response.data.retorno && response.data.retorno.status === "Erro") {
                // Se tiver registros com erro específico, o status geral pode ser Erro também?
                // A documentação diz que se status for Erro, tem retorno.erros
                // Mas também tem retorno.registros com status individual

                // Vamos checar erros globais primeiro
                if (response.data.retorno.erros) {
                    const erros = response.data.retorno.erros;
                    const errorMessages = erros.map(e => e.erro).join(', ');

                    if (errorMessages.includes("API Bloqueada") || errorMessages.includes("Excedido")) {
                        if (attempt < MAX_RETRIES) {
                            const waitTime = Math.pow(2, attempt) * 2000;
                            console.warn(`API bloqueada, aguardando ${waitTime}ms...`);
                            await new Promise(r => setTimeout(r, waitTime));
                            continue;
                        }
                    }
                    throw new Error(errorMessages);
                }
            }

            // Verifica o status do registro individual
            const registro = response.data.retorno.registros?.[0]?.registro;

            if (registro) {
                if (registro.status === "OK") {
                    console.log(`✓ Contato ${email || nome} criado com sucesso no Tiny! ID: ${registro.id}`);
                    return { status: "created", data: response.data, id: registro.id };
                } else if (registro.status === "Erro") {
                    const errorMessages = registro.erros?.map(e => e.erro).join(', ') || "Erro desconhecido";

                    // Se for duplicado
                    if (errorMessages.includes("já cadastrado") || errorMessages.includes("duplicado")) {
                        console.log(`Contato ${email || nome} já existe no Tiny.`);
                        return { status: "exists", id: null };
                    }

                    throw new Error(`Erro no registro: ${errorMessages}`);
                }
            } else {
                // Caso estranho onde retorna OK mas sem registros (o que acontecia antes, mas agora deve vir com erro se falhar)
                console.warn(`⚠ API retornou sem registros para ${email || nome}`, JSON.stringify(response.data));
                return { status: "unknown", data: response.data };
            }

        } catch (error) {
            lastError = error;

            if (attempt < MAX_RETRIES) {
                const waitTime = Math.pow(2, attempt) * 1000;
                console.warn(`Erro na tentativa ${attempt}/${MAX_RETRIES} para ${email || nome}: ${error.message}. Aguardando ${waitTime}ms...`);
                await new Promise(r => setTimeout(r, waitTime));
            }
        }
    }

    // Se chegou aqui, todas as tentativas falharam
    console.error(`Falha após ${MAX_RETRIES} tentativas para contato ${email || nome}:`, lastError?.message);
    throw lastError;
}



/**
 * Função Cloud Function para sincronizar alunos.
 * Pode ser chamada via HTTP ou agendada (se configurada no futuro).
 */
exports.syncEvoToOlist = functions.runWith({ timeoutSeconds: 540 }).https.onRequest(async (req, res) => {
    try {
        // 1. Buscar alunos ativos da unidade Coqueiros
        console.log("Iniciando sincronização EVO -> Olist (Tiny)...");
        const students = await getActiveStudentsFromUnit("coqueiros");
        console.log(`Encontrados ${students.length} alunos ativos em Coqueiros.`);

        // 2. Enviar para o Tiny
        let successCount = 0;
        let errorCount = 0;
        let skippedCount = 0;
        const isDryRun = req.query.dryRun === 'true';

        if (isDryRun) {
            console.log("--- MODO DRY RUN ATIVADO: Nenhuma alteração será feita no Tiny ---");
        }

        // Processar em lotes ou sequencialmente para não estourar rate limits
        for (const student of students) {
            // Extract email from contacts for validation
            const emailContact = student.contacts?.find(c => c.idContactType === 4 || c.contactType === 'E-mail');
            const email = emailContact?.description;

            // Validação básica
            if (!email || !student.document) {
                console.warn(`Aluno ${student.firstName} ${student.lastName} (ID: ${student.idMember}) ignorado: sem email ou CPF.`);
                skippedCount++;
                continue;
            }

            try {
                if (isDryRun) {
                    console.log(`[DRY RUN] Enviaria aluno: ${student.firstName} ${student.lastName} (${email})`);
                    successCount++;
                } else {
                    const result = await createOrUpdateContact(student);
                    if (result.status === "created") successCount++;
                    else skippedCount++;
                }
            } catch (err) {
                errorCount++;
            }

            // Delay mais longo para evitar rate limit da API Tiny (muito restritivo)
            await new Promise(r => setTimeout(r, 2000)); // 2 segundos entre cada requisição
        }

        res.status(200).json({
            message: "Sincronização concluída.",
            stats: {
                total: students.length,
                success: successCount,
                skipped: skippedCount,
                errors: errorCount
            }
        });

    } catch (error) {
        console.error("Erro fatal na sincronização:", error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Função agendada para sincronizar automaticamente todos os dias às 2h da manhã.
 * Executa a mesma lógica da função HTTP, mas de forma automática.
 */
exports.syncEvoToOlistScheduled = functions.pubsub.schedule('0 2 * * *')
    .timeZone('America/Sao_Paulo')
    .onRun(async (context) => {
        try {
            console.log("Iniciando sincronização agendada EVO -> Olist (Tiny)...");
            const students = await getActiveStudentsFromUnit("coqueiros");
            console.log(`Encontrados ${students.length} alunos ativos em Coqueiros.`);

            let successCount = 0;
            let errorCount = 0;
            let skippedCount = 0;

            for (const student of students) {
                const emailContact = student.contacts?.find(c => c.idContactType === 4 || c.contactType === 'E-mail');
                const email = emailContact?.description;

                if (!email || !student.document) {
                    console.warn(`Aluno ${student.firstName} ${student.lastName} (ID: ${student.idMember}) ignorado: sem email ou CPF.`);
                    skippedCount++;
                    continue;
                }

                try {
                    const result = await createOrUpdateContact(student);
                    if (result.status === "created") successCount++;
                    else skippedCount++;
                } catch (err) {
                    errorCount++;
                }

                await new Promise(r => setTimeout(r, 2000)); // 2 segundos entre cada requisição
            }

            const stats = {
                total: students.length,
                success: successCount,
                skipped: skippedCount,
                errors: errorCount
            };

            console.log("Sincronização agendada concluída:", stats);
            return stats;

        } catch (error) {
            console.error("Erro fatal na sincronização agendada:", error);
            throw error;
        }
    });

/**
 * Busca o histórico de compras de um aluno no Tiny ERP pelo CPF.
 * @param {string} cpf - CPF do aluno
 * @returns {Promise<Array>} - Lista de pedidos com detalhes
 */
exports.getStudentPurchases = async function (cpf) {
    if (!cpf) return [];

    // Remove pontuação do CPF para garantir formato correto
    const cleanCpf = cpf.replace(/\D/g, '');

    try {
        // 1. Buscar pedidos do cliente
        const response = await axios.post(`${TINY_API_BASE_URL}/pedidos.pesquisa.php`, null, {
            params: {
                token: OLIST_TOKEN,
                cpf_cnpj: cleanCpf,
                formato: "json"
            }
        });

        if (response.data.retorno.status !== "OK") {
            // Se não encontrar registros, retorna array vazio
            // Código 20 = A consulta não retornou registros
            if (response.data.retorno.codigo_erro == "20") return [];

            console.warn(`Erro ao buscar pedidos para CPF ${cleanCpf}:`, JSON.stringify(response.data.retorno.erros));
            return [];
        }

        const pedidos = response.data.retorno.pedidos;
        const purchases = [];

        // 2. Para cada pedido, buscar os detalhes (itens)
        // Limitando aos últimos 10 pedidos para evitar rate limit excessivo
        const recentOrders = pedidos.slice(0, 10);

        for (const p of recentOrders) {
            try {
                // Delay para rate limit
                await new Promise(r => setTimeout(r, 1000));

                const detailResponse = await axios.post(`${TINY_API_BASE_URL}/pedido.obter.php`, null, {
                    params: {
                        token: OLIST_TOKEN,
                        id: p.pedido.id,
                        formato: "json"
                    }
                });

                if (detailResponse.data.retorno.status === "OK") {
                    const pedidoDetalhe = detailResponse.data.retorno.pedido;

                    purchases.push({
                        id: pedidoDetalhe.id,
                        numero: pedidoDetalhe.numero,
                        data: pedidoDetalhe.data_pedido,
                        total: pedidoDetalhe.valor_total,
                        situacao: pedidoDetalhe.situacao,
                        itens: pedidoDetalhe.itens.map(i => ({
                            descricao: i.item.descricao,
                            quantidade: i.item.quantidade,
                            valor_unitario: i.item.valor_unitario
                        }))
                    });
                }
            } catch (err) {
                console.error(`Erro ao buscar detalhes do pedido ${p.pedido.id}:`, err.message);
                // Continua para o próximo mesmo com erro
            }
        }

        return purchases;

    } catch (error) {
        console.error("Erro em getStudentPurchases:", error);
        throw error;
    }
};
