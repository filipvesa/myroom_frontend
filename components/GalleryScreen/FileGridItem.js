import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import {
  File,
  FileText,
  FileArchive,
  FileImage,
  FileVideo,
  FileSpreadsheet,
  FilePresentation,
} from 'lucide-react-native';

const getFileIcon = fileName => {
  const extension = fileName.split('.').pop().toLowerCase();

  switch (extension) {
    case 'pdf':
      return <FileText color="#D93025" size={36} />;
    case 'doc':
    case 'docx':
    case 'odt':
      return <FileText color="#4285F4" size={36} />;
    case 'xls':
    case 'xlsx':
    case 'ods':
    case 'csv':
      return <FileSpreadsheet color="#0F9D58" size={36} />;
    case 'ppt':
    case 'pptx':
    case 'odp':
      return <FilePresentation color="#F4B400" size={36} />;
    case 'zip':
    case 'rar':
    case '7z':
      return <FileArchive color="#5f6368" size={36} />;
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
      return <FileImage color="#8A2BE2" size={36} />;
    case 'mp4':
    case 'mov':
    case 'avi':
      return <FileVideo color="#FF69B4" size={36} />;
    default:
      return <File color="#808080" size={36} />;
  }
};

const FileGridItem = ({ item, onPress }) => {
  return (
    <TouchableOpacity style={styles.gridItem} onPress={() => onPress(item)}>
      <View style={styles.iconContainer}>{getFileIcon(item.name)}</View>
      <Text style={styles.fileName} numberOfLines={2}>
        {item.name}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  gridItem: {
    width: '33.333%',
    aspectRatio: 1,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileName: {
    height: 36, // Reserve space for two lines of text
    textAlign: 'center',
    fontSize: 12,
    color: '#362419',
    marginTop: 4,
  },
});

export const MemoizedFileGridItem = React.memo(FileGridItem);
