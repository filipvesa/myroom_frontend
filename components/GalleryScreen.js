import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  Platform,
  PermissionsAndroid,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import { SharedElement } from 'react-navigation-shared-element';
import {
  Images,
  Archive,
  Camera,
  Wrench,
  Lock,
  Play,
  Check,
  CloudUpload,
  File,
  Trash,
} from 'lucide-react-native';
import { addFilesToUploadQueue } from '../services/UploadManager';
import RNFS from 'react-native-fs';

const Header = ({ navigation }) => (
  <View style={styles.header}>
    <TouchableOpacity
      style={styles.headerButton}
      onPress={() => navigation.goBack()}
    >
      <Text style={styles.headerButtonText}>‹</Text>
    </TouchableOpacity>
    <View style={styles.headerTitleContainer}>
      <Text style={styles.headerTitle}>PHOTO GALLERY</Text>
      <View style={styles.proBadge}>
        <Text style={styles.proBadgeText}>PRO</Text>
      </View>
    </View>
    <View style={{ width: 40 }} />
  </View>
);

const SelectionHeader = ({
  onCancel,
  selectedCount,
  onUpload,
  onDelete,
  activeTab,
}) => (
  <View style={styles.header}>
    <TouchableOpacity style={styles.headerButton} onPress={onCancel}>
      {/* Using a multiplication sign for a cleaner 'X' */}
      <Text style={styles.headerButtonText}>✕</Text>
    </TouchableOpacity>
    <View style={styles.headerTitleContainer}>
      <Text style={styles.headerTitle}>{selectedCount} selected</Text>
    </View>
    {selectedCount > 0 && activeTab === 'local' && (
      <TouchableOpacity style={styles.headerButton} onPress={onUpload}>
        <CloudUpload color="black" size={28} />
      </TouchableOpacity>
    )}
    {selectedCount > 0 && activeTab === 'storage' && (
      <TouchableOpacity style={styles.headerButton} onPress={onDelete}>
        <Trash color="black" size={28} />
      </TouchableOpacity>
    )}
    {selectedCount === 0 && <View style={{ width: 40 }} />}
  </View>
);

