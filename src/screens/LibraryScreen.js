import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAllBooks, insertBook, deleteBook } from '../database/db';
import SettingsModal from '../components/SettingsModal';

export default function LibraryScreen() {
  const [books, setBooks] = useState([]);
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity 
          onPress={() => setShowSettings(true)} 
          style={{ marginRight: 8, padding: 8 }}
        >
          <Text style={{ fontSize: 22, color: '#8B6914' }}>⚙</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  useEffect(() => {
    if (isFocused) {
      loadBooks();
    }
  }, [isFocused]);

  const loadBooks = () => {
    try {
      const data = getAllBooks();
      setBooks(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddBook = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/epub+zip', '*/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        const newPath = FileSystem.documentDirectory + file.name;
        await FileSystem.copyAsync({
           from: file.uri,
           to: newPath
        });
        
        insertBook(file.name, 'Unknown Author', null, newPath);
        loadBooks();
      }
    } catch (err) {
      console.error('Error picking document', err);
      Alert.alert('Error picking document');
    }
  };

  const handleDelete = (id) => {
    Alert.alert("Remove Book", "Are you sure you want to remove this book from your library?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => {
          deleteBook(id);
          loadBooks();
      }}
    ]);
  };

  const getInitials = (title) => {
    const clean = title.replace('.epub', '').trim();
    const words = clean.split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return clean.substring(0, 2).toUpperCase();
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity 
       style={styles.bookCard} 
       onPress={() => navigation.navigate('Reader', { book: item })}
       onLongPress={() => handleDelete(item.id)}
       activeOpacity={0.7}
    >
      <View style={styles.bookCover}>
        <Text style={styles.coverInitials}>{getInitials(item.title)}</Text>
        <View style={styles.coverAccent} />
      </View>
      <View style={styles.bookMeta}>
        <Text style={styles.bookTitle} numberOfLines={2}>{item.title.replace('.epub', '')}</Text>
        <Text style={styles.bookAuthor}>{item.author}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {books.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📚</Text>
          <Text style={styles.emptyText}>Your library is empty</Text>
          <Text style={styles.emptySubtext}>Tap the button below to add your first book</Text>
        </View>
      ) : (
        <FlatList
          data={books}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 + insets.bottom }}
          showsVerticalScrollIndicator={false}
        />
      )}

      <TouchableOpacity 
         style={[styles.fab, { bottom: 28 + insets.bottom }]} 
         onPress={handleAddBook}
         activeOpacity={0.8}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
      
      <SettingsModal 
        visible={showSettings} 
        onClose={() => setShowSettings(false)} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF6F0' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { color: '#2C2C2C', fontSize: 20, fontWeight: '600', marginBottom: 8 },
  emptySubtext: { color: '#7A7A7A', fontSize: 15, textAlign: 'center', lineHeight: 22 },
  row: {
    justifyContent: 'space-between',
  },
  bookCard: {
    width: '47%',
    backgroundColor: '#FFF8F0',
    borderRadius: 16,
    marginBottom: 18,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#C4A265',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    borderWidth: 1,
    borderColor: '#E8DDD0',
  },
  bookCover: {
    height: 140,
    backgroundColor: '#F0E6D6',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  coverInitials: {
    fontSize: 36,
    fontWeight: '700',
    color: '#8B6914',
    letterSpacing: 2,
  },
  coverAccent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: '#C4A265',
  },
  bookMeta: {
    padding: 14,
  },
  bookTitle: {
    color: '#2C2C2C',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
    lineHeight: 20,
  },
  bookAuthor: {
    color: '#7A7A7A',
    fontSize: 13,
  },
  fab: {
    position: 'absolute',
    right: 24,
    backgroundColor: '#8B6914',
    width: 58,
    height: 58,
    borderRadius: 29,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#8B6914',
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
  },
  fabIcon: { color: '#FFF8F0', fontSize: 30, fontWeight: '400', lineHeight: 32 },
});
