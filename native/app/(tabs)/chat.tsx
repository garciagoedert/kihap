import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../../src/services/firebase';
import { useAuth } from '../../src/context/AuthContext';
import { useColorScheme } from 'nativewind';
import { Search, Edit3 } from 'lucide-react-native';
import { useRouter } from 'expo-router';

export default function ChatScreen() {
  const { user } = useAuth();
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!user) return;

    const chatsCollection = collection(db, 'chats');
    const q = query(
      chatsCollection, 
      where('members', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const chatList = await Promise.all(snapshot.docs.map(async (docSnap) => {
        const data = docSnap.data();
        let name = data.name;
        let photoURL = data.photoURL;

        if (!data.isGroup) {
          const otherId = data.members.find((mId: string) => mId !== user.uid);
          if (otherId) {
            const userSnap = await getDoc(doc(db, 'users', otherId));
            if (userSnap.exists()) {
              const uData = userSnap.data();
              name = uData.nome || uData.name;
              photoURL = uData.profilePicture || uData.photoURL;
            }
          }
        }

        return {
          id: docSnap.id,
          ...data,
          displayName: name || 'Conversa',
          displayPhoto: photoURL || 'https://kihap.com.br/intranet/default-profile.svg'
        };
      }));

      chatList.sort((a: any, b: any) => {
        const timeA = a.lastMessage?.timestamp?.toMillis() || 0;
        const timeB = b.lastMessage?.timestamp?.toMillis() || 0;
        return timeB - timeA;
      });

      setChats(chatList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const renderChatItem = ({ item }: { item: any }) => {
    const safeUserKey = user?.uid.replace(/\./g, '_');
    const unreadCount = item.unreadCount?.[safeUserKey || ''] || 0;
    const lastMsgText = item.lastMessage?.text || 'Inicie uma conversa...';
    const lastMsgTime = item.lastMessage?.timestamp 
      ? new Date(item.lastMessage.timestamp.toMillis()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';

    return (
      <TouchableOpacity 
        onPress={() => router.push(`/chat/${item.id}`)}
        className="flex-row items-center px-6 py-3 active:bg-gray-100 dark:active:bg-white/5"
      >
        <View className="relative">
          <Image 
            source={{ uri: item.displayPhoto }} 
            className="w-14 h-14 rounded-full border border-gray-100 dark:border-white/10" 
          />
          <View className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white dark:border-[#050505] rounded-full" />
        </View>
        <View className="flex-1 ml-4 border-b border-gray-50 dark:border-white/5 pb-3">
          <View className="flex-row justify-between items-center mb-0.5">
            <Text className="text-[15px] font-bold text-gray-900 dark:text-white" numberOfLines={1}>{item.displayName}</Text>
            <Text className="text-[11px] text-gray-400 font-medium">{lastMsgTime}</Text>
          </View>
          <View className="flex-row justify-between items-center">
            <Text className="text-[13px] text-gray-500 dark:text-gray-400 truncate flex-1" numberOfLines={1}>{lastMsgText}</Text>
            {unreadCount > 0 && (
              <View className="bg-[#014fa4] w-5 h-5 items-center justify-center rounded-full ml-2">
                <Text className="text-[10px] text-white font-bold">{unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, paddingTop: insets.top }} className="flex-1 bg-gray-50 dark:bg-[#050505]">
      <View className="px-6 pt-8 pb-4 flex-row items-center justify-between">
        <Text className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Mensagens</Text>
        <TouchableOpacity className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-200 dark:bg-white/5">
          <Edit3 size={20} color={isDark ? '#fff' : '#333'} />
        </TouchableOpacity>
      </View>

      <View className="px-6 mb-4">
        <View className="flex-row items-center bg-white dark:bg-white/5 border border-gray-200 dark:border-transparent px-4 py-2.5 rounded-2xl">
          <Search size={18} color="#999" />
          <Text className="text-gray-500 ml-2 font-medium text-[15px]">Pesquisar</Text>
        </View>
      </View>

      <View className="px-6 mb-6 flex-row space-x-2">
        <TouchableOpacity className="px-5 py-2.5 bg-white dark:bg-white/10 rounded-full border border-gray-100 dark:border-transparent shadow-sm">
          <Text className="text-black dark:text-white font-bold text-sm">Caixa de Entrada</Text>
        </TouchableOpacity>
        <TouchableOpacity className="px-5 py-2.5 bg-white dark:bg-white/5 rounded-full border border-gray-100 dark:border-transparent">
          <Text className="text-gray-500 dark:text-gray-400 font-bold text-sm">Pedidos</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#eab308" />
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 100 }}
          renderItem={renderChatItem}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center pt-20 px-8">
              <Text className="text-gray-400 text-center font-medium">Nenhuma conversa encontrada.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}