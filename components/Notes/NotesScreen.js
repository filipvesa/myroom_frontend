import React from 'react';
import {
  View,
  Text,
  ImageBackground,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { Menu, Grid, User, Plus } from 'lucide-react-native';
import { notesStyles as styles } from './notesStyles';
import NoteCard from './NoteCard';

// Placeholder data
const pinnedNotes = [
  {
    id: '1',
    type: 'checklist',
    title: 'Grocery List',
    items: [
      { id: 'c1', text: 'Milk', done: true },
      { id: 'c2', text: 'Bread', done: true },
      { id: 'c3', text: 'Eggs', done: false },
    ],
  },
];

const otherNotes = [
  {
    id: '2',
    type: 'text',
    title: 'Meeting Idea',
    content: 'Discuss the new Q4 marketing strategy and budget allocation.',
  },
  {
    id: '3',
    type: 'text',
    content: 'Remember to call the dentist tomorrow morning.',
  },
];

const NotesScreen = ({ navigation }) => {
  return (
    <ImageBackground
      style={styles.container}
      source={require('../../assets/images/MainScreen.png')}
      resizeMode="cover"
    >
      <SafeAreaView style={styles.contentContainer}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerIcon}>
            <Menu size={28} color="#362419" />
          </TouchableOpacity>
          <View style={styles.searchBar}>
            <Text style={styles.searchBarText}>Search your notes</Text>
          </View>
          <TouchableOpacity style={styles.headerIcon}>
            <Grid size={28} color="#362419" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.profileIcon}>
            <User size={20} color="white" />
          </TouchableOpacity>
        </View>

        {/* Notes Content */}
        <ScrollView>
          {pinnedNotes.length > 0 && (
            <>
              <Text style={styles.sectionHeader}>Pinned</Text>
              {pinnedNotes.map(note => (
                <NoteCard key={note.id} note={note} />
              ))}
            </>
          )}

          <Text style={styles.sectionHeader}>Others</Text>
          {otherNotes.map(note => (
            <NoteCard key={note.id} note={note} />
          ))}
        </ScrollView>

        {/* Floating Action Button */}
        <TouchableOpacity style={styles.fab}>
          <Plus size={32} color="white" />
        </TouchableOpacity>
      </SafeAreaView>
    </ImageBackground>
  );
};

export default NotesScreen;
