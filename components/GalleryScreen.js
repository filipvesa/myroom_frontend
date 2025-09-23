import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  FlatList,
  TouchableOpacity,
  Image,
  Platform,
  PermissionsAndroid,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Orientation from 'react-native-orientation-locker';
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
  Download,
} from 'lucide-react-native';
import { addFilesToUploadQueue } from '../services/UploadManager';
import { getAuth } from '@react-native-firebase/auth';
import RNFS from 'react-native-fs';

const Header = ({ navigation, onClean, activeTab }) => (
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
    {/* Show the clean button only on the local tab */}
    {activeTab === 'local' ? (
      <TouchableOpacity style={styles.headerButton} onPress={onClean}>
        <Wrench color="black" size={24} />
      </TouchableOpacity>
    ) : (
      <View style={{ width: 40 }} />
    )}
  </View>
);

const SelectionHeader = ({
  onCancel,
  selectedCount,
  onUpload,
  onDelete,
  onDownload,
  onLocalDelete,
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
    <View style={styles.selectionActions}>
      {selectedCount > 0 && activeTab === 'local' && (
        <>
          <TouchableOpacity style={styles.headerButton} onPress={onLocalDelete}>
            <Trash color="black" size={28} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={onUpload}>
            <CloudUpload color="black" size={28} />
          </TouchableOpacity>
        </>
      )}
      {selectedCount > 0 && activeTab === 'storage' && (
        <>
          <TouchableOpacity style={styles.headerButton} onPress={onDownload}>
            <Download color="black" size={28} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={onDelete}>
            <Trash color="black" size={28} />
          </TouchableOpacity>
        </>
      )}
    </View>
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

const groupMediaByDateAndRow = (mediaList, dateExtractor) => {
  if (!mediaList || mediaList.length === 0) return [];

  const groupedByDate = mediaList.reduce((acc, item) => {
    const date = dateExtractor(item);
    if (!date) return acc;

    const d = new Date(date);
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      '0',
    )}-${String(d.getDate()).padStart(2, '0')}`;

    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(item);
    return acc;
  }, {});

  return Object.keys(groupedByDate)
    .sort((a, b) => new Date(b) - new Date(a))
    .map(dateKey => ({
      title: new Date(dateKey).toLocaleDateString('en-US', {
        timeZone: 'UTC',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      data: [groupedByDate[dateKey]], // This is the key: wrap all items for a date into a single array element for renderItem
    }));
};

const GalleryScreen = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('local');
  const [media, setMedia] = useState([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [cloudMedia, setCloudMedia] = useState([]);
  const [groupedLocalMedia, setGroupedLocalMedia] = useState([]);
  const [loadingCloud, setLoadingCloud] = useState(false);
  const [groupedCloudMedia, setGroupedCloudMedia] = useState([]);
  const [selectedItems, setSelectedItems] = useState(new Map());

  useFocusEffect(
    React.useCallback(() => {
      // Lock to portrait when the gallery is visible. This is important
      // for when we navigate back from a screen that allowed rotation.
      Orientation.lockToPortrait(); //
    }, []),
  );

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

  // In a real app, you would retrieve this from secure storage after a login process.
  const getAuthToken = async () => {
    try {
      const authInstance = getAuth();
      return await authInstance.currentUser?.getIdToken();
    } catch (error) {
      console.error('Failed to get auth token', error);
      return null;
    }
  };

  const loadCloudMedia = async () => {
    setLoadingCloud(true);
    try {
      const token = await getAuthToken();
      // Critical Check: If there's no token, the user is not authenticated.
      if (!token) {
        throw new Error(
          'User not authenticated. Please sign in again.',
          'Authentication Error',
        );
      }

      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // 1. Fetch the latest list of media from the server
      const response = await fetch('https://vesafilip.eu/api/media/', {
        headers,
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const serverMediaList = await response.json();

      // --- DEBUGGING: Log the raw data from the server ---
      console.log(
        '[DEBUG] Raw data from server:',
        JSON.stringify(serverMediaList, null, 2),
      );

      // 2. Define cache properties
      const THUMBNAIL_CACHE_DIR = `${RNFS.CachesDirectoryPath}/thumbnail-cache`;
      await RNFS.mkdir(THUMBNAIL_CACHE_DIR); // Ensure the directory exists
      const CACHE_EXPIRY_DAYS = 5;

      // 3. Process each item to check cache or download
      const mediaProcessingPromises = serverMediaList.map(async item => {
        try {
          const remoteThumbnailUrl = item.urls.thumbnail;
          const isVideo = item.mediaType.startsWith('video');

          // If no thumbnail URL is provided...
          if (!remoteThumbnailUrl) {
            // ...still show videos with a placeholder.
            if (isVideo) {
              return { ...item, localThumbnailPath: null };
            }
            return null; // Filter out any non-video item that lacks a thumbnail.
          }

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
            if (ageInDays < CACHE_EXPIRY_DAYS) isCacheValid = true;
            else
              await RNFS.unlink(localFilepath).catch(e =>
                console.warn('Stale cache unlink failed:', e),
              );
          }

          if (isCacheValid) {
            return { ...item, localThumbnailPath: `file://${localFilepath}` };
          } else {
            // Pass the authentication headers to the download request
            await RNFS.downloadFile({
              fromUrl: remoteThumbnailUrl,
              toFile: localFilepath,
              headers: headers, // <-- Add this line
            }).promise;
            return { ...item, localThumbnailPath: `file://${localFilepath}` };
          }
        } catch (e) {
          // --- DEBUGGING: Log which specific item is failing ---
          console.error(
            `[DEBUG] Failed to process item: ${JSON.stringify(item, null, 2)}`,
          );
          console.error('[DEBUG] The error was:', e);

          return null; // Return null on failure for this specific item
        }
      });

      // Wait for all promises to settle and filter out any that failed (returned null)
      const processedMedia = (
        await Promise.all(mediaProcessingPromises)
      ).filter(item => item !== null);

      // If no media is left after processing, it might indicate a wider issue
      if (serverMediaList.length > 0 && processedMedia.length === 0) {
        console.error(
          'All thumbnail downloads failed. Check network and file system permissions.',
        );
        // Optionally, show a specific alert here
      }

      // Group the successfully processed media by date
      const grouped = groupMediaByDateAndRow(
        processedMedia,
        item => item.createdAt,
      );

      setCloudMedia(processedMedia);
      setGroupedCloudMedia(grouped);
    } catch (error) {
      console.error('Failed to fetch cloud media:', error);
      Alert.alert(
        'Error Loading Media',
        'Could not connect to cloud storage. Please check your internet connection or try again later.',
        [{ text: 'OK' }],
      );
    } finally {
      setLoadingCloud(false);
    }
  };

  const handleCloudItemPress = async item => {
    const token = await getAuthToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    if (item.mediaType === 'photo') {
      navigation.navigate('PhotoView', {
        photoUri: item.urls.original,
        thumbnailUri: item.localThumbnailPath, // Pass the local thumbnail
        headers: headers,
      });
    } else if (item.mediaType.startsWith('video')) {
      navigation.navigate('VideoPlayer', {
        videoUri: item.urls.original,
        headers: headers,
      });
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
      const newSelectedItems = new Map(selectedItems);
      if (newSelectedItems.has(item._id)) {
        newSelectedItems.delete(item._id);
      } else {
        newSelectedItems.set(item._id, item);
      }
      if (newSelectedItems.size === 0) {
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
    setSelectedItems(new Map([[item._id, item]]));
  };

  const handleDelete = () => {
    if (selectedItems.size === 0) return;

    Alert.alert(
      'Delete Files',
      `Are you sure you want to delete ${selectedItems.size} file(s) from storage? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const token = await getAuthToken();
            const headers = { 'Content-Type': 'application/json' };
            if (token) {
              headers['Authorization'] = `Bearer ${token}`;
            }
            const deletePromises = Array.from(selectedItems.values()).map(
              item =>
                fetch(`https://vesafilip.eu/api/media/${item._id}`, {
                  method: 'DELETE',
                  headers,
                }),
            );

            await Promise.all(deletePromises);

            Alert.alert('Success', `${selectedItems.size} file(s) deleted.`);
            cancelSelection();
            loadCloudMedia(); // Refresh the list
          },
        },
      ],
    );
  };

  const handleDownload = () => {
    if (selectedItems.size === 0) return;

    Alert.alert(
      'Download Files',
      `Are you sure you want to download ${selectedItems.size} file(s) to your device's Downloads folder?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Download',
          style: 'default',
          onPress: async () => {
            try {
              const token = await getAuthToken();
              const headers = {};
              if (token) {
                headers['Authorization'] = `Bearer ${token}`;
              }

              const downloadAndSavePromises = Array.from(
                selectedItems.values(),
              ).map(async item => {
                const downloadUrl = `https://vesafilip.eu/api/media/download/${item._id}/${item.size}`;
                // Use a temporary path in the cache for the initial download
                const tempPath = `${RNFS.CachesDirectoryPath}/${item.filename}`;

                console.log(
                  `[Download] Starting download for ${item.filename} to ${tempPath}`,
                );

                const downloadResult = await RNFS.downloadFile({
                  fromUrl: downloadUrl,
                  toFile: tempPath,
                  headers: headers,
                }).promise;

                console.log(
                  `[Download] Completed for ${item.filename}. Status: ${downloadResult.statusCode}`,
                );

                if (downloadResult.statusCode !== 200) {
                  throw new Error(
                    `Download failed for ${item.filename} with status ${downloadResult.statusCode}`,
                  );
                }

                // For photos and videos, save them to the gallery to make them visible
                if (
                  item.mediaType === 'photo' ||
                  item.mediaType.startsWith('video')
                ) {
                  console.log(
                    `[Download] Saving ${item.filename} to device gallery.`,
                  );
                  await CameraRoll.save(tempPath, {
                    type: item.mediaType,
                    album: 'MyRoom',
                  });
                }
                // For other file types, we can move them to the public Downloads folder
                else {
                  const finalPath = `${RNFS.DownloadDirectoryPath}/${item.filename}`;
                  await RNFS.moveFile(tempPath, finalPath);
                }
              });

              await Promise.all(downloadAndSavePromises);

              Alert.alert(
                'Download Complete',
                `${selectedItems.size} file(s) have been saved to your device.`,
              );
              loadMedia(); // Refresh the local media list
            } catch (error) {
              console.error('Failed to download files:', error);
              Alert.alert(
                'Download Failed',
                'Could not download one or more files. Please try again.',
              );
            } finally {
              cancelSelection();
            }
          },
        },
      ],
    );
  };

  const handleCleanDuplicates = async () => {
    Alert.alert(
      'Clean Local Duplicates',
      'This will check all local files against cloud storage and delete any that are already backed up. This action cannot be undone. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: async () => {
            setLoadingCloud(true); // Reuse the main loading indicator
            try {
              // 1. Fetch all cloud media filenames into a Set for fast lookups
              console.log('[Clean] Fetching cloud media list...');
              const token = await getAuthToken();
              if (!token) throw new Error('Not authenticated');
              const response = await fetch('https://vesafilip.eu/api/media/', {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (!response.ok) {
                throw new Error('Failed to fetch cloud media list.');
              }
              const cloudMediaList = await response.json();
              const cloudFilenames = new Set(
                cloudMediaList.map(item => item.filename),
              );

              if (cloudFilenames.size === 0) {
                Alert.alert(
                  'Info',
                  'No media found in cloud storage. Nothing to clean.',
                );
                return;
              }
              console.log(
                `[Clean] Found ${cloudFilenames.size} files in the cloud.`,
              );

              // 2. Fetch all local media recursively
              console.log('[Clean] Fetching all local media...');
              let allLocalMedia = [];
              let hasNextPage = true;
              let after = undefined;
              while (hasNextPage) {
                const result = await CameraRoll.getPhotos({
                  first: 1000,
                  assetType: 'All',
                  after,
                });
                allLocalMedia.push(...result.edges);
                hasNextPage = result.page_info.has_next_page;
                after = result.page_info.end_cursor;
              }
              console.log(
                `[Clean] Found ${allLocalMedia.length} total local files.`,
              );

              // 3. Identify and delete duplicates
              const duplicatesToDelete = allLocalMedia.filter(localItem =>
                cloudFilenames.has(localItem.node.image.filename),
              );

              if (duplicatesToDelete.length === 0) {
                Alert.alert('All Clean!', 'No duplicate files were found.');
                return;
              }

              const urisToDelete = duplicatesToDelete.map(
                item => item.node.image.uri,
              );
              await CameraRoll.deletePhotos(urisToDelete);

              Alert.alert(
                'Cleanup Complete',
                `Successfully deleted ${duplicatesToDelete.length} duplicate file(s) from your device.`,
              );

              // 4. Refresh the local media list in the UI
              loadMedia();
            } catch (error) {
              console.error('[Clean] Cleanup failed:', error);
              Alert.alert(
                'Error',
                'The cleanup process failed. Please try again.',
              );
            } finally {
              setLoadingCloud(false);
            }
          },
        },
      ],
    );
  };

  const handleLocalDelete = () => {
    if (selectedItems.size === 0) return;

    Alert.alert(
      'Delete Local Files',
      `Are you sure you want to permanently delete ${selectedItems.size} file(s) from your device? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const urisToDelete = Array.from(selectedItems.values()).map(
                item => item.image.uri,
              );

              await CameraRoll.deletePhotos(urisToDelete);

              Alert.alert(
                'Success',
                `${selectedItems.size} file(s) have been deleted.`,
              );

              // Fully refresh the local media list to reflect the changes
              cancelSelection();
              loadMedia(); // This will fetch the updated list from the device
            } catch (error) {
              console.error('Failed to delete local files:', error);
              Alert.alert('Error', 'Could not delete one or more files.');
            }
          },
        },
      ],
    );
  };

  const loadMedia = async after => {
    if (Platform.OS === 'android' && !(await hasAndroidPermission())) {
      return;
    }
    setLoadingMore(true); // Show loading indicator
    CameraRoll.getPhotos({
      first: 200, // Fetch a larger, single batch of recent photos
      assetType: 'All',
      after,
    })
      .then(r => {
        // De-duplicate the list based on the URI to prevent selection issues
        const seenUris = new Set();
        const uniqueMedia = r.edges.filter(item => {
          const uri = item.node.image.uri;
          return seenUris.has(uri) ? false : seenUris.add(uri);
        });

        setMedia(uniqueMedia);

        const grouped = groupMediaByDateAndRow(
          uniqueMedia,
          item => item.node.timestamp * 1000,
        );
        setGroupedLocalMedia(grouped);
      })
      .catch(err => console.log(err))
      .finally(() => setLoadingMore(false));
  };

  useEffect(() => {
    if (activeTab === 'local') {
      if (media.length === 0) {
        loadMedia();
      }
    } else if (activeTab === 'storage') {
      // Always refresh cloud media when the storage tab is active
      loadCloudMedia();
    }
  }, [activeTab]);

  const loadMoreMedia = () => {
    // Pagination is disabled in this simplified version.
  };

  const handleLongPress = item => {
    // Don't do anything if already in selection mode on long press
    if (isSelectionMode) return;

    setIsSelectionMode(true);
    setSelectedItems(new Map([[item.node.image.uri, item.node]]));
  };

  const handlePress = item => {
    const node = item.node;
    const uri = node.image.uri;
    if (isSelectionMode) {
      const newSelectedItems = new Map(selectedItems);
      if (newSelectedItems.has(uri)) {
        newSelectedItems.delete(uri);
      } else {
        newSelectedItems.set(uri, node);
      }
      if (newSelectedItems.size === 0) {
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
    setSelectedItems(new Map());
  };

  const handleUpload = () => {
    if (selectedItems.size === 0) {
      Alert.alert('No Files Selected', 'Please select files to upload.');
      return;
    }

    const filesToUpload = Array.from(selectedItems.values());
    addFilesToUploadQueue(filesToUpload);

    // Immediately reset the UI. The UploadManager will show a notification.
    setCloudMedia([]); // Invalidate cloud media to force a refresh on next visit
    cancelSelection();
  };

  return (
    <SafeAreaView style={styles.container}>
      {isSelectionMode ? (
        <SelectionHeader
          onCancel={cancelSelection}
          selectedCount={selectedItems.size}
          onUpload={handleUpload}
          onDelete={handleDelete}
          onDownload={handleDownload}
          onLocalDelete={handleLocalDelete}
          activeTab={activeTab}
        />
      ) : (
        <Header
          navigation={navigation}
          activeTab={activeTab}
          onClean={handleCleanDuplicates}
        />
      )}
      {activeTab === 'local' && (
        <SectionList
          sections={groupedLocalMedia}
          contentContainerStyle={styles.listContentContainer}
          keyExtractor={(item, index) => {
            // The item is an array of photos for the section. Use the first image's URI as a key.
            if (Array.isArray(item) && item.length > 0) {
              return item[0].node.image.uri;
            }
            return `section-${index}`; // Fallback key
          }}
          renderSectionHeader={({ section: { title } }) => (
            <Text style={styles.sectionHeader}>{title}</Text>
          )}
          renderItem={({ item: sectionItems }) => {
            // 'sectionItems' is an array of all photos for this section
            return (
              <View style={styles.sectionContainer}>
                {sectionItems.map(item => {
                  const isVideo = item.node.type.startsWith('video');
                  const { uri } = item.node.image;
                  const isSelected = selectedItems.has(uri);
                  return (
                    <TouchableOpacity
                      key={uri}
                      style={styles.imageTouchable}
                      onPress={() => handlePress(item)}
                      onLongPress={() => handleLongPress(item)}
                    >
                      <SharedElement id={`photo.${uri}`} style={{ flex: 1 }}>
                        <Image style={styles.image} source={{ uri }} />
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
                })}
              </View>
            );
          }}
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
          <SectionList
            sections={groupedCloudMedia}
            contentContainerStyle={styles.listContentContainer}
            keyExtractor={(item, index) => {
              // The item is an array of photos for the section. Use the first image's ID as a key.
              if (Array.isArray(item) && item.length > 0) {
                return item[0]._id;
              }
              return `cloud-section-${index}`; // Fallback key
            }}
            renderSectionHeader={({ section: { title } }) => (
              <Text style={styles.sectionHeader}>{title}</Text>
            )}
            renderItem={({ item }) => {
              // 'item' is an array of all cloud photos for this section
              return (
                <View style={styles.sectionContainer}>
                  {item.map(mediaItem => {
                    const isVideo = mediaItem.mediaType.startsWith('video');
                    const isPhoto = mediaItem.mediaType === 'photo';
                    const isSelected = selectedItems.has(mediaItem._id);
                    return (
                      <TouchableOpacity
                        key={mediaItem._id}
                        style={styles.imageTouchable}
                        onPress={() => handleCloudItemInteraction(mediaItem)}
                        onLongPress={() => handleCloudItemLongPress(mediaItem)}
                      >
                        <SharedElement
                          id={`photo.${mediaItem.urls.original}`}
                          style={{ flex: 1 }}
                        >
                          {mediaItem.localThumbnailPath ? (
                            <Image
                              style={styles.image}
                              source={{ uri: mediaItem.localThumbnailPath }}
                            />
                          ) : (
                            <View style={styles.thumbnailPlaceholder}>
                              <Play color="rgba(255,255,255,0.7)" size={40} />
                            </View>
                          )}
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
                  })}
                </View>
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
  selectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
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
    width: '33.333%',
    aspectRatio: 1,
    padding: 2,
  },
  sectionContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  sectionHeader: {
    padding: 16,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#362419',
    backgroundColor: '#E8E0D4',
  },
  imageTouchable_legacy_flatlist: {
    flex: 1 / 3,
    aspectRatio: 1,
    // This padding creates the visual gap between images.
    // A value of 2 means a 4px gap between items.
    padding: 2,
  },
  image: {
    flex: 1,
    borderRadius: 8,
    margin: 8,

    // The image should fill its container. The gap is handled by the parent's padding.
    resizeMode: 'cover',
  },
  thumbnailPlaceholder: {
    flex: 1,
    borderRadius: 8,
    margin: 8,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContentContainer: {
    // No padding needed here, as the item's padding handles the gaps.
  },
  videoIconContainer: {
    position: 'absolute',
    // Increased from 8 to 16 to move it inside the image's margin
    bottom: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
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
