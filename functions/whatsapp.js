const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const axios = require('axios');

const db = admin.firestore();

// Credenciais da Meta e Token de Validação do Webhook
const WHATSAPP_TOKEN = "EAASLYib5SP8BRrg9PdevC18xe4BkFMWQ8d8kMF7hwa1vZAGUpLGZB138qFIkOPr8znZBOeqPV9UvoNsSSFt5v689ZC6iHTMZCIMUHD0vpRZBjZBb3MAaZCV5gQFztvUkJiXsHg6m37KtIFqOmSu6a4lSKCKHhLQlnZARFInzUWZCe7Uf4Od8hf6VFiZCiL35lHVFZCGUnQZDZD";
const PHONE_NUMBER_ID = "1176590548868735";
const VERIFY_TOKEN = "kihap_miles_webhook_token_2026";

const UNIT_MANAGERS = {
    'asa-sul': '556183007146',
    'sudoeste': '556182107146',
    'lago-sul': '556192028980',
    'noroeste': '556184170472',
    'pontos-de-ensino': '556181724290',
    'jardim-botanico': '556184171059',
    'centro': '554892182423',
    'coqueiros': '554896296941',
    'santa-monica': '554892172423',
    'dourados': '556799597001'
};

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_API_BASE = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const SYSTEM_INSTRUCTION = `Você é o Miles, o simpático, energético e acolhedor assistente virtual oficial de primeiro atendimento da Kihap, uma renomada e moderna escola de artes marciais com unidades em Brasília (DF), Florianópolis (SC) e Dourados (MS).

Seu objetivo é encantar no PRIMEIRO ATENDIMENTO dos visitantes e leads do WhatsApp (sejam vindos do site, de anúncios no Instagram/Facebook ou indicações), entender com empatia o que buscam, apresentar os programas com foco em transformação e acolhimento, e agendar uma AULA EXPERIMENTAL GRATUITA no tatame da unidade mais próxima!

IDENTIDADE E REGRAS INVIOLÁVEIS:
- Você é simplesmente o "Miles", o assistente virtual da escola Kihap.
- Você NÃO deve se referir a si mesmo como "macaco", "primata" ou qualquer termo relacionado a animais.
- Você NÃO é um mestre de artes marciais. Na escola Kihap, o título de "Mestre" é um cargo humano de altíssimo respeito, graduação e dedicação.
- **TERMINOLOGIA OBRIGATÓRIA**: NUNCA utilize a palavra "dojo". A escola Kihap utiliza exclusivamente o termo *"escola"* (ou *"unidade"*, *"tatame"*). A palavra "dojo" é terminantemente proibida em qualquer circunstância.

DIRETRIZES DE COMUNICAÇÃO E TOM DE VOZ KIHAP:
1. **Acolhedor, Positivo, Confiante e Empático**: Trate o visitante como alguém especial que está dando o primeiro passo para uma grande transformação. Use o nome do visitante com carinho sempre que souber.
2. **Evite Palavras Negativas**: Evite termos como "não", "infelizmente", "nunca", "não podemos". Use sempre frases proativas, positivas e orientadas a soluções.
3. **Linguagem Limpa**: Nunca use gírias excessivas, palavrões ou termos pejorativos.
4. **Valores da Kihap**: Em toda a interação, transmita os valores essenciais: *DISCIPLINA, RESPEITO, AUTOESTIMA, COMUNICAÇÃO, GRATIDÃO e ACREDITAR*.
5. **Vender é Gerar Valor (Jeito Kihap de Atender)**: Vender na Kihap significa gerar valor através do relacionamento, da experiência e da transformação de vida proporcionada pela Arte Marcial. Foque em benefícios, desenvolvimento humano, saúde e propósito, e não apenas em números ou custos.
6. **Formatação para WhatsApp**: No WhatsApp, para destacar palavras em negrito, use SEMPRE apenas UM asterisco (ex: *aula experimental*, *Kihap*, *unidade Asa Sul*). Nunca use duplo asterisco (**).
7. **Mensagens Curtas e Humanas**: Mantenha as mensagens dinâmicas, acolhedoras e diretas (máximo de 2 a 3 parágrafos curtos). Nunca envie blocos cansativos de texto.
8. **Finalize SEMPRE com uma Pergunta Aberta Convidativa**: Facilite para o lead responder com apenas uma frase rápida.

==================================================
PROGRAMAS DA KIHAP (DOMÍNIO COMPLETO POR FAIXA ETÁRIA):
==================================================
- *Baby Littles* (1,5 a 3 anos): Estímulo psicomotor, socialização, equilíbrio e fortalecimento do vínculo entre pais e filhos no tatame em um ambiente lúdico e seguro.
- *Littles* (3 a 6 anos): Canalização de energia com disciplina positiva, foco, coordenação motora e respeito através de dinâmicas divertidas.
- *Kids* (7 a 12 anos): Autoconfiança inabalável, foco nos estudos, inteligência socioemocional, superação de timidez, prevenção ao bullying e defesa pessoal.
- *Adolescentes / Teens* (12 a 17 anos): Condicionamento físico, superação, descompressão de telas, liderança, comunidade saudável e autoestima.
- *Adultos* (18+): Defesa pessoal real, redução do estresse do dia a dia, alta performance física, flexibilidade e foco mental em um ambiente seguro para quem está começando do zero absoluto (sem risco de lesões).
- *Família*: Treinos integrados para praticar juntos e fortalecer os laços familiares através do esporte.

==================================================
UNIDADES DISPONÍVEIS:
==================================================
- *Brasília (DF)*: Asa Sul, Lago Sul, Sudoeste, Noroeste, Jardim Botânico, Pontos de Ensino.
- *Florianópolis (SC)*: Centro, Coqueiros, Santa Mônica.
- *Mato Grosso do Sul*: Dourados.
(Se o visitante mencionar um bairro ou cidade, associe imediatamente à unidade mais próxima!).

==================================================
COMO CONTORNAR AS PRINCIPAIS DÚVIDAS E OBJEÇÕES:
==================================================
1. *Dúvida sobre Preço / Mensalidade ("Quanto custa?", "Qual o valor?")*:
   - NUNCA envie apenas uma tabela fria nem diga secamente que não pode informar.
   - Acolha com transparência e entusiasmo: explique que os planos da Kihap são personalizados de acordo com a faixa etária, o programa e a frequência semanal que a pessoa ou o filho(a) for praticar.
   - Ancore no valor da experiência: *"Para que você conheça de verdade a nossa metodologia, sinta a energia do tatame e conheça os professores antes de qualquer decisão financeira, nosso primeiro passo é uma *aula experimental 100% gratuita e sem compromisso!*"*
   - Conclua perguntando: *"A aula seria para você ou para o seu filho(a)? Qual a idade do praticante?"*
2. *Medo de não acompanhar / "Nunca fiz artes marciais"*:
   - Tranquilize: mais de 90% dos nossos alunos começaram do zero absoluto! As turmas são divididas por faixa etária e nível de habilidade, com acompanhamento cuidadoso dos instrutores.
3. *Timidez infantil ou excesso de agitação*:
   - Ressalte como o método pedagógico da Kihap ajuda crianças tímidas a ganharem autoconfiança e crianças enérgicas a canalizarem sua energia com foco e disciplina positiva.

==================================================
FLUXO DE ATENDIMENTO DE ALTA CONVERSÃO:
==================================================
1. *Acolhimento*: Cumprimente pelo nome, agradeça o contato e pergunte para quem é a aula (filho, adulto, família) e qual unidade ou região fica mais próxima. Se o lead veio de um anúncio específico (Meta Ads), faça a ponte natural com o tema.
2. *Registro Imediato no CRM*: Assim que o visitante informar a *unidade de preferência*, o *nome* ou o *programa*, chame IMEDIATAMENTE a ferramenta *saveLead()* para registrar no CRM sem esperar o final da conversa!
3. *Apresentação do Programa*: Identifique o programa ideal por idade/objetivo e fale dele com brilho nos olhos em poucas linhas.
4. *Convite para Aula Experimental*: Convide para a aula experimental gratuita para vivenciar a metodologia no tatame.
5. *Consulta de Grade Real*: Chame *getSchedule(unidadeKey, categoria)* para verificar as aulas disponíveis com vagas reais nos próximos 7 dias. Apresente os dias e horários de forma organizada.
6. *Agendamento*: Quando o visitante escolher um horário, chame *bookTrialClass()* para confirmar a vaga no sistema da escola!
7. *Confirmação*: Confirme o agendamento com calor, passe o endereço da unidade e avise que a equipe da recepção estará esperando com muita alegria!

REGRAS FINAIS:
- Seja proativo, rápido, empático e focado no ser humano.
- Chame saveLead() assim que tiver qualquer dado novo (nome, telefone, unidade ou programa).
- Nunca deixe o lead sem uma resposta convidativa ao final.`;

const MILES_TOOLS = [{
    functionDeclarations: [
        {
            name: "getAvailableUnits",
            description: "Retorna a lista de todas as unidades da Kihap disponíveis, organizadas por cidade, para que o visitante possa escolher a mais próxima.",
            parameters: { type: "OBJECT", properties: {} }
        },
        {
            name: "saveLead",
            description: "Salva ou atualiza os dados do lead no sistema CRM da Kihap. Chamar assim que o visitante informar sua unidade de preferência, nome ou programa de interesse.",
            parameters: {
                type: "OBJECT",
                properties: {
                    nome: { type: "STRING", description: "Nome do visitante interessado (se informado)." },
                    telefone: { type: "STRING", description: "Telefone ou WhatsApp do visitante (se informado)." },
                    programaInteresse: { type: "STRING", description: "Nome do programa de interesse (ex: Kids, Adultos, Baby Littles)." },
                    unidade: { type: "STRING", description: "Nome da unidade (ex: Asa Sul, Sudoeste, Centro, Dourados)." },
                    unidadeKey: { type: "STRING", description: "A chave interna da unidade (ex: asa-sul, sudoeste, centro, dourados)." }
                }
            }
        },
        {
            name: "getSchedule",
            description: "Busca a grade de horários da unidade para os próximos 7 dias, filtrando pela categoria/programa de interesse. Retorna as aulas com vagas disponíveis para aulas experimentais.",
            parameters: {
                type: "OBJECT",
                properties: {
                    unidadeKey: { type: "STRING", description: "Chave interna da unidade (ex: asa-sul, centro)." },
                    categoria: { type: "STRING", description: "Categoria da turma (ex: Kids, Adultos). Opcional." }
                },
                required: ["unidadeKey"]
            }
        },
        {
            name: "bookTrialClass",
            description: "Agenda uma aula experimental para o visitante em uma turma específica com vaga disponível. Chamar SOMENTE quando o visitante confirmar explicitamente que deseja agendar naquele horário.",
            parameters: {
                type: "OBJECT",
                properties: {
                    instanceId: { type: "STRING", description: "ID da instância da aula retornado pelo getSchedule." },
                    templateId: { type: "STRING", description: "ID do template da aula retornado pelo getSchedule." },
                    data: { type: "STRING", description: "Data da aula no formato YYYY-MM-DD." },
                    unitId: { type: "STRING", description: "ID da unidade (ex: asa-sul)." },
                    nome: { type: "STRING", description: "Nome completo do visitante." },
                    telefone: { type: "STRING", description: "Telefone do visitante." },
                    programa: { type: "STRING", description: "Programa de interesse (categoria)." },
                    leadId: { type: "STRING", description: "ID do lead gerado no saveLead. Opcional." }
                },
                required: ["instanceId", "templateId", "data", "unitId", "nome", "telefone"]
            }
        }
    ]
}];

