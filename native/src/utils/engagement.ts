import { addDoc, collection, doc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db } from '../services/firebase';

export const UNIT_LABELS: Record<string, string> = {
  centro: 'Centro',
  coqueiros: 'Coqueiros',
  'santa-monica': 'Santa Mônica',
  'asa-sul': 'Asa Sul',
  sudoeste: 'Sudoeste',
  'lago-sul': 'Lago Sul',
  'jardim-botanico': 'Jardim Botânico',
  noroeste: 'Noroeste',
  'pontos-de-ensino': 'Pontos de Ensino',
  dourados: 'Dourados',
  staff: 'Staff',
};

export function normalizeUnitKey(val?: any): string {
  if (!val || typeof val !== 'string') return '';
  return val
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^kihap\s*-\s*/i, '')
    .replace(/^kihap\s+/i, '')
    .replace(/^unidade\s+/i, '')
    .replace(/\s*\(.*\)\s*/g, '')
    .trim()
    .replace(/[\s_]+/g, '-');
}

export function normalizeUnitDisplay(val?: any): string {
  const slug = normalizeUnitKey(val);
  if (slug && UNIT_LABELS[slug]) return UNIT_LABELS[slug];
  if (typeof val === 'string' && val.trim()) {
    return val
      .trim()
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());
  }
  return 'Kihap';
}

/**
 * Saldo efetivo de Kihapcoins protegido contra sobrescrita do sync do EVO:
 * `totalFitCoins` (vindo do EVO) + `kihapcoinsDelta` (ganhos/resgates no app).
 */
export function getEffectiveKihapcoins(userData: any): number {
  const base = Number(userData?.totalFitCoins ?? userData?.fitCoins ?? 0) || 0;
  const delta = Number(userData?.kihapcoinsDelta ?? 0) || 0;
  return Math.max(0, Math.round(base + delta));
}

