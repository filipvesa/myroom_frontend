import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { getAuthToken } from '../../utils/authUtils';

const AuthenticatedImage = ({ uri, style }) => {
  const [headers, setHeaders] = useState(null);

  useEffect(() => {
    const setAuthHeader = async () => {
      const token = await getAuthToken();
      if (token) {
        setHeaders({ Authorization: `Bearer ${token}` });
      }
    };
    setAuthHeader();
  }, [uri]);

  if (!headers) {
    // Render a placeholder while the token is being fetched
    return <View style={style || styles.albumCover} />;
  }

  return <Image source={{ uri, headers }} style={style || styles.albumCover} />;
};

const AlbumStrip = ({ onAlbumSelect, onAlbumLongPress, selectedAlbumId }) => {
  const [albums, setAlbums] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchAlbums = async () => {
      setIsLoading(true);
      try {
        const token = await getAuthToken();
        if (!token) throw new Error('User not authenticated.');

        const response = await fetch('https://vesafilip.eu/api/albums', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.status === 404) {
          setAlbums([]);
          return;
        }
        if (!response.ok) throw new Error('Failed to fetch albums.');

        const data = await response.json();
        setAlbums(data || []);
      } catch (error) {
        console.error('Failed to fetch albums for strip:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAlbums();
  }, []);

  const renderAlbum = ({ item }) => {
    const isSelected = selectedAlbumId === item._id;
    return (
      <TouchableOpacity
        style={[styles.albumContainer, isSelected && styles.selectedAlbum]}
        onPress={() => onAlbumSelect(item._id)}
        onLongPress={() => onAlbumLongPress(item._id)}
      >
        {item.thumbnailUrls && item.thumbnailUrls.length > 0 ? (
          <View style={styles.albumCover}>
            {item.thumbnailUrls.slice(0, 4).map((url, index) => (
              <AuthenticatedImage
                key={index}
                uri={url}
                style={[
                  styles.collageImage,
                  // Dynamic styles for 1, 2, or 4 images
                  item.thumbnailUrls.length === 1 && {
                    width: '100%',
                    height: '100%',
                  },
                  item.thumbnailUrls.length === 2 && {
                    width: '100%',
                    height: '50%',
                  },
                  item.thumbnailUrls.length > 2 && {
                    width: '50%',
                    height: '50%',
                  },
                ]}
              />
            ))}
          </View>
        ) : item.thumbnailUrls ? (
          <AuthenticatedImage
            uri={item.thumbnailUrls}
            style={styles.albumCover}
          />
        ) : (
          <View style={styles.albumCoverPlaceholder}>
            <Text style={styles.placeholderText}>?</Text>
          </View>
        )}
        <Text style={styles.albumName} numberOfLines={2}>
          {item.name}
        </Text>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return <ActivityIndicator style={{ marginVertical: 20 }} color="#362419" />;
  }

  return (
    <View style={styles.stripContainer}>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={[{ _id: null, name: 'All Photos' }, ...albums]} // Add "All Photos" option
        renderItem={renderAlbum}
        keyExtractor={item => item._id || 'all-photos'}
        contentContainerStyle={{ paddingHorizontal: 16 }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  stripContainer: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#d1c8bc',
    backgroundColor: '#E8E0D4',
  },
  albumContainer: {
    marginRight: 15,
    alignItems: 'center',
    width: 80,
    padding: 5,
    borderRadius: 12,
  },
  selectedAlbum: {
    backgroundColor: 'rgba(54, 36, 25, 0.1)',
  },
  albumCover: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 3,
    flexDirection: 'row',
    flexWrap: 'wrap',
    overflow: 'hidden', // Clips the inner images to the rounded corners
  },
  albumCoverPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: 'rgba(54, 36, 25, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 30,
    color: 'white',
  },
  collageImage: {
    // The border creates a "gap" effect between collage images
    borderColor: '#e4ddd4ff',
    borderWidth: 2,
    borderRadius: 5,
  },
  albumName: {
    marginTop: 5,
    fontSize: 12,
    color: '#362419',
    textAlign: 'center',
    fontWeight: 'bold',
  },
});

export default AlbumStrip;