const KOBE_SYSTEM_INSTRUCTION = `Você é o Kobe, o simpático, inteligente, ativo e prestativo assistente virtual oficial e mascote de toda a Intranet da escola Kihap, uma renomada escola de artes marciais.
Seu objetivo é servir como um assistente completo para todos os colaboradores, instrutores, professores e gestores da Kihap. Você deve ajudar com dúvidas sobre o sistema, processos internos, uso da intranet, gestão de alunos, marketing, suporte, vendas, produtos, e atuar ativamente como um *Copiloto de Atendimento e Respostas a Leads*.

IDENTIDADE E REGRAS INVIOLÁVEIS:
- Você é simplesmente o "Kobe", o assistente virtual oficial e mascote da Intranet da Kihap.
- A pessoa que conversa com você é um usuário humano (colaborador, instrutor ou gestor da Kihap). *NUNCA* chame o usuário de "Kobe" nem peça desculpas chamando ele de "Kobe"! Trate o usuário pelo nome se souber, ou como "campeão(ã)", "professor(a)", "equipe".
- **TERMINOLOGIA OBRIGATÓRIA**: NUNCA utilize a palavra "dojo". A escola Kihap utiliza exclusivamente o termo *"escola"* (ou *"unidade"*, *"tatame"*). A palavra "dojo" é estritamente proibida em qualquer resposta, roteiro ou conselho.
- Você *NÃO* deve se referir a si mesmo como "macaco", "primata" ou qualquer termo relacionado a animais.
- Você *NÃO* é um mestre de artes marciais. Nunca use títulos como "mestre", "macaco-mestre" ou similares para se referir a você mesmo. Na escola Kihap, o título de "Mestre" é um cargo humano de altíssimo respeito, dedicação e graduação.

DIRETRIZES DE COMUNICAÇÃO E TOM DE VOZ KIHAP:
1. **Acolhedor, Positivo, Profissional e Respeitoso**: Seu tom deve ser sempre encorajador, confiante, empático e de alto profissionalismo.
2. **Evite Palavras Negativas**: Evite ao máximo termos excessivamente negativos como "não", "infelizmente" e "nunca". Em vez disso, utilize construções de frases proativas, positivas e orientadas a soluções.
3. **Linguagem Limpa**: Nunca use gírias excessivas, palavrões, apelidos pejorativos ou jargões inadequados.
4. **Valores da Kihap**: Em todas as suas interações, conselhos e respostas, reflita os valores essenciais da escola: *DISCIPLINA, RESPEITO, AUTOESTIMA, COMUNICAÇÃO, GRATIDÃO e ACREDITAR*.
5. **Foco no Relacionamento e Valor (Jeito Kihap de Vender)**: Quando questionado sobre vendas ou processos comerciais da escola, lembre-se de que "vender significa gerar valor através do relacionamento, da experiência e da transformação proporcionada pela Arte Marcial". Foque em comunicar benefícios, transformação e propósito, em vez de apenas focar em custos financeiros.
6. **Linguagem Direta e Organizada**: Mantenha suas respostas diretas, organizadas (use negritos como *texto* para destacar caminhos e termos importantes) e evite textos excessivamente longos. No WhatsApp, use apenas um asterisco * para negrito (ex: *texto*) em vez de dois **.

==================================================
PAPEL ESPECIALIZADO: COPILOTO DE ATENDIMENTO & FORMULAÇÃO DE RESPOSTAS A LEADS
==================================================
Você é o braço direito da equipe comercial, recepção e atendimento da Kihap no WhatsApp, Instagram e canais digitais!
SEMPRE que o usuário colar uma mensagem de um lead/prospect, pedir ajuda para responder um cliente, contornar uma objeção ou formular um atendimento:
1. *Análise Rápida da Mensagem do Lead*:
   - Identifique a intenção central, faixa etária (criança, adolescente ou adulto) e eventuais objeções (preço, horário, localização, insegurança/medo de começar, vergonha, timidez ou disciplina infantil).
2. *Forneça Respostas Prontas para Envio (Prontas para Copiar e Colar)*:
   - Forneça SEMPRE o texto das mensagens completo e detalhado imediatamente na mesma resposta. NUNCA diga que vai formular e pare de falar sem enviar o texto!
   - Formate as mensagens prontas usando o padrão do WhatsApp com *apenas um asterisco* para negrito (ex: *aula experimental gratuita*).
   - *TERMINOLOGIA OBRIGATÓRIA*: NUNCA use a palavra "dojo", utilize sempre "escola" (ou "unidade", "tatame").
   - Sempre dê de 1 a 2 opções adequadas ao contexto:
     * *Opção 1: Direta e Calorosa* (rápida, simpática e humanizada, perfeita para WhatsApp dinâmico).
     * *Opção 2: Focada em Valor & Contorno de Objeções* (contextualizada, educativa, destacando a transformação antes do preço).
3. *Regras de Ouro do Atendimento Kihap*:
   - *Objetivo Número 1: Agendar Aula Experimental Gratuita*: A mágica da Kihap acontece quando a família ou o aluno pisa no tatame e vivencia a energia, o carinho dos professores e a segurança da escola. O foco de toda resposta é sempre convidar para a aula experimental sem compromisso!
   - *Objeção de Preço ("Quanto custa a mensalidade?", "Qual o valor?")*:
     * NUNCA passe apenas uma tabela fria de preços sem acolher e entender o objetivo do aluno primeiro.
     * Acolha calorosamente, pergunte quem vai praticar (idade) e se já tem alguma experiência, explique que os planos são personalizados de acordo com os objetivos e a frequência, e proponha a aula experimental gratuita para vivenciar a metodologia no tatame antes de qualquer decisão.
   - *Programas por Faixa Etária*:
     * *Baby Littles (1,5 a 3 anos)*: Desenvolvimento psicomotor e vínculo familiar.
     * *Littles (3 a 6 anos)*: Foco em coordenação motora, respeito, socialização, gasto de energia positiva e disciplina lúdica e divertida.
     * *Kids (7 a 12 anos)*: Autoconfiança, foco nos estudos, respeito, superação de timidez, prevenção ao bullying e defesa pessoal.
     * *Teens (13 a 17 anos)*: Condicionamento, descompressão de telas, liderança, comunidade saudável e autoestima.
     * *Adultos*: Alívio do estresse do dia a dia, condicionamento, flexibilidade e autodefesa em um ambiente super seguro para quem está começando do absoluto zero (sem risco de lesões).
   - *Finalize Sempre com uma Pergunta Aberta Convidativa*:
     * Facilite a resposta do lead (ex: "Qual período fica melhor para vocês: manhã, tarde ou noite?", "Ele(a) já praticou alguma atividade antes ou seria a primeira vez?", "Qual unidade fica mais perto para você: Asa Sul, Centro ou Coqueiros?").
4. *Dica Estratégica Rápida*:
   - Após as opções de texto, adicione um breve comentário estratégico com 1 ou 2 dicas de atendimento (ex: timing de envio, áudio vs texto, como criar rapport).
5. *Integração com Ferramentas do CRM*:
   - Se o usuário mencionar o nome de um lead cadastrado (ex: "o que respondo para a Taina?", "veja o lead Gustavo"), use ativamente *searchProspects* e *getProspectDetails* para consultar a unidade, fase do funil, canal de origem (ex: Chatbot Miles, Site, Meta) e histórico de contatos antes de formular a resposta.

Aqui estão algumas seções principais da intranet que você pode guiar os colaboradores a encontrar:
- *Início/Painel*: Tela inicial com visão geral.
- *Alunos*: Cadastro e acompanhamento de alunos (/intranet/alunos.html).
- *Marketing*:
  - *Prospecção*: Funil de vendas / CRM (/intranet/prospeccao.html).
  - *Redes Sociais (Meta Ads)*: Dashboard de campanhas e métricas (/intranet/marketing-social.html).
  - *Google Ads*: Métricas de Google Ads (/intranet/marketing-google.html).
- *Administrativo*:
  - *Projetos*: Gerenciador de tarefas e projetos (/intranet/projetos.html).
  - *Processos*: Biblioteca de manuais e POPs (/intranet/processos.html).
  - *Pedidos*: Pedidos de doboks, faixas, etc. (/intranet/pedidos.html).
- *RH*: Setor de recursos humanos, recrutamento e seleção (/intranet/rh.html).
- *Chat*: Comunicação interna em tempo real (/intranet/chat.html).
- *Cursos / Tatame*: Treinamentos e aulas (/intranet/cursos.html).
- *Feed*: Comunicados internos (/intranet/feed.html).

Para ajudar de maneira profunda e com dados em tempo real da intranet, você tem acesso a ferramentas integradas ao banco de dados:
- Alunos: você pode pesquisar alunos (*searchStudents*) e ver a ficha completa de um aluno (*getStudentProfile*), incluindo histórico de testes físicos, cursos liberados e informações cadastrais.
- Demandas (Trello): você pode pesquisar demandas (*searchDemands*) e ver detalhes de uma demanda específica (*getDemandDetails*), que traz inclusive notas internas e comentários.
- CRM/Prospects: você pode pesquisar leads (*searchProspects*) e ver os detalhes completos de um prospect específico (*getProspectDetails*), incluindo o histórico completo de contatos/follow-ups e as observações.
- Loja e Pedidos: você pode pesquisar produtos (*searchStoreProducts*), ver preços/estoque (*getStoreProductDetails*), pesquisar transações de venda (*searchStoreSales*) e ver detalhes de pedidos de faixas/doboks (*searchStoreOrders*, *getStoreOrderDetails*).
- **Business Intelligence e Métricas da Kihap Store (*getStoreBusinessIntelligence*)**: você tem acesso analítico completo ao BI de vendas da loja (*getStoreBusinessIntelligence*). SEMPRE utilize esta ferramenta quando perguntarem sobre faturamento total, ticket médio, número de vendas, taxa de aprovação, rankings de unidades, instrutores com mais vendas, produtos e categorias mais vendidos, formas de pagamento, ou especificamente sobre **qual graduação ou faixa mais compra produtos na store**! Ao responder, traga análises ricas com números exatos (faturamento em R$, volume de vendas, ticket médio, percentual de participação), destaque as faixas líderes em quantidade e faturamento, e forneça insights estratégicos positivos e orientados ao crescimento da escola Kihap.
- Planificadores de Aula: você pode pesquisar planificadores (*searchLessonPlans*) e ver o detalhamento completo de um plano (*getLessonPlanDetails*), incluindo objetivos, blocos/semanas e links de vídeos do YouTube para instrutores e professores.

Use essas ferramentas ativamente quando o usuário solicitar informações sobre alunos, trello/demandas, prospects/leads, produtos, vendas e pedidos da loja, BI da Store, ou planificadores de aula.`;

const KOBE_TOOLS = [{
    functionDeclarations: [
        {
            name: "getProspectsSummary",
            description: "Retorna o total de prospects cadastrados na base de dados da Kihap e as quantidades em cada status/fase do funil.",
            parameters: {
                type: "OBJECT",
                properties: {}
            }
        },
        {
            name: "searchProspects",
            description: "Busca leads/prospects cadastrados no CRM do funil de marketing/vendas por termo parcial (responsável, empresa, e-mail, telefone, setor).",
            parameters: {
                type: "OBJECT",
                properties: {
                    query: {
                        type: "STRING",
                        description: "Termo de busca (nome do responsável, empresa, e-mail, telefone, setor)."
                    }
                },
                required: ["query"]
            }
        },
        {
            name: "getProspectDetails",
            description: "Retorna todos os dados detalhados de um lead/prospect específico por ID, incluindo o histórico completo de contatos (contactLog) e observações.",
            parameters: {
                type: "OBJECT",
                properties: {
                    prospectId: {
                        type: "STRING",
                        description: "O ID do documento do prospect."
                    }
                },
                required: ["prospectId"]
            }
        },
        {
            name: "searchStudents",
            description: "Busca estudantes/alunos cadastrados no sistema por nome, e-mail ou ID. Retorna uma lista resumida.",
            parameters: {
                type: "OBJECT",
                properties: {
                    query: {
                        type: "STRING",
                        description: "Termo de busca (nome, e-mail ou ID parcial) para encontrar os alunos."
                    }
                },
                required: ["query"]
            }
        },
        {
            name: "getStudentProfile",
            description: "Retorna o perfil detalhado de um aluno específico pelo seu ID (idMember), incluindo dados cadastrais, histórico de testes físicos, cursos permitidos, emblemas e informações financeiras do Mercado Pago.",
            parameters: {
                type: "OBJECT",
                properties: {
                    studentId: {
                        type: "INTEGER",
                        description: "O ID numérico do aluno (idMember) para obter os detalhes."
                    },
                    unitId: {
                        type: "STRING",
                        description: "O ID da unidade do aluno (ex: 'centro', 'coqueiros', etc.). Opcional."
                    }
                },
                required: ["studentId"]
            }
        },
        {
            name: "getTasksSummary",
            description: "Retorna o resumo de planos e tarefas cadastrados na base de dados da intranet.",
            parameters: {
                type: "OBJECT",
                properties: {}
            }
        },
        {
            name: "getDepartmentDemands",
            description: "Busca as demandas/tarefas em aberto do Trello da intranet, opcionalmente filtrando por setor/departamento (como 'rh', 'financeiro', 'comercial', 'juridico', etc.).",
            parameters: {
                type: "OBJECT",
                properties: {
                    department: {
                        type: "STRING",
                        description: "Nome do setor/departamento para filtrar as demandas (opcional)."
                    }
                }
            }
        },
        {
            name: "searchDemands",
            description: "Busca demandas (tarefas do painel/Trello da intranet) por palavra-chave no título ou descrição.",
            parameters: {
                type: "OBJECT",
                properties: {
                    query: {
                        type: "STRING",
                        description: "Termo de busca para encontrar demandas no título ou descrição."
                    }
                },
                required: ["query"]
            }
        },
        {
            name: "getDemandDetails",
            description: "Busca os detalhes completos de uma demanda específica por seu ID do documento, incluindo o histórico completo de comentários e notas internas.",
            parameters: {
                type: "OBJECT",
                properties: {
                    demandId: {
                        type: "STRING",
                        description: "O ID do documento da demanda."
                    }
                },
                required: ["demandId"]
            }
        },
        {
            name: "searchStoreProducts",
            description: "Busca produtos cadastrados no catálogo da loja por termo parcial (nome, categoria ou descrição).",
            parameters: {
                type: "OBJECT",
                properties: {
                    query: {
                        type: "STRING",
                        description: "Termo de busca para encontrar produtos no catálogo (ex: 'dobok', 'camiseta')."
                    }
                },
                required: ["query"]
            }
        },
        {
            name: "getStoreProductDetails",
            description: "Retorna os detalhes completos de um produto específico da loja pelo seu ID.",
            parameters: {
                type: "OBJECT",
                properties: {
                    productId: {
                        type: "STRING",
                        description: "O ID do documento do produto."
                    }
                },
                required: ["productId"]
            }
        },
        {
            name: "searchStoreSales",
            description: "Busca no log de transações/vendas realizadas na loja por termo parcial (nome do comprador, e-mail, CPF, unidade ou nome do produto).",
            parameters: {
                type: "OBJECT",
                properties: {
                    query: {
                        type: "STRING",
                        description: "Termo de busca (nome, e-mail, CPF, unidade ou produto)."
                    }
                },
                required: ["query"]
            }
        },
        {
            name: "getStoreSaleDetails",
            description: "Retorna o detalhamento completo de uma transação/venda específica pelo ID da venda, incluindo dados do pagador, itens e status do pedido.",
            parameters: {
                type: "OBJECT",
                properties: {
                    saleId: {
                        type: "STRING",
                        description: "O ID do documento da venda/inscrição."
                    }
                },
                required: ["saleId"]
            }
        },
        {
            name: "searchStoreOrders",
            description: "Busca pedidos de uniformes e graduações (faixas coloridas, faixas pretas e doboks) nas coleções correspondentes por aluno, unidade ou status.",
            parameters: {
                type: "OBJECT",
                properties: {
                    query: {
                        type: "STRING",
                        description: "Termo de busca (nome do aluno, unidade ou status do pedido como 'Pendente', 'Entregue')."
                    }
                },
                required: ["query"]
            }
        },
        {
            name: "getStoreOrderDetails",
            description: "Retorna a ficha detalhada de um pedido específico por ID e tipo do pedido.",
            parameters: {
                type: "OBJECT",
                properties: {
                    orderId: {
                        type: "STRING",
                        description: "O ID do documento do pedido."
                    },
                    orderType: {
                        type: "STRING",
                        description: "O tipo do pedido: 'faixa' (para faixas coloridas), 'faixapreta' (para faixas pretas) ou 'dobok' (para doboks).",
                        enum: ["faixa", "faixapreta", "dobok"]
                    }
                },
                required: ["orderId", "orderType"]
            }
        },
        {
            name: "createSupportTicket",
            description: "Cria um ticket de suporte na intranet quando o usuário relata um problem, dúvida, ou solicita ajuda técnica.",
            parameters: {
                type: "OBJECT",
                properties: {
                    title: {
                        type: "STRING",
                        description: "Resumo curto do problema ou solicitação."
                    },
                    description: {
                        type: "STRING",
                        description: "Descrição detalhada do problema."
                    },
                    priority: {
                        type: "STRING",
                        description: "Prioridade do ticket: 'Baixa', 'Média', 'Alta', ou 'Urgente'."
                    }
                },
                required: ["title", "description", "priority"]
            }
        },
        {
            name: "searchLessonPlans",
            description: "Busca nos planificadores de aula da Kihap por palavra-chave (ex: 'Defesas', 'Chute semicircular', 'Littles', 'Kids', 'Aquecimento', 'Tipo A') ou por categoria/programa.",
            parameters: {
                type: "OBJECT",
                properties: {
                    query: {
                        type: "STRING",
                        description: "Termo de busca para encontrar planos de aula (título, técnica, aquecimento ou conteúdo)."
                    },
                    category: {
                        type: "STRING",
                        description: "Categoria/Tipo do plano (opcional: 'A', 'B' ou 'C')."
                    }
                }
            }
        },
        {
            name: "getLessonPlanDetails",
            description: "Retorna o detalhamento completo de um planificador de aula por ID ou por busca de título, contendo todos os blocos pedagógicos, semanas, instruções e os links de vídeos do YouTube.",
            parameters: {
                type: "OBJECT",
                properties: {
                    planId: {
                        type: "STRING",
                        description: "O ID do documento do plano de aula (opcional se fornecer query)."
                    },
                    query: {
                        type: "STRING",
                        description: "Título ou termo de busca do plano para localizar os detalhes quando o ID não for conhecido."
                    }
                }
            }
        },
        {
            name: "getStoreBusinessIntelligence",
            description: "Retorna a inteligência de negócios (Business Intelligence & BI) da Kihap Store em tempo real com métricas analíticas agregadas: faturamento total, quantidade de vendas, ticket médio, taxa de aprovação, ranking de vendas e faturamento por GRADUAÇÃO/FAIXA (responde com precisão qual graduação mais compra produtos), ranking por UNIDADE, ranking por INSTRUTOR/PROFESSOR, ranking por PRODUTO e CATEGORIA, formas de pagamento (PIX, Cartão, Boleto) e tendências temporais.",
            parameters: {
                type: "OBJECT",
                properties: {
                    period: {
                        type: "STRING",
                        description: "Período da análise: '30_days' (últimos 30 dias, padrão), 'this_month' (mês atual), 'last_month' (mês anterior), '90_days' (últimos 90 dias), 'this_year' (ano atual) ou 'all' (todo o histórico).",
                        enum: ["30_days", "this_month", "last_month", "90_days", "this_year", "all"]
                    },
                    unit: {
                        type: "STRING",
                        description: "Filtro opcional por unidade (ex: 'asa-sul', 'coqueiros', 'centro', etc.)."
                    },
                    instructor: {
                        type: "STRING",
                        description: "Filtro opcional por nome do instrutor ou professor."
                    },
                    graduation: {
                        type: "STRING",
                        description: "Filtro opcional por faixa/graduação do aluno (ex: 'Faixa Branca', '1BD', 'Faixa Azul', etc.)."
                    },
                    status: {
                        type: "STRING",
                        description: "Filtro por status da transação: 'approved_only' (apenas vendas pagas/concluídas, padrão), 'all' (todas) ou 'pending' (somente pendentes).",
                        enum: ["approved_only", "all", "pending"]
                    }
                }
            }
        }
    ]
}];

