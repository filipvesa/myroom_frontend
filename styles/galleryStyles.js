import { StyleSheet } from 'react-native';

export const galleryStyles = StyleSheet.create({
  // Main Container
  container: {
    flex: 1,
    backgroundColor: '#E8E0D4',
  },

  // Header and Selection Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#E8E0D4',
  },
  headerButton: {
    padding: 8,
  },
  headerButtonText: {
    fontSize: 28,
    color: 'black',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    color: 'black',
    letterSpacing: 1,
    fontSize: 18,
    fontWeight: '500',
  },
  selectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // SectionList and Placeholders
  sectionContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  sectionHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#E8E0D4',
    paddingHorizontal: 16,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#362419',
  },
  selectionCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#b0a9a1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionCircleSelected: {
    backgroundColor: 'rgba(0, 122, 255, 0.7)',
    borderColor: 'rgba(0, 122, 255, 1)',
  },
  listContentContainer: {
    // No padding needed here, as the item's padding handles the gaps.
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 18,
    color: '#362419',
    fontWeight: '500',
    opacity: 0.7,
  },

  // Media Item (Local and Cloud)
  imageTouchable: {
    width: '33.333%',
    aspectRatio: 1,
    padding: 2,
  },
  image: {
    flex: 1,
    borderRadius: 8,
    margin: 8,
    resizeMode: 'cover',
  },
  thumbnailPlaceholder: {
    flex: 1,
    borderRadius: 8,
    margin: 8,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoIconContainer: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    backgroundColor: 'rgba(0, 122, 255, 0.7)',
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Bottom Navigation
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.9)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 12,
    paddingBottom: 20, // For home indicator
    paddingHorizontal: 16,
  },
  tab: {
    alignItems: 'center',
    gap: 4,
    padding: 8,
    minWidth: 60,
  },
  mainTab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  tabLabel: {
    fontSize: 12,
  },
});
