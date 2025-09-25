import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createSharedElementStackNavigator } from 'react-navigation-shared-element';
import { StackCardStyleInterpolator } from '@react-navigation/stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { getAuth, FirebaseAuthTypes } from '@react-native-firebase/auth';
import SplashScreen from './components/SplashScreen';
import MainScreen from './components/MainScreen';
import GalleryScreen from './components/GalleryScreen';
import PhotoViewScreen from './components/PhotoViewScreen';
import VideoPlayerScreen from './components/VideoPlayerScreen';
import LoginScreen from './components/LoginScreen';
import SignUpScreen from './components/SignUpScreen';
import { initializeNotifications } from './services/NotificationManager';
import { initializeRemoteLogging } from './services/RemoteLog';

export type RootStackParamList = {
  Splash: undefined;
  Main: undefined;
  Gallery: undefined;
  PhotoView: {
    optimizedUri: string;
    originalUri: string;
    thumbnailUri: string;
    headers: Record<string, string>;
  };
  VideoPlayer: { videoUri: string };
  Login: undefined;
  SignUp: undefined;
};

// This is a robust way to get the props type for the interpolator.
type StackCardStyleInterpolatorProps =
  Parameters<StackCardStyleInterpolator>[0];

const Stack = createSharedElementStackNavigator<RootStackParamList>();

const AuthStack = () => (
  <Stack.Navigator
    initialRouteName="Splash"
    screenOptions={{ headerShown: false }}
  >
    <Stack.Screen name="Splash" component={SplashScreen} />
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="SignUp" component={SignUpScreen} />
  </Stack.Navigator>
);

const MainStack = () => (
  <Stack.Navigator
    initialRouteName="Splash" // Show splash briefly for returning users too
    screenOptions={{
      headerShown: false,
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
      sharedElements={route => {
        return [`photo.${route.params.originalUri}`];
      }}
    />
    <Stack.Screen
      name="VideoPlayer"
      component={VideoPlayerScreen}
      options={{ headerShown: false }}
    />
  </Stack.Navigator>
);

function App() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>();

  useEffect(() => {
    initializeNotifications();
    initializeRemoteLogging();

    const subscriber = getAuth().onAuthStateChanged(userState => {
      setUser(userState);
      if (initializing) {
        setInitializing(false);
      }
    });

    return subscriber; // unsubscribe on unmount
  }, []);

  if (initializing) {
    // Show a static splash screen view while checking auth state.
    return <SplashScreen />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        {user ? <MainStack /> : <AuthStack />}
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}

export default App;