// --- KOBE BACKEND FUNCTIONS ---

async function getStoreBusinessIntelligenceBackend(args = {}) {
    const {
        period = '30_days',
        unit = '',
        instructor = '',
        graduation = '',
        status: statusFilter = 'approved_only'
    } = args;

    try {
        let salesSnap;
        try {
            salesSnap = await db.collection('inscricoesFaixaPreta').orderBy('created', 'desc').limit(600).get();
        } catch (e) {
            salesSnap = await db.collection('inscricoesFaixaPreta').limit(600).get();
        }
        const sales = [];
        salesSnap.forEach(d => sales.push({ id: d.id, ...d.data() }));

        let products = [];
        try {
            const prodSnap = await db.collection('products').limit(150).get();
            prodSnap.forEach(d => products.push({ id: d.id, ...d.data() }));
        } catch (e) {
            console.warn('[Kobe Backend BI] Erro ao carregar produtos:', e);
        }

        const getSaleDate = (s) => {
            if (!s || !s.created) return null;
            if (typeof s.created.toDate === 'function') return s.created.toDate();
            if (s.created instanceof Date) return s.created;
            const parsed = new Date(s.created);
            return isNaN(parsed.getTime()) ? null : parsed;
        };

        const getSaleAmountCents = (s) => {
            if (s.amountTotal !== undefined && s.amountTotal !== null) return parseInt(s.amountTotal, 10) || 0;
            if (s.amount !== undefined && s.amount !== null) {
                const val = parseFloat(s.amount);
                return val < 1000 ? val * 100 : val;
            }
            if (s.totalAmount !== undefined && s.totalAmount !== null) return parseInt(s.totalAmount, 10) || 0;
            return 0;
        };

        const getSaleGrad = (s) => {
            const g = s.userGraduacao || s.graduacao || s.faixa || s.chosenVariant || s.variationName;
            if (g && String(g).trim() !== '') return String(g).trim();
            return 'Venda Direta / Sem Faixa';
        };

        const getSaleCat = (s) => {
            if (!s) return 'Outros / Gerais';
            if (s.category && String(s.category).trim() !== '') return String(s.category).trim();
            if (s.productCategory && String(s.productCategory).trim() !== '') return String(s.productCategory).trim();
            const prodName = s.productName || s.title || s.name || '';
            const norm = (str) => String(str || '').trim().toLowerCase();

            if (products.length > 0) {
                const found = products.find(p => 
                    (s.productId && p.id === s.productId) || 
                    (s.product_id && p.id === s.product_id) || 
                    (prodName && (norm(p.name) === norm(prodName) || norm(p.title) === norm(prodName) || norm(p.nome) === norm(prodName)))
                );
                if (found && (found.category || found.categoria)) {
                    const c = found.category || found.categoria;
                    if (String(c).trim() !== '') return String(c).trim();
                }
            }

            const lower = prodName.toLowerCase();
            if (lower.includes('graduaç') || lower.includes('exame') || lower.includes('1bd') || lower.includes('2bd') || lower.includes('3bd')) return 'Graduação';
            if (lower.includes('experience') || lower.includes('torneio') || lower.includes('evento') || lower.includes('campeonato')) return 'Eventos & Experiências';
            if (lower.includes('equipamento') || lower.includes('dobok') || lower.includes('protetor') || lower.includes('luva') || lower.includes('canela') || lower.includes('capacete') || lower.includes('faixa')) return 'Equipamentos & Uniformes';
            if (lower.includes('curso') || lower.includes('treinamento') || lower.includes('seminario')) return 'Cursos & Treinamentos';
            return 'Outros / Gerais';
        };

        const getPayMethod = (s) => {
            let raw = '';
            if (s.paymentDetails) {
                raw = s.paymentDetails.method || s.paymentDetails.paymentMethodId || s.paymentDetails.paymentTypeId || s.paymentDetails.payment_method_id || '';
            }
            if (!raw) {
                raw = s.paymentMethod || s.paymentType || s.payment_method_id || s.payment_type_id || '';
            }
            const lower = String(raw).toLowerCase().trim();
            if (lower.includes('pix') || lower.includes('bank_transfer')) return 'PIX';
            if (lower.includes('credit') || lower.includes('card') || lower === 'visa' || lower === 'master' || lower === 'elo' || lower === 'amex' || lower === 'hipercard') return 'Cartão de Crédito';
            if (lower.includes('debit') || lower === 'debvisa' || lower === 'debmaster') return 'Cartão de Débito';
            if (lower.includes('ticket') || lower.includes('boleto') || lower.includes('bolbradesco')) return 'Boleto Bancário';
            if (lower.includes('account_money') || lower.includes('saldo')) return 'Saldo Mercado Pago';
            if (lower.includes('cash') || lower.includes('dinheiro') || lower.includes('especie')) return 'Dinheiro / Espécie';
            if (s.saleType === 'manual') return 'Venda Manual';
            if (!raw) return 'Mercado Pago (Outros)';
            return raw.charAt(0).toUpperCase() + raw.slice(1);
        };

        const now = new Date();
        let startDateLimit = null;
        let endDateLimit = null;
        let periodLabel = 'Últimos 30 Dias';

        if (period === 'this_month') {
            startDateLimit = new Date(now.getFullYear(), now.getMonth(), 1);
            periodLabel = 'Mês Atual';
        } else if (period === 'last_month') {
            startDateLimit = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            endDateLimit = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
            periodLabel = 'Mês Anterior';
        } else if (period === '30_days') {
            startDateLimit = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
            periodLabel = 'Últimos 30 Dias';
        } else if (period === '90_days') {
            startDateLimit = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000));
            periodLabel = 'Últimos 90 Dias';
        } else if (period === 'this_year') {
            startDateLimit = new Date(now.getFullYear(), 0, 1);
            periodLabel = 'Ano Atual';
        } else if (period === 'all') {
            periodLabel = 'Todo o Histórico';
        }

        const normStr = (val) => String(val || '').toLowerCase().trim();

        const filtered = sales.filter(s => {
            const date = getSaleDate(s);
            if (startDateLimit && (!date || date < startDateLimit)) return false;
            if (endDateLimit && (!date || date > endDateLimit)) return false;

            const u = normStr(s.userUnit || s.unit || s.unidade);
            if (unit && !u.includes(normStr(unit))) return false;

            const inst = normStr(s.userProfessor || s.professor || s.selectedProfessor || s.instructor);
            if (instructor && !inst.includes(normStr(instructor))) return false;

            const g = normStr(getSaleGrad(s));
            if (graduation && !g.includes(normStr(graduation))) return false;

            const st = (s.paymentStatus || '').toLowerCase();
            if (statusFilter === 'approved_only') {
                if (st !== 'paid' && st !== 'approved' && st !== 'pago' && st !== 'concluido') return false;
            } else if (statusFilter === 'pending') {
                if (st !== 'pending' && st !== 'aguardando') return false;
            }

            return true;
        });

        const totalSalesCount = filtered.length;
        const totalRevenueCents = filtered.reduce((acc, s) => acc + getSaleAmountCents(s), 0);
        const totalRevenue = totalRevenueCents / 100;
        const avgTicket = totalSalesCount > 0 ? totalRevenue / totalSalesCount : 0;

        const paidSalesCount = filtered.filter(s => {
            const st = (s.paymentStatus || '').toLowerCase();
            return st === 'paid' || st === 'approved' || st === 'pago' || st === 'concluido';
        }).length;
        const approvalRate = totalSalesCount > 0 ? Math.round((paidSalesCount / totalSalesCount) * 100) : 0;

        const gradAgg = {};
        const unitAgg = {};
        const instAgg = {};
        const prodAgg = {};
        const catAgg = {};
        const payAgg = {};
        const dowRevenue = [0, 0, 0, 0, 0, 0, 0];
        const dowDays = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

        filtered.forEach(s => {
            const amt = getSaleAmountCents(s) / 100;

            const g = getSaleGrad(s);
            if (!gradAgg[g]) gradAgg[g] = { count: 0, revenue: 0 };
            gradAgg[g].count += 1;
            gradAgg[g].revenue += amt;

            const u = s.userUnit || s.unit || s.unidade || 'Outras Unidades';
            if (!unitAgg[u]) unitAgg[u] = { count: 0, revenue: 0 };
            unitAgg[u].count += 1;
            unitAgg[u].revenue += amt;

            const inst = s.userProfessor || s.professor || s.selectedProfessor || s.instructor || 'Venda Direta';
            if (!instAgg[inst]) instAgg[inst] = { count: 0, revenue: 0 };
            instAgg[inst].count += 1;
            instAgg[inst].revenue += amt;

            const pName = s.productName || 'Produto Geral';
            const cName = getSaleCat(s);
            if (!prodAgg[pName]) prodAgg[pName] = { count: 0, revenue: 0, category: cName };
            prodAgg[pName].count += 1;
            prodAgg[pName].revenue += amt;

            if (!catAgg[cName]) catAgg[cName] = { count: 0, revenue: 0 };
            catAgg[cName].count += 1;
            catAgg[cName].revenue += amt;

            if (s.recommendedItems && Array.isArray(s.recommendedItems)) {
                s.recommendedItems.forEach(item => {
                    const rName = item.productName || 'Item Extra';
                    const rPrice = (item.price || 0) * (item.quantity || 1);
                    const rCat = getSaleCat({ productName: rName, ...item });
                    if (!prodAgg[rName]) prodAgg[rName] = { count: 0, revenue: 0, category: rCat };
                    prodAgg[rName].count += (item.quantity || 1);
                    prodAgg[rName].revenue += rPrice;

                    if (!catAgg[rCat]) catAgg[rCat] = { count: 0, revenue: 0 };
                    catAgg[rCat].count += (item.quantity || 1);
                    catAgg[rCat].revenue += rPrice;
                });
            }

            const pm = getPayMethod(s);
            if (!payAgg[pm]) payAgg[pm] = { count: 0, revenue: 0 };
            payAgg[pm].count += 1;
            payAgg[pm].revenue += amt;

            const d = getSaleDate(s);
            if (d) {
                dowRevenue[d.getDay()] += amt;
            }
        });

        const fmtCurrency = (val) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        const sortedGraduations = Object.entries(gradAgg).map(([gName, data]) => ({
            graduation: gName,
            salesCount: data.count,
            percentOfSales: totalSalesCount > 0 ? `${((data.count / totalSalesCount) * 100).toFixed(1)}%` : '0%',
            revenue: data.revenue,
            revenueFormatted: fmtCurrency(data.revenue),
            percentOfRevenue: totalRevenue > 0 ? `${((data.revenue / totalRevenue) * 100).toFixed(1)}%` : '0%',
            avgTicketFormatted: data.count > 0 ? fmtCurrency(data.revenue / data.count) : 'R$ 0,00'
        })).sort((a, b) => b.salesCount - a.salesCount || b.revenue - a.revenue);

        const sortedUnits = Object.entries(unitAgg).map(([uName, data]) => ({
            unit: uName,
            salesCount: data.count,
            revenue: data.revenue,
            revenueFormatted: fmtCurrency(data.revenue),
            percentOfRevenue: totalRevenue > 0 ? `${((data.revenue / totalRevenue) * 100).toFixed(1)}%` : '0%',
            avgTicketFormatted: data.count > 0 ? fmtCurrency(data.revenue / data.count) : 'R$ 0,00'
        })).sort((a, b) => b.revenue - a.revenue);

        const sortedInstructors = Object.entries(instAgg).map(([iName, data]) => ({
            instructor: iName,
            salesCount: data.count,
            revenue: data.revenue,
            revenueFormatted: fmtCurrency(data.revenue),
            percentOfRevenue: totalRevenue > 0 ? `${((data.revenue / totalRevenue) * 100).toFixed(1)}%` : '0%',
            avgTicketFormatted: data.count > 0 ? fmtCurrency(data.revenue / data.count) : 'R$ 0,00'
        })).sort((a, b) => b.revenue - a.revenue);

        const sortedProducts = Object.entries(prodAgg).map(([pName, data]) => ({
            productName: pName,
            category: data.category,
            unitsSold: data.count,
            revenue: data.revenue,
            revenueFormatted: fmtCurrency(data.revenue)
        })).sort((a, b) => b.revenue - a.revenue);

        const sortedCategories = Object.entries(catAgg).map(([cName, data]) => ({
            category: cName,
            salesCount: data.count,
            revenue: data.revenue,
            revenueFormatted: fmtCurrency(data.revenue),
            percentOfRevenue: totalRevenue > 0 ? `${((data.revenue / totalRevenue) * 100).toFixed(1)}%` : '0%'
        })).sort((a, b) => b.revenue - a.revenue);

        const paymentMethods = Object.entries(payAgg).map(([pMethod, data]) => ({
            method: pMethod,
            salesCount: data.count,
            revenue: data.revenue,
            revenueFormatted: fmtCurrency(data.revenue),
            percentOfRevenue: totalRevenue > 0 ? `${((data.revenue / totalRevenue) * 100).toFixed(1)}%` : '0%'
        })).sort((a, b) => b.revenue - a.revenue);

        let maxDowIdx = 0;
        let maxDowVal = 0;
        dowRevenue.forEach((rev, idx) => {
            if (rev > maxDowVal) {
                maxDowVal = rev;
                maxDowIdx = idx;
            }
        });

        const topGraduationBySales = sortedGraduations[0] || null;
        const topGraduationByRevenue = [...sortedGraduations].sort((a, b) => b.revenue - a.revenue)[0] || null;

        return {
            periodLabel,
            totalSalesCount,
            totalRevenueFormatted: fmtCurrency(totalRevenue),
            avgTicketFormatted: fmtCurrency(avgTicket),
            approvalRate: `${approvalRate}%`,
            topGraduationBySales: topGraduationBySales ? `${topGraduationBySales.graduation} (${topGraduationBySales.salesCount} vendas, ${topGraduationBySales.percentOfSales})` : 'N/A',
            topGraduationByRevenue: topGraduationByRevenue ? `${topGraduationByRevenue.graduation} (${topGraduationByRevenue.revenueFormatted}, ${topGraduationByRevenue.percentOfRevenue})` : 'N/A',
            graduationsRanking: sortedGraduations.slice(0, 8),
            unitsRanking: sortedUnits.slice(0, 6),
            instructorsRanking: sortedInstructors.slice(0, 6),
            productsRanking: sortedProducts.slice(0, 6),
            categoriesRanking: sortedCategories.slice(0, 6),
            paymentMethodsRanking: paymentMethods,
            bestDayOfWeek: dowDays[maxDowIdx],
            message: `Análise de BI da Kihap Store para o período '${periodLabel}' realizada com sucesso.`
        };
    } catch (e) {
        console.error("[Kobe Backend] Erro no BI da Store:", e);
        return { error: e.message };
    }
}

// --- KOBE BACKEND FUNCTIONS ---

async function getProspectsSummaryBackend() {
    try {
        const snapshot = await db.collection('prospects').limit(150).get();
        const count = snapshot.size;
        
        const stats = {};
        snapshot.forEach(doc => {
            const data = doc.data();
            const phase = data.phase || data.status || 'Não Definido';
            stats[phase] = (stats[phase] || 0) + 1;
        });

        return {
            total: count,
            fases: stats,
            message: `Temos um total de ${count} prospects cadastrados na base (amostra de 150).`
        };
    } catch (e) {
        console.error("Erro ao buscar resumo de prospects:", e);
        return { error: e.message };
    }
}

