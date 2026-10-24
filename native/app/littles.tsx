import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  Platform,
  StyleSheet,
  Dimensions,
  Image as RNImage,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft,
  ChevronRight,
  BookOpen,
  Heart,
  ShieldCheck,
  Zap,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface LittleCharacter {
  id: string;
  name: string;
  belt: string;
  beltShort: string;
  stepNumber: number;
  step: string;
  beltHex: string;
  beltBorder: string;
  softBg: string;
  pillBg: string;
  pillText: string;
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
    stepNumber: 1,
    step: '1º Passo',
    beltHex: '#e2e8f0',
    beltBorder: '#cbd5e1',
    softBg: '#f8fafc',
    pillBg: '#f1f5f9',
    pillText: '#334155',
    animal: 'Panda',
    animalEmoji: '🐼',
    meaning: 'Nome ligado a bondade, afeto e calma.',
    challenge: 'Agitado e ansioso',
    virtue: 'Foco, calma e respiração',
    teaching:
      'No tatame da Kihap, o Miles aprende a desacelerar a mente e canalizar toda a sua energia em atenção. A faixa branca é o início onde a semente da disciplina é plantada.',
    parentTip:
      'Quando seu filho estiver agitado em casa, convide-o a fazer três respirações profundas, lembrando das pausas do Miles no início de cada aula.',
    image: require('../assets/images/littles/miles.png'),
  },
  {
    id: 'jun',
    name: 'Jun',
    belt: 'Faixa Laranja',
    beltShort: 'Laranja',
    stepNumber: 2,
    step: '2º Passo',
    beltHex: '#f97316',
    beltBorder: '#ea580c',
    softBg: '#fff7ed',
    pillBg: '#ffedd5',
    pillText: '#9a3412',
    animal: 'Leão',
    animalEmoji: '🦁',
    meaning: 'Origem oriental ligada a talento e liderança.',
    challenge: 'Inseguro e medroso',
    virtue: 'Coragem e autoconfiança',
    teaching:
      'Mesmo sendo um leãozinho, Jun tinha receio de tentar novos movimentos. No tatame, ele descobre que coragem não é não sentir medo, mas sim tentar com o coração aberto!',
    parentTip:
      'Elogie o esforço e a iniciativa em casa antes do resultado. Comemore cada pequena superação para fortalecer a autoconfiança.',
    image: require('../assets/images/littles/jun.png'),
  },
  {
    id: 'eddy',
    name: 'Eddy',
    belt: 'Faixa Amarela',
    beltShort: 'Amarela',
    stepNumber: 3,
    step: '3º Passo',
    beltHex: '#eab308',
    beltBorder: '#ca8a04',
    softBg: '#fefce8',
    pillBg: '#fef9c3',
    pillText: '#854d0e',
    animal: 'Girafa',
    animalEmoji: '🦒',
    meaning: 'Guardião generoso e atento.',
    challenge: 'Impulsivo e falante',
    virtue: 'Atenção e saber ouvir',
    teaching:
      'Eddy quer falar o tempo todo! No treino da Kihap, ele aprende o superpoder do silêncio marcial: ouvir os mestres com atenção para absorver cada detalhe.',
    parentTip:
      'Pratique momentos de escuta ativa à mesa: cada membro da família fala na sua vez sem interrupções.',
    image: require('../assets/images/littles/eddy.png'),
  },
  {
    id: 'sachi',
    name: 'Sachi',
    belt: 'Faixa Camuflada',
    beltShort: 'Camuflada',
    stepNumber: 4,
    step: '4º Passo',
    beltHex: '#65a30d',
    beltBorder: '#4d7c0f',
    softBg: '#f7fee7',
    pillBg: '#ecfccb',
    pillText: '#3f6212',
    animal: 'Borboleta',
    animalEmoji: '🦋',
    meaning: 'Origem japonesa: alegria e plenitude.',
    challenge: 'Egoísta e competitiva',
    virtue: 'Humildade e cooperação',
    teaching:
      'Sachi é muito talentosa, mas queria vencer sempre sozinha. Na faixa camuflada, ela camufla o ego e entende que a maior vitória é ajudar os colegas a crescerem juntos.',
    parentTip:
      'Incentive brincadeiras em equipe onde o objetivo seja ajudar o irmão ou colega, reforçando o valor da cooperação.',
    image: require('../assets/images/littles/sachi.png'),
  },
  {
    id: 'kobe',
    name: 'Kobe',
    belt: 'Faixa Verde',
    beltShort: 'Verde',
    stepNumber: 5,
    step: '5º Passo',
    beltHex: '#10b981',
    beltBorder: '#059669',
    softBg: '#ecfdf5',
    pillBg: '#d1fae5',
    pillText: '#065f46',
    animal: 'Jacaré',
    animalEmoji: '🐊',
    meaning: 'Determinação e força de superação.',
    challenge: 'Teimoso e respondão',
    virtue: 'Respeito e disciplina positiva',
    teaching:
      'Kobe tem uma força enorme, mas insistia em teimar. No tatame, ele canaliza essa determinação para treinar com respeito aos mestres, aos pais e às regras.',
    parentTip:
      'Quando surgir uma teimosia, estabeleça um combinativo calmo olhando nos olhos, reafirmando as regras com carinho e firmeza.',
    image: require('../assets/images/littles/kobe.png'),
  },
  {
    id: 'hye',
    name: 'Hye',
    belt: 'Faixa Roxa',
    beltShort: 'Roxa',
    stepNumber: 6,
    step: '6º Passo',
    beltHex: '#a855f7',
    beltBorder: '#9333ea',
    softBg: '#faf5ff',
    pillBg: '#f3e8ff',
    pillText: '#6b21a8',
    animal: 'Coruja',
    animalEmoji: '🦉',
    meaning: 'Origem coreana: inteligência e mente brilhante.',
    challenge: 'Distraída e esquecida',
    virtue: 'Presença e memória marcial',
    teaching:
      'Hye tem pensamento ágil, mas vivia esquecendo suas coisas. As formas e movimentos do Kihap exercitam a memória e ensinam a estar 100% presente no momento.',
    parentTip:
      'Envolva a criança na organização dos seus pertences (como preparar o dobok ou a mochila escolar) com uma pequena rotina visual.',
    image: require('../assets/images/littles/hye.png'),
  },
  {
    id: 'hope',
    name: 'Hope',
    belt: 'Faixa Azul',
    beltShort: 'Azul',
    stepNumber: 7,
    step: '7º Passo',
    beltHex: '#3b82f6',
    beltBorder: '#2563eb',
    softBg: '#eff6ff',
    pillBg: '#dbeafe',
    pillText: '#1e40af',
    animal: 'Arara',
    animalEmoji: '🦜',
    meaning: 'Esperança e harmonia.',
    challenge: 'Tímida e indecisa',
    virtue: 'Expressão, atitude e voz firme',
    teaching:
      'Hope tinha vergonha de falar na frente dos outros. O grito do "KIHAP!" deu asas à sua voz, ensinando que expressar o que sente com firmeza é um ato de coragem.',
    parentTip:
      'Peça a opinião do seu filho em pequenas escolhas do dia (como qual refeição preparar) e celebre quando ele expressar suas vontades com firmeza.',
    image: require('../assets/images/littles/hope.png'),
  },
  {
    id: 'jeong',
    name: 'Jeong',
    belt: 'Faixa Marrom',
    beltShort: 'Marrom',
    stepNumber: 8,
    step: '8º Passo',
    beltHex: '#b45309',
    beltBorder: '#92400e',
    softBg: '#fffbeb',
    pillBg: '#fef3c7',
    pillText: '#78350f',
    animal: 'Macaco',
    animalEmoji: '🐒',
    meaning: 'Conceito coreano de afeto, lealdade e empatia.',
    challenge: 'Frustrado e impaciente',
    virtue: 'Resiliência e empatia',
    teaching:
      'Jeong ficava chateado quando um golpe não dava certo de primeira. Ele aprendeu que errar faz parte do aprendizado e que manter o bom humor ajuda a vencer qualquer desafio.',
    parentTip:
      'Diante de um erro ou frustração, lembre seu filho de que "o mestre é quem mais tentou e mais errou até acertar". Abrace o processo.',
    image: require('../assets/images/littles/jeong.png'),
  },
  {
    id: 'benny',
    name: 'Benny',
    belt: 'Faixa Vermelha',
    beltShort: 'Vermelha',
    stepNumber: 9,
    step: '9º Passo',
    beltHex: '#ef4444',
    beltBorder: '#dc2626',
    softBg: '#fef2f2',
    pillBg: '#fee2e2',
    pillText: '#991b1b',
    animal: 'Fênix',
    animalEmoji: '🦅',
    meaning: 'Força renovadora e liderança inspiradora.',
    challenge: 'Acomodado e relutante',
    virtue: 'Superação e liderança',
    teaching:
      'Na última faixa antes da Faixa Preta, Benny supera a zona de conforto. Ele se dedica ao máximo e se torna um exemplo inspirador para todos os outros Littles.',
    parentTip:
      'Desafie seu filho a dar um passo além daquilo que já domina, parabenizando o espírito de liderança dentro de casa.',
    image: require('../assets/images/littles/benny.png'),
  },
];

