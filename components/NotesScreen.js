import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { Menu, Grid } from 'lucide-react-native';
import { Square, CheckSquare, Plus } from 'lucide-react-native'; // Using lucide for checkboxes
import { galleryStyles } from '../styles/galleryStyles'; // Import styles for consistent background

const NotesScreen = ({ navigation }) => {
  // Dummy data for demonstration
  const pinnedNotes = [
    {
      id: '1',
      title: 'Tardings EXCHANGE CRO',
      items: [
        { id: '1a', text: 'Cro 1000 X 0.07 $70', checked: false },
        { id: '1b', text: 'SOL 100 X 17.78 $1778 +fee', checked: true },
      ],
    },
  ];

  const otherNotes = [
    {
      id: '2',
      title: 'Revolut Card',
      content: '4812 3456 7890 1234\nExp: 12/24 CVV: 123',
    },
  ];

  const renderChecklistItem = item => (
    <View key={item.id} style={styles.listItem}>
      {item.checked ? (
        <CheckSquare size={20} color="#888" />
      ) : (
        <Square size={20} color="#888" />
      )}
      <Text
        style={[
          styles.listItemText,
          item.checked && styles.listItemTextChecked,
        ]}
      >
        {item.text}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity>
            <Menu size={24} color="#362419" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.searchBar}>
            <Text style={styles.searchText}>Search your notes</Text>
          </TouchableOpacity>
          <TouchableOpacity>
            <Grid size={24} color="#362419" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.profileIcon}
            onPress={() => navigation.navigate('Main')}
          />
        </View>

        {/* Pinned Section */}
        <Text style={styles.sectionHeader}>PINNED</Text>
        {pinnedNotes.map(note => (
          <View key={note.id} style={styles.noteCard}>
            <Text style={styles.noteTitle}>{note.title}</Text>
            {note.items.map(renderChecklistItem)}
          </View>
        ))}

        {/* Others Section */}
        <Text style={styles.sectionHeader}>OTHERS</Text>
        {otherNotes.map(note => (
          <View key={note.id} style={styles.noteCard}>
            <Text style={styles.noteTitle}>{note.title}</Text>
            <Text style={styles.noteContent}>{note.content}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity style={styles.fab}>
        <Plus size={30} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: galleryStyles.container.backgroundColor, // Using the same background
  },
  scrollContent: {
    padding: 15,
    paddingTop: 50, // Increased padding to lower the header further
    paddingBottom: 100, // Padding for FAB
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  searchBar: {
    flex: 1,
    backgroundColor: 'rgba(54, 36, 25, 0.1)',
    borderRadius: 25,
    paddingVertical: 10,
    paddingHorizontal: 15,
    marginHorizontal: 15,
  },
  searchText: { color: '#5a3e2b' },
  profileIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#c1a288',
  },
  sectionHeader: {
    color: '#5a3e2b',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 10,
    marginLeft: 5,
  },
  noteCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  noteTitle: {
    color: '#362419',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  noteContent: { color: '#362419', fontSize: 14, lineHeight: 20 },
  listItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  listItemText: { color: '#362419', marginLeft: 10, fontSize: 14 },
  listItemTextChecked: { textDecorationLine: 'line-through', color: '#888' },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    backgroundColor: '#362419',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
  },
});

export default NotesScreen;