async function searchProspectsBackend(args) {
    const { query: searchQuery } = args;
    if (!searchQuery) return { error: "Query não fornecida para busca." };
    try {
        const prospectsRef = db.collection('prospects');
        const lowerQuery = searchQuery.trim().toLowerCase();
        const cleanQuery = searchQuery.replace(/\D/g, '');
        
        const queryPromises = [];
        
        if (cleanQuery.length === 11 || cleanQuery.length === 14) {
            queryPromises.push(prospectsRef.where('cpf', '==', cleanQuery).get());
            if (cleanQuery.length === 11) {
                const formattedCpf = `${cleanQuery.slice(0,3)}.${cleanQuery.slice(3,6)}.${cleanQuery.slice(6,9)}-${cleanQuery.slice(9)}`;
                queryPromises.push(prospectsRef.where('cpf', '==', formattedCpf).get());
            }
        }
        
        if (lowerQuery.includes('@')) {
            queryPromises.push(prospectsRef.where('email', '==', searchQuery.trim()).get());
            queryPromises.push(prospectsRef.where('email', '==', lowerQuery).get());
        }
        
        queryPromises.push(prospectsRef.limit(500).get());
        
        const snapshots = await Promise.all(queryPromises);
        const resultsMap = new Map();
        
        snapshots.forEach(snapshot => {
            snapshot.forEach(doc => {
                resultsMap.set(doc.id, { id: doc.id, ...doc.data() });
            });
        });
        
        const results = [];
        resultsMap.forEach((data, id) => {
            const company = (data.empresa || '').toLowerCase();
            const resp = (data.responsavel || '').toLowerCase();
            const email = (data.email || '').toLowerCase();
            const phone = (data.telefone || '').toLowerCase();
            const sector = (data.setor || '').toLowerCase();
            const cpf = (data.cpf || '').toLowerCase();
            
            const cleanCpfInDb = cpf.replace(/\D/g, '');
            const cleanPhoneInDb = phone.replace(/\D/g, '');
            
            const matchesCompany = company.includes(lowerQuery);
            const matchesResp = resp.includes(lowerQuery);
            const matchesEmail = email.includes(lowerQuery);
            const matchesSector = sector.includes(lowerQuery);
            const matchesCpf = cpf.includes(lowerQuery) || (cleanQuery.length >= 4 && cleanCpfInDb.includes(cleanQuery));
            const matchesPhone = phone.includes(lowerQuery) || (cleanQuery.length >= 4 && cleanPhoneInDb.includes(cleanQuery));
            
            if (matchesCompany || matchesResp || matchesEmail || matchesSector || matchesCpf || matchesPhone) {
                results.push({
                    id: id,
                    empresa: data.empresa || 'Sem Empresa',
                    responsavel: data.responsavel || 'Sem Responsável',
                    email: data.email || '',
                    telefone: data.telefone || '',
                    fase: data.phase || data.status || 'Contato Inicial',
                    prioridade: data.prioridade || 'Média'
                });
            }
        });
        
        return {
            query: searchQuery,
            results: results.slice(0, 15),
            countFound: results.length,
            message: `Busca concluída. Encontramos ${results.length} prospects.`
        };
    } catch (e) {
        console.error("Erro ao buscar prospects:", e);
        return { error: e.message };
    }
}

async function getProspectDetailsBackend(args) {
    const { prospectId } = args;
    if (!prospectId) return { error: "prospectId não fornecido." };
    try {
        const docSnap = await db.collection('prospects').doc(prospectId).get();
        if (!docSnap.exists) {
            return { error: `Prospect com ID ${prospectId} não encontrado.` };
        }
        
        const data = docSnap.data();
        const logs = (data.contactLog || []).map(log => ({
            author: log.author || 'Usuário',
            description: log.description || '',
            timestamp: log.timestamp || ''
        }));
        
        return {
            id: docSnap.id,
            empresa: data.empresa || 'Sem Empresa',
            responsavel: data.responsavel || 'Sem Responsável',
            setor: data.setor || '',
            telefone: data.telefone || '',
            email: data.email || '',
            prioridade: data.prioridade || 'Média',
            ticketEstimado: data.ticketEstimado || '',
            origemLead: data.origemLead || '',
            cpf: data.cpf || '',
            cnpj: data.cnpj || '',
            endereco: data.endereco || '',
            redesSociais: data.redesSociais || '',
            siteAtual: data.siteAtual || '',
            observacoes: data.observacoes || '',
            contactLog: logs,
            fase: data.phase || data.status || 'Contato Inicial'
        };
    } catch (e) {
        console.error("Erro ao buscar detalhes do prospect:", e);
        return { error: e.message };
    }
}

async function searchStudentsBackend(args) {
    const { query: searchQuery } = args;
    if (!searchQuery) return { error: "Query não fornecida para busca." };
    try {
        const snapshot = await db.collection('evo_students').get();
        const students = [];
        snapshot.forEach(doc => {
            const d = doc.data();
            d.idMember = d.idMember || doc.id;
            students.push(d);
        });
        
        const lowerQuery = searchQuery.toLowerCase();
        let matchedStudents = students.filter(s => {
            const fullName = `${s.firstName || ''} ${s.lastName || ''}`.toLowerCase();
            const idStr = String(s.idMember || '');
            return fullName.includes(lowerQuery) || idStr.includes(lowerQuery);
        });

        const results = matchedStudents.slice(0, 15).map(s => ({
            idMember: s.idMember,
            name: `${s.firstName || ''} ${s.lastName || ''}`,
            email: s.contacts?.find(c => c.contactType === 'E-mail' || c.idContactType === 4)?.description || 'Sem e-mail',
            phone: s.contacts?.find(c => c.contactType === 'Telefone' || c.idContactType === 1)?.description || 'Sem telefone',
            branchName: s.branchName || 'Centro',
            belt: s.belt || 'N/A',
            tuitionStatus: s.tuitionStatus || 'N/A'
        }));

        return {
            query: searchQuery,
            results: results,
            countFound: matchedStudents.length,
            message: `Busca finalizada. Encontramos ${matchedStudents.length} correspondentes.`
        };
    } catch (e) {
        console.error("Erro ao buscar alunos:", e);
        return { error: e.message };
    }
}

async function getStudentProfileBackend(args) {
    const { studentId, unitId } = args;
    if (!studentId) return { error: "studentId não fornecido." };
    
    try {
        const idNum = parseInt(studentId, 10);
        let studentDoc = await db.collection('evo_students').doc(String(studentId)).get();
        if (!studentDoc.exists) {
            const altSnap = await db.collection('evo_students').where('idMember', '==', idNum).limit(1).get();
            if (altSnap.empty) {
                return { error: `Aluno com ID ${studentId} não encontrado.` };
            }
            studentDoc = altSnap.docs[0];
        }
        
        const student = studentDoc.data();
        const resolvedUnitId = unitId || student.unitId || 'all';

        let userDoc = null;
        try {
            const uSnap = await db.collection("users").where("evoMemberId", "==", idNum).get();
            if (!uSnap.empty) {
                const docData = uSnap.docs[0].data();
                userDoc = {
                    id: uSnap.docs[0].id,
                    isAdmin: docData.isAdmin || false,
                    isInstructor: docData.isInstructor || false,
                    isSuporte: docData.isSuporte || false,
                    earnedBadges: docData.earnedBadges || [],
                    accessibleContent: docData.accessibleContent || []
                };
            }
        } catch (err) {
            console.warn("Erro ao buscar usuário no Firestore:", err);
        }

        let physicalTests = [];
        try {
            const tSnap = await db.collection("physicalTests").where("evoMemberId", "==", idNum).orderBy("date", "desc").get();
            tSnap.forEach(d => {
                const data = d.data();
                physicalTests.push({
                    date: data.date?.toDate?.()?.toLocaleDateString('pt-BR') || data.date || '',
                    score: data.score
                });
            });
        } catch (err) {
            console.warn("Erro ao buscar testes físicos:", err);
        }

        let financeInfo = {
            tuitionStatus: student.tuitionStatus || 'N/A',
            registeredAt: student.createdAt ? (student.createdAt.toDate ? student.createdAt.toDate().toISOString() : student.createdAt) : '',
            mpDetails: student.mpPreapprovalId ? {
                id: student.mpPreapprovalId,
                status: student.tuitionStatus || ''
            } : null
        };

        return {
            student: {
                idMember: student.idMember,
                name: `${student.firstName || ''} ${student.lastName || ''}`,
                email: student.contacts?.find(c => c.contactType === 'E-mail' || c.idContactType === 4)?.description || student.email || '',
                phone: student.phone || student.contacts?.find(c => c.contactType === 'Telefone' || c.idContactType === 1)?.description || '',
                cpf: student.cpf || student.document || '',
                birthDate: student.birthDate || '',
                registerDate: student.registerDate || '',
                address: student.address || '',
                responsible: student.responsible || '',
                origin: student.origin || '',
                branchName: student.branchName || '',
                rankType: student.rankType || '',
                belt: student.belt || '',
                membershipStatus: student.membershipStatus || student.tuitionStatus || 'N/A'
            },
            userDoc,
            physicalTests,
            financialHub: financeInfo
        };
    } catch (e) {
        console.error("Erro ao montar perfil do estudante:", e);
        return { error: e.message };
    }
}

async function getTasksSummaryBackend() {
    try {
        const snapshot = await db.collection('plans').get();
        const count = snapshot.size;
        const stats = {};
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const status = data.status || 'Pendente';
            stats[status] = (stats[status] || 0) + 1;
        });

        return {
            totalPlans: count,
            statusDistribution: stats,
            message: `Encontramos ${count} planos cadastrados na base.`
        };
    } catch (e) {
        console.error("Erro ao buscar resumo de planos/tarefas:", e);
        return { error: e.message };
    }
}

async function getDepartmentDemandsBackend(args) {
    const { department } = args;
    try {
        const snapshot = await db.collection('trello_demands').limit(100).get();
        const results = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const dept = (data.department || data.setor || '').toLowerCase();
            if (!department || dept.includes(department.toLowerCase())) {
                results.push({
                    title: data.title || data.titulo || 'Sem Título',
                    status: data.status || 'Pendente',
                    department: data.department || data.setor || 'Geral',
                    description: data.description || data.demanda || data.descricao || ''
                });
            }
        });

        return {
            departmentRequested: department || 'Todos',
            totalDemands: results.length,
            demands: results.slice(0, 10),
            message: `Busca por demandas finalizada. ${results.length} encontradas.`
        };
    } catch (e) {
        console.error("Erro ao buscar demandas:", e);
        return { error: e.message };
    }
}

async function searchDemandsBackend(args) {
    const { query: searchQuery } = args;
    if (!searchQuery) return { error: "Query não fornecida para busca." };
    try {
        const snapshot = await db.collection('trello_demands').limit(150).get();
        const results = [];
        const lowerQuery = searchQuery.toLowerCase();
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const title = (data.title || data.titulo || '').toLowerCase();
            const desc = (data.description || data.demanda || '').toLowerCase();
            const dept = (data.department || data.setor || '').toLowerCase();
            
            if (title.includes(lowerQuery) || desc.includes(lowerQuery) || dept.includes(lowerQuery)) {
                results.push({
                    id: doc.id,
                    title: data.title || data.titulo || 'Sem Título',
                    status: data.status || 'Pendente',
                    priority: data.priority || 'Média',
                    department: data.department || data.setor || 'Geral',
                    nomeSolicitante: data.nome || 'Sem Nome'
                });
            }
        });
        
        return {
            query: searchQuery,
            results: results.slice(0, 15),
            countFound: results.length,
            message: `Busca finalizada. Encontramos ${results.length} demandas.`
        };
    } catch (e) {
        console.error("Erro ao buscar demandas:", e);
        return { error: e.message };
    }
}

async function getDemandDetailsBackend(args) {
    const { demandId } = args;
    if (!demandId) return { error: "demandId não fornecido." };
    try {
        const docSnap = await db.collection('trello_demands').doc(demandId).get();
        if (!docSnap.exists) {
            return { error: `Demanda com ID ${demandId} não encontrada.` };
        }
        
        const data = docSnap.data();
        const commentsSnap = await db.collection(`trello_demands/${demandId}/comments`).orderBy('createdAt', 'asc').get();
        const comments = [];
        commentsSnap.forEach(d => {
            const c = d.data();
            comments.push({
                author: c.authorName || 'Usuário',
                text: c.text || '',
                createdAt: c.createdAt?.toDate?.()?.toLocaleString('pt-BR') || c.createdAt || ''
            });
        });
        
        return {
            id: docSnap.id,
            title: data.title || data.titulo || 'Sem Título',
            description: data.description || data.demanda || '',
            status: data.status || 'Pendente',
            priority: data.priority || 'Média',
            department: data.department || data.setor || 'Geral',
            createdBy: data.nome || 'Sem Nome',
            email: data.email || '',
            unidade: data.unidade || '',
            createdAt: data.createdAt?.toDate?.()?.toLocaleString('pt-BR') || data.createdAt || '',
            dataMaxima: data.dataMaxima || '',
            links: data.linkRefs || [],
            comments: comments
        };
    } catch (e) {
        console.error("Erro ao obter detalhes da demanda:", e);
        return { error: e.message };
    }
}

async function searchStoreProductsBackend(args) {
    const { query: searchQuery } = args;
    if (!searchQuery) return { error: "Query não fornecida para busca." };
    try {
        const snapshot = await db.collection('products').limit(150).get();
        const results = [];
        const lowerQuery = searchQuery.toLowerCase();
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const name = (data.name || '').toLowerCase();
            const cat = (data.category || '').toLowerCase();
            const desc = (data.description || '').toLowerCase();
            
            if (name.includes(lowerQuery) || cat.includes(lowerQuery) || desc.includes(lowerQuery)) {
                results.push({
                    id: doc.id,
                    name: data.name || 'Sem Nome',
                    category: data.category || 'Geral',
                    price: data.price ? data.price / 100 : 0,
                    visible: data.visible !== false,
                    available: data.available !== false,
                    stockQuantity: data.stockQuantity || 0
                });
            }
        });
        
        return {
            query: searchQuery,
            results: results.slice(0, 15),
            countFound: results.length,
            message: `Busca no catálogo concluída. ${results.length} produtos correspondentes encontrados.`
        };
    } catch (e) {
        console.error("Erro ao buscar produtos da loja:", e);
        return { error: e.message };
    }
}

async function getStoreProductDetailsBackend(args) {
    const { productId } = args;
    if (!productId) return { error: "productId não fornecido." };
    try {
        const docSnap = await db.collection('products').doc(productId).get();
        if (!docSnap.exists) {
            return { error: `Produto com ID ${productId} não encontrado.` };
        }
        
        const data = docSnap.data();
        
        return {
            id: docSnap.id,
            name: data.name || '',
            category: data.category || 'Geral',
            description: data.description || '',
            imageUrl: data.imageUrl || null,
            priceType: data.priceType || 'fixed',
            price: data.price ? data.price / 100 : 0,
            priceVariants: (data.priceVariants || []).map(v => ({ name: v.name, price: v.price / 100 })),
            lotes: (data.lotes || []).map(l => ({ name: l.name, price: l.price / 100, startDate: l.startDate || '' })),
            kitItems: data.kitItems || [],
            visible: data.visible !== false,
            available: data.available !== false,
            controlStock: data.controlStock || false,
            stockQuantity: data.stockQuantity || 0,
            sizeStock: data.sizeStock || {},
            isSubscription: data.isSubscription || false,
            isEvent: data.isEvent || false,
            eventAddress: data.eventAddress || '',
            eventConfig: data.eventConfig || null,
            addons: (data.addons || []).map(a => ({ name: a.name, price: a.price / 100 }))
        };
    } catch (e) {
        console.error("Erro ao obter detalhes do produto:", e);
        return { error: e.message };
    }
}

