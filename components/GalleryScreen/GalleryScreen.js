import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  Image,
  Platform,
  PermissionsAndroid,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import { Play, Check, File } from 'lucide-react-native';
import { addFilesToUploadQueue } from '../../services/UploadManager';
import RNFS from 'react-native-fs';
import RNFB from 'react-native-blob-util';
import Header from './Header';
import SelectionHeader from './SelectionHeader';
import BottomNavigation from './BottomNavigation';
import { MemoizedLocalMediaItem } from './LocalMediaItem';
import { MemoizedCloudMediaItem } from './CloudMediaItem';
import { getAuthToken } from '../../utils/authUtils';
import { galleryStyles as styles } from '../../styles/galleryStyles';
import { groupMediaByDateAndRow } from '../../utils/galleryUtils';

const GalleryScreen = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('local');
  const [media, setMedia] = useState([]);
  const [pageInfo, setPageInfo] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [cloudMedia, setCloudMedia] = useState([]);
  const [groupedLocalMedia, setGroupedLocalMedia] = useState([]);
  const [groupedCloudMedia, setGroupedCloudMedia] = useState([]);
  const [selectedItems, setSelectedItems] = useState(new Map());
  const [selectedSections, setSelectedSections] = useState(new Set());

  // State for cloud media pagination
  const [loadingCloud, setLoadingCloud] = useState(false); // For initial load
  const [loadingMoreCloud, setLoadingMoreCloud] = useState(false);
  const [cloudPage, setCloudPage] = useState(1);
  const [hasMoreCloud, setHasMoreCloud] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function hasAndroidPermission() {
    if (Platform.OS !== 'android') {
      return true;
    }

    let hasPermission = false;
    if (Platform.Version >= 33) {
      // On Android 13+, we need to check for granular media permissions.
      const statuses = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
      ]);
      hasPermission =
        statuses[PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES] ===
          PermissionsAndroid.RESULTS.GRANTED &&
        statuses[PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO] ===
          PermissionsAndroid.RESULTS.GRANTED;
    } else {
      // On older Android versions (API 28 and below), we need WRITE_EXTERNAL_STORAGE
      // to be able to delete files from the gallery.
      const readResult = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
      );
      // We also need write permission for deletion to work.
      const writeResult = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
      );
      hasPermission =
        readResult === PermissionsAndroid.RESULTS.GRANTED &&
        writeResult === PermissionsAndroid.RESULTS.GRANTED;
    }

    if (!hasPermission) {
      Alert.alert(
        'Permission Required',
        'MyRoom needs access to your photos and videos to display them. Please grant permission in your device settings.',
        [
          { text: 'Not Now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ],
      );
    }

    return hasPermission;
  }

  const onRefresh = React.useCallback(async () => {
    setIsRefreshing(true);
    try {
      if (activeTab === 'local') {
        await loadMedia(); // Refresh from the beginning
      } else if (activeTab === 'storage') {
        await loadCloudMedia(1); // Refresh from page 1
      }
    } catch (error) {
      console.error('Pull-to-refresh failed:', error);
    }
    setIsRefreshing(false);
  }, [activeTab]);

  const loadCloudMedia = async (page = 1) => {
    if (page === 1) {
      setLoadingCloud(true);
    } else {
      setLoadingMoreCloud(true);
    }

    try {
      const PAGE_LIMIT = 20;
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
      const response = await fetch(
        `https://vesafilip.eu/api/media/?page=${page}&limit=${PAGE_LIMIT}`,
        {
          headers,
        },
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // --- FIX: Handle both object and array responses from the server ---
      const responseData = await response.json();
      let serverMediaList;
      let pagination;

      if (Array.isArray(responseData)) {
        // Handle the case where the server returns an empty array directly
        serverMediaList = responseData;
        pagination = { currentPage: page, totalPages: page }; // Assume this is the last page
      } else {
        // Handle the expected object structure
        serverMediaList = responseData.media || [];
        pagination = responseData.pagination || {
          currentPage: page,
          totalPages: page,
        };
      }

      // --- DEBUGGING: Log the raw data from the server ---
      console.log(
        '[DEBUG] Raw data from server:',
        JSON.stringify(responseData, null, 2),
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

      // Append new media if it's not the first page
      const newCloudMedia =
        page === 1 ? processedMedia : [...cloudMedia, ...processedMedia];

      // Update state
      setCloudMedia(newCloudMedia);
      setCloudPage(page);

      // --- FIX: Use pagination data from the server ---
      setHasMoreCloud(pagination.currentPage < pagination.totalPages);

      // Group the successfully processed media by date *after* filtering
      // Group the successfully processed media by date
      const grouped = groupMediaByDateAndRow(
        newCloudMedia,
        item => item.createdAt,
      );
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
      setLoadingMoreCloud(false);
    }
  };

  const handleCloudItemPress = async item => {
    const token = await getAuthToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    if (item.mediaType === 'photo') {
      navigation.navigate('PhotoView', {
        optimizedUri: item.urls.medium, // Use 'medium' as the optimized version
        originalUri: item.urls.original, // Use the full URL provided by the backend
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

  const handleSectionLongPress = section => {
    setIsSelectionMode(true);

    const newSelectedItems = new Map(selectedItems);
    const newSelectedSections = new Set(selectedSections);
    const sectionTitle = section.title;
    const isSectionCurrentlySelected = newSelectedSections.has(sectionTitle);

    // Flatten the rows to get all items in the section
    const allItemsInSection = section.data.flat(); // .flat() is perfect here

    // Define how to get a unique ID and the item data for each tab
    const getItemId =
      activeTab === 'local' ? item => item.node.image.uri : item => item._id;
    const getItemData =
      activeTab === 'local' ? item => item.node : item => item;

    if (isSectionCurrentlySelected) {
      // If the section is already selected, deselect it and all its items.
      newSelectedSections.delete(sectionTitle);
      allItemsInSection.forEach(item => {
        newSelectedItems.delete(getItemId(item));
      });
    } else {
      // If the section is not selected, select it and all its items.
      newSelectedSections.add(sectionTitle);
      allItemsInSection.forEach(item => {
        newSelectedItems.set(getItemId(item), getItemData(item));
      });
    }

    setSelectedItems(newSelectedItems);
    setSelectedSections(newSelectedSections);

    // If deselecting the last selected items, exit selection mode
    if (newSelectedItems.size === 0) {
      setIsSelectionMode(false);
    }
  };

  const renderSectionHeader = ({ section }) => {
    const isSectionSelected = selectedSections.has(section.title);
    return (
      <TouchableOpacity onLongPress={() => handleSectionLongPress(section)}>
        <View style={styles.sectionHeaderContainer}>
          <Text style={styles.sectionHeader}>{section.title}</Text>
          {isSelectionMode && (
            <View
              style={[
                styles.selectionCircle,
                isSectionSelected && styles.selectionCircleSelected,
              ]}
            >
              <Check color="white" size={14} />
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
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
              const downloadsDir = RNFS.DownloadDirectoryPath;
              const myRoomDir = `${downloadsDir}/MyRoom`;
              await RNFS.mkdir(myRoomDir);

              const token = await getAuthToken();
              const headers = {};
              if (token) {
                headers['Authorization'] = `Bearer ${token}`;
              }

              const downloadPromises = Array.from(selectedItems.values()).map(
                async item => {
                  // Construct a valid filename since it's not in the item object
                  let extension = 'file';
                  let mimeType = 'application/octet-stream';
                  if (item.mimeType) {
                    extension = item.mimeType.split('/')[1];
                    mimeType = item.mimeType;
                  } else if (item.mediaType === 'photo') {
                    extension = 'jpg';
                    mimeType = 'image/jpeg';
                  } else if (item.mediaType === 'video') {
                    extension = 'mp4';
                    mimeType = 'video/mp4';
                  }
                  const filename = `${item._id}.${extension}`;
                  const downloadUrl = `https://vesafilip.eu/api/media/download/${item._id}/original`;
                  const finalPath = `${myRoomDir}/${filename}`;

                  console.log(
                    `[Download] Starting download for ${filename} to ${finalPath}`,
                  );

                  const res = await RNFS.downloadFile({
                    fromUrl: downloadUrl,
                    toFile: finalPath,
                    headers: headers,
                  }).promise;

                  if (res.statusCode !== 200) {
                    throw new Error(
                      `Download failed for ${filename} with status ${res.statusCode}`,
                    );
                  }

                  // After download, scan the file to make it visible in the gallery
                  await RNFB.fs.scanFile([{ path: finalPath, mime: mimeType }]);
                  console.log(
                    `[Download] Scanned ${filename} (Status: ${res.statusCode})`,
                  );
                },
              );

              await Promise.all(downloadPromises);

              Alert.alert(
                'Download Complete',
                `${selectedItems.size} file(s) have been saved to your "Downloads/MyRoom" folder.`,
              );
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
              cancelSelection(); // The useFocusEffect will handle the refresh.
            } catch (error) {
              console.error('Failed to delete local files:', error);
              Alert.alert('Error', 'Could not delete one or more files.');
            }
          },
        },
      ],
    );
  };

  const loadMedia = async (after, isPullToRefresh = false) => {
    if (Platform.OS === 'android' && !(await hasAndroidPermission())) {
      return;
    }
    if (!isPullToRefresh) setLoadingMore(true); // Show loading indicator
    CameraRoll.getPhotos({
      first: 42, // Fetch a reasonable page size
      assetType: 'All',
      after,
    })
      .then(r => {
        const incomingMedia = r.edges;
        const currentMedia = after ? media : [];
        const combinedMedia = [...currentMedia, ...incomingMedia];

        // De-duplicate the list based on the URI to prevent selection issues
        const seenUris = new Set();
        const uniqueMedia = combinedMedia.filter(item => {
          const uri = item.node.image.uri;
          return seenUris.has(uri) ? false : seenUris.add(uri);
        });

        setMedia(uniqueMedia);
        setPageInfo(r.page_info);

        const grouped = groupMediaByDateAndRow(
          uniqueMedia,
          item => item.node.timestamp * 1000,
        );
        setGroupedLocalMedia(grouped);
      })
      .catch(err => console.log(err))
      .finally(() => {
        if (!isPullToRefresh) setLoadingMore(false);
      });
  };

  useEffect(() => {
    if (activeTab === 'local') {
      // Only load local media on the first visit to the tab
      if (media.length === 0) {
        loadMedia();
      }
    } else if (activeTab === 'storage') {
      // Only load cloud media on the first visit to the tab
      if (cloudMedia.length === 0) {
        loadCloudMedia(1);
      }
    }
  }, [activeTab]);

  const loadMoreMedia = () => {
    if (pageInfo?.has_next_page && !loadingMore) {
      loadMedia(pageInfo.end_cursor);
    }
  };

  const loadMoreCloudMedia = () => {
    if (hasMoreCloud && !loadingMoreCloud && !loadingCloud) {
      loadCloudMedia(cloudPage + 1);
    }
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
          // For local files, all URIs are the same.
          optimizedUri: uri,
          originalUri: uri,
          thumbnailUri: uri,
          headers: {}, // No headers needed for local files
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
    setSelectedSections(new Set());
  };

  const handleUpload = () => {
    if (selectedItems.size === 0) {
      Alert.alert('No Files Selected', 'Please select files to upload.');
      return;
    }

    const filesToUpload = Array.from(selectedItems.values());
    addFilesToUploadQueue(filesToUpload);

    // Immediately reset the UI. The UploadManager will show a notification.
    cancelSelection(); // Just cancel the selection, the focus effect will handle the refresh.
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
        <Header navigation={navigation} activeTab={activeTab} />
      )}
      {activeTab === 'local' && (
        <SectionList
          sections={groupedLocalMedia}
          contentContainerStyle={styles.listContentContainer}
          keyExtractor={(sectionItems, index) => {
            // The item passed to keyExtractor is the array of photos for the section.
            // Use the first image's URI as a key.
            if (Array.isArray(sectionItems) && sectionItems.length > 0) {
              return sectionItems[0].node.image.uri;
            }
            return `section-${index}`; // Fallback key
          }}
          renderSectionHeader={renderSectionHeader}
          renderItem={({ item: rowItems }) => {
            // 'rowItems' is now an array of up to 3 photos for a single row
            return (
              <View style={styles.sectionContainer}>
                {rowItems.map(item => (
                  <MemoizedLocalMediaItem
                    key={item.node.image.uri}
                    item={item}
                    onPress={handlePress}
                    onLongPress={handleLongPress}
                    isSelected={selectedItems.has(item.node.image.uri)}
                  />
                ))}
              </View>
            );
          }}
          onEndReached={loadMoreMedia}
          onEndReachedThreshold={0.5}
          initialNumToRender={12} // Render a few sections initially
          onRefresh={onRefresh}
          refreshing={isRefreshing}
          maxToRenderPerBatch={6} // Render smaller batches
          windowSize={11} // Keep a reasonable number of sections in memory
          ListFooterComponent={
            loadingMore && <ActivityIndicator color="#362419" />
          }
        />
      )}
      {activeTab === 'storage' && (
        <SectionList
          sections={groupedCloudMedia}
          contentContainerStyle={styles.listContentContainer}
          keyExtractor={(sectionItems, index) => {
            if (Array.isArray(sectionItems) && sectionItems.length > 0) {
              return sectionItems[0]._id; // Use first item's ID as key
            }
            return `section-${index}`; // Fallback
          }}
          renderSectionHeader={renderSectionHeader}
          renderItem={({ item: rowItems }) => {
            // 'rowItems' is now an array of up to 3 photos for a single row
            return (
              <View style={styles.sectionContainer}>
                {rowItems.map(item => (
                  <MemoizedCloudMediaItem
                    key={item._id}
                    item={item}
                    handleCloudItemInteraction={handleCloudItemInteraction}
                    onLongPress={handleCloudItemLongPress}
                    isSelected={selectedItems.has(item._id)}
                  />
                ))}
              </View>
            );
          }}
          onEndReached={loadMoreCloudMedia}
          onEndReachedThreshold={0.5}
          onRefresh={onRefresh}
          refreshing={isRefreshing}
          initialNumToRender={12} // Render a few sections initially
          maxToRenderPerBatch={6} // Render smaller batches
          windowSize={11} // Keep a reasonable number of sections in memory
          ListFooterComponent={
            loadingMoreCloud && <ActivityIndicator color="#362419" />
          }
        />
      )}
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

export default GalleryScreen;
