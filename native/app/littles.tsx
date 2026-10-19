import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Platform,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft,
  Sparkles,
  Search,
  X,
  Award,
  Heart,
  Shield,
  Smile,
  Zap,
  Flame,
  ChevronRight,
  BookOpen,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface LittleCharacter {
  id: string;
  name: string;
  belt: string;
  beltShort: string;
  step: string;
  beltHex: string;
  accentColor: string;
  gradientColors: [string, string];
  cardGradient: [string, string];
  animal: string;
  animalEmoji: string;
  meaning: string;
  challenge: string;
  virtue: string;
  teaching: string;
  parentTip: string;
  image: any;
}

const LITTLES_DATA: LittleCharacter[] = [
  {
    id: 'miles',
    name: 'Miles',
    belt: 'Faixa Branca',
    beltShort: 'Branca',
    step: '1º Passo',
    beltHex: '#f1f5f9',
    accentColor: '#94a3b8',
    gradientColors: ['rgba(241, 245, 249, 0.25)', 'rgba(148, 163, 184, 0.05)'],
    cardGradient: ['#1c202a', '#12151d'],
    animal: 'Panda',
    animalEmoji: '🐼',
    meaning: 'Simbologia relacionada a "amoroso" e "bondoso".',
    challenge: 'Agitado e ansioso',
    virtue: 'Foco, Calma & Respiração',
    teaching:
      'No tatame, Miles aprende a desacelerar a mente e canalizar sua agitação em disciplina. Ele descobre que a faixa branca é a semente de onde nasce o futuro faixa preta!',
    parentTip:
      'Incentive momentos de respiração calma quando a criança estiver agitada, lembrando das pausas do Miles no tatame.',
    image: require('../assets/images/littles/miles.png'),
  },
  {
    id: 'jun',
    name: 'Jun',
    belt: 'Faixa Laranja',
    beltShort: 'Laranja',
    step: '2º Passo',
    beltHex: '#f97316',
    accentColor: '#ea580c',
    gradientColors: ['rgba(249, 115, 22, 0.35)', 'rgba(234, 88, 12, 0.05)'],
    cardGradient: ['#231815', '#161113'],
    animal: 'Leão',
    animalEmoji: '🦁',
    meaning: 'Origem chinesa ("rei, governante") e coreana ("belo, talentoso").',
    challenge: 'Inseguro e medroso',
    virtue: 'Coragem & Autoconfiança',
    teaching:
      'Apesar de ser o rei da floresta, Jun sentia receio de errar novos movimentos. No tatame, aprendeu que coragem não é a ausência de medo, mas a força de tentar mesmo com frio na barriga!',
    parentTip:
      'Elogie a coragem de tentar novas atividades em família, comemorando cada pequeno progresso.',
    image: require('../assets/images/littles/jun.png'),
  },
  {
    id: 'eddy',
    name: 'Eddy',
    belt: 'Faixa Amarela',
    beltShort: 'Amarela',
    step: '3º Passo',
    beltHex: '#eab308',
    accentColor: '#ca8a04',
    gradientColors: ['rgba(234, 179, 8, 0.35)', 'rgba(202, 138, 4, 0.05)'],
    cardGradient: ['#231f13', '#151410'],
    animal: 'Girafa',
    animalEmoji: '🦒',
    meaning: '"Guardião das riquezas", "protetor rico" e valoroso.',
    challenge: 'Impulsivo e falante',
    virtue: 'Atenção & Saber Ouvir',
    teaching:
      'Eddy é muito curioso e adora falar! No tatame, ele treina o poder do silêncio marcial: ouvir os mestres com atenção para absorver os detalhes de cada golpe.',
    parentTip:
      'Crie brincadeiras de escuta atenta em casa, incentivando a criança a ouvir até o final antes de falar.',
    image: require('../assets/images/littles/eddy.png'),
  },
  {
    id: 'sachi',
    name: 'Sachi',
    belt: 'Faixa Camuflada',
    beltShort: 'Camuflada',
    step: '4º Passo',
    beltHex: '#22c55e',
    accentColor: '#15803d',
    gradientColors: ['rgba(34, 197, 94, 0.35)', 'rgba(21, 128, 61, 0.05)'],
    cardGradient: ['#142119', '#0d1611'],
    animal: 'Borboleta',
    animalEmoji: '🦋',
    meaning: 'Origem japonesa: "criança de felicidade e alegria plena".',
    challenge: 'Egoísta e convencida',
    virtue: 'Humildade & Cooperação',
    teaching:
      'Sachi é talentosa, mas queria sempre ser o centro de tudo. Na faixa camuflada, ela aprende a camuflar o ego e descobre que a maior alegria é ajudar os colegas a crescerem juntos!',
    parentTip:
      'Mostre como é gratificante compartilhar e parabenizar os amigos e irmãos pelas conquistas deles.',
    image: require('../assets/images/littles/sachi.png'),
  },
  {
    id: 'kobe',
    name: 'Kobe',
    belt: 'Faixa Verde',
    beltShort: 'Verde',
    step: '5º Passo',
    beltHex: '#10b981',
    accentColor: '#059669',
    gradientColors: ['rgba(16, 185, 129, 0.40)', 'rgba(5, 150, 105, 0.05)'],
    cardGradient: ['#12221b', '#0b1612'],
    animal: 'Jacaré',
    animalEmoji: '🐊',
    meaning: '"Pequeno que vence", "vencedor" e "suplantador".',
    challenge: 'Teimoso e respondão',
    virtue: 'Respeito & Disciplina Positiva',
    teaching:
      'Kobe tem determinação sem igual, mas adorava teimar com regras. Nas artes marciais, canalizou sua garra para vencer com respeito aos mestres, família e adversários!',
    parentTip:
      'Quando houver teimosia, use o "código do Kobe": faça uma pausa rápida, respire e conversem olhando nos olhos.',
    image: require('../assets/images/littles/kobe.png'),
  },
  {
    id: 'hye',
    name: 'Hye',
    belt: 'Faixa Roxa',
    beltShort: 'Roxa',
    step: '6º Passo',
    beltHex: '#a855f7',
    accentColor: '#9333ea',
    gradientColors: ['rgba(168, 85, 247, 0.35)', 'rgba(147, 51, 234, 0.05)'],
    cardGradient: ['#1d1425', '#120d18'],
    animal: 'Coruja',
    animalEmoji: '🦉',
    meaning: 'Origem coreana: "mente brilhante" e "inteligente".',
    challenge: 'Esquecida e avoada',
    virtue: 'Presença & Memória Marcial',
    teaching:
      'Hye tem raciocínio rápido, mas vivia no mundo da lua. As sequências e formas do Kihap treinam seu cérebro para manter atenção total no momento presente.',
    parentTip:
      'Ajude a criança a criar checklists divertidos (como preparar a mochila do treino), fortalecendo sua memória e rotina.',
    image: require('../assets/images/littles/hye.png'),
  },
  {
    id: 'hope',
    name: 'Hope',
    belt: 'Faixa Azul',
    beltShort: 'Azul',
    step: '7º Passo',
    beltHex: '#3b82f6',
    accentColor: '#2563eb',
    gradientColors: ['rgba(59, 130, 246, 0.35)', 'rgba(37, 99, 235, 0.05)'],
    cardGradient: ['#131c2c', '#0d131f'],
    animal: 'Arara',
    animalEmoji: '🦜',
    meaning: 'Origem indígena norte-americana "Hopi" (povo pacífico).',
    challenge: 'Tímida e indecisa',
    virtue: 'Expressão, Atitude & Voz Firme',
    teaching:
      'Hope tinha receio de se expressar em público. No tatame, soltar o grito "KIHAP!" deu asas à sua voz e autoconfiança, ensinando-a a se defender e decidir com firmeza.',
    parentTip:
      'Estimule a criança a dar opiniões em pequenas decisões do dia a dia, validando suas ideias com entusiasmo.',
    image: require('../assets/images/littles/hope.png'),
  },
  {
    id: 'jeong',
    name: 'Jeong',
    belt: 'Faixa Marrom',
    beltShort: 'Marrom',
    step: '8º Passo',
    beltHex: '#b45309',
    accentColor: '#78350f',
    gradientColors: ['rgba(180, 83, 9, 0.35)', 'rgba(120, 53, 15, 0.05)'],
    cardGradient: ['#221812', '#150f0b'],
    animal: 'Macaco',
    animalEmoji: '🐒',
    meaning: 'Termo coreano que significa "correto", "afetuoso", "bondoso".',
    challenge: 'Mal-humorado e individualista',
    virtue: 'Resiliência, Empatia & Alegria',
    teaching:
      'Jeong se chateava quando os movimentos não saíam perfeitos de primeira. No caminho para a faixa preta, aprendeu que errar faz parte do treino e que a empatia une a turma!',
    parentTip:
      'Ensine que o bom humor é um superpoder que alivia frustrações quando as coisas ficam difíceis.',
    image: require('../assets/images/littles/jeong.png'),
  },
  {
    id: 'benny',
    name: 'Benny',
    belt: 'Faixa Vermelha',
    beltShort: 'Vermelha',
    step: '9º Passo',
    beltHex: '#ef4444',
    accentColor: '#dc2626',
    gradientColors: ['rgba(239, 68, 68, 0.38)', 'rgba(220, 38, 38, 0.06)'],
    cardGradient: ['#261314', '#170b0c'],
    animal: 'Fênix',
    animalEmoji: '🦅',
    meaning: '"Bento", "abençoado" e "filho da fortuna e riqueza".',
    challenge: 'Acomodado e desconfiado',
    virtue: 'Superação & Renascimento',
    teaching:
      'Na última faixa antes da Faixa Preta, a Fênix Benny renasce do comodismo! Ele abraça o esforço máximo e confia no mestre para se tornar um líder exemplar.',
    parentTip:
      'Mostre que o verdadeiro campeão não para quando está confortável, mas se desafia a ser 1% melhor a cada dia.',
    image: require('../assets/images/littles/benny.png'),
  },
];

