import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  Image,
  Platform,
  FlatList,
  ActivityIndicator,
  Alert,
  Linking,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import { PermissionsAndroid } from 'react-native';
import { Play, Check, File } from 'lucide-react-native';
import { launchCamera } from 'react-native-image-picker';
import { addFilesToUploadQueue } from '../../services/UploadManager';
import RNFS from 'react-native-fs';
import RNFB from 'react-native-blob-util';
import Header from './Header';
import SelectionHeader from './SelectionHeader';
import BottomNavigation from './BottomNavigation';
import { MemoizedLocalMediaItem } from './LocalMediaItem';
import { MemoizedFileGridItem } from './FileGridItem';
import { MemoizedCloudMediaItem } from './CloudMediaItem';
import InfoModal from './InfoModal';
import AddToAlbumModal from './AddToAlbumModal';
import AlbumStrip from './AlbumStrip';
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

  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [selectedFileInfo, setSelectedFileInfo] = useState(null);
  const [isAddToAlbumModalVisible, setIsAddToAlbumModalVisible] =
    useState(false);
  const [selectedAlbumId, setSelectedAlbumId] = useState(null);

  // State for cloud media pagination
  const [loadingCloud, setLoadingCloud] = useState(false); // For initial load
  const [loadingMoreCloud, setLoadingMoreCloud] = useState(false);
  const [cloudPage, setCloudPage] = useState(1);
  const [hasMoreCloud, setHasMoreCloud] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // State for the new Files tab
  const [otherFiles, setOtherFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  // Re-check permissions when the app becomes active again
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        // If returning to the app on the 'files' tab, re-check permissions and load files
        if (activeTab === 'files') {
          console.log(
            'App has come to the foreground, re-checking file permissions.',
          );
          loadOtherFiles();
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [activeTab]); // Re-subscribe if the active tab changes

  async function hasAndroidPermission(permissionType = 'media') {
    if (Platform.OS !== 'android') {
      return true;
    }

    // For Android 13 (API 33) and above, use granular media permissions for photos/videos
    if (permissionType === 'media' && Platform.Version >= 33) {
      const statuses = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO,
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
      ]);
      const hasPermission =
        statuses[PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES] ===
          PermissionsAndroid.RESULTS.GRANTED &&
        statuses[PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO] ===
          PermissionsAndroid.RESULTS.GRANTED;
      statuses[PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE] ===
        PermissionsAndroid.RESULTS.GRANTED;

      if (!hasPermission) {
        Alert.alert(
          'Permission Required',
          'MyRoom needs access to your photos and videos to display them.',
          [{ text: 'OK' }],
        );
      }
      return hasPermission;
    }

    // For Android 11 (API 30) and above, for non-media files, check for All Files Access
    if (permissionType === 'files' && Platform.Version >= 30) {
      const hasPermission = await PermissionsAndroid.check(
        'android.permission.MANAGE_EXTERNAL_STORAGE',
      );
      return hasPermission;
    }

    // For older Android versions (below 13 for media, below 11 for files), use legacy storage permissions
    const hasLegacyPermission = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
    );
    if (hasLegacyPermission) {
      return true;
    }

    const status = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
    );
    if (status !== PermissionsAndroid.RESULTS.GRANTED) {
      Alert.alert(
        'Permission Required',
        'MyRoom needs access to your photos and videos to display them. Please grant permission in your device settings.',
        [
          { text: 'Not Now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ],
      );
      return false;
    }

    return true;
  }

  const onRefresh = React.useCallback(async () => {
    setIsRefreshing(true);
    try {
      if (activeTab === 'local') {
        await loadMedia(); // Refresh from the beginning
      } else if (activeTab === 'storage') {
        await loadCloudMedia(1, selectedAlbumId); // Re-load the currently selected album
      } else if (activeTab === 'files') {
        await loadOtherFiles(); // Refresh the files list
      }
    } catch (error) {
      console.error('Pull-to-refresh failed:', error);
    }
    setIsRefreshing(false);
  }, [activeTab, selectedAlbumId]);

  const loadCloudMedia = async (page = 1, albumId = selectedAlbumId) => {
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
      const baseUrl = 'https://vesafilip.eu/api';
      const url = albumId
        ? `${baseUrl}/albums/${albumId}/media?page=${page}&limit=${PAGE_LIMIT}`
        : `${baseUrl}/media/?page=${page}&limit=${PAGE_LIMIT}`;
      const response = await fetch(url, {
        headers,
      });
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

  const loadOtherFiles = async () => {
    setLoadingFiles(true);

    // Expanded list of document extensions
    const documentExtensions = [
      '.pdf',
      '.doc',
      '.docx',
      '.xls',
      '.xlsx',
      '.ppt',
      '.pptx',
      '.txt',
      '.csv', // Added CSV
      '.rtf', // Added RTF
      '.odt', // OpenDocument Text
      '.ods', // OpenDocument Spreadsheet
      '.odp', // OpenDocument Presentation
      '.epub', // Added EPUB
      '.zip',
      '.rar',
      '.7z', // Added 7z
    ];

    // This function will recursively scan a directory for matching files.
    const recursiveScan = async path => {
      let results = [];
      try {
        if (!(await RNFS.exists(path))) {
          console.log(`[File Scan] Path does not exist: ${path}`);
          return [];
        }

        const items = await RNFS.readDir(path);
        console.log(`[File Scan] Found ${items.length} items in ${path}`);

        for (const item of items) {
          console.log(
            `[File Scan] Processing item: ${item.name} (type: ${
              item.isDirectory() ? 'directory' : 'file'
            })`,
          );
          if (item.isDirectory()) {
            results = results.concat(await recursiveScan(item.path)); // Recurse into subdirectories
          } else if (item.isFile()) {
            // Ensure it's actually a file
            const fileNameLower = item.name.toLowerCase();
            const isDocument = documentExtensions.some(ext =>
              fileNameLower.endsWith(ext),
            );
            if (isDocument) {
              console.log(`[File Scan] Matched document: ${item.name}`);
              results.push(item); // Add file if extension matches
            } else {
              console.log(
                `[File Scan] Skipped non-document file: ${item.name}`,
              );
            }
          }
        }
      } catch (error) {
        console.warn(`[File Scan] Error accessing directory: ${path}`, error);
      }
      return results;
    };

    try {
      const downloadFiles = await recursiveScan(RNFS.DownloadDirectoryPath);
      const documentFiles = await recursiveScan(
        `${RNFS.ExternalStorageDirectoryPath}/Documents`,
      );

      const allFoundFiles = [...downloadFiles, ...documentFiles];
      // De-duplicate in case a file is found in multiple scans (unlikely but safe)
      const uniqueFiles = allFoundFiles.filter(
        (v, i, a) => a.findIndex(t => t.path === v.path) === i,
      );

      console.log(
        `[File Scan] Found ${uniqueFiles.length} total unique matching documents.`,
      );
      setOtherFiles(uniqueFiles);
    } catch (error) {
      console.error('Failed to read document directory:', error);
      Alert.alert(
        'Error',
        'Could not read the files directory. Please check permissions.',
      );
    } finally {
      setLoadingFiles(false);
    }
  };

  const getMimeType = fileName => {
    const extension = fileName.split('.').pop().toLowerCase();
    const mimeTypes = {
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ppt: 'application/vnd.ms-powerpoint',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      txt: 'text/plain',
      csv: 'text/csv',
      rtf: 'application/rtf',
      odt: 'application/vnd.oasis.opendocument.text',
      ods: 'application/vnd.oasis.opendocument.spreadsheet',
      odp: 'application/vnd.oasis.opendocument.presentation',
      zip: 'application/zip',
      rar: 'application/x-rar-compressed',
      '7z': 'application/x-7z-compressed',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      mp4: 'video/mp4',
      mov: 'video/quicktime',
      avi: 'video/x-msvideo',
    };
    return mimeTypes[extension] || 'application/octet-stream'; // Fallback
  };

  const handleFilePress = async file => {
    try {
      const mime = getMimeType(file.name);
      await RNFB.android.actionViewIntent(file.path, mime);
    } catch (error) {
      // Check for the specific error message from the library
      if (error.message && error.message.includes('No app associated')) {
        const extension = file.name.split('.').pop().toLowerCase();
        let suggestion = 'a file viewer';
        if (extension === 'pdf') {
          suggestion = 'a PDF reader';
        } else if (
          ['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'].includes(extension)
        ) {
          suggestion = 'a document editor like Microsoft Office or Google Docs';
        }

        Alert.alert(
          'No App Found',
          `Could not find an app on your device to open this file. You may need to install ${suggestion} from the Play Store.`,
          [
            { text: 'OK' },
            {
              text: 'Search Play Store',
              onPress: () =>
                Linking.openURL(`market://search?q=${extension}%20viewer`),
            },
          ],
        );
      } else {
        // Handle other potential errors
        console.error('Error opening file:', error);
        Alert.alert(
          'Error',
          'An unexpected error occurred while trying to open the file.',
        );
      }
    }
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

  const handleAlbumSelect = albumId => {
    // If the same album is tapped again, do nothing.
    if (albumId === selectedAlbumId) return;

    setSelectedAlbumId(albumId);
    // Reset media and pagination to load fresh data for the selected album
    setCloudMedia([]);
    setGroupedCloudMedia([]);
    loadCloudMedia(1, albumId);
  };

  const handleShowItemInfo = async item => {
    let fileInfo = {};

    try {
      if (activeTab === 'local') {
        const node = item.node;
        let realPath = node.image.uri;
        let size = 0;
        if (realPath.startsWith('content://')) {
          const stat = await RNFB.fs.stat(realPath);
          realPath = stat.path;
          size = stat.size;
        } else {
          const stat = await RNFS.stat(realPath);
          size = stat.size;
        }
        fileInfo = {
          filename: node.image.filename,
          mimeType: node.type,
          size: size,
          createdAt: node.timestamp * 1000,
          path: realPath,
        };
      } else {
        // For cloud media
        let extension = 'file';
        if (item.mimeType) {
          extension = item.mimeType.split('/')[1] || 'bin';
        } else if (item.mediaType === 'photo') {
          extension = 'jpg';
        } else if (item.mediaType === 'video') {
          extension = 'mp4';
        }
        const constructedFilename = `${item._id}.${extension}`;

        fileInfo = {
          filename: constructedFilename,
          mimeType: item.mimeType,
          size: item.size,
          createdAt: item.createdAt,
          path: 'Cloud Storage',
        };
      }
      setSelectedFileInfo(fileInfo);
      setInfoModalVisible(true);
    } catch (error) {
      console.error('Failed to get file info:', error);
      Alert.alert('Error', 'Could not retrieve file information.');
    }
  };

  const handleSectionLongPress = section => {
    if (!isSelectionMode) setIsSelectionMode(true);

    const newSelectedItems = new Map(selectedItems);
    const newSelectedSections = new Set(selectedSections);
    const sectionTitle = section.title;
    const isSectionCurrentlySelected = newSelectedSections.has(sectionTitle);

    const allItemsInSection = section.data.flat();

    const getItemId =
      activeTab === 'local' ? item => item.node.image.uri : item => item._id;
    const getItemData =
      activeTab === 'local' ? item => item.node : item => item;

    if (isSectionCurrentlySelected) {
      newSelectedSections.delete(sectionTitle);
      allItemsInSection.forEach(item => {
        newSelectedItems.delete(getItemId(item));
      });
    } else {
      newSelectedSections.add(sectionTitle);
      allItemsInSection.forEach(item => {
        newSelectedItems.set(getItemId(item), getItemData(item));
      });
    }

    setSelectedItems(newSelectedItems);
    setSelectedSections(newSelectedSections);

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

  const handleAlbumDelete = albumId => {
    if (!albumId) return; // Can't delete "All Photos"

    Alert.alert(
      'Delete Album',
      'Are you sure you want to delete this album? The photos inside will not be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await getAuthToken();
              const response = await fetch(
                `https://vesafilip.eu/api/albums/${albumId}`,
                {
                  method: 'DELETE',
                  headers: { Authorization: `Bearer ${token}` },
                },
              );
              if (!response.ok) {
                // --- FIX: Improve error message with details from the server ---
                let errorMessage = `HTTP Error: ${response.status}`;
                try {
                  const errorBody = await response.json();
                  errorMessage += ` - ${
                    errorBody.message || 'Unknown server error'
                  }`;
                } catch (e) {
                  // Could not parse error body
                }
                throw new Error(errorMessage);
              }
              // --- FIX: Reset to "All Photos" view after deletion ---
              setSelectedAlbumId(null);
              await loadCloudMedia(1, null); // Explicitly refresh the "All Photos" view
            } catch (error) {
              console.error('Failed to delete album:', error);
              Alert.alert('Error', 'Could not delete the album.');
            }
          },
        },
      ],
    );
  };

  const loadMedia = async (after, isPullToRefresh = false) => {
    if (Platform.OS === 'android' && !(await hasAndroidPermission('media'))) {
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
    } else if (activeTab === 'files') {
      // Load non-media files when the active tab is 'files'
      loadOtherFiles();
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
    if (isSelectionMode) return; // Don't do anything if already in selection mode

    setIsSelectionMode(true); // Enter selection mode
    if (activeTab === 'local') {
      setSelectedItems(new Map([[item.node.image.uri, item.node]]));
    } else {
      setSelectedItems(new Map([[item._id, item]]));
    }
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

  const handleOpenAddToAlbumModal = () => {
    setIsAddToAlbumModalVisible(true);
  };

  const handleConfirmAddToAlbum = albumId => {
    // This function is called when an album is selected in the modal.
    const mediaIds = Array.from(selectedItems.keys());
    if (mediaIds.length === 0) {
      Alert.alert('No items selected.');
      return;
    }

    const addItemsToAlbum = async () => {
      try {
        const token = await getAuthToken();
        const response = await fetch(
          `https://vesafilip.eu/api/albums/${albumId}/media`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ mediaIds }),
          },
        );
        if (!response.ok) throw new Error('Failed to add items to album.');
        Alert.alert('Success', 'Items added to album!');
        setIsAddToAlbumModalVisible(false);
        cancelSelection();
      } catch (error) {
        console.error(error);
        Alert.alert('Error', 'Could not add items to the album.');
      }
    };

    addItemsToAlbum();
  };

  const handleCameraLaunch = () => {
    launchCamera(
      {
        mediaType: 'photo',
        saveToPhotos: false, // Does not save a copy to the local gallery
      },
      response => {
        if (response.didCancel) {
          console.log('User cancelled camera.');
        } else if (response.errorCode) {
          console.error('Camera Error: ', response.errorMessage);
          Alert.alert('Camera Error', 'Could not open the camera.');
        } else {
          const asset = response.assets && response.assets[0];
          if (asset) {
            // The response gives us an object that looks very similar to a CameraRoll node.
            // We can adapt it to be used by our UploadManager.
            const fileToUpload = {
              image: {
                uri: asset.uri,
                filename: asset.fileName,
              },
              type: asset.type,
            };
            addFilesToUploadQueue([fileToUpload]);
            Alert.alert('Upload Started', 'Your photo is being uploaded.');
          }
        }
      },
    );
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
          onAddToAlbum={handleOpenAddToAlbumModal}
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
                    onPress={() => handlePress(item)}
                    onLongPress={() => handleLongPress(item)}
                    onPressInfo={handleShowItemInfo}
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
          ListHeaderComponent={
            <AlbumStrip
              onAlbumSelect={handleAlbumSelect}
              onAlbumLongPress={handleAlbumDelete}
              selectedAlbumId={selectedAlbumId}
            />
          }
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
                    onLongPress={() => handleLongPress(item)}
                    onPressInfo={handleShowItemInfo}
                    isSelected={selectedItems.has(item._id)}
                  />
                ))}
              </View>
            );
          }}
          onEndReached={loadMoreCloudMedia}
          onEndReachedThreshold={0.2}
          onRefresh={onRefresh}
          refreshing={isRefreshing}
          initialNumToRender={6} // Render a few sections initially
          maxToRenderPerBatch={1} // Render smaller batches
          windowSize={3} // Keep a reasonable number of sections in memory
          ListFooterComponent={
            loadingMoreCloud && <ActivityIndicator color="#362419" />
          }
        />
      )}
      {activeTab === 'files' &&
        (loadingFiles ? (
          <ActivityIndicator style={{ flex: 1 }} color="#362419" />
        ) : otherFiles.length === 0 ? (
          <View style={styles.centeredContent}>
            <Text style={styles.placeholderText}>No documents found.</Text>
          </View>
        ) : (
          <FlatList
            data={otherFiles}
            keyExtractor={item => item.path}
            numColumns={3}
            renderItem={({ item }) => (
              <MemoizedFileGridItem
                item={item}
                onPress={() => handleFilePress(item)}
              />
            )}
            onRefresh={onRefresh}
            refreshing={isRefreshing}
          />
        ))}
      {activeTab !== 'local' &&
        activeTab !== 'storage' &&
        activeTab !== 'files' && (
          <View style={styles.placeholderContainer}>
            <Text style={styles.placeholderText}>Coming Soon</Text>
          </View>
        )}
      {!isSelectionMode && (
        <BottomNavigation
          activeTab={activeTab}
          onTabPress={tabId => {
            if (tabId === 'files') {
              setActiveTab('files');
            } else if (tabId === 'camera') {
              // The camera is an action, not a tab state. Just launch it.
              handleCameraLaunch();
            } else {
              setActiveTab(tabId);
            }
          }}
        />
      )}
      <InfoModal
        isVisible={infoModalVisible}
        onClose={() => setInfoModalVisible(false)}
        fileInfo={selectedFileInfo}
      />
      <AddToAlbumModal
        isVisible={isAddToAlbumModalVisible}
        onClose={() => setIsAddToAlbumModalVisible(false)}
        onConfirm={handleConfirmAddToAlbum}
      />
    </SafeAreaView>
  );
};

export default GalleryScreen;