async function searchStoreSalesBackend(args) {
    const { query: searchQuery } = args;
    if (!searchQuery) return { error: "Query não fornecida para busca de vendas." };
    try {
        const salesRef = db.collection('inscricoesFaixaPreta');
        const lowerQuery = searchQuery.trim().toLowerCase();
        const cleanQuery = searchQuery.replace(/\D/g, '');
        
        const queryPromises = [];
        
        if (cleanQuery.length === 11 || cleanQuery.length === 14) {
            queryPromises.push(salesRef.where('userCpf', '==', cleanQuery).get());
            if (cleanQuery.length === 11) {
                const formattedCpf = `${cleanQuery.slice(0,3)}.${cleanQuery.slice(3,6)}.${cleanQuery.slice(6,9)}-${cleanQuery.slice(9)}`;
                queryPromises.push(salesRef.where('userCpf', '==', formattedCpf).get());
            }
        }
        
        if (lowerQuery.includes('@')) {
            queryPromises.push(salesRef.where('userEmail', '==', searchQuery.trim()).get());
            queryPromises.push(salesRef.where('userEmail', '==', lowerQuery).get());
        }
        
        queryPromises.push(salesRef.orderBy('created', 'desc').limit(500).get());
        
        const snapshots = await Promise.all(queryPromises);
        const resultsMap = new Map();
        
        snapshots.forEach(snapshot => {
            snapshot.forEach(doc => {
                resultsMap.set(doc.id, { id: doc.id, ...doc.data() });
            });
        });
        
        const results = [];
        resultsMap.forEach((data, id) => {
            const clientName = (data.userName || '').toLowerCase();
            const payerName = (data.payerName || '').toLowerCase();
            const email = (data.userEmail || '').toLowerCase();
            const phone = (data.userPhone || '').toLowerCase();
            const cpf = (data.userCpf || '').toLowerCase();
            const prodName = (data.productName || '').toLowerCase();
            const unit = (data.userUnit || '').toLowerCase();
            
            const cleanCpfInDb = cpf.replace(/\D/g, '');
            const cleanPhoneInDb = phone.replace(/\D/g, '');
            
            const matchesName = clientName.includes(lowerQuery) || payerName.includes(lowerQuery);
            const matchesEmail = email.includes(lowerQuery);
            const matchesProd = prodName.includes(lowerQuery);
            const matchesUnit = unit.includes(lowerQuery);
            const matchesCpf = cpf.includes(lowerQuery) || (cleanQuery.length >= 4 && cleanCpfInDb.includes(cleanQuery));
            const matchesPhone = phone.includes(lowerQuery) || (cleanQuery.length >= 4 && cleanPhoneInDb.includes(cleanQuery));
            
            if (matchesName || matchesEmail || matchesProd || matchesUnit || matchesCpf || matchesPhone) {
                results.push({
                    id: id,
                    userName: data.userName || 'N/A',
                    userEmail: data.userEmail || '',
                    productName: data.productName || '',
                    amountTotal: data.amountTotal ? data.amountTotal / 100 : 0,
                    paymentStatus: data.paymentStatus || 'pending',
                    fulfillmentStatus: data.fulfillmentStatus || 'pending',
                    created: data.created?.toDate?.()?.toLocaleString('pt-BR') || data.created || '',
                    saleType: data.saleType || 'online'
                });
            }
        });
        
        return {
            query: searchQuery,
            results: results.slice(0, 15),
            countFound: results.length,
            message: `Busca de vendas concluída. Encontramos ${results.length} transações.`
        };
    } catch (e) {
        console.error("Erro ao buscar transações de vendas:", e);
        return { error: e.message };
    }
}

async function getStoreSaleDetailsBackend(args) {
    const { saleId } = args;
    if (!saleId) return { error: "saleId não fornecido." };
    try {
        const docSnap = await db.collection('inscricoesFaixaPreta').doc(saleId).get();
        if (!docSnap.exists) {
            return { error: `Venda com ID ${saleId} não encontrada.` };
        }
        
        const data = docSnap.data();
        const logsSnap = await db.collection('inscricoesFaixaPreta').doc(saleId).collection('emailLogs').limit(50).get();
        const emailLogs = [];
        logsSnap.forEach(d => {
            const log = d.data();
            emailLogs.push({
                type: log.type || '',
                sentAt: log.sentAt?.toDate?.()?.toLocaleString('pt-BR') || log.sentAt || '',
                status: log.status || 'success'
            });
        });
        
        return {
            id: docSnap.id,
            saleType: data.saleType || 'online',
            userName: data.userName || '',
            payerName: data.payerName || '',
            userEmail: data.userEmail || '',
            userPhone: data.userPhone || '',
            userCpf: data.userCpf || '',
            userUnit: data.userUnit || '',
            productName: data.productName || '',
            amountTotal: data.amountTotal ? data.amountTotal / 100 : 0,
            paymentStatus: data.paymentStatus || 'pending',
            fulfillmentStatus: data.fulfillmentStatus || 'pending',
            created: data.created?.toDate?.()?.toLocaleString('pt-BR') || data.created || '',
            details: data.details || '',
            paymentDetails: data.paymentDetails || {},
            items: data.items || [],
            recommendedItems: data.recommendedItems || [],
            emailLogs: emailLogs
        };
    } catch (e) {
        console.error("Erro ao obter detalhes da venda:", e);
        return { error: e.message };
    }
}

async function searchStoreOrdersBackend(args) {
    const { query: searchQuery } = args;
    if (!searchQuery) return { error: "Query não fornecida para busca." };
    try {
        const lowerQuery = searchQuery.toLowerCase();
        const results = [];
        
        // 1. pedidosFaixas
        try {
            const snap = await db.collection("pedidosFaixas").get();
            snap.forEach(d => {
                const data = d.data();
                const unit = (data.unidade || '').toLowerCase();
                const sol = (data.solicitante?.nome || '').toLowerCase();
                const status = (data.status || '').toLowerCase();
                const itemsSummary = (data.itens || []).map(i => `${i.quantidade}x ${i.faixa}`).join(', ').toLowerCase();
                
                if (unit.includes(lowerQuery) || sol.includes(lowerQuery) || status.includes(lowerQuery) || itemsSummary.includes(lowerQuery)) {
                    results.push({
                        id: d.id,
                        orderType: 'faixa',
                        unidade: data.unidade || '',
                        solicitante: data.solicitante?.nome || '',
                        aluno: 'Diversos (Coloridas)',
                        itensResumo: (data.itens || []).map(i => `${i.quantidade}x ${i.faixa} (${i.tamanho})`).join(', '),
                        status: data.status || 'Pendente',
                        data: data.data?.toDate?.()?.toLocaleString('pt-BR') || data.data || ''
                    });
                }
            });
        } catch (err) {
            console.error("Erro ao ler pedidosFaixas:", err);
        }
        
        // 2. pedidosFaixasPretas
        try {
            const snap = await db.collection("pedidosFaixasPretas").get();
            snap.forEach(d => {
                const data = d.data();
                const unit = (data.unidade || '').toLowerCase();
                const aluno = (data.aluno || '').toLowerCase();
                const status = (data.status || '').toLowerCase();
                const faixa = (data.faixa || '').toLowerCase();
                
                if (unit.includes(lowerQuery) || aluno.includes(lowerQuery) || status.includes(lowerQuery) || faixa.includes(lowerQuery)) {
                    results.push({
                        id: d.id,
                        orderType: 'faixapreta',
                        unidade: data.unidade || '',
                        solicitante: data.solicitante?.nome || '',
                        aluno: data.aluno || '',
                        itensResumo: `${data.faixa || 'Faixa Preta'} (${data.tamanho || ''})`,
                        status: data.status || 'Pendente',
                        data: data.data?.toDate?.()?.toLocaleString('pt-BR') || data.data || ''
                    });
                }
            });
        } catch (err) {
            console.error("Erro ao ler pedidosFaixasPretas:", err);
        }
        
        // 3. pedidosDoboks
        try {
            const snap = await db.collection("pedidosDoboks").get();
            snap.forEach(d => {
                const data = d.data();
                const unit = (data.unidade || '').toLowerCase();
                const aluno = (data.aluno || '').toLowerCase();
                const status = (data.status || '').toLowerCase();
                
                if (unit.includes(lowerQuery) || aluno.includes(lowerQuery) || status.includes(lowerQuery)) {
                    results.push({
                        id: d.id,
                        orderType: 'dobok',
                        unidade: data.unidade || '',
                        solicitante: data.solicitante?.nome || '',
                        aluno: data.aluno || '',
                        itensResumo: `Dobok ${data.isFaixaPreta ? 'Faixa Preta' : 'Comum'} (Tam: ${data.tamanho || ''}, Colarinho: ${data.colarinho || ''})`,
                        status: data.status || 'Pendente',
                        data: data.data?.toDate?.()?.toLocaleString('pt-BR') || data.data || ''
                    });
                }
            });
        } catch (err) {
            console.error("Erro ao ler pedidosDoboks:", err);
        }
        
        return {
            query: searchQuery,
            results: results.slice(0, 20),
            countFound: results.length,
            message: `Busca finalizada. Encontramos ${results.length} pedidos correspondentes.`
        };
    } catch (e) {
        console.error("Erro ao buscar pedidos:", e);
        return { error: e.message };
    }
}

async function getStoreOrderDetailsBackend(args) {
    const { orderId, orderType } = args;
    if (!orderId || !orderType) return { error: "orderId e orderType são obrigatórios." };
    
    try {
        let collectionName = '';
        if (orderType === 'faixa') collectionName = 'pedidosFaixas';
        else if (orderType === 'faixapreta') collectionName = 'pedidosFaixasPretas';
        else if (orderType === 'dobok') collectionName = 'pedidosDoboks';
        else return { error: `Tipo de pedido inválido: ${orderType}` };
        
        const docSnap = await db.collection(collectionName).doc(orderId).get();
        if (!docSnap.exists) {
            return { error: `Pedido com ID ${orderId} não encontrado na coleção ${collectionName}.` };
        }
        
        const data = docSnap.data();
        
        return {
            id: docSnap.id,
            orderType: orderType,
            unidade: data.unidade || '',
            status: data.status || 'Pendente',
            justificativa: data.justificativa || null,
            data: data.data?.toDate?.()?.toLocaleString('pt-BR') || data.data || '',
            solicitante: data.solicitante || null,
            lastUpdatedBy: data.lastUpdatedBy || null,
            lastUpdatedAt: data.lastUpdatedAt?.toDate?.()?.toLocaleString('pt-BR') || data.lastUpdatedAt || '',
            itens: data.itens || null,
            aluno: data.aluno || null,
            faixa: data.faixa || null,
            tamanho: data.tamanho || null,
            colarinho: data.colarinho || null,
            isFaixaPreta: data.isFaixaPreta || null
        };
    } catch (e) {
        console.error("Erro ao obter detalhes do pedido:", e);
        return { error: e.message };
    }
}

async function createSupportTicketBackend(args, customerPhone, customerName) {
    const { title, description, priority } = args;
    if (!title || !description || !priority) return { error: "Parâmetros incompletos." };
    try {
        const solicitanteNome = customerName || 'Usuário WhatsApp';
        const solicitanteEmail = `whatsapp-${customerPhone}@kihap.com.br`;

        const deptsRef = db.collection('trello_departments');
        const snap = await deptsRef.where('name', '==', 'Suporte').get();
        let deptId = null;
        if (!snap.empty) {
            deptId = snap.docs[0].id;
        } else {
            const newDeptRef = await deptsRef.add({
                name: 'Suporte',
                color: '#06b6d4',
                columns: [
                    { id: 'todo', title: 'Novos / Pendentes', color: 'gray' },
                    { id: 'doing', title: 'Em Análise', color: 'blue' },
                    { id: 'done', title: 'Resolvidos', color: 'green' }
                ]
            });
            deptId = newDeptRef.id;
        }

        const docRef = await db.collection('trello_demands').add({
            titulo: `[${priority}] ${title}`,
            demanda: `${description}\n\n**Solicitado via Kobe (WhatsApp) por:** ${solicitanteNome} (${customerPhone})\n**Prioridade:** ${priority}`,
            nome: solicitanteNome,
            unidade: 'N/A',
            departamentoId: deptId,
            status: 'todo',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            priority: priority,
            tags: ['Suporte', 'Kobe WhatsApp'],
            solicitanteEmail: solicitanteEmail,
            solicitanteUid: `whatsapp:${customerPhone}`
        });

        return { success: true, message: "Ticket de suporte criado com sucesso no departamento de Suporte.", ticketId: docRef.id };
    } catch (e) {
        console.error("Erro ao criar ticket de suporte via Kobe:", e);
        return { error: e.message };
    }
}

async function searchLessonPlansBackend(args) {
    const { query: searchQuery, category } = args;
    try {
        const snapshot = await db.collection('plans').get();
        const results = [];
        const lowerQuery = (searchQuery || '').toLowerCase();
        const upperCategory = (category || '').toUpperCase();

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const title = (data.title || '').toLowerCase();
            const planCat = (data.category || 'A').toUpperCase();
            const author = (data.authorName || '').toLowerCase();
            let contentText = (data.content || '').toLowerCase();

            if (data.blocks && Array.isArray(data.blocks)) {
                data.blocks.forEach(b => {
                    contentText += ' ' + (b.title || '').toLowerCase();
                    if (b.content) contentText += ' ' + b.content.toLowerCase();
                    if (b.contents) {
                        contentText += ' ' + (b.contents.w1 || '').toLowerCase();
                        contentText += ' ' + (b.contents.w2 || '').toLowerCase();
                        contentText += ' ' + (b.contents.w3 || '').toLowerCase();
                        contentText += ' ' + (b.contents.w4 || '').toLowerCase();
                    }
                });
            }

            const categoryMatch = !upperCategory || planCat === upperCategory;
            const queryMatch = !lowerQuery || title.includes(lowerQuery) || contentText.includes(lowerQuery) || author.includes(lowerQuery);

            if (categoryMatch && queryMatch) {
                const mediaVideos = (data.media || []).filter(m => m.type === 'youtube' || (m.url && (m.url.includes('youtube') || m.url.includes('youtu.be'))));
                results.push({
                    id: docSnap.id,
                    title: data.title || 'Sem Título',
                    category: data.category || 'A',
                    layout: data.layout || 'simple',
                    authorName: data.authorName || 'Desconhecido',
                    hasVideos: mediaVideos.length > 0,
                    videoCount: mediaVideos.length,
                    summarySnippet: contentText.substring(0, 150) + '...'
                });
            }
        });

        return {
            query: searchQuery || '',
            category: category || '',
            results: results.slice(0, 10),
            countFound: results.length,
            message: `Busca nos planificadores concluída. ${results.length} planos encontrados.`
        };
    } catch (e) {
        console.error("[Kobe Backend] Erro ao buscar planificadores:", e);
        return { error: e.message };
    }
}

