import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  TextInput,
  Modal,
  Platform,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import {
  ArrowLeft,
  Sparkles,
  Search,
  X,
  Award,
  Heart,
  Shield,
  Smile,
  Compass,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { StatusBar } from 'expo-status-bar';

interface LittleCharacter {
  id: string;
  name: string;
  belt: string;
  beltShort: string;
  beltHex: string;
  beltDarkBg: string;
  beltLightBg: string;
  animal: string;
  meaning: string;
  traits: string;
  teaching: string;
  image: any;
}

const LITTLES_DATA: LittleCharacter[] = [
  {
    id: 'miles',
    name: 'Miles',
    belt: 'Faixa Branca',
    beltShort: 'Branca',
    beltHex: '#e5e7eb',
    beltDarkBg: 'rgba(255,255,255,0.08)',
    beltLightBg: '#f3f4f6',
    animal: 'Panda',
    meaning: 'O nome Miles possui simbologia relacionada a "amoroso" e "bondoso".',
    traits: 'Agitado e ansioso.',
    teaching: 'No tatame, Miles aprende a canalizar sua agitação em foco, respiração e disciplina para dar os primeiros passos no caminho marcial.',
    image: require('../assets/images/littles/miles.png'),
  },
  {
    id: 'jun',
    name: 'Jun',
    belt: 'Faixa Laranja',
    beltShort: 'Laranja',
    beltHex: '#ea580c',
    beltDarkBg: 'rgba(234,88,12,0.15)',
    beltLightBg: '#ffedd5',
    animal: 'Leão',
    meaning: 'Nome originalmente chinês que quer dizer "rei, governante". Em coreano, o significado se altera para "belo, talentoso".',
    traits: 'Inseguro e medroso.',
    teaching: 'Apesar de ser o rei da floresta, Jun sente medo dos desafios. No tatame, descobre que a verdadeira coragem é tentar mesmo com receio!',
    image: require('../assets/images/littles/jun.png'),
  },
  {
    id: 'eddy',
    name: 'Eddy',
    belt: 'Faixa Amarela',
    beltShort: 'Amarela',
    beltHex: '#eab308',
    beltDarkBg: 'rgba(234,179,8,0.15)',
    beltLightBg: '#fef9c3',
    animal: 'Girafa',
    meaning: '"Guardião das riquezas", "protetor das riquezas" ou "guardião rico".',
    traits: 'Impulsivo e falante.',
    teaching: 'Eddy é muito curioso e adora falar! No tatame, ele treina a disciplina de ouvir com atenção e pensar antes de agir.',
    image: require('../assets/images/littles/eddy.png'),
  },
  {
    id: 'sachi',
    name: 'Sachi',
    belt: 'Faixa Camuflada',
    beltShort: 'Camuflada',
    beltHex: '#4d7c0f',
    beltDarkBg: 'rgba(77,124,15,0.18)',
    beltLightBg: '#ecfccb',
    animal: 'Borboleta',
    meaning: 'Originário da cultura japonesa, significa "criança de felicidade e alegria".',
    traits: 'Egoísta e convencida.',
    teaching: 'Sachi aprende a importância da humildade, do espírito de equipe e de apoiar os colegas, descobrindo que vencer juntos é mais bonito.',
    image: require('../assets/images/littles/sachi.png'),
  },
  {
    id: 'kobe',
    name: 'Kobe',
    belt: 'Faixa Verde',
    beltShort: 'Verde',
    beltHex: '#16a34a',
    beltDarkBg: 'rgba(22,163,74,0.18)',
    beltLightBg: '#dcfce7',
    animal: 'Jacaré',
    meaning: 'Significa "pequeno que vence", "pequeno vencedor" ou "pequeno suplantador".',
    traits: 'Teimoso e respondão.',
    teaching: 'O famoso Kobe tem uma determinação sem igual, mas precisava aprender a ouvir. Com as artes marciais, ele vence com respeito e gentileza!',
    image: require('../assets/images/littles/kobe.png'),
  },
  {
    id: 'hye',
    name: 'Hye',
    belt: 'Faixa Roxa',
    beltShort: 'Roxa',
    beltHex: '#9333ea',
    beltDarkBg: 'rgba(147,51,234,0.18)',
    beltLightBg: '#f3e8ff',
    animal: 'Coruja',
    meaning: 'Nome de origem coreana que significa "brilhante" ou "inteligente".',
    traits: 'Esquecida e avoada.',
    teaching: 'Hye tem uma inteligência admirável, mas vivia distraída. As formas e movimentos do Kihap a ajudam a praticar foco, presença e memória.',
    image: require('../assets/images/littles/hye.png'),
  },
  {
    id: 'hope',
    name: 'Hope',
    belt: 'Faixa Azul',
    beltShort: 'Azul',
    beltHex: '#2563eb',
    beltDarkBg: 'rgba(37,99,235,0.18)',
    beltLightBg: '#dbeafe',
    animal: 'Arara',
    meaning: 'Nome de origem indígena norte-americana, relacionado ao povo originário "Hopi" (povo pacífico).',
    traits: 'Tímida e indecisa.',
    teaching: 'Hope tinha receio de se expressar. Com os treinos de força e o grito de energia (Kihap!), ela desenvolve voz firme e confiança inabalável.',
    image: require('../assets/images/littles/hope.png'),
  },
  {
    id: 'jeong',
    name: 'Jeong',
    belt: 'Faixa Marrom',
    beltShort: 'Marrom',
    beltHex: '#854d0e',
    beltDarkBg: 'rgba(133,77,14,0.22)',
    beltLightBg: '#fef3c7',
    animal: 'Macaco',
    meaning: 'Nome que vem do coreano e quer dizer "correto", "apropriado", "bondoso".',
    traits: 'Mal-humorado e individualista.',
    teaching: 'Jeong se irritava quando errava. Rumo à faixa preta, ele aprende resiliência emocional, paciência e a alegria de treinar em comunidade.',
    image: require('../assets/images/littles/jeong.png'),
  },
  {
    id: 'benny',
    name: 'Benny',
    belt: 'Faixa Vermelha',
    beltShort: 'Vermelha',
    beltHex: '#dc2626',
    beltDarkBg: 'rgba(220,38,38,0.18)',
    beltLightBg: '#fee2e2',
    animal: 'Fênix',
    meaning: 'Possui simbologia relacionada a "bento", "abençoado" e "filho da fortuna e riqueza".',
    traits: 'Acomodado e desconfiado.',
    teaching: 'Na reta final para a Faixa Preta, a Fênix Benny aprende a renascer da zona de conforto com esforço máximo e confiança no mestre!',
    image: require('../assets/images/littles/benny.png'),
  },
];

export default function LittlesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [selectedBelt, setSelectedBelt] = useState<string>('todos');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeModalChar, setActiveModalChar] = useState<LittleCharacter | null>(null);

  const beltFilters = useMemo(() => {
    return [
      { id: 'todos', label: 'Todos' },
      ...LITTLES_DATA.map((c) => ({ id: c.id, label: c.beltShort })),
    ];
  }, []);

  const filteredCharacters = useMemo(() => {
    return LITTLES_DATA.filter((c) => {
      const matchBelt =
        selectedBelt === 'todos' || c.id === selectedBelt || c.beltShort.toLowerCase() === selectedBelt.toLowerCase();

      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.animal.toLowerCase().includes(q) ||
        c.belt.toLowerCase().includes(q) ||
        c.traits.toLowerCase().includes(q);

      return matchBelt && matchSearch;
    });
  }, [selectedBelt, searchQuery]);

  return (
    <View className="flex-1 bg-[#f8f7f4] dark:bg-[#0c0c0c]">
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack.Screen options={{ headerShown: false }} />

      {/* HEADER */}
      <View
        style={{ paddingTop: insets.top + (Platform.OS === 'ios' ? 8 : 14) }}
        className="px-5 pb-4 bg-white/95 dark:bg-[#141414]/95 border-b border-gray-150 dark:border-white/5 backdrop-blur-md"
      >
        <View className="flex-row items-center justify-between mb-3">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-2xl bg-gray-100 dark:bg-white/10 items-center justify-center active:scale-95 transition-transform"
            accessibilityLabel="Voltar"
          >
            <ArrowLeft size={20} color={isDark ? '#ffffff' : '#111827'} />
          </TouchableOpacity>

          <View className="items-center flex-1 px-3">
            <View className="flex-row items-center gap-1.5">
              <Sparkles size={16} color="#eab308" />
              <Text className="text-base font-black text-gray-900 dark:text-white tracking-tight">
                Turma dos Littles
              </Text>
            </View>
            <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
              Mascotes & Graduação Kihap
            </Text>
          </View>

          <View className="w-10 h-10 items-center justify-center">
            <View className="w-8 h-8 rounded-full bg-yellow-500/10 dark:bg-yellow-500/20 items-center justify-center">
              <Smile size={18} color="#eab308" />
            </View>
          </View>
        </View>

        {/* SEARCH BAR */}
        <View className="flex-row items-center bg-gray-100 dark:bg-white/5 rounded-2xl px-3.5 py-2.5 border border-gray-200/50 dark:border-white/5">
          <Search size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Buscar por nome, animal ou faixa..."
            placeholderTextColor={isDark ? '#6b7280' : '#9ca3af'}
            className="flex-1 ml-2.5 text-xs text-gray-900 dark:text-white font-medium"
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={15} color={isDark ? '#9ca3af' : '#6b7280'} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      >
        {/* HERO BANNER EXPLICATIVO */}
        <View className="mx-5 mt-4 p-5 rounded-3xl bg-gradient-to-r from-yellow-500/15 via-amber-500/10 to-orange-500/15 border border-yellow-500/20 dark:border-yellow-500/10">
          <View className="flex-row items-center gap-2 mb-1.5">
            <View className="w-6 h-6 rounded-lg bg-yellow-500 items-center justify-center">
              <Award size={14} color="#000" />
            </View>
            <Text className="text-xs font-black text-gray-900 dark:text-yellow-400 uppercase tracking-wider">
              A Jornada dos Littles
            </Text>
          </View>
          <Text className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
            Cada personagem representa uma faixa e traz um desafio de comportamento que toda criança vivencia. No tatame, transformamos desafios em virtudes marciais!
          </Text>
        </View>

        {/* BELT FILTER TABS */}
        <View className="mt-4">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
            className="flex-row"
          >
            {beltFilters.map((tab) => {
              const active = selectedBelt === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => setSelectedBelt(tab.id)}
                  activeOpacity={0.8}
                  className={`px-3.5 py-1.5 rounded-full border transition-all ${
                    active
                      ? 'bg-yellow-500 border-yellow-500'
                      : 'bg-white dark:bg-[#1a1a1a] border-gray-200 dark:border-white/10'
                  }`}
                >
                  <Text
                    className={`text-[11px] font-bold ${
                      active ? 'text-black' : 'text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* CHARACTERS LIST */}
        <View className="px-5 mt-5">
          {filteredCharacters.length === 0 ? (
            <View className="py-14 items-center justify-center bg-white dark:bg-[#141414] rounded-3xl border border-dashed border-gray-200 dark:border-white/10 mt-2">
              <Smile size={36} color="#9ca3af" />
              <Text className="text-sm font-bold text-gray-500 dark:text-gray-400 mt-2">
                Nenhum personagem encontrado
              </Text>
              <Text className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                Tente buscar por outro termo ou selecione "Todos".
              </Text>
            </View>
          ) : (
            filteredCharacters.map((char, index) => {
              return (
                <TouchableOpacity
                  key={char.id}
                  activeOpacity={0.92}
                  onPress={() => setActiveModalChar(char)}
                  className="mb-4 rounded-3xl p-5 bg-white dark:bg-[#171717] border border-gray-150 dark:border-white/5 shadow-sm overflow-hidden relative"
                >
                  {/* Subtle color highlight top bar */}
                  <View
                    style={{ backgroundColor: char.beltHex }}
                    className="absolute top-0 left-0 right-0 h-1.5"
                  />

                  <View className="flex-row items-center gap-4">
                    {/* Character Avatar Showcase */}
                    <View
                      style={{
                        backgroundColor: isDark ? char.beltDarkBg : char.beltLightBg,
                        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                      }}
                      className="w-24 h-24 rounded-2xl items-center justify-center p-1.5 border relative overflow-hidden"
                    >
                      <Image
                        source={char.image}
                        className="w-full h-full"
                        resizeMode="contain"
                      />
                    </View>

                    {/* Character Basic Info */}
                    <View className="flex-1">
                      <View className="flex-row items-center justify-between mb-1">
                        <View
                          style={{
                            backgroundColor: isDark ? char.beltDarkBg : char.beltLightBg,
                            borderColor: char.beltHex,
                          }}
                          className="px-2.5 py-0.5 rounded-full border flex-row items-center gap-1"
                        >
                          <View
                            style={{ backgroundColor: char.beltHex }}
                            className="w-2 h-2 rounded-full"
                          />
                          <Text
                            style={{
                              color: isDark && char.belt === 'Faixa Branca' ? '#ffffff' : char.beltHex,
                            }}
                            className="text-[10px] font-black uppercase tracking-wider"
                          >
                            {char.belt}
                          </Text>
                        </View>

                        <Text className="text-[10px] font-bold text-gray-400">
                          #{index + 1}
                        </Text>
                      </View>

                      <Text className="text-xl font-black text-gray-900 dark:text-white tracking-tight">
                        {char.name}
                      </Text>
                      <Text className="text-xs font-bold text-gray-500 dark:text-gray-400 mt-0.5">
                        Animal: <Text className="text-yellow-600 dark:text-yellow-400">{char.animal}</Text>
                      </Text>

                      <View className="mt-2 flex-row items-center gap-1">
                        <Text className="text-[11px] font-medium text-gray-600 dark:text-gray-300" numberOfLines={2}>
                          <Text className="font-bold text-gray-700 dark:text-gray-200">Desafio: </Text>
                          {char.traits}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Quick Expand / Tap CTA */}
                  <View className="mt-3.5 pt-3 border-t border-gray-100 dark:border-white/5 flex-row items-center justify-between">
                    <Text className="text-[10px] font-bold text-gray-400 dark:text-gray-400 flex-row items-center gap-1">
                      <Compass size={12} color={isDark ? '#9ca3af' : '#6b7280'} /> Toque para ver o ensinamento no tatame
                    </Text>
                    <View className="w-6 h-6 rounded-full bg-gray-100 dark:bg-white/10 items-center justify-center">
                      <Sparkles size={11} color="#eab308" />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* CHARACTER DETAIL MODAL */}
      <Modal
        visible={!!activeModalChar}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveModalChar(null)}
      >
        <View className="flex-1 bg-black/75 justify-center items-center p-5">
          <View className="w-full max-w-sm bg-white dark:bg-[#1a1a1a] rounded-3xl border border-gray-200 dark:border-white/10 overflow-hidden shadow-2xl">
            {activeModalChar && (
              <>
                {/* Modal Top Belt Color Stripe */}
                <View
                  style={{ backgroundColor: activeModalChar.beltHex }}
                  className="h-2 w-full"
                />

                <View className="p-6">
                  {/* Close button */}
                  <View className="flex-row items-center justify-between mb-4">
                    <View
                      style={{
                        backgroundColor: isDark ? activeModalChar.beltDarkBg : activeModalChar.beltLightBg,
                        borderColor: activeModalChar.beltHex,
                      }}
                      className="px-3 py-1 rounded-full border flex-row items-center gap-1.5"
                    >
                      <View
                        style={{ backgroundColor: activeModalChar.beltHex }}
                        className="w-2.5 h-2.5 rounded-full"
                      />
                      <Text
                        style={{
                          color: isDark && activeModalChar.belt === 'Faixa Branca' ? '#ffffff' : activeModalChar.beltHex,
                        }}
                        className="text-xs font-black uppercase tracking-wider"
                      >
                        {activeModalChar.belt}
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={() => setActiveModalChar(null)}
                      className="w-8 h-8 rounded-full bg-gray-100 dark:bg-white/10 items-center justify-center active:scale-95"
                    >
                      <X size={16} color={isDark ? '#fff' : '#111827'} />
                    </TouchableOpacity>
                  </View>

                  {/* Character Large Visual */}
                  <View
                    style={{
                      backgroundColor: isDark ? activeModalChar.beltDarkBg : activeModalChar.beltLightBg,
                    }}
                    className="w-full h-44 rounded-2xl items-center justify-center p-3 mb-4 overflow-hidden border border-gray-100 dark:border-white/5"
                  >
                    <Image
                      source={activeModalChar.image}
                      className="w-full h-full"
                      resizeMode="contain"
                    />
                  </View>

                  <Text className="text-2xl font-black text-gray-900 dark:text-white tracking-tight text-center">
                    {activeModalChar.name}
                  </Text>
                  <Text className="text-xs font-bold text-yellow-600 dark:text-yellow-400 text-center uppercase tracking-widest mt-0.5">
                    Mascote {activeModalChar.animal}
                  </Text>

                  {/* Information Blocks */}
                  <View className="mt-5 space-y-3">
                    <View className="p-3.5 rounded-2xl bg-gray-50 dark:bg-[#222222] border border-gray-100 dark:border-white/5">
                      <View className="flex-row items-center gap-1.5 mb-1">
                        <Heart size={14} color="#eab308" />
                        <Text className="text-[11px] font-black text-gray-900 dark:text-white uppercase tracking-wider">
                          Significado do Nome
                        </Text>
                      </View>
                      <Text className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                        {activeModalChar.meaning}
                      </Text>
                    </View>

                    <View className="p-3.5 rounded-2xl bg-gray-50 dark:bg-[#222222] border border-gray-100 dark:border-white/5">
                      <View className="flex-row items-center gap-1.5 mb-1">
                        <Shield size={14} color="#f97316" />
                        <Text className="text-[11px] font-black text-gray-900 dark:text-white uppercase tracking-wider">
                          Desafio Comportamental
                        </Text>
                      </View>
                      <Text className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                        {activeModalChar.traits}
                      </Text>
                    </View>

                    <View className="p-3.5 rounded-2xl bg-yellow-500/10 dark:bg-yellow-500/15 border border-yellow-500/25">
                      <View className="flex-row items-center gap-1.5 mb-1">
                        <Award size={14} color="#eab308" />
                        <Text className="text-[11px] font-black text-yellow-700 dark:text-yellow-400 uppercase tracking-wider">
                          Evolução no Tatame
                        </Text>
                      </View>
                      <Text className="text-xs text-gray-700 dark:text-gray-200 leading-relaxed font-medium">
                        {activeModalChar.teaching}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => setActiveModalChar(null)}
                    className="mt-5 w-full py-3 rounded-2xl bg-yellow-500 items-center justify-center active:scale-98 shadow-sm"
                  >
                    <Text className="text-xs font-black text-black uppercase tracking-wider">
                      Fechar
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
