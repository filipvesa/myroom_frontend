import React from 'react';
import { View, Image, TouchableOpacity } from 'react-native';
import { Play, Check } from 'lucide-react-native';
import { galleryStyles as styles } from '../../styles/galleryStyles';

const LocalMediaItem = ({ item, onLongPress, onPress, isSelected }) => {
  const isVideo = item.node.type.startsWith('video');
  const { uri } = item.node.image;

  return (
    <TouchableOpacity
      style={styles.imageTouchable}
      onPress={() => onPress(item)}
      onLongPress={() => onLongPress(item)}
    >
      <Image style={styles.image} source={{ uri }} />
      {isSelected && (
        <View style={styles.selectionOverlay}>
          <Check color="white" size={24} />
        </View>
      )}
      {isVideo && (
        <View style={styles.videoIconContainer}>
          <Play color="white" size={24} />
        </View>
      )}
    </TouchableOpacity>
  );
};

export const MemoizedLocalMediaItem = React.memo(LocalMediaItem);
