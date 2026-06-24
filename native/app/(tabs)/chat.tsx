import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, query, where, onSnapshot, doc, getDoc, orderBy, limit, updateDoc } from 'firebase/firestore';
import { db } from '../../src/services/firebase';
import { useAuth } from '../../src/context/AuthContext';
import { useColorScheme } from 'nativewind';
import { Search, Edit3, MessageCircle, Award, CreditCard, Bell } from 'lucide-react-native';
import { useRouter } from 'expo-router';

export default function ChatScreen() {
  const { user } = useAuth();
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<'conversas' | 'notificacoes'>('notificacoes');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNotifId, setExpandedNotifId] = useState<string | null>(null);

  const formatNotifDate = (createdAt: any) => {
    if (!createdAt) return 'Agora';
    try {
      let date: Date;
      if (typeof createdAt.toDate === 'function') {
        date = createdAt.toDate();
      } else if (createdAt.seconds) {
        date = new Date(createdAt.seconds * 1000);
      } else {
        date = new Date(createdAt);
      }
      
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Agora';
      if (diffMins < 60) return `${diffMins}m atrás`;
      if (diffHours < 24) return `${diffHours}h atrás`;
      if (diffDays === 1) return 'Ontem';
      if (diffDays < 7) return `${diffDays}d atrás`;
      
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    } catch (e) {
      return 'Agora';
    }
  };

  const handleNotificationPress = async (notif: any) => {
    if (expandedNotifId === notif.id) {
      setExpandedNotifId(null);
    } else {
      setExpandedNotifId(notif.id);
    }

    if (!notif.read) {
      try {
        await updateDoc(doc(db, 'notifications', notif.id), {
          read: true
        });
      } catch (err) {
        console.error("Error marking notification as read:", err);
      }
    }
  };

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

  // Fetch notifications
  useEffect(() => {
    if (!user) return;

    const notifsCollection = collection(db, 'notifications');
    const q = query(
      notifsCollection,
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifList = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      setNotifications(notifList);
      setLoadingNotifs(false);
    }, (error) => {
      console.error("Error fetching notifications:", error);
      setLoadingNotifs(false);
    });

    return () => unsubscribe();
  }, [user]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'chat': return MessageCircle;
      case 'award': return Award;
      case 'payment': return CreditCard;
      default: return Bell;
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case 'chat': return '#014fa4';
      case 'award': return '#eab308';
      case 'payment': return '#22c55e';
      default: return '#666';
    }
  };

  const defaultProfileImg = require('../../assets/images/default-profile.png');

  const renderChatItem = ({ item }: { item: any }) => {
    const safeUserKey = user?.uid.replace(/\./g, '_');
    const unreadCount = item.unreadCount?.[safeUserKey || ''] || 0;
    const lastMsgText = item.lastMessage?.text || 'Inicie uma conversa...';
    const lastMsgTime = item.lastMessage?.timestamp 
      ? new Date(item.lastMessage.timestamp.toMillis()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';

    const hasPhoto = item.displayPhoto && !item.displayPhoto.includes('default-profile.svg') && !item.displayPhoto.includes('default-profile.png');
    const photoSource = hasPhoto ? { uri: item.displayPhoto.startsWith('/') ? `https://kihap.com.br${item.displayPhoto}` : item.displayPhoto } : defaultProfileImg;

    return (
      <TouchableOpacity 
        onPress={() => router.push(`/chat/${item.id}`)}
        className="flex-row items-center px-6 py-3 active:bg-gray-100 dark:active:bg-white/5"
      >
        <View className="relative">
          <Image 
            source={photoSource} 
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

  // Filter conversations
  const filteredChats = chats.filter(chat => {
    const queryStr = searchQuery.toLowerCase();
    const displayName = (chat.displayName || '').toLowerCase();
    const lastMessage = (chat.lastMessage?.text || '').toLowerCase();
    return displayName.includes(queryStr) || lastMessage.includes(queryStr);
  });

  // Filter notifications
  const filteredNotifications = notifications.filter(notif => {
    const queryStr = searchQuery.toLowerCase();
    const title = (notif.title || '').toLowerCase();
    const message = (notif.message || '').toLowerCase();
    return title.includes(queryStr) || message.includes(queryStr);
  });

  return (
    <View style={{ flex: 1, paddingTop: insets.top }} className="flex-1 bg-gray-50 dark:bg-[#050505]">
      {/* Header */}
      <View className="px-6 pt-8 pb-4 flex-row items-center justify-between">
        <Text className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          {activeTab === 'conversas' ? 'Mensagens' : 'Notificações'}
        </Text>
        {activeTab === 'conversas' && (
          <TouchableOpacity 
            onPress={() => router.push('/busca')}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-200 dark:bg-white/5"
          >
            <Edit3 size={20} color={isDark ? '#fff' : '#333'} />
          </TouchableOpacity>
        )}
      </View>

      {/* Sub-tab Selector */}
      <View className="flex-row bg-gray-100 dark:bg-[#1a1a1a] p-1.5 rounded-2xl mx-6 mb-4">
        <TouchableOpacity
          onPress={() => {
            setActiveTab('notificacoes');
            setSearchQuery('');
          }}
          style={activeTab === 'notificacoes' ? {
            backgroundColor: isDark ? '#2b2b2b' : '#fff',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.15,
            shadowRadius: 1.5,
            elevation: 2,
          } : null}
          className="flex-1 py-3 rounded-xl items-center justify-center"
        >
          <Text 
            style={{ color: activeTab === 'notificacoes' ? (isDark ? '#fff' : '#111') : '#999' }}
            className="text-[11px] font-black uppercase tracking-wider text-center"
          >
            Notificações
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            setActiveTab('conversas');
            setSearchQuery('');
          }}
          style={activeTab === 'conversas' ? {
            backgroundColor: isDark ? '#2b2b2b' : '#fff',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.15,
            shadowRadius: 1.5,
            elevation: 2,
          } : null}
          className="flex-1 py-3 rounded-xl items-center justify-center"
        >
          <Text 
            style={{ color: activeTab === 'conversas' ? (isDark ? '#fff' : '#111') : '#999' }}
            className="text-[11px] font-black uppercase tracking-wider text-center"
          >
            Conversas
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      {activeTab === 'conversas' && (
        <View className="px-6 mb-4">
          <View className="flex-row items-center bg-white dark:bg-white/5 border border-gray-200 dark:border-transparent px-4 py-2 rounded-2xl">
            <Search size={18} color="#999" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Pesquisar..."
              placeholderTextColor="#999"
              className="flex-1 ml-2 text-gray-950 dark:text-white font-medium text-[15px] p-0"
            />
          </View>
        </View>
      )}

      {activeTab === 'conversas' ? (
        <>

          {loading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color="#eab308" />
            </View>
          ) : (
            <FlatList
              data={filteredChats}
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
        </>
      ) : (
        loadingNotifs ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#eab308" />
          </View>
        ) : (
          <FlatList
            data={filteredNotifications}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 100 }}
            renderItem={({ item }) => {
              const IconComp = getIcon(item.type);
              const color = getColor(item.type);
              const isExpanded = expandedNotifId === item.id;
              
              return (
                <TouchableOpacity 
                  onPress={() => handleNotificationPress(item)}
                  style={!item.read ? {
                    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.05)' : 'rgba(239, 246, 255, 0.2)'
                  } : null}
                  className="flex-row items-start px-6 py-4 active:bg-gray-50 dark:active:bg-white/5"
                >
                  <View className="relative">
                    <View 
                      style={{ backgroundColor: `${color}15` }}
                      className="w-12 h-12 rounded-full items-center justify-center bg-gray-50 dark:bg-white/10"
                    >
                      <IconComp size={22} color={color} />
                    </View>
                    {!item.read && (
                      <View className="absolute top-0 right-0 w-3 h-3 bg-blue-500 rounded-full border-2 border-white dark:border-[#0a0a0a]" />
                    )}
                  </View>
                  <View className="flex-1 ml-4 border-b border-gray-50 dark:border-white/5 pb-4">
                    <View className="flex-row justify-between items-start mb-1">
                      <Text 
                        style={!item.read ? { fontWeight: '900' } : { fontWeight: '700' }}
                        className="text-[15px] text-gray-900 dark:text-white flex-1"
                      >
                        {item.title}
                      </Text>
                      <Text className="text-[11px] text-gray-400 font-bold ml-2">
                        {formatNotifDate(item.createdAt)}
                      </Text>
                    </View>
                    <Text 
                      className="text-[14px] text-gray-500 dark:text-gray-400 leading-snug" 
                      numberOfLines={isExpanded ? undefined : 2}
                    >
                      {item.message}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View className="flex-1 items-center justify-center pt-20 px-8">
                <Text className="text-gray-400 text-center font-medium">Nenhuma notificação encontrada.</Text>
              </View>
            }
          />
        )
      )}
    </View>
  );
}