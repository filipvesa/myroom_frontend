import React, { useState, useEffect } from 'react';
import {
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  Text,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Orientation from 'react-native-orientation-locker';
import { SharedElement } from 'react-navigation-shared-element';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const AnimatedImage = Animated.createAnimatedComponent(Image);

const PhotoViewScreen = ({ route, navigation }) => {
  const { photoUri, thumbnailUri, headers } = route.params;
  const { width, height } = useWindowDimensions();

  // Start by showing the thumbnail, then switch to the full-res image
  const [imageSource, setImageSource] = useState({ uri: thumbnailUri });

  useEffect(() => {
    // Once the component mounts, set the source to the high-resolution image.
    // The thumbnail will be displayed until this one loads.
    setImageSource({ uri: photoUri, headers: headers });
  }, [photoUri, headers]);

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

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const pinchGesture = Gesture.Pinch()
    .onUpdate(e => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      if (scale.value < 1) {
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

  return (
    <GestureDetector
      gesture={Gesture.Simultaneous(pinchGesture, panGesture, doubleTap)}
    >
      <View style={styles.container}>
        <StatusBar hidden />
        <SharedElement id={`photo.${photoUri}`} style={StyleSheet.absoluteFill}>
          <AnimatedImage
            source={imageSource}
            style={[styles.image, animatedStyle]}
            resizeMode="contain"
          />
        </SharedElement>
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
  closeButton: {
    position: 'absolute',
    top: 60,
    right: 20,
  },
  closeButtonText: {
    color: 'white',
    fontSize: 30,
  },
});

export default PhotoViewScreen;
