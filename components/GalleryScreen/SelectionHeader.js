import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { CloudUpload, Trash, Download } from 'lucide-react-native';
import { galleryStyles as styles } from '../../styles/galleryStyles';

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

export default SelectionHeader;
