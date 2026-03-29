import React from 'react';
import { View, Text, Modal, FlatList, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';

export default function TOCModal({ visible, toc, onClose, onSelect }) {
  const renderItem = ({ item, index }) => (
    <TouchableOpacity style={styles.item} onPress={() => onSelect(item.href)} activeOpacity={0.6}>
      <Text style={styles.chapterNum}>Chapter {index + 1}</Text>
      <Text style={styles.itemText}>{item.label.trim()}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Table of Contents</Text>
            <Text style={styles.subtitle}>{toc.length} chapters</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>Done</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={toc}
          keyExtractor={(item, index) => item.href + index}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 20 }}
          showsVerticalScrollIndicator={false}
        />
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
  subtitle: { fontSize: 13, color: '#7A7A7A', marginTop: 2 },
  closeBtn: { 
    paddingHorizontal: 16, 
    paddingVertical: 8, 
    backgroundColor: '#F0E6D6', 
    borderRadius: 20 
  },
  closeText: { color: '#8B6914', fontWeight: '600', fontSize: 15 },
  item: { 
    paddingVertical: 16, 
    borderBottomWidth: 1, 
    borderBottomColor: '#E8DDD0' 
  },
  chapterNum: { 
    fontSize: 11, 
    fontWeight: '600', 
    color: '#C4A265', 
    textTransform: 'uppercase', 
    letterSpacing: 1, 
    marginBottom: 4 
  },
  itemText: { fontSize: 16, color: '#2C2C2C', lineHeight: 22 }
});
