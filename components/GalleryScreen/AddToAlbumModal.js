import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { getAuthToken } from '../../utils/authUtils';

const AddToAlbumModal = ({ isVisible, onClose, onConfirm }) => {
  const [albums, setAlbums] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState('');

  const fetchAlbums = async () => {
    setIsLoading(true);
    try {
      // --- FIX: Add a check to ensure the token exists before making the request ---
      const token = await getAuthToken();

      if (!token) {
        throw new Error('User is not authenticated.');
      }

      const response = await fetch('https://vesafilip.eu/api/albums', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        let errorMessage = `HTTP Error: ${response.status}`;
        try {
          const errorBody = await response.json();
          errorMessage += ` - ${errorBody.message || 'Unknown server error'}`;
        } catch (e) {
          // Could not parse error body
        }
        throw new Error(errorMessage);
      }
      const data = await response.json();
      // --- FIX: Handle direct array response from the server ---
      // Also attach the token to each album object for the Image component to use
      const albumsWithToken = (data || []).map(album => ({ ...album, token }));
      setAlbums(albumsWithToken);
    } catch (error) {
      Alert.alert(
        'Error Loading Albums',
        'Could not load your albums. Please try again later.',
      );
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAlbum = async () => {
    if (!newAlbumName.trim()) {
      Alert.alert('Invalid Name', 'Please enter a name for the new album.');
      return;
    }
    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('User is not authenticated.');
      }

      const response = await fetch('https://vesafilip.eu/api/albums', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newAlbumName }),
      });

      if (!response.ok) {
        // --- FIX: Improve error message with details from the server ---
        let errorMessage = `HTTP Error: ${response.status}`;
        try {
          const errorBody = await response.json();
          errorMessage += ` - ${errorBody.message || 'Unknown server error'}`;
        } catch (e) {
          // Could not parse error body
        }
        throw new Error(errorMessage);
      }

      const newAlbum = await response.json();
      // Immediately add the new album to the list and select it
      onConfirm(newAlbum._id);
    } catch (error) {
      Alert.alert('Error', 'Could not create the album.');
      console.error(error);
    }
  };

  useEffect(() => {
    if (isVisible) {
      fetchAlbums();
      setIsCreating(false); // Reset create mode when modal opens
      setNewAlbumName('');
    }
  }, [isVisible]);

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPressOut={onClose}
      >
        <View style={styles.modalContent}>
          <Text style={styles.title}>Add to Album</Text>
          {isLoading ? (
            <ActivityIndicator size="large" color="#362419" />
          ) : (
            <ScrollView>
              {isCreating ? (
                <View style={styles.createContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="New Album Name"
                    value={newAlbumName}
                    onChangeText={setNewAlbumName}
                    autoFocus
                  />
                  <TouchableOpacity
                    style={styles.createButton}
                    onPress={handleCreateAlbum}
                  >
                    <Text style={styles.createButtonText}>Create</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.albumRow}
                  onPress={() => setIsCreating(true)}
                >
                  <Text style={styles.createText}>+ Create New Album</Text>
                </TouchableOpacity>
              )}
              {albums.map(album => (
                <TouchableOpacity
                  key={album._id}
                  style={styles.albumRowContainer}
                  onPress={() => onConfirm(album._id)}
                >
                  {/* --- FIX: Check for both single and multiple cover photo URLs --- */}
                  {album.coverPhotoUrl ? (
                    // Case 1: A single cover photo URL is provided
                    <Image
                      source={{
                        uri: album.coverPhotoUrl,
                        headers: { Authorization: `Bearer ${album.token}` },
                      }}
                      style={styles.albumCover}
                    />
                  ) : album.coverPhotoUrls &&
                    album.coverPhotoUrls.length > 0 ? (
                    // Case 2: An array of URLs for a collage is provided
                    <View style={styles.albumCover}>
                      {album.coverPhotoUrls.slice(0, 4).map((url, index) => (
                        <Image
                          key={index}
                          source={{
                            uri: url,
                            headers: { Authorization: `Bearer ${album.token}` },
                          }}
                          style={[
                            styles.collageImage,
                            // Adjust style for 1, 2, or 4 images
                            album.coverPhotoUrls.length === 1 && {
                              width: '100%',
                              height: '100%',
                            },
                            album.coverPhotoUrls.length === 2 && {
                              width: '100%',
                              height: '50%',
                            },
                            album.coverPhotoUrls.length > 2 && {
                              width: '50%',
                              height: '50%',
                            },
                          ]}
                        />
                      ))}
                    </View>
                  ) : (
                    // Case 3: No cover photo is available
                    <View style={styles.albumCoverPlaceholder}>
                      <Text style={styles.placeholderText}>?</Text>
                    </View>
                  )}
                  <View style={styles.albumInfo}>
                    <Text style={styles.albumName}>{album.name}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalContent: {
    width: '90%',
    maxHeight: '70%',
    backgroundColor: '#E8E0D4',
    borderRadius: 12,
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#362419',
    marginBottom: 15,
  },
  albumRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#d1c8bc',
  },
  albumName: {
    fontSize: 18,
    color: '#362419',
  },
  createText: {
    fontSize: 18,
    color: '#007AFF',
    fontWeight: '600',
    paddingVertical: 15, // Keep consistent padding
    borderBottomWidth: 1,
    borderBottomColor: '#d1c8bc',
  },
  albumCover: {
    width: 50,
    height: 50,
    borderRadius: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    overflow: 'hidden', // Ensures the small images are clipped by the border radius
  },
  albumCoverPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#b0a9a1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 24,
    color: 'white',
  },
  collageImage: {
    // No specific styles needed here, dimensions are applied dynamically
  },
  albumInfo: {
    marginLeft: 15,
  },
  createContainer: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#d1c8bc',
  },
  input: {
    width: '100%',
    height: 40,
    backgroundColor: 'white',
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 10,
    fontSize: 16,
  },
  createButton: {
    backgroundColor: '#362419',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  createButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default AddToAlbumModal;
