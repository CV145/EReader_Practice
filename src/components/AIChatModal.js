import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  Modal, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  SafeAreaView, 
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert
} from 'react-native';
import { getSetting, getChatHistory, addChatHistory, clearChatHistory } from '../database/db';
import { chatWithGemini, listModels } from '../services/aiService';

export default function AIChatModal({ visible, onClose, bookId, chapterText }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef(null);

  useEffect(() => {
    if (visible) {
      loadHistory();
      const apiKey = getSetting('gemini_api_key');
      if (apiKey) listModels(apiKey);
    }
  }, [visible, bookId]);

  const loadHistory = () => {
    try {
      const history = getChatHistory(bookId);
      setMessages(history);
    } catch (e) {
      console.error('Error loading chat history', e);
    }
  };

  const handleSend = async (customPrompt = null) => {
    const prompt = customPrompt || input.trim();
    if (!prompt && !customPrompt) return;

    const apiKey = getSetting('gemini_api_key');
    if (!apiKey) {
      Alert.alert('Missing API Key', 'Go to Settings in the Library to add your Gemini API Key.');
      return;
    }

    if (!chapterText) {
      if (!loading) {
        console.log("AI Modal: Waiting for chapter text...");
        setLoading(true);
        setTimeout(() => handleSend(prompt), 1000);
        return;
      } else {
        console.log("AI Modal: Still waiting for chapter text retry...");
        setTimeout(() => handleSend(prompt), 1000);
        return;
      }
    }

    setLoading(true);
    console.log("AI Modal: Sending request to Gemini...");
    if (!customPrompt) setInput('');

    const userMsg = { role: 'user', content: prompt };
    setMessages(prev => [...prev, userMsg]);
    addChatHistory(bookId, 'user', prompt);

    try {
      const response = await chatWithGemini(apiKey, chapterText, messages, prompt);
      const aiMsg = { role: 'model', content: response };
      setMessages(prev => [...prev, aiMsg]);
      addChatHistory(bookId, 'model', response);
    } catch (err) {
      Alert.alert('AI Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const onSummarize = () => {
    handleSend("Please provide a concise summary of this chapter, highlighting the main events and character developments.");
  };

  const onClear = () => {
    Alert.alert("Clear Chat", "Delete the entire chat history for this book?", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: () => {
          clearChatHistory(bookId);
          setMessages([]);
      }}
    ]);
  };

  const renderMessage = ({ item }) => (
    <View style={[
      styles.messageBubble, 
      item.role === 'user' ? styles.userBubble : styles.aiBubble
    ]}>
      <Text style={styles.roleLabel}>{item.role === 'user' ? 'You' : 'Gemini'}</Text>
      <Text style={styles.messageText}>{item.content}</Text>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={{ flex: 1 }}
        >
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>AI Reading Assistant</Text>
              <Text style={styles.subtitle}>Powered by Gemini · Chapter context active</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>Done</Text>
            </TouchableOpacity>
          </View>

          {messages.length === 0 && !loading && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>✦</Text>
              <Text style={styles.emptyTitle}>Ask anything about this chapter</Text>
              <Text style={styles.emptyHint}>Character analysis, plot summaries, themes, vocabulary — I've read the chapter and I'm ready to discuss.</Text>
            </View>
          )}

          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(_, index) => index.toString()}
            renderItem={renderMessage}
            contentContainerStyle={styles.chatList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          />

          {loading && <ActivityIndicator style={{ marginBottom: 12 }} color="#8B6914" />}

          <View style={styles.footer}>
            <View style={styles.shortcuts}>
               <TouchableOpacity style={styles.shortcutBtn} onPress={onSummarize} disabled={loading} activeOpacity={0.7}>
                 <Text style={styles.shortcutText}>✦ Summarize</Text>
               </TouchableOpacity>
               <TouchableOpacity style={styles.clearBtn} onPress={onClear} activeOpacity={0.7}>
                 <Text style={styles.clearBtnText}>Clear</Text>
               </TouchableOpacity>
            </View>
            
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="Ask about this chapter..."
                placeholderTextColor="#B8A88A"
                value={input}
                onChangeText={setInput}
                multiline
              />
              <TouchableOpacity 
                style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]} 
                onPress={() => handleSend()}
                disabled={!input.trim() || loading}
                activeOpacity={0.7}
              >
                <Text style={styles.sendBtnText}>↑</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF6F0' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E8DDD0',
    backgroundColor: '#FAF6F0'
  },
  title: { fontSize: 19, fontWeight: '700', color: '#2C2C2C' },
  subtitle: { fontSize: 12, color: '#8B6914', marginTop: 3 },
  closeBtn: { 
    paddingHorizontal: 16, 
    paddingVertical: 8, 
    backgroundColor: '#F0E6D6', 
    borderRadius: 20 
  },
  closeText: { color: '#8B6914', fontWeight: '600', fontSize: 15 },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  emptyIcon: { fontSize: 36, color: '#C4A265', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#2C2C2C', marginBottom: 10, textAlign: 'center' },
  emptyHint: { fontSize: 14, color: '#7A7A7A', textAlign: 'center', lineHeight: 21 },
  chatList: { padding: 20, paddingBottom: 16 },
  messageBubble: {
    padding: 14,
    borderRadius: 16,
    marginBottom: 14,
    maxWidth: '85%',
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#8B691415',
    borderWidth: 1,
    borderColor: '#E8DDD0',
  },
  aiBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFF8F0',
    borderWidth: 1,
    borderColor: '#E8DDD0',
  },
  roleLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#C4A265',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  messageText: {
    color: '#2C2C2C',
    fontSize: 15,
    lineHeight: 23,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E8DDD0',
    backgroundColor: '#FAF6F0'
  },
  shortcuts: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  shortcutBtn: {
    backgroundColor: '#F0E6D6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  shortcutText: { color: '#8B6914', fontSize: 13, fontWeight: '600' },
  clearBtn: {
    backgroundColor: '#FAF6F0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8DDD0',
  },
  clearBtnText: { color: '#7A7A7A', fontSize: 13, fontWeight: '500' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: '#FFF8F0',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 12,
    color: '#2C2C2C',
    fontSize: 15,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#E8DDD0',
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#8B6914',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  sendBtnDisabled: {
    backgroundColor: '#D4C8B8',
  },
  sendBtnText: { color: '#FFF8F0', fontSize: 20, fontWeight: 'bold' }
});