export default function LittlesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [activeModalChar, setActiveModalChar] = useState<LittleCharacter | null>(null);

  const handleOpenModal = (char: LittleCharacter) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_) {}
    setActiveModalChar(char);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <Stack.Screen options={{ headerShown: false }} />

      {/* HEADER LIMPO DA KIHAP */}
      <View
        style={[
          styles.headerContainer,
          { paddingTop: insets.top + (Platform.OS === 'ios' ? 8 : 14) },
        ]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            activeOpacity={0.7}
            accessibilityLabel="Voltar"
          >
            <ArrowLeft size={22} color="#111827" />
          </TouchableOpacity>

          <View style={styles.headerTitleBox}>
            <Text style={styles.headerTitle}>Mascotes Littles</Text>
            <Text style={styles.headerSubtitle}>Programa Infantil Kihap</Text>
          </View>

          <View style={styles.headerLogoBox}>
            <RNImage
              source={{ uri: 'https://kihap.com.br/imgs/favicon.png' }}
              style={styles.headerLogo}
              resizeMode="contain"
            />
          </View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: 16,
          paddingBottom: insets.bottom + 40,
        }}
      >
        {/* CONTADOR DE ITENS */}
        <View style={styles.listHeaderRow}>
          <Text style={styles.listHeaderTitle}>
            Todos os Personagens
          </Text>
          <Text style={styles.listHeaderCount}>
            {LITTLES_DATA.length} mascotes
          </Text>
        </View>

        {/* LISTA DE CARDS DOS PERSONAGENS */}
        <View style={styles.cardsContainer}>
          {LITTLES_DATA.map((char) => {
              return (
                <TouchableOpacity
                  key={char.id}
                  activeOpacity={0.9}
                  onPress={() => handleOpenModal(char)}
                  style={styles.card}
                >
                  {/* FAIXA MARCIAL NO TOPO DO CARD */}
                  <View style={styles.cardBeltHeader}>
                    <View style={styles.beltStripeContainer}>
                      <View
                        style={[
                          styles.beltStripeMain,
                          { backgroundColor: char.beltHex },
                          char.id === 'miles' && styles.beltWhiteBorder,
                        ]}
                      />
                      <View style={styles.beltStripeTip}>
                        {Array.from({ length: Math.min(char.stepNumber, 4) }).map((_, i) => (
                          <View key={i} style={styles.beltStripeRankLine} />
                        ))}
                      </View>
                    </View>
                    <View style={[styles.stepBadge, { backgroundColor: char.pillBg }]}>
                      <Text style={[styles.stepBadgeText, { color: char.pillText }]}>
                        {char.step.toUpperCase()} • {char.belt.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  {/* CORPO DO CARD COM IMAGEM DO PERSONAGEM E DADOS */}
                  <View style={styles.cardBody}>
                    <View style={[styles.characterStage, { backgroundColor: char.softBg }]}>
                      <ExpoImage
                        source={char.image}
                        style={styles.characterImage}
                        contentFit="contain"
                        transition={200}
                      />
                    </View>

                    <View style={styles.cardInfo}>
                      <View style={styles.cardNameRow}>
                        <Text style={styles.characterName}>{char.name}</Text>
                        <View style={styles.animalTag}>
                          <Text style={styles.animalTagText}>
                            {char.animal}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.meaningText} numberOfLines={1}>
                        {char.meaning}
                      </Text>

                      {/* BLOCOS LIMPOS: DESAFIO & TATAME */}
                      <View style={styles.pillsBox}>
                        <View style={styles.challengeRow}>
                          <View style={styles.iconCircleRed}>
                            <Zap size={11} color="#b91c1c" />
                          </View>
                          <Text style={styles.challengeLabel}>Desafio:</Text>
                          <Text style={styles.challengeValue} numberOfLines={1}>
                            {char.challenge}
                          </Text>
                        </View>

                        <View style={styles.virtueRow}>
                          <View style={styles.iconCircleGreen}>
                            <ShieldCheck size={11} color="#15803d" />
                          </View>
                          <Text style={styles.virtueLabel}>No Tatame:</Text>
                          <Text style={styles.virtueValue} numberOfLines={1}>
                            {char.virtue}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* RODAPÉ DO CARD */}
                  <View style={styles.cardFooter}>
                    <Text style={styles.cardFooterAction}>Conhecer história completa</Text>
                    <ChevronRight size={16} color="#ca8a04" />
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* MODAL LIMPO COM DETALHES DO PERSONAGEM */}
      <Modal
        visible={!!activeModalChar}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveModalChar(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setActiveModalChar(null)}
          />

          {activeModalChar && (
            <View style={styles.modalSheet}>
              {/* INDICADOR DE ARRASTE */}
              <View style={styles.modalHandle} />

              {/* CABEÇALHO DO MODAL */}
              <View style={styles.modalHeaderRow}>
                <View style={[styles.modalStepBadge, { backgroundColor: activeModalChar.pillBg }]}>
                  <Text style={[styles.modalStepBadgeText, { color: activeModalChar.pillText }]}>
                    {activeModalChar.step} • {activeModalChar.belt}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => setActiveModalChar(null)}
                  style={styles.modalCloseButton}
                  hitSlop={12}
                >
                  <X size={20} color="#4b5563" />
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
              >
                {/* DESTAQUE DO PERSONAGEM */}
                <View style={[styles.modalStage, { backgroundColor: activeModalChar.softBg }]}>
                  <ExpoImage
                    source={activeModalChar.image}
                    style={styles.modalImage}
                    contentFit="contain"
                    transition={200}
                  />
                  <Text style={styles.modalName}>{activeModalChar.name}</Text>
                  <Text style={styles.modalAnimal}>
                    {activeModalChar.animal}
                  </Text>
                </View>

                {/* BLOCOS INFORMATIVOS */}
                <View style={styles.modalContent}>
                  {/* SIGNIFICADO DO NOME */}
                  <View style={styles.infoCard}>
                    <View style={styles.infoCardHeader}>
                      <BookOpen size={16} color="#3b82f6" />
                      <Text style={styles.infoCardTitle}>Origem & Significado</Text>
                    </View>
                    <Text style={styles.infoCardBody}>{activeModalChar.meaning}</Text>
                  </View>

                  {/* O DESAFIO */}
                  <View style={styles.infoCardRed}>
                    <View style={styles.infoCardHeader}>
                      <Zap size={16} color="#dc2626" />
                      <Text style={styles.infoCardTitleRed}>O Desafio Comportamental</Text>
                    </View>
                    <Text style={styles.infoCardBodyRed}>{activeModalChar.challenge}</Text>
                  </View>

                  {/* A LIÇÃO NO TATAME */}
                  <View style={styles.infoCardGreen}>
                    <View style={styles.infoCardHeader}>
                      <ShieldCheck size={16} color="#16a34a" />
                      <Text style={styles.infoCardTitleGreen}>A Lição no Tatame da Kihap</Text>
                    </View>
                    <Text style={styles.infoCardBodyGreen}>{activeModalChar.teaching}</Text>
                  </View>

                  {/* DICA PARA A FAMÍLIA (DESTAQUE AMARELO KIHAP) */}
                  <View style={styles.parentTipCard}>
                    <View style={styles.infoCardHeader}>
                      <Heart size={16} color="#ca8a04" />
                      <Text style={styles.parentTipTitle}>Dica dos Mestres para a Família</Text>
                    </View>
                    <Text style={styles.parentTipBody}>{activeModalChar.parentTip}</Text>
                  </View>

                  {/* BOTÃO FECHAR */}
                  <TouchableOpacity
                    style={styles.modalPrimaryButton}
                    onPress={() => setActiveModalChar(null)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.modalPrimaryButtonText}>Entendi, Mestre!</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  headerContainer: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 0,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  headerTitleBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: 'NeueMachina-Ultrabold',
    fontSize: 18,
    color: '#0f172a',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 1,
  },
  headerLogoBox: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLogo: {
    width: 28,
    height: 28,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
    paddingVertical: 0,
  },
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  listHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  listHeaderCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  cardsContainer: {
    paddingHorizontal: 16,
    gap: 14,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardBeltHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#fafafa',
  },
  beltStripeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 14,
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  beltStripeMain: {
    width: 44,
    height: '100%',
  },
  beltWhiteBorder: {
    borderRightWidth: 1,
    borderColor: '#cbd5e1',
  },
  beltStripeTip: {
    width: 22,
    height: '100%',
    backgroundColor: '#0f172a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 2,
  },
  beltStripeRankLine: {
    width: 2,
    height: '70%',
    backgroundColor: '#ffffff',
    borderRadius: 1,
  },
  stepBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  stepBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardBody: {
    flexDirection: 'row',
    padding: 14,
    gap: 14,
  },
  characterStage: {
    width: 105,
    height: 125,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  characterImage: {
    width: '100%',
    height: '100%',
  },
  cardInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  cardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  characterName: {
    fontFamily: 'NeueMachina-Ultrabold',
    fontSize: 20,
    color: '#0f172a',
  },
  animalTag: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  animalTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  meaningText: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 8,
  },
  pillsBox: {
    gap: 5,
  },
  challengeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 5,
  },
  iconCircleRed: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  challengeLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#991b1b',
  },
  challengeValue: {
    fontSize: 10,
    fontWeight: '600',
    color: '#7f1d1d',
    flex: 1,
  },
  virtueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 5,
  },
  iconCircleGreen: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  virtueLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#166534',
  },
  virtueValue: {
    fontSize: 10,
    fontWeight: '600',
    color: '#14532d',
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#fafafa',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  cardFooterAction: {
    fontSize: 12,
    fontWeight: '700',
    color: '#854d0e',
  },
  emptyBox: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
    paddingTop: 12,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#cbd5e1',
    alignSelf: 'center',
    marginBottom: 12,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  modalStepBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  modalStepBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalStage: {
    alignItems: 'center',
    paddingVertical: 18,
    marginHorizontal: 20,
    borderRadius: 20,
    marginBottom: 16,
  },
  modalImage: {
    width: 150,
    height: 170,
    marginBottom: 10,
  },
  modalName: {
    fontFamily: 'NeueMachina-Ultrabold',
    fontSize: 26,
    color: '#0f172a',
  },
  modalAnimal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
    marginTop: 2,
  },
  modalContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  infoCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  infoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  infoCardTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1e40af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoCardBody: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
  infoCardRed: {
    backgroundColor: '#fef2f2',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  infoCardTitleRed: {
    fontSize: 11,
    fontWeight: '800',
    color: '#b91c1c',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoCardBodyRed: {
    fontSize: 13,
    color: '#7f1d1d',
    lineHeight: 18,
    fontWeight: '600',
  },
  infoCardGreen: {
    backgroundColor: '#f0fdf4',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  infoCardTitleGreen: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803d',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoCardBodyGreen: {
    fontSize: 13,
    color: '#14532d',
    lineHeight: 19,
  },
  parentTipCard: {
    backgroundColor: '#fefce8',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#fef08a',
  },
  parentTipTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#854d0e',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  parentTipBody: {
    fontSize: 13,
    color: '#713f12',
    lineHeight: 19,
  },
  modalPrimaryButton: {
    backgroundColor: '#eab308',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  modalPrimaryButtonText: {
    fontFamily: 'NeueMachina-Ultrabold',
    fontSize: 14,
    color: '#000000',
    letterSpacing: 0.5,
  },
});
