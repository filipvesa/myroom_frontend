import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createSharedElementStackNavigator } from 'react-navigation-shared-element';
import { StackCardStyleInterpolator } from '@react-navigation/stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import SplashScreen from './components/SplashScreen';
import MainScreen from './components/MainScreen';
import GalleryScreen from './components/GalleryScreen';
import PhotoViewScreen from './components/PhotoViewScreen';
import VideoPlayerScreen from './components/VideoPlayerScreen';
import { initializeNotifications } from './services/NotificationManager';

export type RootStackParamList = {
  Splash: undefined;
  Main: undefined;
  Gallery: undefined;
  PhotoView: { photoUri: string };
  VideoPlayer: { videoUri: string };
};

// This is a robust way to get the props type for the interpolator.
type StackCardStyleInterpolatorProps =
  Parameters<StackCardStyleInterpolator>[0];

const Stack = createSharedElementStackNavigator<RootStackParamList>();

function App() {
  useEffect(() => {
    initializeNotifications();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Splash"
          screenOptions={{
            headerShown: false, // Hides the header bar on all screens
          }}
        >
          <Stack.Screen name="Splash" component={SplashScreen} />
          <Stack.Screen name="Main" component={MainScreen} />
          <Stack.Screen name="Gallery" component={GalleryScreen} />
          <Stack.Screen
            name="PhotoView"
            component={PhotoViewScreen}
            options={{
              gestureEnabled: false,
              transitionSpec: {
                open: { animation: 'timing', config: { duration: 300 } },
                close: { animation: 'timing', config: { duration: 300 } },
              },
              cardStyleInterpolator: ({
                current: { progress },
              }: StackCardStyleInterpolatorProps) => ({
                cardStyle: { opacity: progress },
              }),
            }}
            sharedElements={route => [`photo.${route.params.photoUri}`]}
          />
          <Stack.Screen
            name="VideoPlayer"
            component={VideoPlayerScreen}
            options={{ headerShown: false }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}

export default App;
