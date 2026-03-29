import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  Modal, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  SafeAreaView, 
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { getSetting, saveSetting } from '../database/db';

export default function SettingsModal({ visible, onClose }) {
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    if (visible) {
      const savedKey = getSetting('gemini_api_key');
      if (savedKey) setApiKey(savedKey);
    }
  }, [visible]);

  const handleSave = () => {
    try {
      saveSetting('gemini_api_key', apiKey.trim());
      Alert.alert('Saved', 'Your API key has been saved securely on this device.');
      onClose();
    } catch (e) {
      Alert.alert('Error', 'Failed to save settings.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={{ flex: 1 }}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Settings</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>Done</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <View style={styles.section}>
              <Text style={styles.label}>Gemini API Key</Text>
              <Text style={styles.hint}>
                Required for the AI Chapter Chat feature. Get your free key from Google AI Studio.
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Paste your API key here..."
                placeholderTextColor="#B8A88A"
                value={apiKey}
                onChangeText={setApiKey}
                secureTextEntry={true}
                autoCapitalize="none"
              />
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.8}>
              <Text style={styles.saveBtnText}>Save Settings</Text>
            </TouchableOpacity>
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
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#E8DDD0'
  },
  title: { fontSize: 22, fontWeight: '700', color: '#2C2C2C' },
  closeBtn: { 
    paddingHorizontal: 16, 
    paddingVertical: 8, 
    backgroundColor: '#F0E6D6', 
    borderRadius: 20 
  },
  closeText: { color: '#8B6914', fontWeight: '600', fontSize: 15 },
  content: { padding: 24 },
  section: { marginBottom: 32 },
  label: { fontSize: 17, fontWeight: '600', color: '#8B6914', marginBottom: 8 },
  hint: { fontSize: 14, color: '#7A7A7A', marginBottom: 16, lineHeight: 21 },
  input: {
    backgroundColor: '#FFF8F0',
    borderRadius: 12,
    padding: 16,
    color: '#2C2C2C',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E8DDD0'
  },
  saveBtn: {
    backgroundColor: '#8B6914',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center'
  },
  saveBtnText: { color: '#FFF8F0', fontSize: 17, fontWeight: '600' }
});
