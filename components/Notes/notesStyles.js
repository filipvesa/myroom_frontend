import { StyleSheet } from 'react-native';

export const notesStyles = StyleSheet.create({
  // Main Screen
  container: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
    backgroundColor: 'rgba(232, 224, 212, 0.95)', // Semi-transparent overlay
    padding: 15,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerIcon: {
    padding: 5,
  },
  searchBar: {
    flex: 1,
    backgroundColor: 'rgba(54, 36, 25, 0.1)',
    borderRadius: 25,
    paddingVertical: 10,
    paddingHorizontal: 15,
    marginHorizontal: 15,
    justifyContent: 'center',
  },
  searchBarText: {
    color: '#5a3e2b',
    fontSize: 16,
  },
  profileIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#b0a9a1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionHeader: {
    color: '#5a3e2b',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Note Card
  noteCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(54, 36, 25, 0.1)',
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#362419',
    marginBottom: 8,
  },
  noteContent: {
    fontSize: 14,
    color: '#362419',
    lineHeight: 20,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  listItemText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#362419',
  },
  listItemTextDone: {
    textDecorationLine: 'line-through',
    color: '#8e8e93',
  },

  // Floating Action Button (FAB)
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
    elevation: 8, // Adds shadow on Android
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});
