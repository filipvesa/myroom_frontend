import React from 'react';
import { ImageBackground, StyleSheet, Text, View } from 'react-native';

const SplashScreen = () => {
  return (
    <ImageBackground
      // This path assumes your assets folder is in the root directory
      source={require('../assets/images/SplashScreen.png')}
      style={styles.background}
      resizeMode="cover" // This ensures the image covers the whole screen
    >
      <View style={styles.textContainer}>
        <Text style={styles.title}>Welcome to Your Room</Text>
        <Text style={styles.subtitle}>Capture and organize your memories</Text>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
    justifyContent: 'flex-start', // Aligns content to the top
    alignItems: 'center', // Center content horizontally
    paddingTop: '35%', // Pushes content down from the top
  },
  textContainer: {
    alignItems: 'center', // Center the text items within their container
  },
  title: {
    fontSize: 34,
    color: '#362419', // A dark brown, almost black color
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 18,
    color: '#362419',
    marginTop: 8, // Adds a little space below the main title
  },
});

export default SplashScreen;
