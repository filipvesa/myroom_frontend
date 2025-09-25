import React, { useState, useEffect } from 'react';
import {
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  Text,
  StatusBar,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Orientation from 'react-native-orientation-locker';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';

const AnimatedImage = Animated.createAnimatedComponent(Image);

const PhotoViewScreen = ({ route, navigation }) => {
  const { optimizedUri, originalUri, thumbnailUri, headers } = route.params;
  const { width, height } = useWindowDimensions();

  // Start by showing the thumbnail, then switch to the optimized or original image
  const [imageSource, setImageSource] = useState({ uri: thumbnailUri });
  const [isLoading, setIsLoading] = useState(false);
  const [isHd, setIsHd] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      // When the screen is focused, unlock orientation to allow rotation
      Orientation.unlockAllOrientations();

      return () => {
        // When the screen is unfocused, lock back to portrait
        Orientation.lockToPortrait();
      };
    }, []),
  );

  useFocusEffect(
    React.useCallback(() => {
      // Log that the user is viewing this specific photo

      // By setting the high-res source here, we ensure the shared element
      // transition completes before we try to load the new image.
      if (optimizedUri) {
        setImageSource({ uri: optimizedUri, headers: headers });
      }
      console.log(`[Observability] User is viewing photo: ${optimizedUri}`);
    }, [optimizedUri]),
  );

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Memoize the goBack function to preserve navigation context. Must be defined *before* the gestures that use it.
  const goBack = React.useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const pinchGesture = Gesture.Pinch()
    .onUpdate(e => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      'worklet'; // Explicitly mark this as a worklet
      // Define a threshold for the dismiss gesture
      const DISMISS_THRESHOLD = 0.6;

      if (scale.value < DISMISS_THRESHOLD) {
        // Safely call the JS function from the UI thread
        runOnJS(goBack)();
      } else if (scale.value < 1) {
        // Animate back to center and 1x scale
        scale.value = withTiming(1);
        savedScale.value = 1;
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        savedScale.value = scale.value;
        // After zooming, clamp the translation to the new boundaries
        const maxTx = (width * scale.value - width) / 2;
        const maxTy = (height * scale.value - height) / 2;
        translateX.value = Math.max(-maxTx, Math.min(translateX.value, maxTx));
        translateY.value = Math.max(-maxTy, Math.min(translateY.value, maxTy));
        // Save the clamped values
        savedTranslateX.value = translateX.value;
        savedTranslateY.value = translateY.value;
      }
    });

  const panGesture = Gesture.Pan()
    .onUpdate(e => {
      if (scale.value > 1) {
        const maxTx = (width * (scale.value - 1)) / 2;
        const maxTy = (height * (scale.value - 1)) / 2;

        const newX = savedTranslateX.value + e.translationX;
        const newY = savedTranslateY.value + e.translationY;

        // Clamp the translation values to the boundaries
        translateX.value = Math.max(-maxTx, Math.min(newX, maxTx));
        translateY.value = Math.max(-maxTy, Math.min(newY, maxTy));
      }
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onStart(() => {
      if (scale.value !== 1) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        scale.value = withTiming(2);
        savedScale.value = 2;
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const handleHdPress = () => {
    // Switch to the original, full-resolution image
    setImageSource({ uri: originalUri, headers: headers });
    setIsHd(true);
  };

  return (
    <GestureDetector
      gesture={Gesture.Simultaneous(pinchGesture, panGesture, doubleTap)}
    >
      <View style={styles.container}>
        <StatusBar hidden />
        <AnimatedImage
          source={imageSource}
          onLoadStart={() => setIsLoading(true)}
          onLoadEnd={() => setIsLoading(false)}
          style={[styles.image, animatedStyle]}
          resizeMode="contain"
        />
        {isLoading && (
          <ActivityIndicator style={styles.loader} size="large" color="white" />
        )}
        {!isLoading && originalUri && !isHd && (
          <TouchableOpacity style={styles.hdButton} onPress={handleHdPress}>
            <Text style={styles.hdButtonText}>HD</Text>
          </TouchableOpacity>
        )}
        {!isLoading && isHd && (
          <View style={[styles.hdButton, styles.hdActive]}>
            <Text style={styles.hdButtonText}>HD</Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  loader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 60,
    right: 20,
  },
  hdButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  hdActive: {
    backgroundColor: 'rgba(0, 122, 255, 0.7)',
    borderColor: 'rgba(0, 122, 255, 1)',
  },
  hdButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  closeButtonText: {
    color: 'white',
    fontSize: 30,
  },
});

export default PhotoViewScreen;
