import React from 'react';
import { View, Image, TouchableOpacity } from 'react-native';
import { Play, Check, File, Info } from 'lucide-react-native';
import { galleryStyles as styles } from '../../styles/galleryStyles';

const CloudMediaItem = ({
  item,
  onLongPress,
  isSelected,
  onPressInfo,
  handleCloudItemInteraction,
}) => {
  const isVideo = item.mediaType.startsWith('video');
  const isPhoto = item.mediaType === 'photo';

  return (
    <TouchableOpacity
      style={styles.imageTouchable}
      onPress={() => handleCloudItemInteraction(item)}
      onLongPress={() => onLongPress(item)}
    >
      {item.localThumbnailPath ? (
        <Image style={styles.image} source={{ uri: item.localThumbnailPath }} />
      ) : (
        <View style={styles.thumbnailPlaceholder}>
          <Play color="rgba(255,255,255,0.7)" size={40} />
        </View>
      )}
      {isSelected && (
        <TouchableOpacity
          style={styles.infoIconContainer}
          onPress={() => onPressInfo(item)}
        >
          <Info color="white" size={18} />
        </TouchableOpacity>
      )}
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
      {!isPhoto && !isVideo && (
        <View style={styles.videoIconContainer}>
          <File color="white" size={24} />
        </View>
      )}
    </TouchableOpacity>
  );
};

export const MemoizedCloudMediaItem = React.memo(CloudMediaItem);