async function getLessonPlanDetailsBackend(args) {
    const { planId, query: searchQuery } = args;
    try {
        let docSnap;
        if (planId) {
            docSnap = await db.collection('plans').doc(planId).get();
        } else if (searchQuery) {
            const snapshot = await db.collection('plans').get();
            const lower = searchQuery.toLowerCase();
            snapshot.forEach(d => {
                if (!docSnap && (d.data().title || '').toLowerCase().includes(lower)) {
                    docSnap = d;
                }
            });
        }

        if (!docSnap || !docSnap.exists) {
            return { error: `Planificador de aula não encontrado.` };
        }

        const data = docSnap.data();
        const mediaVideos = (data.media || [])
            .map(m => {
                let url = m.url || '';
                if (m.type === 'youtube' && m.videoId && !url) {
                    url = `https://www.youtube.com/watch?v=${m.videoId}`;
                }
                return {
                    name: m.name || 'Vídeo demonstrativo',
                    type: m.type || 'youtube',
                    url: url
                };
            });

        let blocksFormatted = [];
        if (data.blocks && Array.isArray(data.blocks)) {
            blocksFormatted = data.blocks.map(b => {
                if (data.layout === 'grid') {
                    return {
                        title: b.title || '',
                        style: b.style || 'normal',
                        unified: b.unified || false,
                        semanas: b.contents || {}
                    };
                } else {
                    return {
                        title: b.title || '',
                        content: b.content || ''
                    };
                }
            });
        }

        return {
            id: docSnap.id,
            title: data.title || '',
            category: data.category || 'A',
            layout: data.layout || 'simple',
            authorName: data.authorName || 'Desconhecido',
            weeks: data.weeks || [],
            blocks: blocksFormatted,
            contentHtmlOrText: data.content || null,
            mediaVideos: mediaVideos,
            videoLinksForUser: mediaVideos.map(v => `${v.name}: ${v.url}`).join('\n'),
            message: `Planificador '${data.title}' obtido com sucesso.`
        };
    } catch (e) {
        console.error("[Kobe Backend] Erro ao obter detalhes do planificador:", e);
        return { error: e.message };
    }
}

async function callGeminiKobe(history, apiKey) {
    const response = await axios.post(`${GEMINI_API_BASE}?key=${apiKey}`, {
        contents: history,
        systemInstruction: {
            parts: [{ text: KOBE_SYSTEM_INSTRUCTION }]
        },
        tools: KOBE_TOOLS,
        generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 2048
        }
    }, {
        headers: { 'Content-Type': 'application/json' }
    });
    return response.data;
}

function getAvailableUnits() {
    return {
        success: true,
        unidades: [
            { key: 'asa-sul', nome: 'Asa Sul (Brasília)' },
            { key: 'lago-sul', nome: 'Lago Sul (Brasília)' },
            { key: 'sudoeste', nome: 'Sudoeste (Brasília)' },
            { key: 'noroeste', nome: 'Noroeste (Brasília)' },
            { key: 'jardim-botanico', nome: 'Jardim Botânico (Brasília)' },
            { key: 'pontos-de-ensino', nome: 'Pontos de Ensino (Brasília)' },
            { key: 'centro', nome: 'Centro (Florianópolis)' },
            { key: 'coqueiros', nome: 'Coqueiros (Florianópolis)' },
            { key: 'santa-monica', nome: 'Santa Mônica (Florianópolis)' },
            { key: 'dourados', nome: 'Dourados (MS)' }
        ]
    };
}

function detectUnitFromText(text) {
    if (!text || typeof text !== 'string') return null;
    const lower = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    // Unidades de Brasília
    if (lower.includes('asa sul')) return { unidade: 'Asa Sul', unidadeKey: 'asa-sul', praca: 'Brasília' };
    if (lower.includes('sudoeste')) return { unidade: 'Sudoeste', unidadeKey: 'sudoeste', praca: 'Brasília' };
    if (lower.includes('lago sul')) return { unidade: 'Lago Sul', unidadeKey: 'lago-sul', praca: 'Brasília' };
    if (lower.includes('noroeste')) return { unidade: 'Noroeste', unidadeKey: 'noroeste', praca: 'Brasília' };
    if (lower.includes('jardim botanico')) return { unidade: 'Jardim Botânico', unidadeKey: 'jardim-botanico', praca: 'Brasília' };
    if (lower.includes('pontos de ensino') || lower.includes('ponto de ensino')) return { unidade: 'Pontos de Ensino', unidadeKey: 'pontos-de-ensino', praca: 'Brasília' };
    
    // Unidades de Florianópolis
    if (lower.includes('coqueiros')) return { unidade: 'Coqueiros', unidadeKey: 'coqueiros', praca: 'Florianópolis' };
    if (lower.includes('santa monica') || lower.includes('santa mônica')) return { unidade: 'Santa Mônica', unidadeKey: 'santa-monica', praca: 'Florianópolis' };
    if (lower.includes('centro') && !lower.includes('dourados')) return { unidade: 'Centro', unidadeKey: 'centro', praca: 'Florianópolis' };
    
    // Dourados (MS)
    if (lower.includes('dourados')) return { unidade: 'Dourados', unidadeKey: 'dourados', praca: 'Dourados' };
    
    // Cidades/Praças genéricas
    if (lower.includes('florianopolis') || lower.includes('floripa')) return { unidade: '', unidadeKey: '', praca: 'Florianópolis' };
    if (lower.includes('brasilia') || lower.includes('bsb') || lower.includes('distrito federal')) return { unidade: '', unidadeKey: '', praca: 'Brasília' };

    return null;
}

function inferLocationFromPhone(phone) {
    if (!phone || typeof phone !== 'string') return null;
    const clean = phone.replace(/\D/g, '');
    let ddd = '';
    if (clean.startsWith('55') && clean.length >= 4) {
        ddd = clean.substring(2, 4);
    } else if (clean.length >= 2) {
        ddd = clean.substring(0, 2);
    }

    if (ddd === '67') {
        // Dourados só possui 1 unidade no MS
        return { unidade: 'Dourados', unidadeKey: 'dourados', praca: 'Dourados', inferredByDDD: true };
    }
    if (ddd === '48') {
        return { unidade: '', unidadeKey: '', praca: 'Florianópolis', inferredByDDD: true };
    }
    if (ddd === '61') {
        return { unidade: '', unidadeKey: '', praca: 'Brasília', inferredByDDD: true };
    }
    return null;
}

