import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { galleryStyles as styles } from '../../styles/galleryStyles';

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
    </View>
    <View style={{ width: 40 }} />
  </View>
);

export default Header;