export function getLocalDateStr(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getCurrentWeekKey(d: Date = new Date()): string {
  const dateStr = getLocalDateStr(d);
  const utc = new Date(`${dateStr}T12:00:00Z`);
  const dayNum = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((utc.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function getCurrentMonthKey(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export interface AvatarFrameStyleMeta {
  id: 'none' | 'gold' | 'flame';
  label: string;
  ringColor: string;
  secondaryColor: string;
  badgeIcon: string;
}

export const AVATAR_FRAMES: Record<string, AvatarFrameStyleMeta> = {
  none: {
    id: 'none',
    label: 'Padrão',
    ringColor: 'transparent',
    secondaryColor: 'transparent',
    badgeIcon: '',
  },
  gold: {
    id: 'gold',
    label: 'Dourada Kihap',
    ringColor: '#eab308',
    secondaryColor: '#fde047',
    badgeIcon: '👑',
  },
  flame: {
    id: 'flame',
    label: 'Chama Suprema',
    ringColor: '#f97316',
    secondaryColor: '#ef4444',
    badgeIcon: '🔥',
  },
};

export interface WeeklyQuizItem {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  rewardCoins: number;
}

export const DEFAULT_WEEKLY_QUIZZES: WeeklyQuizItem[] = [
  {
    id: 'quiz_kihap_meaning',
    question: 'O que representa a palavra "KIHAP" na filosofia da nossa escola?',
    options: [
      'Apenas um grito de ataque sem propósito',
      'A união de energia, foco mental e espírito marcial no golpe',
      'O nome de uma faixa especial de competição',
      'Um cumprimento realizado somente antes dos exames',
    ],
    correctIndex: 1,
    explanation: 'Kihap representa a concentração máxima de energia física e foco mental no momento exato da execução.',
    rewardCoins: 15,
  },
  {
    id: 'quiz_white_belt',
    question: 'Qual o significado simbólico da Faixa Branca no início da jornada marcial?',
    options: [
      'Pureza, mente aberta e humildade para aprender os fundamentos',
      'Velocidade máxima em chutes saltados',
      'Autorização imediata para liderar turmas',
      'Domínio completo de todas as fórmulas',
    ],
    correctIndex: 0,
    explanation: 'Como uma semente em solo limpo, a Faixa Branca simboliza receptividade, humildade e disposição para aprender.',
    rewardCoins: 15,
  },
  {
    id: 'quiz_tatame_etiquette',
    question: 'Ao entrar ou sair do tatame da escola, qual é a atitude correta do aluno?',
    options: [
      'Correr diretamente para a fila sem cumprimentar',
      'Fazer a reverência respeitando o espaço de treino e os colegas',
      'Ajustar o dobok apenas depois de iniciar os chutes',
      'Entrar calçado para não sujar o pé',
    ],
    correctIndex: 1,
    explanation: 'A reverência ao entrar e sair do tatame cultiva o respeito pelos mestres, colegas e pelo espaço de evolução.',
    rewardCoins: 15,
  },
  {
    id: 'quiz_streak_rule',
    question: 'Como funciona a regra para manter sua Ofensiva de Aulas acesa no app Kihap?',
    options: [
      'É preciso treinar todos os domingos sem falta',
      'Apenas 1 treino por mês já garante a sequência',
      'Manter intervalo de até 5 dias entre os check-ins de aula',
      'Assistir vídeos sem ir à unidade presencial',
    ],
    correctIndex: 2,
    explanation: 'Cada check-in realizado em até 5 dias após o anterior mantém sua chama ativa e aumenta sua ofensiva!',
    rewardCoins: 15,
  },
  {
    id: 'quiz_black_belt',
    question: 'Na Kihap, o que a conquista da Faixa Preta simboliza de verdade?',
    options: [
      'O fim definitivo dos estudos nas artes marciais',
      'O verdadeiro começo da maturidade, exemplo e aperfeiçoamento contínuo',
      'Apenas força física superior aos iniciantes',
      'Dispensa da disciplina e do respeito às regras',
    ],
    correctIndex: 1,
    explanation: 'A Faixa Preta marca o verdadeiro início do artista marcial maduro: constância, caráter, liderança e eterno aprendizado.',
    rewardCoins: 15,
  },
  {
    id: 'quiz_littles_miles',
    question: 'Qual virtude principal o personagem Miles (Panda) ensina aos alunos Littles?',
    options: [
      'Competir sozinho sem ajudar os colegas',
      'Foco, calma e respiração para canalizar energia',
      'Falar mais alto que o instrutor',
      'Desistir no primeiro erro de movimento',
    ],
    correctIndex: 1,
    explanation: 'O Miles ensina que pausar e respirar transforma agitação em foco e autocontrole no tatame e em casa.',
    rewardCoins: 15,
  },
  {
    id: 'quiz_green_belt',
    question: 'O que a Faixa Verde representa no caminho do desenvolvimento marcial?',
    options: [
      'O broto que rompe a terra e cresce com confiança e serenidade',
      'O encerramento dos exames físicos',
      'Uma faixa exclusiva para instrutores antigos',
      'Treino apenas de defesa sem golpes',
    ],
    correctIndex: 0,
    explanation: 'Assim como a planta que cresce firme rumo ao céu, na Faixa Verde o aluno fortalece técnica com serenidade interior.',
    rewardCoins: 15,
  },
  {
    id: 'quiz_respect_home',
    question: 'Como os valores aprendidos no tatame se conectam com a vida fora da escola?',
    options: [
      'Valem apenas durante os 45 minutos da aula',
      'Se aplicam em casa e nos estudos com respeito, disciplina e coragem',
      'Servem somente para campeonatos oficiais',
      'Mudam a cada troca de uniforme',
    ],
    correctIndex: 1,
    explanation: 'O propósito da Kihap é despertar disciplina, coragem e respeito no tatame para levar esses valores para a família e a escola.',
    rewardCoins: 15,
  },
];

export interface CoinRewardItem {
  id: string;
  title: string;
  description: string;
  cost: number;
  type: 'streak_shield' | 'avatar_frame' | 'littles_pack' | 'coupon' | 'physical' | 'experience';
  category: 'digital' | 'store';
  frameId?: string;
  discountPercent?: number;
  icon: string;
  active?: boolean;
}

export const DEFAULT_COIN_REWARDS: CoinRewardItem[] = [
  {
    id: 'streak_shield',
    title: 'Escudo de Chama',
    description: 'Protege sua ofensiva se você ficar até 10 dias sem conseguir treinar (máx. 3 acumulados).',
    cost: 50,
    type: 'streak_shield',
    category: 'digital',
    icon: '🛡️',
    active: true,
  },
  {
    id: 'frame_gold',
    title: 'Moldura Dourada Kihap',
    description: 'Borda dourada exclusiva ao redor do seu avatar no Perfil, Passaporte e Ranking.',
    cost: 80,
    type: 'avatar_frame',
    category: 'digital',
    frameId: 'gold',
    icon: '👑',
    active: true,
  },
  {
    id: 'frame_flame',
    title: 'Moldura Chama Suprema',
    description: 'Aura em chamas no seu avatar para destacar sua constância no tatame.',
    cost: 120,
    type: 'avatar_frame',
    category: 'digital',
    frameId: 'flame',
    icon: '🔥',
    active: true,
  },
  {
    id: 'littles_pack',
    title: 'Figurinha Surpresa Littles',
    description: 'Desbloqueia uma figurinha especial da turma Kihap Littles no seu álbum.',
    cost: 60,
    type: 'littles_pack',
    category: 'digital',
    icon: '🐼',
    active: true,
  },
  {
    id: 'coupon_10',
    title: 'Cupom 10% na Loja Oficial',
    description: 'Gera na hora um código válido por 90 dias para usar no carrinho do app ou site.',
    cost: 150,
    type: 'coupon',
    category: 'store',
    discountPercent: 10,
    icon: '🎟️',
    active: true,
  },
  {
    id: 'chaveiro_kihap',
    title: 'Chaveiro / Adesivo Kihap',
    description: 'Gera um voucher para retirar seu brinde exclusivo na recepção da sua unidade.',
    cost: 100,
    type: 'physical',
    category: 'store',
    icon: '🥋',
    active: true,
  },
  {
    id: 'vip_friend_pass',
    title: 'Passe VIP Aula Experimental',
    description: 'Voucher especial para convidar um amigo ou familiar para treinar junto com você.',
    cost: 80,
    type: 'experience',
    category: 'store',
    icon: '🤝',
    active: true,
  },
];

export const LITTLES_HOME_MISSIONS: Record<string, { id: string; title: string; tip: string }[]> = {
  miles: [
    { id: 'm1', title: 'Fazer 3 respirações calmas antes de dormir em 3 dias da semana', tip: 'Ajude a criança a inspirar pelo nariz e soltar devagar como o Miles.' },
    { id: 'm2', title: 'Manter a atenção em uma tarefa até o fim sem interromper', tip: 'Pode ser montar um brinquedo, ler ou terminar uma refeição tranquilo.' },
    { id: 'm3', title: 'Organizar os sapatos ou a mochila com calma antes da aula', tip: 'Valorize a postura tranquila na hora de se arrumar para a escola.' },
  ],
  jun: [
    { id: 'j1', title: 'Tentar uma atividade nova mesmo sentindo receio no início', tip: 'Lembre que coragem é tentar com o coração aberto, mesmo com frio na barriga.' },
    { id: 'j2', title: 'Cumprimentar professores ou familiares com voz firme e olho no olho', tip: 'Celebre a atitude e a postura confiante ao cumprimentar.' },
    { id: 'j3', title: 'Compartilhar algo bom que conseguiu superar na semana', tip: 'Conversar sobre pequenas vitórias constrói autoconfiança duradoura.' },
  ],
  eddy: [
    { id: 'e1', title: 'Ouvir os pais ou irmãos até terminarem de falar sem cortar', tip: 'Pratiquem a escuta ativa durante uma conversa ou refeição em família.' },
    { id: 'e2', title: 'Aguardar sua vez com paciência em uma brincadeira ou fila', tip: 'Reforce como o autocontrole ajuda todo mundo a se divertir melhor.' },
    { id: 'e3', title: 'Seguir uma orientação dos pais na primeira vez que for pedido', tip: 'Dê um comando simples e comemore quando houver atenção imediata.' },
  ],
  sachi: [
    { id: 's1', title: 'Ajudar um irmão, amigo ou os pais em alguma tarefa sem precisar pedir', tip: 'Cooperação fortalece a equipe dentro e fora do tatame.' },
    { id: 's2', title: 'Comemorar a conquista ou acerto de outro colega ou familiar', tip: 'Elogie quando a criança aplaudir quem está ao seu lado.' },
    { id: 's3', title: 'Dividir um brinquedo ou jogo com espírito de amizade', tip: 'Mostre como vencer juntos é ainda mais divertido que ganhar sozinho.' },
  ],
  kobe: [
    { id: 'k1', title: 'Responder com gentileza ("Sim, papai/mamãe") ao combinar uma regra', tip: 'O respeito começa na forma como conversamos dentro de casa.' },
    { id: 'k2', title: 'Cuidar do dobok ou da roupa deixando tudo dobrado após o uso', tip: 'Disciplina com os próprios materiais mostra respeito ao treino.' },
    { id: 'k3', title: 'Aceitar um "não" com serenidade sem discussão ou teimosia', tip: 'Combinem juntos o motivo da regra com calma e firmeza positiva.' },
  ],
  hye: [
    { id: 'h1', title: 'Preparar sozinho(a) a garrafinha e o uniforme para a aula Kihap', tip: 'Use uma pequena rotina visual para a criança conferir o que precisa levar.' },
    { id: 'h2', title: 'Guardar os brinquedos ou material escolar no lugar depois de usar', tip: 'Presença e atenção começam cuidando do nosso ambiente.' },
    { id: 'h3', title: 'Lembrar de uma palavra ou movimento ensinado na última aula', tip: 'Peça para a criança mostrar e ensinar um movimento para a família!' },
  ],
  hope: [
    { id: 'ho1', title: 'Dar o grito "KIHAP!" com energia e segurança durante o treino', tip: 'Expressar a voz com firmeza desenvolve postura e coragem.' },
    { id: 'ho2', title: 'Falar o que está sentindo com educação quando algo incomodar', tip: 'Ensine que usar palavras claras e respeitosas resolve conflitos.' },
    { id: 'ho3', title: 'Escolher e defender uma ideia positiva para a família fazer junta', tip: 'Dê espaço para a criança participar de pequenas escolhas da casa.' },
  ],
  jeong: [
    { id: 'je1', title: 'Continuar tentando após errar uma tarefa sem desistir', tip: 'Lembre seu filho de que o mestre é quem mais tentou até acertar.' },
    { id: 'je2', title: 'Consolar ou oferecer ajuda a alguém que esteja triste ou frustrado', tip: 'Empatia transforma colegas em verdadeiros parceiros.' },
    { id: 'je3', title: 'Praticar um desafio técnico em casa com sorriso no rosto', tip: 'Manter o bom humor diante de dificuldades fortalece a resiliência.' },
  ],
  benny: [
    { id: 'b1', title: 'Dar um bom exemplo para crianças menores em casa ou na escola', tip: 'Liderança positiva é inspirar os outros pelas próprias atitudes.' },
    { id: 'b2', title: 'Superar uma meta própria (ex.: fazer mais polichinelos ou ler mais páginas)', tip: 'Desafie a dar 10% a mais além do que já domina.' },
    { id: 'b3', title: 'Agradecer às pessoas que ajudam no dia a dia com um sorriso sincero', tip: 'Gratidão e liderança caminham sempre juntas na Kihap.' },
  ],
};

/**
 * Publica um marco no Mural de Conquistas (achievements_feed) respeitando a privacidade do perfil.
 */
export async function publishAchievementIfPublic(
  user: { uid: string; photoURL?: string | null } | null,
  userData: any,
  achievement: {
    type: 'streak_milestone' | 'physical_pr' | 'badge' | 'littles_mission';
    title: string;
    subtitle: string;
    icon: string;
    metricValue?: string;
    dedupeKey: string;
  }
): Promise<boolean> {
  if (!user?.uid) return false;
  if (userData?.socialPrivacy === 'private') return false;

  try {
    const existingQ = query(
      collection(db, 'achievements_feed'),
      where('dedupeKey', '==', `${user.uid}_${achievement.dedupeKey}`)
    );
    const snap = await getDocs(existingQ);
    if (!snap.empty) return false;

    const unitSlug =
      normalizeUnitKey(userData?.unitId || userData?.unidadeId || userData?.unit || userData?.unidade || '') ||
      'kihap';
    let photo = userData?.photoURL || userData?.profilePicture || user?.photoURL || '';
    if (photo && photo.startsWith('/')) {
      photo = `https://kihap.com.br${photo}`;
    }

    await addDoc(collection(db, 'achievements_feed'), {
      userId: user.uid,
      userName: userData?.name || userData?.nome || userData?.displayName || 'Aluno Kihap',
      userPhotoURL: photo,
      userBelt: userData?.belt || userData?.graduacao || 'Aluno Kihap',
      unitId: unitSlug,
      type: achievement.type,
      title: achievement.title,
      subtitle: achievement.subtitle,
      icon: achievement.icon,
      metricValue: achievement.metricValue || '',
      dedupeKey: `${user.uid}_${achievement.dedupeKey}`,
      reactions: {},
      createdAt: serverTimestamp(),
    });
    return true;
  } catch (err) {
    console.warn('[engagement] Aviso ao publicar marco no mural:', err);
    return false;
  }
}

/**
 * Marca leitura/estudo no Tatame para a missão semanal do aluno.
 */
export async function recordTatameStudyProgress(uid?: string, articleId?: string): Promise<void> {
  if (!uid) return;
  try {
    const weekKey = getCurrentWeekKey();
    await setDoc(
      doc(db, 'users', uid),
      {
        weeklyProgress: {
          [weekKey]: {
            tatameRead: true,
            lastTatameArticleId: articleId || null,
          },
        },
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('[engagement] Aviso ao registrar leitura Tatame:', err);
  }
}
