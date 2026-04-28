import React, { useState, useEffect, useRef } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Platform, Image, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../../src/services/firebase';
import { useAuth } from '../../src/context/AuthContext';
import { useColorScheme } from 'nativewind';
import { ArrowLeft, Send, Smile, Paperclip } from 'lucide-react-native';

export default function ChatRoomScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [otherUser, setOtherUser] = useState<any>(null);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!id || !user) return;

    const chatRef = doc(db, 'chats', id as string);
    getDoc(chatRef).then(async (snap) => {
      if (snap.exists()) {
        const chatData = snap.data();
        if (!chatData.isGroup) {
          const otherId = chatData.members.find((mId: string) => mId !== user.uid);
          if (otherId) {
            const userSnap = await getDoc(doc(db, 'users', otherId));
            if (userSnap.exists()) {
              setOtherUser({ id: otherId, ...userSnap.data() });
            }
          }
        } else {
          setOtherUser({ name: chatData.name, photoURL: chatData.photoURL });
        }
      }
    });

    const messagesRef = collection(db, 'chats', id as string, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      setMessages(msgs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [id, user]);

  const handleSend = async () => {
    if (!inputText.trim() || !id || !user) return;
    const text = inputText.trim();
    setInputText('');

    try {
      const messagesRef = collection(db, 'chats', id as string, 'messages');
      await addDoc(messagesRef, {
        text,
        senderId: user.uid,
        timestamp: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isMe = item.senderId === user?.uid;
    
    return (
      <View className={`mb-4 flex-row ${isMe ? 'justify-end' : 'justify-start'} px-4`}>
        {!isMe && (
          <Image 
            source={{ uri: otherUser?.profilePicture || otherUser?.photoURL || 'https://kihap.com.br/intranet/default-profile.svg' }} 
            className="w-8 h-8 rounded-full mr-2 self-end"
          />
        )}
        <View 
          className={`max-w-[75%] px-4 py-3 rounded-3xl ${
            isMe 
              ? 'bg-[#eab308] rounded-br-none shadow-sm' 
              : 'bg-white dark:bg-[#222] rounded-bl-none shadow-sm'
          }`}
        >
          <Text className={`text-[15px] leading-relaxed ${isMe ? 'text-black font-bold' : 'text-gray-800 dark:text-gray-100 font-medium'}`}>
            {item.text}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1 }} className="bg-white dark:bg-[#050505]">
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View className="flex-row items-center px-4 py-3 border-b border-gray-100 dark:border-white/5 bg-white dark:bg-[#0a0a0a] z-50">
          <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
            <ArrowLeft size={24} color={isDark ? '#fff' : '#333'} />
          </TouchableOpacity>
          <Image 
            source={{ uri: otherUser?.profilePicture || otherUser?.photoURL || 'https://kihap.com.br/intranet/default-profile.svg' }} 
            className="w-10 h-10 rounded-full ml-2 border border-gray-50 dark:border-white/5"
          />
          <View className="ml-3 flex-1">
            <Text className="text-[15px] font-black text-gray-900 dark:text-white" numberOfLines={1}>
              {otherUser?.nome || otherUser?.name || 'Conversa'}
            </Text>
            <View className="flex-row items-center">
              <div className="w-2 h-2 rounded-full bg-green-500 mr-1.5" />
              <Text className="text-[10px] text-green-500 font-black uppercase tracking-widest">Online agora</Text>
            </View>
          </View>
        </View>

        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <View style={{ flex: 1 }} className="bg-gray-50 dark:bg-[#050505]">
            {loading ? (
              <View className="flex-1 items-center justify-center">
                <ActivityIndicator size="small" color="#eab308" />
              </View>
            ) : (
              <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(item) => item.id}
                renderItem={renderMessage}
                contentContainerStyle={{ paddingVertical: 24, flexGrow: 1 }}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
              />
            )}
          </View>

          {/* Input Area (Fixed to bottom) */}
          <View className="p-4 border-t border-gray-100 dark:border-white/5 bg-white dark:bg-[#0a0a0a]">
            <View className="flex-row items-center space-x-3">
              <TouchableOpacity className="w-10 h-10 rounded-full items-center justify-center bg-gray-50 dark:bg-white/5">
                <Smile size={22} color={isDark ? '#999' : '#666'} />
              </TouchableOpacity>
              
              <View className="flex-1 flex-row items-center bg-gray-50 dark:bg-white/5 rounded-full px-5 py-1 border border-gray-100 dark:border-transparent">
                <TextInput
                  placeholder="Escreva uma mensagem..."
                  placeholderTextColor="#999"
                  value={inputText}
                  onChangeText={setInputText}
                  className="flex-1 text-[16px] text-gray-900 dark:text-white py-3"
                  multiline
                />
                <TouchableOpacity className="ml-2">
                  <Paperclip size={18} color="#999" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity 
                onPress={handleSend}
                disabled={!inputText.trim()}
                className={`w-12 h-12 rounded-full items-center justify-center shadow-lg ${
                  inputText.trim() 
                    ? 'bg-[#014fa4]' 
                    : 'bg-gray-100 dark:bg-white/5'
                }`}
              >
                <Send size={18} color={inputText.trim() ? '#fff' : (isDark ? '#444' : '#ccc')} style={{ marginLeft: 3 }} />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
