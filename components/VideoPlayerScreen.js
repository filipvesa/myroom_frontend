import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  StatusBar,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import Video from 'react-native-video';
import { useFocusEffect } from '@react-navigation/native';
import Orientation from 'react-native-orientation-locker';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';

const VideoPlayerScreen = ({ route, navigation }) => {
  const { videoUri, headers } = route.params;
  const [isLoading, setIsLoading] = React.useState(true);
  const [showControls, setShowControls] = React.useState(true);
  const { width, height } = useWindowDimensions();

  useFocusEffect(
    React.useCallback(() => {
      // Allow rotation for video playback
      Orientation.unlockAllOrientations();
      return () => {
        // Lock back to portrait when leaving
        Orientation.lockToPortrait();
      };
    }, []),
  );

  useFocusEffect(
    React.useCallback(() => {
      // Log that the user is viewing this specific video
      console.log(`[Observability] User is viewing video: ${videoUri}`);
    }, [videoUri]),
  );

  // --- Gesture and Animation Logic ---
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const pinchGesture = Gesture.Pinch()
    .onUpdate(e => {
      'worklet';
      scale.value = e.scale * savedScale.value;
    })
    .onEnd(() => {
      'worklet';
      if (scale.value < 1) {
        // Animate back to center if zoomed out too far
        scale.value = withTiming(1);
        savedScale.value = 1;
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        runOnJS(setShowControls)(true);
      } else {
        savedScale.value = scale.value;
        // Clamp translation to new boundaries after zooming
        const maxTx = (width * scale.value - width) / 2;
        const maxTy = (height * scale.value - height) / 2;
        translateX.value = Math.max(-maxTx, Math.min(translateX.value, maxTx));
        translateY.value = Math.max(-maxTy, Math.min(translateY.value, maxTy));
        savedTranslateX.value = translateX.value;
        savedTranslateY.value = translateY.value;
        runOnJS(setShowControls)(false);
      }
    });

  const panGesture = Gesture.Pan()
    .onStart(() => {
      'worklet';
      // Only allow panning when zoomed in.
      if (scale.value <= 1) {
        return false;
      }
    })
    .onUpdate(e => {
      'worklet';
      const maxTx = (width * (scale.value - 1)) / 2;
      const maxTy = (height * (scale.value - 1)) / 2;
      const newX = savedTranslateX.value + e.translationX;
      const newY = savedTranslateY.value + e.translationY;
      translateX.value = Math.max(-maxTx, Math.min(newX, maxTx));
      translateY.value = Math.max(-maxTy, Math.min(newY, maxTy));
    })
    .onEnd(() => {
      'worklet';
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onStart(() => {
      'worklet';
      if (scale.value !== 1) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        runOnJS(setShowControls)(true);
      } else {
        scale.value = withTiming(2);
        savedScale.value = 2;
        runOnJS(setShowControls)(false);
      }
    });

  const animatedStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    };
  });

  return (
    <GestureDetector
      gesture={Gesture.Simultaneous(pinchGesture, panGesture, doubleTap)}
    >
      <View style={styles.container}>
        <StatusBar hidden />
        <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
          <Video
            source={{ uri: videoUri, headers: headers }}
            style={styles.video}
            controls={showControls}
            resizeMode="contain"
            onLoad={() => setIsLoading(false)}
            onEnd={() => navigation.goBack()}
            onError={e => {
              console.error('Video Error:', e);
              navigation.goBack();
            }}
          />
        </Animated.View>
        {isLoading && (
          <ActivityIndicator
            style={StyleSheet.absoluteFill}
            size="large"
            color="white"
          />
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
  },
  video: {
    flex: 1,
  },
  closeButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 1, // Ensure it's on top of the video
  },
  closeButtonText: {
    color: 'white',
    fontSize: 30,
  },
});

export default VideoPlayerScreen;