export default function LittlesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [selectedBelt, setSelectedBelt] = useState<string>('todos');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeModalChar, setActiveModalChar] = useState<LittleCharacter | null>(null);

  const beltFilters = useMemo(() => {
    return [
      { id: 'todos', label: 'Todos', hex: '#eab308' },
      ...LITTLES_DATA.map((c) => ({ id: c.id, label: c.beltShort, hex: c.beltHex })),
    ];
  }, []);

  const filteredCharacters = useMemo(() => {
    return LITTLES_DATA.filter((c) => {
      const matchBelt =
        selectedBelt === 'todos' ||
        c.id === selectedBelt ||
        c.beltShort.toLowerCase() === selectedBelt.toLowerCase();

      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.animal.toLowerCase().includes(q) ||
        c.belt.toLowerCase().includes(q) ||
        c.challenge.toLowerCase().includes(q) ||
        c.virtue.toLowerCase().includes(q);

      return matchBelt && matchSearch;
    });
  }, [selectedBelt, searchQuery]);

  const handleOpenModal = (char: LittleCharacter) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_) {}
    setActiveModalChar(char);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Stack.Screen options={{ headerShown: false }} />

      {/* AMBIENT BACKGROUND GLOW */}
      <View style={styles.ambientTopGlow} pointerEvents="none">
        <LinearGradient
          colors={['rgba(234, 179, 8, 0.12)', 'rgba(234, 88, 12, 0.04)', 'transparent']}
          style={StyleSheet.absoluteFillObject}
        />
      </View>

      {/* FLOATING TOP APP BAR */}
      <View
        style={[
          styles.headerContainer,
          { paddingTop: insets.top + (Platform.OS === 'ios' ? 6 : 14) },
        ]}
      >
        <View style={styles.headerTopRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            activeOpacity={0.8}
            accessibilityLabel="Voltar"
          >
            <ArrowLeft size={20} color="#ffffff" />
          </TouchableOpacity>

          <View style={styles.headerTitleCenter}>
            <View style={styles.headerTitleRow}>
              <Sparkles size={16} color="#eab308" />
              <Text style={styles.headerTitleText}>UNIVERSO LITTLES</Text>
            </View>
            <Text style={styles.headerSubtitleText}>
              COLEÇÃO DE MASCOTES & GRADUAÇÃO
            </Text>
          </View>

          <View style={styles.headerCounterBadge}>
            <Text style={styles.headerCounterText}>9</Text>
          </View>
        </View>

        {/* SEARCH INPUT */}
        <View style={styles.searchBar}>
          <Search size={16} color="#94a3b8" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Buscar por mascote, animal ou faixa..."
            placeholderTextColor="#64748b"
            style={styles.searchInput}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={15} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: 12,
          paddingBottom: insets.bottom + 48,
        }}
      >
        {/* HERO PEDAGOGICAL CARD */}
        <View style={styles.heroBanner}>
          <LinearGradient
            colors={['rgba(234, 179, 8, 0.18)', 'rgba(15, 17, 23, 0.95)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroBannerGradient}
          />
          <View style={styles.heroBannerContent}>
            <View style={styles.heroBannerBadgeRow}>
              <View style={styles.heroIconBox}>
                <Award size={15} color="#000000" />
              </View>
              <Text style={styles.heroBadgeText}>O MÉTODO MARCIAL LITTLES</Text>
            </View>
            <Text style={styles.heroDescriptionText}>
              Cada faixa do Kihap é representada por um mascote e um desafio comportamental real. Conforme a criança treina e avança nas faixas, ela transforma dificuldades em virtudes para a vida!
            </Text>
          </View>
        </View>

        {/* HORIZONTAL BELT TABS */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.beltTabsContainer}
          style={styles.beltTabsScroll}
        >
          {beltFilters.map((tab) => {
            const active = selectedBelt === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => {
                  try {
                    Haptics.selectionAsync();
                  } catch (_) {}
                  setSelectedBelt(tab.id);
                }}
                activeOpacity={0.8}
                style={[
                  styles.beltTab,
                  active && styles.beltTabActive,
                  active && { borderColor: tab.hex },
                ]}
              >
                {tab.id !== 'todos' && (
                  <View
                    style={[
                      styles.beltTabDot,
                      { backgroundColor: tab.hex },
                    ]}
                  />
                )}
                <Text
                  style={[
                    styles.beltTabText,
                    active && styles.beltTabTextActive,
                    active && tab.id !== 'todos' && { color: '#ffffff' },
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* SECTION HEADER */}
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionTitleWithIcon}>
            <Flame size={15} color="#eab308" />
            <Text style={styles.sectionTitleText}>
              {selectedBelt === 'todos'
                ? 'TODOS OS 9 MASCOTES'
                : `FAIXA ${selectedBelt.toUpperCase()}`}
            </Text>
          </View>
          <Text style={styles.sectionSubtitleCount}>
            {filteredCharacters.length}{' '}
            {filteredCharacters.length === 1 ? 'personagem' : 'personagens'}
          </Text>
        </View>

        {/* CHARACTERS SHOWCASE (HERO TRADING CARDS) */}
        <View style={styles.cardsListContainer}>
          {filteredCharacters.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Smile size={42} color="#64748b" />
              <Text style={styles.emptyTitle}>Nenhum mascote encontrado</Text>
              <Text style={styles.emptySubtitle}>
                Tente buscar por outro termo ou selecione a aba "Todos".
              </Text>
            </View>
          ) : (
            filteredCharacters.map((char) => {
              return (
                <TouchableOpacity
                  key={char.id}
                  activeOpacity={0.92}
                  onPress={() => handleOpenModal(char)}
                  style={styles.heroCard}
                >
                  <LinearGradient
                    colors={char.cardGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFillObject}
                  />

                  {/* TOP MARTIAL BELT STRIPE */}
                  <View style={styles.beltStripeContainer}>
                    <View
                      style={[
                        styles.beltStripeMain,
                        { backgroundColor: char.beltHex },
                      ]}
                    />
                    <View style={styles.beltStripeTip} />
                  </View>

                  <View style={styles.cardMainBody}>
                    {/* CHARACTER STAGE WITH AMBIENT HALO */}
                    <View style={styles.characterStage}>
                      <LinearGradient
                        colors={char.gradientColors}
                        style={styles.characterAmbientHalo}
                      />
                      <ExpoImage
                        source={char.image}
                        style={styles.characterImage}
                        contentFit="contain"
                        transition={150}
                      />
                    </View>

                    {/* CHARACTER DETAILS */}
                    <View style={styles.characterContent}>
                      {/* STEP & BELT PILL */}
                      <View style={styles.characterMetaRow}>
                        <View
                          style={[
                            styles.characterBeltBadge,
                            { borderColor: char.beltHex },
                          ]}
                        >
                          <View
                            style={[
                              styles.characterBeltDot,
                              { backgroundColor: char.beltHex },
                            ]}
                          />
                          <Text
                            style={[
                              styles.characterBeltText,
                              { color: char.beltHex },
                            ]}
                          >
                            {char.belt}
                          </Text>
                        </View>
                        <Text style={styles.stepBadgeText}>{char.step}</Text>
                      </View>

                      {/* NAME */}
                      <Text style={styles.characterNameText}>{char.name}</Text>

                      {/* ANIMAL TAG */}
                      <Text style={styles.characterAnimalText}>
                        {char.animalEmoji} {char.animal} • {char.meaning}
                      </Text>

                      {/* CHALLENGE VS VIRTUE PILLS */}
                      <View style={styles.traitsContainer}>
                        <View style={styles.traitBoxChallenge}>
                          <View style={styles.traitHeaderRow}>
                            <Zap size={11} color="#f97316" />
                            <Text style={styles.traitLabelChallenge}>
                              DESAFIO
                            </Text>
                          </View>
                          <Text
                            style={styles.traitValueChallenge}
                            numberOfLines={1}
                          >
                            {char.challenge}
                          </Text>
                        </View>

                        <View style={styles.traitBoxVirtue}>
                          <View style={styles.traitHeaderRow}>
                            <Shield size={11} color="#eab308" />
                            <Text style={styles.traitLabelVirtue}>
                              NO TATAME
                            </Text>
                          </View>
                          <Text style={styles.traitValueVirtue} numberOfLines={1}>
                            {char.virtue}
                          </Text>
                        </View>
                      </View>

                      {/* EXPLORE BUTTON */}
                      <View style={styles.exploreLinkRow}>
                        <Text style={styles.exploreLinkText}>
                          Ver história e ensinamento
                        </Text>
                        <ChevronRight size={13} color="#eab308" />
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* IMMERSIVE CHARACTER MODAL */}
      <Modal
        visible={!!activeModalChar}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveModalChar(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCardWrapper}>
            {activeModalChar && (
              <>
                <LinearGradient
                  colors={activeModalChar.cardGradient}
                  style={StyleSheet.absoluteFillObject}
                />

                {/* MODAL BELT HEADER ACCENT */}
                <View style={styles.modalBeltStripe}>
                  <View
                    style={[
                      styles.modalBeltStripeFill,
                      { backgroundColor: activeModalChar.beltHex },
                    ]}
                  />
                  <View style={styles.modalBeltStripeBlackTip} />
                </View>

                {/* MODAL CLOSE BUTTON */}
                <TouchableOpacity
                  onPress={() => setActiveModalChar(null)}
                  style={styles.modalCloseButton}
                  activeOpacity={0.8}
                >
                  <X size={18} color="#ffffff" />
                </TouchableOpacity>

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.modalScrollContent}
                >
                  {/* HERO CHARACTER STAGE IN MODAL */}
                  <View style={styles.modalHeroStage}>
                    <LinearGradient
                      colors={activeModalChar.gradientColors}
                      style={styles.modalHeroHalo}
                    />
                    <ExpoImage
                      source={activeModalChar.image}
                      style={styles.modalHeroImage}
                      contentFit="contain"
                    />
                  </View>

                  {/* BADGE */}
                  <View
                    style={[
                      styles.modalBeltBadge,
                      { borderColor: activeModalChar.beltHex },
                    ]}
                  >
                    <View
                      style={[
                        styles.modalBeltBadgeDot,
                        { backgroundColor: activeModalChar.beltHex },
                      ]}
                    />
                    <Text
                      style={[
                        styles.modalBeltBadgeText,
                        { color: activeModalChar.beltHex },
                      ]}
                    >
                      {activeModalChar.belt} • {activeModalChar.step}
                    </Text>
                  </View>

                  {/* NAME & ANIMAL */}
                  <Text style={styles.modalNameText}>
                    {activeModalChar.name}
                  </Text>
                  <Text style={styles.modalAnimalText}>
                    {activeModalChar.animalEmoji} Mascote{' '}
                    {activeModalChar.animal}
                  </Text>

                  {/* LORE BLOCKS */}
                  <View style={styles.modalBlocksList}>
                    {/* BLOCK 1: MEANING */}
                    <View style={styles.modalInfoCard}>
                      <View style={styles.modalInfoCardHeader}>
                        <Heart size={14} color="#eab308" />
                        <Text style={styles.modalInfoCardTitle}>
                          SIGNIFICADO DO NOME
                        </Text>
                      </View>
                      <Text style={styles.modalInfoCardBody}>
                        {activeModalChar.meaning}
                      </Text>
                    </View>

                    {/* BLOCK 2: CHALLENGE */}
                    <View style={styles.modalInfoCard}>
                      <View style={styles.modalInfoCardHeader}>
                        <Zap size={14} color="#f97316" />
                        <Text style={styles.modalInfoCardTitle}>
                          O DESAFIO DE COMPORTAMENTO
                        </Text>
                      </View>
                      <Text style={styles.modalInfoCardBody}>
                        {activeModalChar.challenge}
                      </Text>
                    </View>

                    {/* BLOCK 3: MARTIAL VIRTUE ON TATAME */}
                    <View style={styles.modalGoldenCard}>
                      <LinearGradient
                        colors={[
                          'rgba(234, 179, 8, 0.22)',
                          'rgba(234, 179, 8, 0.05)',
                        ]}
                        style={StyleSheet.absoluteFillObject}
                      />
                      <View style={styles.modalInfoCardHeader}>
                        <Shield size={14} color="#facc15" />
                        <Text style={styles.modalGoldenCardTitle}>
                          A TRANSFORMAÇÃO NO TATAME
                        </Text>
                      </View>
                      <Text style={styles.modalGoldenCardBody}>
                        {activeModalChar.teaching}
                      </Text>
                    </View>

                    {/* BLOCK 4: PARENT TIP */}
                    <View style={styles.modalInfoCard}>
                      <View style={styles.modalInfoCardHeader}>
                        <BookOpen size={14} color="#38bdf8" />
                        <Text style={styles.modalInfoCardTitle}>
                          DICA DOS MESTRES PARA A FAMÍLIA
                        </Text>
                      </View>
                      <Text style={styles.modalInfoCardBody}>
                        {activeModalChar.parentTip}
                      </Text>
                    </View>
                  </View>

                  {/* CLOSE BUTTON */}
                  <TouchableOpacity
                    onPress={() => setActiveModalChar(null)}
                    style={styles.modalPrimaryButton}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.modalPrimaryButtonText}>
                      VOLTAR PARA A TURMA
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0d12',
  },
  ambientTopGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 320,
  },
  headerContainer: {
    backgroundColor: 'rgba(12, 13, 18, 0.92)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
  },
  headerTitleCenter: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 8,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitleText: {
    fontFamily: 'NeueMachina-Ultrabold',
    fontSize: 16,
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  headerSubtitleText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 1.5,
    marginTop: 2,
  },
  headerCounterBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(234, 179, 8, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.40)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCounterText: {
    fontFamily: 'NeueMachina-Ultrabold',
    fontSize: 13,
    color: '#eab308',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '500',
  },
  heroBanner: {
    marginHorizontal: 18,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.30)',
    marginBottom: 16,
  },
  heroBannerGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  heroBannerContent: {
    padding: 16,
  },
  heroBannerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  heroIconBox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: '#eab308',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBadgeText: {
    fontFamily: 'NeueMachina-Ultrabold',
    fontSize: 11,
    color: '#facc15',
    letterSpacing: 1,
  },
  heroDescriptionText: {
    fontSize: 12,
    color: '#cbd5e1',
    lineHeight: 18,
    fontWeight: '400',
  },
  beltTabsScroll: {
    marginBottom: 16,
  },
  beltTabsContainer: {
    paddingHorizontal: 18,
    gap: 8,
  },
  beltTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    gap: 6,
  },
  beltTabActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderWidth: 1.5,
  },
  beltTabDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  beltTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
  },
  beltTabTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  sectionTitleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitleText: {
    fontFamily: 'NeueMachina-Ultrabold',
    fontSize: 12,
    color: '#ffffff',
    letterSpacing: 1,
  },
  sectionSubtitleCount: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  cardsListContainer: {
    paddingHorizontal: 18,
    gap: 14,
  },
  heroCard: {
    borderRadius: 26,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
  },
  beltStripeContainer: {
    height: 6,
    width: '100%',
    flexDirection: 'row',
  },
  beltStripeMain: {
    flex: 1,
  },
  beltStripeTip: {
    width: 22,
    backgroundColor: '#000000',
  },
  cardMainBody: {
    flexDirection: 'row',
    padding: 14,
    gap: 14,
  },
  characterStage: {
    width: 120,
    height: 150,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  characterAmbientHalo: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
  },
  characterImage: {
    width: 105,
    height: 135,
  },
  characterContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  characterMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  characterBeltBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.40)',
    gap: 5,
  },
  characterBeltDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  characterBeltText: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stepBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  characterNameText: {
    fontFamily: 'NeueMachina-Ultrabold',
    fontSize: 20,
    color: '#ffffff',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  characterAnimalText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#cbd5e1',
    marginTop: 1,
  },
  traitsContainer: {
    gap: 5,
    marginTop: 8,
  },
  traitBoxChallenge: {
    backgroundColor: 'rgba(249, 115, 22, 0.12)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.20)',
  },
  traitHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 1,
  },
  traitLabelChallenge: {
    fontSize: 8,
    fontWeight: '900',
    color: '#f97316',
    letterSpacing: 0.5,
  },
  traitValueChallenge: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fdba74',
  },
  traitBoxVirtue: {
    backgroundColor: 'rgba(234, 179, 8, 0.12)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.22)',
  },
  traitLabelVirtue: {
    fontSize: 8,
    fontWeight: '900',
    color: '#eab308',
    letterSpacing: 0.5,
  },
  traitValueVirtue: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fef08a',
  },
  exploreLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  exploreLinkText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#eab308',
    letterSpacing: 0.3,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  emptyTitle: {
    fontFamily: 'NeueMachina-Ultrabold',
    fontSize: 15,
    color: '#ffffff',
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  modalCardWrapper: {
    width: '100%',
    maxHeight: '90%',
    borderRadius: 30,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    position: 'relative',
    backgroundColor: '#12151d',
  },
  modalBeltStripe: {
    height: 8,
    width: '100%',
    flexDirection: 'row',
  },
  modalBeltStripeFill: {
    flex: 1,
  },
  modalBeltStripeBlackTip: {
    width: 28,
    backgroundColor: '#000000',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 18,
    right: 18,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.60)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    zIndex: 10,
  },
  modalScrollContent: {
    padding: 22,
    alignItems: 'center',
  },
  modalHeroStage: {
    width: 170,
    height: 190,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    position: 'relative',
  },
  modalHeroHalo: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
  },
  modalHeroImage: {
    width: 160,
    height: 180,
  },
  modalBeltBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.50)',
    gap: 6,
    marginBottom: 8,
  },
  modalBeltBadgeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  modalBeltBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalNameText: {
    fontFamily: 'NeueMachina-Ultrabold',
    fontSize: 26,
    color: '#ffffff',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  modalAnimalText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#eab308',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 2,
    marginBottom: 18,
  },
  modalBlocksList: {
    width: '100%',
    gap: 10,
  },
  modalInfoCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalInfoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  modalInfoCardTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.8,
  },
  modalInfoCardBody: {
    fontSize: 12,
    color: '#cbd5e1',
    lineHeight: 18,
    fontWeight: '400',
  },
  modalGoldenCard: {
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.40)',
    overflow: 'hidden',
    position: 'relative',
  },
  modalGoldenCardTitle: {
    fontFamily: 'NeueMachina-Ultrabold',
    fontSize: 11,
    color: '#facc15',
    letterSpacing: 0.8,
  },
  modalGoldenCardBody: {
    fontSize: 12,
    color: '#fef08a',
    lineHeight: 18,
    fontWeight: '500',
  },
  modalPrimaryButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: '#eab308',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    shadowColor: '#eab308',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  modalPrimaryButtonText: {
    fontFamily: 'NeueMachina-Ultrabold',
    fontSize: 12,
    color: '#000000',
    letterSpacing: 1,
  },
});
