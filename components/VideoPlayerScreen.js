import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import Video from 'react-native-video';
import { useFocusEffect } from '@react-navigation/native';
import Orientation from 'react-native-orientation-locker';

const VideoPlayerScreen = ({ route, navigation }) => {
  const { videoUri } = route.params;
  const [isLoading, setIsLoading] = React.useState(true);

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

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <Video
        source={{ uri: videoUri }}
        style={StyleSheet.absoluteFill}
        controls={true} // Show default player controls
        resizeMode="contain"
        onLoad={() => setIsLoading(false)} // Hide loader when video is ready
        onEnd={() => navigation.goBack()} // Go back when video finishes
        onError={e => {
          console.error('Video Error:', e);
          navigation.goBack();
        }}
      />
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
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
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