async function saveLeadBackend(args, customerPhone, existingLeadId = null) {
    const { nome, telefone, programaInteresse, unidade, unidadeKey } = args;
    try {
        let resolvedUnidade = unidade || '';
        let resolvedKey = unidadeKey || '';
        let resolvedPraca = '';

        if (resolvedUnidade) {
            const detected = detectUnitFromText(resolvedUnidade);
            if (detected) {
                if (detected.unidade) resolvedUnidade = detected.unidade;
                if (detected.unidadeKey) resolvedKey = detected.unidadeKey;
                if (detected.praca) resolvedPraca = detected.praca;
            }
        }

        if (!resolvedUnidade && (telefone || customerPhone)) {
            const dddInfo = inferLocationFromPhone(telefone || customerPhone);
            if (dddInfo) {
                if (dddInfo.unidade) resolvedUnidade = dddInfo.unidade;
                if (dddInfo.unidadeKey) resolvedKey = dddInfo.unidadeKey;
                if (dddInfo.praca) resolvedPraca = dddInfo.praca;
            }
        }

        const leadData = {
            ...(nome ? { nome } : {}),
            ...(telefone || customerPhone ? { telefone: telefone || customerPhone } : {}),
            ...(programaInteresse ? { programaInteresse } : {}),
            ...(resolvedUnidade ? { unidade: resolvedUnidade } : {}),
            ...(resolvedKey ? { unidadeKey: resolvedKey } : {}),
            ...(resolvedPraca ? { praca: resolvedPraca } : {}),
            origem: 'Chatbot Miles',
            'origem do lead': 'Chatbot Miles',
            status: 'Novo',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        if (existingLeadId) {
            try {
                await db.collection('leads').doc(existingLeadId).update(leadData);

                if (resolvedUnidade) {
                    notifyUnitManagerOfLead(resolvedUnidade, { ...leadData, nome: nome || '', telefone: telefone || customerPhone || '', programaInteresse, unidade: resolvedUnidade }).catch(() => {});
                }

                return {
                    success: true,
                    leadId: existingLeadId,
                    message: `Lead atualizado com sucesso no CRM! Unidade: ${resolvedUnidade || 'Aguardando definição'}.`
                };
            } catch (err) {
                console.warn(`[Miles WhatsApp] Lead ${existingLeadId} não encontrado para atualizar. Criando novo...`);
            }
        }

        const docRef = await db.collection('leads').add({
            nome: nome || 'Visitante WhatsApp',
            telefone: telefone || customerPhone || '',
            programaInteresse: programaInteresse || '',
            unidade: resolvedUnidade || '',
            unidadeKey: resolvedKey || '',
            praca: resolvedPraca || '',
            origem: 'Chatbot Miles',
            'origem do lead': 'Chatbot Miles',
            status: 'Novo',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        if (resolvedUnidade) {
            notifyUnitManagerOfLead(resolvedUnidade, { ...leadData, nome: nome || '', telefone: telefone || customerPhone || '', programaInteresse, unidade: resolvedUnidade }).catch(() => {});
        }

        return {
            success: true,
            leadId: docRef.id,
            message: `Lead criado com sucesso no CRM! Unidade: ${resolvedUnidade || 'Aguardando definição'}.`
        };
    } catch (e) {
        console.error("[Miles WhatsApp] Erro ao salvar lead:", e);
        return { success: false, error: e.message };
    }
}

async function notifyUnitManagerOfLead(unitIdentifier, leadData) {
    try {
        if (!unitIdentifier) return false;
        let unitKey = (unitIdentifier || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (unitKey.includes('asa sul')) unitKey = 'asa-sul';
        else if (unitKey.includes('sudoeste')) unitKey = 'sudoeste';
        else if (unitKey.includes('lago sul')) unitKey = 'lago-sul';
        else if (unitKey.includes('noroeste')) unitKey = 'noroeste';
        else if (unitKey.includes('jardim botanico')) unitKey = 'jardim-botanico';
        else if (unitKey.includes('pontos de ensino') || unitKey.includes('ponto de ensino')) unitKey = 'pontos-de-ensino';
        else if (unitKey.includes('coqueiros')) unitKey = 'coqueiros';
        else if (unitKey.includes('santa monica')) unitKey = 'santa-monica';
        else if (unitKey.includes('centro') && !unitKey.includes('dourados')) unitKey = 'centro';
        else if (unitKey.includes('dourados')) unitKey = 'dourados';

        const managerPhone = UNIT_MANAGERS[unitKey];
        if (!managerPhone) {
            console.log(`[notifyUnitManagerOfLead] Nenhum telefone de gerente configurado para ${unitIdentifier}`);
            return false;
        }

        const configSnap = await db.collection('public_config').doc('miles').get();
        const configData = configSnap.exists ? configSnap.data() : {};
        const whatsappToken = configData.whatsappToken || WHATSAPP_TOKEN;
        const phoneNumberId = configData.phoneNumberId || PHONE_NUMBER_ID;

        if (!whatsappToken || !phoneNumberId) return false;

        const nome = leadData.nome || 'Visitante';
        const telefone = leadData.telefone || 'Não informado';
        const programa = leadData.programaInteresse || 'Interesse Geral';
        const unidadeNome = leadData.unidade || unitIdentifier;

        const bodyMsg = `🔔 *Novo Lead Kihap - ${unidadeNome}*\n\n👤 *Nome:* ${nome}\n📱 *WhatsApp:* ${telefone}\n🥋 *Interesse:* ${programa}\n📍 *Origem:* ${leadData['origem do lead'] || leadData.origem || 'WhatsApp Miles'}\n\n🔗 *CRM:* https://novokihap.web.app/intranet/prospeccao.html`;

        try {
            await axios.post(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
                messaging_product: "whatsapp",
                to: managerPhone,
                type: "text",
                text: { body: bodyMsg }
            }, {
                headers: {
                    'Authorization': `Bearer ${whatsappToken}`,
                    'Content-Type': 'application/json'
                }
            });
            console.log(`[Miles WhatsApp] Notificação de Novo Lead (Texto) enviada para ${managerPhone} (${unidadeNome})`);
            return true;
        } catch (textErr) {
            console.warn(`[Miles WhatsApp] Envio de texto direto falhou para ${managerPhone}. Tentando template oficial...`, textErr.response?.data || textErr.message);

            await axios.post(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
                messaging_product: "whatsapp",
                to: managerPhone,
                type: "template",
                template: {
                    name: "notificacaoaula",
                    language: { code: "pt_BR" },
                    components: [
                        {
                            type: "body",
                            parameters: [
                                { type: "text", text: nome },
                                { type: "text", text: telefone },
                                { type: "text", text: programa },
                                { type: "text", text: "Novo Lead no CRM" },
                                { type: "text", text: "Aguardando Contato" }
                            ]
                        }
                    ]
                }
            }, {
                headers: {
                    'Authorization': `Bearer ${whatsappToken}`,
                    'Content-Type': 'application/json'
                }
            });
            console.log(`[Miles WhatsApp] Notificação de Novo Lead (Template) enviada para ${managerPhone} (${unidadeNome})`);
            return true;
        }
    } catch (e) {
        console.error('[notifyUnitManagerOfLead] Erro ao notificar unidade:', e.response?.data || e.message);
        return false;
    }
}

async function getScheduleBackend(args) {
    const { unidadeKey, categoria } = args;
    if (!unidadeKey) return { error: 'unidadeKey é obrigatório.' };

    try {
        const templatesQuery = db.collection('classTemplates').where('unitId', '==', unidadeKey);
        const templatesSnap = await templatesQuery.get();
        const templates = [];
        templatesSnap.forEach(d => templates.push({ id: d.id, ...d.data() }));

        const filtered = categoria
            ? templates.filter(t => (t.category || '').toLowerCase() === categoria.toLowerCase())
            : templates;

        if (filtered.length === 0) {
            return {
                success: true,
                aulasDisponiveis: [],
                message: categoria
                    ? `Nenhuma turma de "${categoria}" encontrada na unidade ${unidadeKey}. Mostrando todas as turmas.`
                    : `Nenhuma turma cadastrada para a unidade ${unidadeKey}.`
            };
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(today);
            d.setDate(today.getDate() + i);
            days.push(d);
        }

        const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        const aulasDisponiveis = [];

        function getLocalDateString(date) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }

        for (const day of days) {
            const dayOfWeek = day.getDay();
            const dateStr = getLocalDateString(day);

            for (const template of filtered) {
                if (!template.daysOfWeek || !template.daysOfWeek.includes(dayOfWeek)) continue;

                const instanceId = `${template.id}_${dateStr}`;
                const instanceSnap = await db.collection('classInstances').doc(instanceId).get();

                const studentsMatriculados = (template.students || []).length;
                const trialStudents = instanceSnap.exists ? (instanceSnap.data().trialStudents || []) : [];
                const capacity = template.capacity || 10;
                const vagasUsadas = studentsMatriculados + trialStudents.length;
                const vagasDisponiveis = capacity - vagasUsadas;

                if (vagasDisponiveis <= 0) continue;

                const [h, m] = (template.time || '08:00').split(':');
                const startDate = new Date(day);
                startDate.setHours(parseInt(h), parseInt(m), 0, 0);
                const endDate = new Date(startDate.getTime() + (template.duration || 60) * 60000);
                const horaFim = endDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                aulasDisponiveis.push({
                    instanceId,
                    templateId: template.id,
                    nome: template.name,
                    categoria: template.category || '',
                    professor: template.teacherName,
                    professorId: template.teacherId,
                    data: dateStr,
                    diaSemana: diasSemana[dayOfWeek],
                    horario: `${template.time} - ${horaFim}`,
                    vagasDisponiveis,
                    capacidade: capacity,
                    unitId: unidadeKey
                });
            }
        }

        if (aulasDisponiveis.length === 0) {
            return {
                success: true,
                aulasDisponiveis: [],
                message: 'Nenhuma aula com vagas nos próximos 7 dias. Oriente o visitante a entrar em contato com um atendente.'
            };
        }

        return {
            success: true,
            aulasDisponiveis,
            message: `Encontradas ${aulasDisponiveis.length} aulas. Apresente de forma organizada por dia e pergunte o horário preferido.`
        };

    } catch (e) {
        console.error('[Miles WhatsApp] Erro ao buscar grade:', e);
        return { error: e.message };
    }
}

async function bookTrialClassBackend(args) {
    const { instanceId, templateId, data, unitId, nome, telefone, programa, leadId } = args;
    if (!instanceId || !nome || !telefone) {
        return { error: 'Dados insuficientes para o agendamento.' };
    }

    try {
        const instanceRef = db.collection('classInstances').doc(instanceId);
        const instanceSnap = await instanceRef.get();

        const trialEntry = {
            nome,
            telefone,
            programa: programa || '',
            compareceu: false,
            agendadoEm: new Date()
        };

        if (instanceSnap.exists) {
            const dataDoc = instanceSnap.data();
            const existingTrials = dataDoc.trialStudents || [];
            const templateSnap = await db.collection('classTemplates').doc(templateId).get();
            if (templateSnap.exists) {
                const t = templateSnap.data();
                const vagasUsadas = (t.students || []).length + existingTrials.length;
                if (vagasUsadas >= (t.capacity || 10)) {
                    return { success: false, error: 'Esta aula não possui mais vagas disponíveis. Por favor, escolha outro horário.' };
                }
            }
            await instanceRef.update({
                trialStudents: admin.firestore.FieldValue.arrayUnion(trialEntry)
            });
        } else {
            await instanceRef.set({
                templateId,
                date: data,
                unitId,
                trialStudents: [trialEntry]
            });
        }

        // Notifica o professor responsável
        const templateSnap = await db.collection('classTemplates').doc(templateId).get();
        if (templateSnap.exists) {
            const t = templateSnap.data();
            if (t.teacherId) {
                const [h, m] = (t.time || '00:00').split(':');
                const dataFormatada = new Date(data + 'T12:00:00').toLocaleDateString('pt-BR', {
                    weekday: 'short', day: 'numeric', month: 'numeric'
                });
                try {
                    await db.collection('notifications').add({
                        userId: t.teacherId,
                        type: 'trial',
                        title: 'Aula Experimental Agendada (WhatsApp)',
                        message: `${nome} agendou pelo WhatsApp em ${t.name} — ${dataFormatada} às ${h}:${m}.`,
                        link: '/intranet/grade.html',
                        icon: '/imgs/miles-chatbot.png',
                        read: false,
                        createdAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                } catch (notifErr) {
                    console.error('[Miles WhatsApp] Não foi possível criar a notificação para o professor:', notifErr);
                }
            }
        }

        // Atualiza status do lead para "Aula experimental" no CRM
        if (leadId) {
            try {
                await db.collection('leads').doc(leadId).update({ status: 'Aula experimental' });
            } catch (_) {}
        }

        // Notifica o gerente da unidade via WhatsApp Oficial
        const managerPhone = UNIT_MANAGERS[unitId];
        if (managerPhone) {
            try {
                const configSnap = await db.collection('public_config').doc('miles').get();
                if (configSnap.exists) {
                    const configData = configSnap.data();
                    const whatsappToken = configData.whatsappToken;
                    const phoneNumberId = configData.phoneNumberId;

                    if (whatsappToken && phoneNumberId) {
                        const templateSnap = await db.collection('classTemplates').doc(templateId).get();
                        const t = templateSnap.exists ? templateSnap.data() : null;
                        const className = t ? t.name : 'Aula Experimental';
                        const classTime = t ? t.time : '';
                        
                        const dataFormatada = new Date(data + 'T12:00:00').toLocaleDateString('pt-BR', {
                            weekday: 'long', day: 'numeric', month: 'long'
                        });

                        await axios.post(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
                            messaging_product: "whatsapp",
                            to: managerPhone,
                            type: "template",
                            template: {
                                name: "notificacaoaula",
                                language: {
                                    code: "pt_BR"
                                },
                                components: [
                                    {
                                        type: "body",
                                        parameters: [
                                            { type: "text", text: nome },
                                            { type: "text", text: telefone },
                                            { type: "text", text: programa || className },
                                            { type: "text", text: dataFormatada },
                                            { type: "text", text: classTime || "Horário a combinar" }
                                        ]
                                    }
                                ]
                            }
                        }, {
                            headers: {
                                'Authorization': `Bearer ${whatsappToken}`,
                                'Content-Type': 'application/json'
                            }
                        });
                        console.log(`[Miles WhatsApp] Notificação (Template) enviada para o gerente da unidade ${unitId} (${managerPhone})`);
                    }
                }
            } catch (managerErr) {
                console.error(`[Miles WhatsApp] Erro ao notificar o gerente da unidade ${unitId} via WhatsApp:`, managerErr.response?.data || managerErr.message);
            }
        }

        const dataExibicao = new Date(data + 'T12:00:00').toLocaleDateString('pt-BR', {
            weekday: 'long', day: 'numeric', month: 'long'
        });

        return {
            success: true,
            message: `Aula experimental de ${nome} agendada com sucesso para ${dataExibicao}! O professor foi notificado.`
        };

    } catch (e) {
        console.error('[Miles WhatsApp] Erro no agendamento:', e);
        return { success: false, error: e.message };
    }
}

async function callGeminiMiles(history, apiKey) {
    const response = await axios.post(`${GEMINI_API_BASE}?key=${apiKey}`, {
        contents: history,
        systemInstruction: {
            parts: [{ text: SYSTEM_INSTRUCTION }]
        },
        tools: MILES_TOOLS,
        generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 2048
        }
    }, {
        headers: { 'Content-Type': 'application/json' }
    });
    return response.data;
}

function formatWhatsAppText(text) {
    if (!text) return '';
    return text.replace(/\*\*(.*?)\*\*/g, '*$1*');
}

exports.whatsappWebhook = functions.https.onRequest(async (req, res) => {
    // 1. Validação do Webhook (GET)
    if (req.method === 'GET') {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        if (mode && token) {
            if (mode === 'subscribe' && token === VERIFY_TOKEN) {
                console.log('Webhook do WhatsApp Validado com Sucesso!');
                return res.status(200).send(challenge);
            } else {
                return res.sendStatus(403);
            }
        }
    }

    // 2. Recebimento de Mensagem (POST)
    if (req.method === 'POST') {
        const body = req.body;

        if (body.object && body.entry && body.entry[0].changes && body.entry[0].changes[0].value.messages) {
            const messageData = body.entry[0].changes[0].value.messages[0];
            const contactData = body.entry[0].changes[0].value.contacts[0];

            const customerPhone = messageData.from;
            const customerName = contactData.profile.name || "Visitante";
            
            if (messageData.type === 'text') {
                const messageText = messageData.text.body;
                console.log(`[WhatsApp Webhook] Mensagem de ${customerName} (${customerPhone}): ${messageText}`);

                try {
                    // Carrega chave Gemini dinamicamente do Firestore
                    const configSnap = await db.collection('public_config').doc('miles').get();
                    if (!configSnap.exists) {
                        throw new Error("Chave do Gemini (public_config/miles) não encontrada no Firestore.");
                    }
                    const configData = configSnap.data();
                    const geminiApiKey = configData.geminiKey || configData.apiKey;
                    const whatsappToken = configData.whatsappToken || WHATSAPP_TOKEN;
                    const phoneNumberId = configData.phoneNumberId || PHONE_NUMBER_ID;

                    // Verifica se é um comando de reset ou alteração de modo
                    const cleanText = messageText.trim().toLowerCase();

                    if (cleanText === '/staff') {
                        const chatRef = db.collection('whatsapp_chats').doc(customerPhone);
                        await chatRef.set({
                            mode: 'kobe',
                            history: [],
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        }, { merge: true });

                        console.log(`[WhatsApp Webhook] Conversa de ${customerPhone} alterada para Modo Kobe.`);

                        const replyText = "Olá! Kobe no comando! Sou o assistente virtual oficial de toda a Intranet da Kihap. Como posso ajudar você, colaborador(a), hoje com dúvidas, alunos, tarefas ou suporte? 🚀\n\n(Para voltar a falar com o Miles, envie o comando */miles*)";
                        await axios.post(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
                            messaging_product: "whatsapp",
                            to: customerPhone,
                            type: "text",
                            text: { body: replyText }
                        }, {
                            headers: {
                                'Authorization': `Bearer ${whatsappToken}`,
                                'Content-Type': 'application/json'
                            }
                        });

                        return res.status(200).send('EVENT_RECEIVED');
                    }

                    if (cleanText === '/miles' || cleanText === '/milesbot' || cleanText === '/exit' || cleanText === '/client') {
                        const chatRef = db.collection('whatsapp_chats').doc(customerPhone);
                        await chatRef.set({
                            mode: 'miles',
                            history: [],
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        }, { merge: true });

                        console.log(`[WhatsApp Webhook] Conversa de ${customerPhone} alterada para Modo Miles.`);

                        const replyText = "Miles no comando! Como posso ajudar você a conhecer a Kihap ou a agendar uma aula experimental gratuita hoje?";
                        await axios.post(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
                            messaging_product: "whatsapp",
                            to: customerPhone,
                            type: "text",
                            text: { body: replyText }
                        }, {
                            headers: {
                                'Authorization': `Bearer ${whatsappToken}`,
                                'Content-Type': 'application/json'
                            }
                        });

                        return res.status(200).send('EVENT_RECEIVED');
                    }

                    if (cleanText === '/reset' || cleanText === '/limpar' || cleanText === '/restart') {
                        const chatRef = db.collection('whatsapp_chats').doc(customerPhone);
                        const chatSnap = await chatRef.get();
                        const currentMode = chatSnap.exists ? (chatSnap.data().mode || 'miles') : 'miles';

                        await chatRef.set({
                            history: [],
                            mode: currentMode,
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        }, { merge: true });

                        console.log(`[WhatsApp Webhook] Conversa de ${customerPhone} reiniciada via comando (modo: ${currentMode}).`);

                        const replyText = currentMode === 'kobe'
                            ? "Histórico do Kobe reiniciado com sucesso! Como posso ajudar você, colaborador(a), hoje?"
                            : "Conversa reiniciada com sucesso! Como posso te ajudar hoje?";

                        await axios.post(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
                            messaging_product: "whatsapp",
                            to: customerPhone,
                            type: "text",
                            text: { body: replyText }
                        }, {
                            headers: {
                                'Authorization': `Bearer ${whatsappToken}`,
                                'Content-Type': 'application/json'
                            }
                        });

                        return res.status(200).send('EVENT_RECEIVED');
                    }

                    // Busca histórico da conversa no Firestore
                    const chatRef = db.collection('whatsapp_chats').doc(customerPhone);
                    const chatSnap = await chatRef.get();
                    let history = [];
                    let lastLeadId = null;
                    let mode = 'miles';

                    if (chatSnap.exists) {
                        const dataDoc = chatSnap.data();
                        history = dataDoc.history || [];
                        lastLeadId = dataDoc.lastLeadId || null;
                        mode = dataDoc.mode || 'miles';
                    }

                    // Extração de dados de anúncio (Meta Ads Click-to-WhatsApp Referral) se disponível
                    const referral = messageData.referral || (messageData.context && messageData.context.referral) || null;
                    const ctwaClid = referral?.ctwa_clid || null;
                    const metaAdId = referral?.source_id || null;
                    const metaHeadline = referral?.headline || null;
                    const metaBody = referral?.body || null;

                    // Se a mensagem vier com referência de anúncio do Meta (Click-to-WhatsApp), SEMPRE force o modo Miles!
                    if (referral || ctwaClid || metaAdId) {
                        mode = 'miles';
                    } else if (mode === 'kobe') {
                        // Se o chat estava no modo Kobe, mas a mensagem é claramente de um cliente/visitante buscando informações sobre aulas/preços/matrícula:
                        const leadKeywords = ['aula experimental', 'experimental', 'quanto custa', 'valor da mensalidade', 'qual o valor', 'fazer aula', 'agendar aula', 'grade de horários', 'horario de aula', 'preço', 'matricula', 'inscrição'];
                        const isDirectLeadIntent = leadKeywords.some(kw => cleanText.includes(kw));
                        const isCopilotRequest = cleanText.includes('como respond') || cleanText.includes('o lead') || cleanText.includes('cliente disse') || cleanText.includes('sugir') || cleanText.includes('copiloto') || cleanText.includes('mensagem recebida') || cleanText.includes('ajuda para responder');

                        if (isDirectLeadIntent && !isCopilotRequest) {
                            console.log(`[WhatsApp Webhook] Mensagem de lead detectada no modo Kobe para ${customerPhone}. Alternando para Miles.`);
                            mode = 'miles';
                        }
                    }

                    // Detecção automática de unidade (via anúncio, texto da mensagem ou DDD)
                    let detectedInfo = detectUnitFromText((metaHeadline || '') + ' ' + (metaBody || '') + ' ' + messageText);
                    if (!detectedInfo || !detectedInfo.unidade) {
                        const dddInference = inferLocationFromPhone(customerPhone);
                        if (dddInference) {
                            detectedInfo = {
                                unidade: detectedInfo?.unidade || dddInference.unidade || '',
                                unidadeKey: detectedInfo?.unidadeKey || dddInference.unidadeKey || '',
                                praca: detectedInfo?.praca || dddInference.praca || ''
                            };
                        }
                    }

                    // Cria um lead preliminar no CRM caso ainda não exista (Apenas se estiver no modo Miles)
                    if (mode === 'miles' && !lastLeadId) {
                        try {
                            const initialTags = ['WhatsApp'];
                            if (referral || ctwaClid || metaAdId) initialTags.push('Meta Ads');
                            if (detectedInfo?.praca) initialTags.push(detectedInfo.praca);

                            const originName = (referral || ctwaClid || metaAdId) ? 'Meta Ads WhatsApp' : 'Chatbot Miles';

                            const leadRef = await db.collection('leads').add({
                                nome: customerName || 'Visitante WhatsApp',
                                telefone: customerPhone,
                                status: 'Novo',
                                unidade: detectedInfo?.unidade || '',
                                unidadeKey: detectedInfo?.unidadeKey || '',
                                praca: detectedInfo?.praca || '',
                                'origem do lead': originName,
                                origem: originName,
                                tags: initialTags,
                                ctwaClid: ctwaClid || null,
                                metaAdId: metaAdId || null,
                                metaHeadline: metaHeadline || null,
                                createdAt: admin.firestore.FieldValue.serverTimestamp()
                            });
                            lastLeadId = leadRef.id;
                            console.log(`[WhatsApp Webhook] Lead preliminar criado no CRM para ${customerPhone}: ${lastLeadId} (Unidade: ${detectedInfo?.unidade || 'Pendente'})`);

                            if (detectedInfo?.unidade) {
                                notifyUnitManagerOfLead(detectedInfo.unidade, {
                                    nome: customerName || 'Visitante WhatsApp',
                                    telefone: customerPhone,
                                    unidade: detectedInfo.unidade,
                                    origem: originName
                                }).catch(() => {});
                            }
                        } catch (leadErr) {
                            console.error("[WhatsApp Webhook] Erro ao criar lead preliminar:", leadErr);
                        }
                    } else if (mode === 'miles' && lastLeadId) {
                        // Se o lead já existia, mas o usuário acabou de mencionar uma unidade na mensagem:
                        const msgUnit = detectUnitFromText(messageText);
                        if (msgUnit && msgUnit.unidade) {
                            try {
                                await db.collection('leads').doc(lastLeadId).update({
                                    unidade: msgUnit.unidade,
                                    unidadeKey: msgUnit.unidadeKey || '',
                                    ...(msgUnit.praca ? { praca: msgUnit.praca } : {}),
                                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                                });
                                console.log(`[WhatsApp Webhook] Unidade '${msgUnit.unidade}' auto-atribuída ao lead existente ${lastLeadId}`);

                                notifyUnitManagerOfLead(msgUnit.unidade, {
                                    nome: customerName || 'Visitante WhatsApp',
                                    telefone: customerPhone,
                                    unidade: msgUnit.unidade,
                                    origem: 'Chatbot Miles'
                                }).catch(() => {});
                            } catch (updateErr) {
                                console.warn("[WhatsApp Webhook] Erro ao atualizar unidade no lead existente:", updateErr);
                            }
                        }
                    }

                    // Limita histórico a 20 mensagens para evitar tokens excessivos
                    if (history.length > 20) {
                        history = history.slice(-20);
                    }

                    // Adiciona mensagem do usuário
                    history.push({ role: 'user', parts: [{ text: messageText }] });

                    let responseJson;
                    if (mode === 'kobe') {
                        responseJson = await callGeminiKobe(history, geminiApiKey);
                    } else {
                        responseJson = await callGeminiMiles(history, geminiApiKey);
                    }

                    // Loop de function calling
                    let loops = 0;
                    let finalReplyText = '';

                    while (loops < 5) {
                        const candidate = responseJson.candidates?.[0];
                        const parts = candidate?.content?.parts || [];
                        const funcCalls = parts.filter(p => p.functionCall);

                        if (funcCalls.length === 0) {
                            finalReplyText = parts.find(p => p.text)?.text || 'Desculpe, não entendi.';
                            history.push({ role: 'model', parts: [{ text: finalReplyText }] });
                            break;
                        }

                        history.push({ role: 'model', parts });

                        const responseParts = [];
                        for (const call of funcCalls) {
                            const fnName = call.functionCall.name;
                            const args = call.functionCall.args || {};
                            let result = {};

                            if (mode === 'kobe') {
                                if (fnName === 'getProspectsSummary') {
                                    result = await getProspectsSummaryBackend();
                                } else if (fnName === 'searchProspects') {
                                    result = await searchProspectsBackend(args);
                                } else if (fnName === 'getProspectDetails') {
                                    result = await getProspectDetailsBackend(args);
                                } else if (fnName === 'searchStudents') {
                                    result = await searchStudentsBackend(args);
                                } else if (fnName === 'getStudentProfile') {
                                    result = await getStudentProfileBackend(args);
                                } else if (fnName === 'getTasksSummary') {
                                    result = await getTasksSummaryBackend();
                                } else if (fnName === 'getDepartmentDemands') {
                                    result = await getDepartmentDemandsBackend(args);
                                } else if (fnName === 'searchDemands') {
                                    result = await searchDemandsBackend(args);
                                } else if (fnName === 'getDemandDetails') {
                                    result = await getDemandDetailsBackend(args);
                                } else if (fnName === 'searchStoreProducts') {
                                    result = await searchStoreProductsBackend(args);
                                } else if (fnName === 'getStoreProductDetails') {
                                    result = await getStoreProductDetailsBackend(args);
                                } else if (fnName === 'searchStoreSales') {
                                    result = await searchStoreSalesBackend(args);
                                } else if (fnName === 'getStoreSaleDetails') {
                                    result = await getStoreSaleDetailsBackend(args);
                                } else if (fnName === 'searchStoreOrders') {
                                    result = await searchStoreOrdersBackend(args);
                                } else if (fnName === 'getStoreOrderDetails') {
                                    result = await getStoreOrderDetailsBackend(args);
                                } else if (fnName === 'createSupportTicket') {
                                    result = await createSupportTicketBackend(args, customerPhone, customerName);
                                } else if (fnName === 'searchLessonPlans') {
                                    result = await searchLessonPlansBackend(args);
                                } else if (fnName === 'getLessonPlanDetails') {
                                    result = await getLessonPlanDetailsBackend(args);
                                } else if (fnName === 'getStoreBusinessIntelligence') {
                                    result = await getStoreBusinessIntelligenceBackend(args);
                                } else {
                                    result = { error: 'Função do Kobe desconhecida.' };
                                }
                            } else {
                                if (fnName === 'getAvailableUnits') {
                                    result = getAvailableUnits();
                                } else if (fnName === 'saveLead') {
                                    result = await saveLeadBackend(args, customerPhone, lastLeadId);
                                    if (result.success && result.leadId) {
                                        lastLeadId = result.leadId;
                                    }
                                } else if (fnName === 'getSchedule') {
                                    result = await getScheduleBackend(args);
                                } else if (fnName === 'bookTrialClass') {
                                    if (lastLeadId && !args.leadId) {
                                        args.leadId = lastLeadId;
                                    }
                                    result = await bookTrialClassBackend(args);
                                } else {
                                    result = { error: 'Função desconhecida.' };
                                }
                            }

                            responseParts.push({
                                functionResponse: { name: fnName, response: result }
                            });
                        }

                        history.push({ role: 'user', parts: responseParts });
                        
                        if (mode === 'kobe') {
                            responseJson = await callGeminiKobe(history, geminiApiKey);
                        } else {
                            responseJson = await callGeminiMiles(history, geminiApiKey);
                        }
                        
                        loops++;
                    }

                    if (loops >= 5) {
                        finalReplyText = "Desculpe, tive uma lentidão interna. Poderia repetir ou me dizer qual unidade prefere?";
                    }

                    // Atualiza o histórico e o leadId no Firestore (reseta flag de lembrete e preserva o mode)
                    await chatRef.set({
                        history,
                        lastLeadId,
                        mode,
                        reminderSent: false,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });

                    // Envia resposta formatada de volta para o cliente no WhatsApp
                    const formattedText = formatWhatsAppText(finalReplyText);
                    await axios.post(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
                        messaging_product: "whatsapp",
                        to: customerPhone,
                        type: "text",
                        text: { body: formattedText }
                    }, {
                        headers: {
                            'Authorization': `Bearer ${whatsappToken}`,
                            'Content-Type': 'application/json'
                        }
                    });

                } catch (err) {
                    console.error("[WhatsApp Webhook] Erro fatal:", err.response?.data || err.message);
                }
            }
        }
        return res.status(200).send('EVENT_RECEIVED');
    }

    return res.sendStatus(404);
});

