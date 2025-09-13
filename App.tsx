import React, { useState } from 'react';
import { NewAppScreen } from '@react-native/new-app-screen';
import { StatusBar, StyleSheet, useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import SplashScreen from './components/SplashScreen';

function App() {
  // The splash screen is now visible until you manually hide it.
  const [isSplashVisible, setSplashVisible] = useState(true);
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      {isSplashVisible ? <SplashScreen /> : <AppContent />}
    </SafeAreaProvider>
  );
}

// This can be your main app screen.
// For now, it shows the default React Native screen.
function AppContent() {
  return (
    <View style={styles.container}>
      {/* You can replace NewAppScreen with your own main screen component */}
      <NewAppScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;
