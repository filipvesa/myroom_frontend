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
} from 'lucide-react-native';

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

const BottomNavigation = ({ activeTab, onTabPress }) => {
  const tabs = [
    { id: 'photos', icon: Images, label: 'Local' },
    { id: 'gallery', icon: Archive, label: 'Storage' },
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
  const [activeTab, setActiveTab] = useState('photos');
  const [media, setMedia] = useState([]);
  const [pageInfo, setPageInfo] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);

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
    loadMedia();
  }, []);

  const loadMoreMedia = () => {
    if (pageInfo?.has_next_page && !loadingMore) {
      setLoadingMore(true);
      loadMedia(pageInfo.end_cursor);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header navigation={navigation} />
      {activeTab === 'photos' ? (
        <FlatList
          data={media}
          numColumns={3}
          contentContainerStyle={styles.listContentContainer}
          keyExtractor={item => item.node.image.uri}
          renderItem={({ item }) => {
            const isVideo = item.node.type.startsWith('video');
            return (
              <TouchableOpacity
                style={styles.imageTouchable}
                onPress={() => {
                  if (!isVideo) {
                    navigation.navigate('PhotoView', {
                      photoUri: item.node.image.uri,
                    });
                  } else {
                    alert('Video player not implemented yet!');
                    navigation.navigate('VideoPlayer', {
                      videoUri: item.node.image.uri,
                    });
                  }
                }}
              >
                <SharedElement
                  id={`photo.${item.node.image.uri}`}
                  style={{ flex: 1 }}
                >
                  <Image
                    style={styles.image}
                    source={{ uri: item.node.image.uri }}
                  />
                </SharedElement>
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
      ) : (
        <View style={styles.placeholderContainer}>
          <Text style={styles.placeholderText}>Cloud Storage Coming Soon</Text>
        </View>
      )}
      <BottomNavigation activeTab={activeTab} onTabPress={setActiveTab} />
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
    bottom: 5,
    right: 5,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 15,
    width: 30,
    height: 30,
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