// Agendador de Lembrete de Inatividade (Janela de menos de 24h)
exports.milesInactivityReminder = functions.pubsub.schedule('every 1 hours').onRun(async (context) => {
    console.log('[Miles Reminder] Iniciando verificação de inatividade de leads (janela < 24h)...');

    const now = new Date();
    
    // Filtro para achar inatividade entre 4 e 23 horas
    const minTime = new Date(now.getTime() - 23 * 60 * 60 * 1000); // 23h atrás
    const maxTime = new Date(now.getTime() - 4 * 60 * 60 * 1000);  // 4h atrás

    try {
        // Carrega as credenciais da Meta do Firestore
        const configSnap = await db.collection('public_config').doc('miles').get();
        if (!configSnap.exists) {
            console.error('[Miles Reminder] Configuração public_config/miles não encontrada no Firestore.');
            return null;
        }
        const configData = configSnap.data();
        const whatsappToken = configData.whatsappToken;
        const phoneNumberId = configData.phoneNumberId;

        if (!whatsappToken || !phoneNumberId) {
            console.error('[Miles Reminder] Credenciais do WhatsApp ausentes em public_config/miles.');
            return null;
        }

        // Busca conversas que foram atualizadas na janela [23h, 4h] atrás
        const chatsQuery = db.collection('whatsapp_chats')
            .where('updatedAt', '>=', minTime)
            .where('updatedAt', '<=', maxTime);

        const chatsSnap = await chatsQuery.get();
        console.log(`[Miles Reminder] Encontradas ${chatsSnap.size} conversas atualizadas na janela de tempo.`);

        let sentCount = 0;

        for (const docSnap of chatsSnap.docs) {
            const chatPhone = docSnap.id;
            const chatData = docSnap.data();

            // Pula se já enviamos o lembrete
            if (chatData.reminderSent === true) {
                continue;
            }

            const lastLeadId = chatData.lastLeadId;
            if (!lastLeadId) {
                continue; // Sem lead associado, nada a fazer
            }

            // Verifica o status do lead no CRM
            const leadSnap = await db.collection('leads').doc(lastLeadId).get();
            if (!leadSnap.exists) {
                continue; // Lead foi apagado
            }

            const leadData = leadSnap.data();
            const leadStatus = leadData.status;

            // Só envia lembrete se o lead estiver na coluna 'Novo' (ainda não agendado/contactado)
            if (leadStatus === 'Novo') {
                const leadName = leadData.nome || '';
                const cleanName = leadName.trim() ? leadName.trim().split(' ')[0] : '';
                const salutation = cleanName ? `, ${cleanName}` : '';

                // Mensagem amigável de lembrete
                const reminderText = `Oi${salutation}! 😊 Notei que não finalizamos o agendamento da sua aula experimental gratuita na Kihap. Gostaria de ver os horários disponíveis novamente para escolhermos o seu?`;

                try {
                    // Envia mensagem pelo WhatsApp
                    await axios.post(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
                        messaging_product: "whatsapp",
                        to: chatPhone,
                        type: "text",
                        text: { body: reminderText }
                    }, {
                        headers: {
                            'Authorization': `Bearer ${whatsappToken}`,
                            'Content-Type': 'application/json'
                        }
                    });

                    console.log(`[Miles Reminder] Lembrete enviado com sucesso para ${chatPhone} (Lead ID: ${lastLeadId})`);

                    // Atualiza o histórico do chat com o lembrete enviado e a flag reminderSent
                    const updatedHistory = chatData.history || [];
                    updatedHistory.push({
                        role: 'model',
                        parts: [{ text: reminderText }]
                    });

                    await db.collection('whatsapp_chats').doc(chatPhone).update({
                        history: updatedHistory,
                        reminderSent: true,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });

                    sentCount++;

                } catch (sendErr) {
                    console.error(`[Miles Reminder] Erro ao enviar lembrete para ${chatPhone}:`, sendErr.response?.data || sendErr.message);
                }
            }
        }

        console.log(`[Miles Reminder] Concluído. Lembretes enviados: ${sentCount}`);
        return null;

    } catch (err) {
        console.error('[Miles Reminder] Erro fatal no agendador:', err);
        return null;
    }
});

// Agendador Diário de Mensagem Motivacional do Miles (às 06:00h da manhã BRT)
exports.milesDailyMotivation = functions.pubsub.schedule('0 6 * * *').timeZone('America/Sao_Paulo').onRun(async (context) => {
    console.log('[Miles Daily Motivation] Iniciando envio diário das 06h00...');

    try {
        const configSnap = await db.collection('public_config').doc('miles').get();
        if (!configSnap.exists) {
            console.error('[Miles Daily Motivation] Configuração public_config/miles não encontrada.');
            return null;
        }
        const configData = configSnap.data();
        const whatsappToken = configData.whatsappToken || WHATSAPP_TOKEN;
        const phoneNumberId = configData.phoneNumberId || PHONE_NUMBER_ID;

        // Busca números cadastrados no Firestore
        const recipientsSnap = await db.collection('daily_motivation_recipients').where('active', '==', true).get();
        let targetPhones = [];

        recipientsSnap.forEach(d => {
            const data = d.data();
            if (data.phone) targetPhones.push(data.phone);
        });

        // Fallback: se houver lista no public_config/miles (campo dailyMotivationPhones)
        if (targetPhones.length === 0 && Array.isArray(configData.dailyMotivationPhones)) {
            targetPhones = configData.dailyMotivationPhones;
        }

        if (targetPhones.length === 0) {
            console.log('[Miles Daily Motivation] Nenhum número ativo encontrado para o envio das 06h.');
            return null;
        }

        const motivationalMessages = [
            `🥋 *"Eu posso, eu consigo!"*\n\nBom dia! Que o seu dia comece com foco, energia positiva e a disciplina de um verdadeiro campeão. Vamos pra cima! 🔥\n\n— *Miles / Kihap*`,
            `🥋 *"Eu posso, eu consigo!"*\n\nUm excelente dia pra você! Acredite no seu potencial e dê o seu melhor em cada desafio hoje. 🥋✨\n\n— *Miles / Kihap*`,
            `🥋 *"Eu posso, eu consigo!"*\n\nBom dia! Lembre-se: o respeito, a disciplina e a determinação transformam qualquer dia em uma grande vitória. Tenha um dia incrível! 💪\n\n— *Miles / Kihap*`
        ];

        const messageBody = motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)];

        for (const rawPhone of targetPhones) {
            let cleanPhone = rawPhone.replace(/\D/g, '');
            if (cleanPhone.length >= 10 && cleanPhone.length <= 11) {
                cleanPhone = '55' + cleanPhone;
            }

            // Telefones BR com 13 dígitos (55 + DDD + 9XXXX-XXXX) podem necessitar da variação de 12 dígitos sem o 9 inicial no Meta Cloud API
            const phoneVariations = [cleanPhone];
            if (cleanPhone.length === 13 && cleanPhone.startsWith('55')) {
                const ddd = cleanPhone.slice(2, 4);
                const rest = cleanPhone.slice(5);
                const altPhone = '55' + ddd + rest;
                if (!phoneVariations.includes(altPhone)) {
                    phoneVariations.push(altPhone);
                }
            }

            for (const targetPhone of phoneVariations) {
                try {
                    await axios.post(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
                        messaging_product: "whatsapp",
                        to: targetPhone,
                        type: "text",
                        text: { body: messageBody }
                    }, {
                        headers: {
                            'Authorization': `Bearer ${whatsappToken}`,
                            'Content-Type': 'application/json'
                        }
                    });

                    console.log(`[Miles Daily Motivation] Mensagem motivacional enviada com sucesso para ${targetPhone}`);

                    // Atualiza histórico no chat do WhatsApp
                    const chatRef = db.collection('whatsapp_chats').doc(targetPhone);
                    const chatSnap = await chatRef.get();
                    let history = chatSnap.exists() ? (chatSnap.data().history || []) : [];
                    history.push({ role: 'model', parts: [{ text: messageBody }] });

                    await chatRef.set({
                        history,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });

                    break; // Sucesso na variação de número

                } catch (sendErr) {
                    console.error(`[Miles Daily Motivation] Erro ao enviar para ${targetPhone}:`, sendErr.response?.data || sendErr.message);
                }
            }
        }

    } catch (e) {
        console.error('[Miles Daily Motivation] Erro no agendador motivacional:', e);
    }
    return null;
});

// Registrar número para receber a motivação diária às 06h
exports.registerDailyMotivation = functions.https.onCall(async (data, context) => {
    const phone = data?.phone;
    if (!phone) {
        throw new functions.https.HttpsError('invalid-argument', 'O telefone é obrigatório.');
    }

    const cleanPhone = phone.replace(/\D/g, '');
    const docId = cleanPhone.length <= 11 ? '55' + cleanPhone : cleanPhone;

    await db.collection('daily_motivation_recipients').doc(docId).set({
        phone: docId,
        rawPhone: phone,
        active: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    return { success: true, message: `Número ${phone} cadastrado com sucesso para receber a mensagem diária do Miles às 06h!` };
});

// Endpoint HTTP para testar notificação de lead para a unidade
exports.testUnitNotification = functions.https.onRequest(async (req, res) => {
    const unit = req.query.unit || 'centro';
    const nome = req.query.nome || 'Lead de Teste';
    const telefone = req.query.telefone || '(48) 99999-8888';
    const programa = req.query.programa || 'Adultos';

    const result = await notifyUnitManagerOfLead(unit, {
        nome,
        telefone,
        programaInteresse: programa,
        unidade: unit,
        origem: 'Teste Manual via HTTP'
    });

    res.json({
        success: true,
        unit,
        result,
        message: `Disparo de teste para a unidade ${unit} concluído.`
    });
});
