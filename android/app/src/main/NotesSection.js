import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons'; // Or any other icon library
import { galleryStyles } from '../../styles/galleryStyles'; // Import styles from GalleryScreen to maintain visual consistency

const NotesSection = () => {
  return (
    <View style={styles.notesContainer}>
      {/* Header */}
      <View style={styles.header}>
        <Icon name="menu" size={24} color="#fff" />
        <View style={styles.searchBar}>
          <Text style={styles.searchText}>Search Keep</Text>
        </View>
        <Icon name="grid-view" size={24} color="#fff" />
        <View style={styles.profileIcon} />
      </View>

      {/* Pinned Section */}
      <Text style={styles.sectionHeader}>Pinned</Text>
      <View style={styles.noteCard}>
        <Text style={styles.noteTitle}>Tardings EXCHANGE CRO</Text>
        <View style={styles.listItem}>
          <Icon name="check-box-outline-blank" size={20} color="#888" />
          <Text style={styles.listItemText}>Cro 1000 X 0.07 $70</Text>
        </View>
        <View style={styles.listItem}>
          <Icon name="check-box-outline-blank" size={20} color="#888" />
          <Text style={styles.listItemText}>SOL 100 X 17.78 $1778 +fee</Text>
        </View>
      </View>

      {/* Others Section */}
      <Text style={styles.sectionHeader}>Others</Text>
      <View style={styles.noteCard}>
        <Text style={styles.noteTitle}>Revolut Card</Text>
        <Text style={styles.noteContent}>
          4812 3456 7890 1234 Exp: 12/24 CVV: 123
        </Text>
      </View>

      {/* Floating Action Button */}
      <TouchableOpacity style={styles.fab}>
        <Icon name="add" size={30} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

const localStyles = StyleSheet.create({
  notesContainer: {
    flex: 1,
    padding: 25,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  searchBar: {
    flex: 1,
    backgroundColor: '#333',
    borderRadius: 25,
    padding: 10,
    marginHorizontal: 15,
  },
  searchText: {
    color: '#999',
  },
  profileIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f06292', // A placeholder color
  },
  sectionHeader: {
    color: '#aaa',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  noteCard: {
    backgroundColor: '#222',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  noteTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  noteContent: {
    color: '#fff',
    fontSize: 14,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  listItemText: {
    color: '#fff',
    marginLeft: 10,
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    backgroundColor: '#4285F4', // A blue color
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8, // Adds a shadow on Android
  },
});

const styles = StyleSheet.create({
  ...localStyles,
  ...galleryStyles, // Inherit gallery styles
  notesContainer: {
    ...localStyles.notesContainer,
    backgroundColor: galleryStyles.container.backgroundColor, // Set the gallery background color to the notes container
  },
});

export default NotesSection;
