import React, { useState, useEffect } from 'react';
import { View, TextInput, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { getNoteForBook, saveNoteForBook } from '../database/db';

export default function NotebookPanel({ bookId, onClose }) {
  const [note, setNote] = useState('');

  useEffect(() => {
    try {
      const exist = getNoteForBook(bookId);
      if (exist && exist.content) {
        setNote(exist.content);
      }
    } catch (e) {
      console.error("Error loading notes", e);
    }
  }, [bookId]);

  const handleTextChange = (text) => {
    setNote(text);
    try {
       saveNoteForBook(bookId, text);
    } catch(e) { 
       console.error('save failed', e); 
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.handle} />
        <View style={styles.headerContent}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Notebook</Text>
            <Text style={styles.subtitle}>Characters, ideas, notes…</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      <TextInput
        style={styles.input}
        multiline
        placeholder="Start writing your thoughts here..."
        placeholderTextColor="#B8A88A"
        value={note}
        onChangeText={handleTextChange}
        textAlignVertical="top"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F0',
    borderTopWidth: 1,
    borderTopColor: '#E8DDD0',
  },
  header: { 
    backgroundColor: '#FAF6F0',
    borderBottomWidth: 1,
    borderBottomColor: '#E8DDD0',
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: '#D4C8B8',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
  },
  headerContent: {
    flexDirection: 'row', 
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  title: { color: '#2C2C2C', fontSize: 16, fontWeight: '600' },
  subtitle: { color: '#7A7A7A', fontSize: 12, marginTop: 2 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0E6D6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: { color: '#8B6914', fontSize: 14, fontWeight: 'bold' },
  input: {
    flex: 1,
    color: '#2C2C2C',
    fontSize: 15,
    lineHeight: 24,
    padding: 16,
  }
});
