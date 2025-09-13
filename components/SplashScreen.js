import React from 'react';
import {
  ImageBackground,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';

const SplashScreen = ({ onContinue }) => {
  return (
    <ImageBackground
      // This path assumes your assets folder is in the root directory
      source={require('../assets/images/SplashScreen.png')}
      style={styles.background}
      resizeMode="cover" // This ensures the image covers the whole screen
    >
      <View style={styles.textContainer}>
        <Text style={styles.title}>Welcome to MyRoom</Text>
        <Text style={styles.subtitle}>Capture and organize your memories</Text>
      </View>

      {/* This button will only appear in development mode */}
      {__DEV__ && (
        <TouchableOpacity style={styles.devButton} onPress={onContinue}>
          <Text style={styles.devButtonText}>Continue (Dev)</Text>
        </TouchableOpacity>
      )}
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
    justifyContent: 'flex-start', // Aligns content to the top
    alignItems: 'center', // Center content horizontally
    paddingTop: '29%', // Pushes content down from the top
  },
  textContainer: {
    alignItems: 'center', // Center the text items within their container
  },
  title: {
    fontSize: 36,
    color: '#362419', // A dark brown, almost black color
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 18,
    color: '#362419',
    marginTop: 8, // Adds a little space below the main title
  },
  devButton: {
    position: 'absolute',
    bottom: 50,
    backgroundColor: 'rgba(54, 36, 25, 0.7)',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 8,
  },
  devButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});

export default SplashScreen;
