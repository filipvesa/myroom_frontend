import React from 'react';
import {
  ImageBackground,
  StyleSheet,
  Pressable,
  View,
  Text,
} from 'react-native';

const MainScreen = () => {
const MainScreen = ({ navigation }) => {
  return (
    <ImageBackground
      style={styles.container}
      source={require('../assets/images/MainScreen.png')}
      resizeMode="cover"
    >
      {/* We wrap buttons in a View to contain them */}
      <View style={styles.buttonContainer}>
        {/* Button for the top shelf */}
        <Pressable
          style={({ pressed }) => [
            styles.shelfButton,
            styles.topShelf,
            {
              backgroundColor: pressed
                ? 'rgba(54, 36, 25, 0.5)' // Darker when pressed
                : 'rgba(54, 36, 25, 0.1)', // Even lighter by default
            },
          ]}
          // To navigate, you would use: onPress={() => navigation.navigate('SomeNewScreen')}
          onPress={() => alert('Top Shelf Tapped!')}
        >
          {({ pressed }) => (
            <Text
              style={[
                styles.buttonText,
                styles.galleryText,
                { color: pressed ? 'white' : '#F5EFE6' },
                pressed && styles.highlightedText,
              ]}
            >
              Reserved
            </Text>
          )}
        </Pressable>

        {/* Button for the shelf with the camera */}
        <Pressable
          style={({ pressed }) => [
            styles.shelfButton,
            styles.cameraShelf,
            {
              backgroundColor: pressed
                ? 'rgba(54, 36, 25, 0.5)'
                : 'rgba(54, 36, 25, 0.1)',
            },
          ]}
          // To navigate, you would use: onPress={() => navigation.navigate('GalleryScreen')}
          onPress={() => alert('Camera Shelf Tapped!')}
        >
          {({ pressed }) => (
            <Text
              style={[
                styles.buttonText,
                styles.photosText,
                { color: pressed ? 'white' : '#F5EFE6' },
                pressed && styles.highlightedText,
              ]}
            >
              My Gallery
            </Text>
          )}
        </Pressable>

        {/* Button for the shelf with the tablet */}
        <Pressable
          style={({ pressed }) => [
            styles.shelfButton,
            styles.tabletShelf,
            {
              backgroundColor: pressed
                ? 'rgba(54, 36, 25, 0.5)'
                : 'rgba(54, 36, 25, 0.1)',
            },
          ]}
          // To navigate, you would use: onPress={() => navigation.navigate('NotesScreen')}
          onPress={() => alert('Tablet Shelf Tapped!')}
        >
          {({ pressed }) => (
            <Text
              style={[
                styles.buttonText,
                styles.notesText,
                { color: pressed ? 'white' : '#F5EFE6' },
                pressed && styles.highlightedText,
              ]}
            >
              My Notes
            </Text>
          )}
        </Pressable>

        {/* Button for the shelf with the book */}
        <Pressable
          style={({ pressed }) => [
            styles.shelfButton,
            styles.bookShelf,
            {
              backgroundColor: pressed
                ? 'rgba(54, 36, 25, 0.5)'
                : 'rgba(54, 36, 25, 0.1)',
            },
          ]}
          // To navigate, you would use: onPress={() => navigation.navigate('JournalScreen')}
          onPress={() => alert('Book Shelf Tapped!')}
        >
          {({ pressed }) => (
            <Text
              style={[
                styles.buttonText,
                styles.journalText,
                { color: pressed ? 'white' : '#F5EFE6' },
                pressed && styles.highlightedText,
              ]}
            >
              My Journal
            </Text>
          )}
        </Pressable>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  buttonContainer: {
    flex: 1,
  },
  shelfButton: {
    position: 'absolute',
    // --- Adjust Size Here ---
    width: '60%', // Example: 60% of the screen's width
    height: '15%', // Example: 15% of the screen's height
    borderRadius: 8,
  },
  buttonText: {
    position: 'absolute', // Allows manual positioning within the button
    fontSize: 20,
    fontWeight: 'bold',
  },
  highlightedText: {
    textShadowColor: 'rgba(255, 255, 255, 0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  // --- Adjust Text Positions Below ---
  galleryText: {
    // Manually position the text using pixels
    top: 15,
    left: 20,
  },
  photosText: {
    top: 15,
    left: 20,
  },
  notesText: {
    top: 15,
    right: 20,
  },
  journalText: {
    top: 15,
    left: 20,
  },
  // --- Adjust Positions Below ---
  topShelf: {
    // This button is for the empty top shelf
    top: '21.5%', // % from the top
    left: '22%', // % from the left
    width: '60%', // Example: 60% of the screen's width
    height: '14%', // Example: 15% of the screen's height
  },
  cameraShelf: {
    // This button is for the shelf with the camera
    top: '37%', // % from the top
    left: '22%', // % from the left
  },
  tabletShelf: {
    // This button is for the shelf with the tablet
    top: '53.8%', // % from the top
    left: '22%', // % from the left
  },
  bookShelf: {
    // This button is for the shelf with the book
    top: '71.3%', // % from the top
    left: '22%', // % from the left
    height: '16%', // Example: 15% of the screen's height
  },
});

export default MainScreen;
