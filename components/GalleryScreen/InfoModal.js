import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';

const InfoRow = ({ label, value }) => (
  <View style={styles.row}>
    <Text style={styles.label}>{label}</Text>
    <Text style={styles.value} selectable>
      {value}
    </Text>
  </View>
);

const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const InfoModal = ({ isVisible, onClose, fileInfo }) => {
  if (!fileInfo) return null;

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
          <Text style={styles.title}>File Information</Text>
          <InfoRow label="Filename" value={fileInfo.filename} />
          <InfoRow label="Type" value={fileInfo.mimeType} />
          <InfoRow label="Size" value={formatBytes(fileInfo.size)} />
          <InfoRow
            label="Created"
            value={new Date(fileInfo.createdAt).toLocaleString()}
          />
          <InfoRow label="Path" value={fileInfo.path} />
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
    backgroundColor: '#E8E0D4',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#362419',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#d1c8bc',
    paddingBottom: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#5a3e2b',
    flex: 1,
  },
  value: {
    fontSize: 16,
    color: '#362419',
    flex: 2,
    textAlign: 'right',
  },
});

export default InfoModal;