const BottomNavigation = ({ activeTab, onTabPress }) => {
  const tabs = [
    { id: 'local', icon: Images, label: 'Local' },
    { id: 'storage', icon: Archive, label: 'Storage' },
    { id: 'camera', icon: Camera, label: 'Camera', isMain: true },
    { id: 'tools', icon: Wrench, label: 'Tools' },
    { id: 'lock', icon: Lock, label: 'Lock' },
  ];

  return (
    <View style={styles.bottomNav}>
      {tabs.map(({ id, icon: Icon, label, isMain }) => {
        const isActive = activeTab === id;
        return (
          <TouchableOpacity
            key={id}
            onPress={() => onTabPress(id)}
            style={[
              styles.tab,
              isMain && styles.mainTab,
              isMain && {
                backgroundColor: isActive ? 'white' : 'rgba(255,255,255,0.8)',
              },
            ]}
          >
            <Icon
              size={isMain ? 24 : 20}
              color={isMain ? 'black' : isActive ? 'white' : 'gray'}
            />
            {!isMain && (
              <Text
                style={[
                  styles.tabLabel,
                  { color: isActive ? 'white' : 'gray' },
                ]}
              >
                {label}
              </Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const GalleryScreen = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('local');
  const [media, setMedia] = useState([]);
  const [pageInfo, setPageInfo] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [cloudMedia, setCloudMedia] = useState([]);
  const [loadingCloud, setLoadingCloud] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);

  async function hasAndroidPermission() {
    const getCheckPermissionPromise = () => {
      if (Platform.Version >= 33) {
        return Promise.all([
          PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
          ),
          PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
          ),
        ]).then(
          ([hasReadMediaImagesPermission, hasReadMediaVideoPermission]) =>
            hasReadMediaImagesPermission && hasReadMediaVideoPermission,
        );
      } else {
        return PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        );
      }
    };

    const hasPermission = await getCheckPermissionPromise();
    if (hasPermission) {
      return true;
    }
    const getRequestPermissionPromise = () => {
      if (Platform.Version >= 33) {
        return PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
        ]).then(
          statuses =>
            statuses[PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES] ===
              PermissionsAndroid.RESULTS.GRANTED &&
            statuses[PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO] ===
              PermissionsAndroid.RESULTS.GRANTED,
        );
      } else {
        return PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        ).then(status => status === PermissionsAndroid.RESULTS.GRANTED);
      }
    };

    return await getRequestPermissionPromise();
  }

  const loadCloudMedia = async () => {
    setLoadingCloud(true);
    try {
      // 1. Fetch the latest list of media from the server
      const response = await fetch('https://vesafilip.eu/api/media/');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const serverMediaList = await response.json();

      // 2. Define cache properties
      const THUMBNAIL_CACHE_DIR = `${RNFS.CachesDirectoryPath}/thumbnail-cache`;
      await RNFS.mkdir(THUMBNAIL_CACHE_DIR); // Ensure the directory exists
      const CACHE_EXPIRY_DAYS = 5;

      // 3. Process each item to check cache or download
      const processedMedia = await Promise.all(
        serverMediaList.map(async item => {
          const remoteThumbnailUrl = item.urls.thumbnail;
          // Create a safe, unique filename from the URL
          const localFilename = remoteThumbnailUrl.replace(
            /[^a-zA-Z0-9]/g,
            '_',
          );
          const localFilepath = `${THUMBNAIL_CACHE_DIR}/${localFilename}`;

          const fileExists = await RNFS.exists(localFilepath);
          let isCacheValid = false;

          if (fileExists) {
            const stat = await RNFS.stat(localFilepath);
            const ageInDays = (new Date() - stat.mtime) / (1000 * 60 * 60 * 24);
            if (ageInDays < CACHE_EXPIRY_DAYS) {
              isCacheValid = true;
            } else {
              // Cache is stale, delete it so it can be re-downloaded
              await RNFS.unlink(localFilepath).catch(e => console.log(e));
            }
          }

          if (isCacheValid) {
            // Use the valid, cached version
            return { ...item, localThumbnailPath: `file://${localFilepath}` };
          } else {
            // Download the new thumbnail
            await RNFS.downloadFile({
              fromUrl: remoteThumbnailUrl,
              toFile: localFilepath,
            }).promise;
            return { ...item, localThumbnailPath: `file://${localFilepath}` };
          }
        }),
      );

      setCloudMedia(processedMedia);
    } catch (error) {
      console.error('Failed to fetch cloud media:', error);
    } finally {
      setLoadingCloud(false);
    }
  };

  const handleCloudItemPress = item => {
    if (item.mediaType === 'photo') {
      navigation.navigate('PhotoView', {
        photoUri: item.urls.original, // Use original for full quality viewing
      });
    } else if (item.mediaType === 'video') {
      navigation.navigate('VideoPlayer', { videoUri: item.urls.original });
    } else {
      // Fallback for other file types (e.g., documents, zip files)
      Linking.openURL(item.urls.original).catch(err =>
        console.error('Failed to open URL:', err),
      );
    }
  };

  const handleCloudItemInteraction = item => {
    if (isSelectionMode) {
      // Toggle selection
      const isCurrentlySelected = selectedItems.some(i => i._id === item._id);
      const newSelectedItems = isCurrentlySelected
        ? selectedItems.filter(i => i._id !== item._id)
        : [...selectedItems, item];

      if (newSelectedItems.length === 0) {
        setIsSelectionMode(false);
      }
      setSelectedItems(newSelectedItems);
    } else {
      // Default behavior: view photo or play video
      handleCloudItemPress(item);
    }
  };

  const handleCloudItemLongPress = item => {
    if (isSelectionMode) return;
    setIsSelectionMode(true);
    setSelectedItems([item]);
  };

  const handleDelete = () => {
    if (selectedItems.length === 0) return;

    Alert.alert(
      'Delete Files',
      `Are you sure you want to delete ${selectedItems.length} file(s) from storage? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const deletePromises = selectedItems.map(item =>
              fetch(`https://vesafilip.eu/api/media/${item._id}`, {
                method: 'DELETE',
              }),
            );

            await Promise.all(deletePromises);

            Alert.alert('Success', `${selectedItems.length} file(s) deleted.`);
            cancelSelection();
            loadCloudMedia(); // Refresh the list
          },
        },
      ],
    );
  };

  const loadMedia = async after => {
    if (Platform.OS === 'android' && !(await hasAndroidPermission())) {
      return;
    }
    CameraRoll.getPhotos({
      first: 21,
      assetType: 'All',
      after,
    })
      .then(r => {
        setMedia(prevMedia => (after ? [...prevMedia, ...r.edges] : r.edges));
        setPageInfo(r.page_info);
      })
      .catch(err => console.log(err))
      .finally(() => setLoadingMore(false));
  };

  useEffect(() => {
    if (activeTab === 'local') {
      // Load local media if it hasn't been loaded yet
      if (media.length === 0) {
        loadMedia();
      }
    } else if (activeTab === 'storage') {
      // Always refresh cloud media when the storage tab is active
      loadCloudMedia();
    }
  }, [activeTab]);

  const loadMoreMedia = () => {
    if (pageInfo?.has_next_page && !loadingMore) {
      setLoadingMore(true);
      loadMedia(pageInfo.end_cursor);
    }
  };

  const handleLongPress = item => {
    // Don't do anything if already in selection mode on long press
    if (isSelectionMode) return;

    setIsSelectionMode(true);
    setSelectedItems([item.node]);
  };

  const handlePress = item => {
    const node = item.node;
    const uri = node.image.uri;
    if (isSelectionMode) {
      const isCurrentlySelected = selectedItems.some(i => i.image.uri === uri);
      const newSelectedItems = isCurrentlySelected
        ? selectedItems.filter(i => i.image.uri !== uri)
        : [...selectedItems, node];

      if (newSelectedItems.length === 0) {
        setIsSelectionMode(false);
      }
      setSelectedItems(newSelectedItems);
    } else {
      // Default behavior: view photo or play video
      const isVideo = item.node.type.startsWith('video');
      if (!isVideo) {
        navigation.navigate('PhotoView', {
          photoUri: uri,
        });
      } else {
        // Use the new in-app player for local videos as well
        navigation.navigate('VideoPlayer', { videoUri: uri });
      }
    }
  };

  const cancelSelection = () => {
    setIsSelectionMode(false);
    setSelectedItems([]);
  };

  const handleUpload = () => {
    if (selectedItems.length === 0) {
      Alert.alert('No Files Selected', 'Please select files to upload.');
      return;
    }

    // Hand off the files to the upload manager
    addFilesToUploadQueue(selectedItems);

    // Immediately reset the UI. The UploadManager will show a notification.
    setCloudMedia([]); // Invalidate cloud media to force a refresh on next visit
    cancelSelection();
  };

  return (
    <SafeAreaView style={styles.container}>
      {isSelectionMode ? (
        <SelectionHeader
          onCancel={cancelSelection}
          selectedCount={selectedItems.length}
          onUpload={handleUpload}
          onDelete={handleDelete}
          activeTab={activeTab}
        />
      ) : (
        <Header navigation={navigation} />
      )}
      {activeTab === 'local' && (
        <FlatList
          data={media}
          numColumns={3}
          contentContainerStyle={styles.listContentContainer}
          keyExtractor={item => item.node.image.uri}
          renderItem={({ item }) => {
            const isVideo = item.node.type.startsWith('video');
            const uri = item.node.image.uri;
            const isSelected = selectedItems.some(i => i.image.uri === uri);
            return (
              <TouchableOpacity
                style={styles.imageTouchable}
                onPress={() => handlePress(item)}
                onLongPress={() => handleLongPress(item)}
              >
                <SharedElement
                  id={`photo.${item.node.image.uri}`}
                  style={{ flex: 1 }}
                >
                  <Image style={styles.image} source={{ uri: uri }} />
                </SharedElement>
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
          }}
          onEndReached={loadMoreMedia}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore && <ActivityIndicator color="#362419" />
          }
        />
      )}
      {activeTab === 'storage' &&
        (loadingCloud ? (
          <View style={styles.placeholderContainer}>
            <ActivityIndicator size="large" color="#362419" />
          </View>
        ) : (
          <FlatList
            data={cloudMedia}
            numColumns={3}
            contentContainerStyle={styles.listContentContainer}
            keyExtractor={item => item._id}
            renderItem={({ item }) => {
              const isVideo = item.mediaType === 'video';
              const isPhoto = item.mediaType === 'photo';
              const isSelected = selectedItems.some(i => i._id === item._id);
              return (
                <TouchableOpacity
                  style={styles.imageTouchable}
                  onPress={() => handleCloudItemInteraction(item)}
                  onLongPress={() => handleCloudItemLongPress(item)}
                >
                  <SharedElement
                    id={`photo.${item.urls.original}`}
                    style={{ flex: 1 }}
                  >
                    <Image
                      style={styles.image}
                      source={{ uri: item.localThumbnailPath }}
                    />
                  </SharedElement>
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
            }}
          />
        ))}
      {activeTab !== 'local' && activeTab !== 'storage' && (
        <View style={styles.placeholderContainer}>
          <Text style={styles.placeholderText}>Coming Soon</Text>
        </View>
      )}
      {!isSelectionMode && (
        <BottomNavigation activeTab={activeTab} onTabPress={setActiveTab} />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8E0D4',
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#E8E0D4',
  },
  headerButton: {
    padding: 8,
  },
  headerButtonText: {
    fontSize: 28,
    color: 'black',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    color: 'black',
    letterSpacing: 1,
    fontSize: 18,
    fontWeight: '500',
  },
  proBadge: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  proBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 18,
    color: '#362419',
    fontWeight: '500',
    opacity: 0.7,
  },
  imageTouchable: {
    flex: 1 / 3,
    aspectRatio: 1,
    padding: 10, // Creates space inside each touchable cell
  },
  image: {
    flex: 1,
    borderRadius: 8,
  },
  listContentContainer: {
    // Adds padding to the outside of the entire list.
    // The combination with item padding creates uniform gaps.
    padding: 3,
  },
  videoIconContainer: {
    position: 'absolute',
    bottom: 15, // Increased to account for the parent's padding
    right: 15, // Increased to account for the parent's padding
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionOverlay: {
    position: 'absolute',
    top: 15,
    right: 15,
    width: 30,
    height: 30,
    backgroundColor: 'rgba(0, 122, 255, 0.7)',
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Bottom Navigation
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.9)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 12,
    paddingBottom: 20, // For home indicator
    paddingHorizontal: 16,
  },
  tab: {
    alignItems: 'center',
    gap: 4,
    padding: 8,
    minWidth: 60,
  },
  mainTab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  tabLabel: {
    fontSize: 12,
  },
});

export default GalleryScreen;
