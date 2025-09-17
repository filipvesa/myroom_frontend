import { Alert } from 'react-native';

/**
 * This is a simple, in-memory queue for managing file uploads.
 * It processes one file at a time to avoid overwhelming the network.
 * The uploads will continue as long as the app is running in the foreground or background.
 * They will stop if the app is terminated by the user or the OS.
 */

let uploadQueue = [];
let isProcessing = false;

const processQueue = async () => {
  if (isProcessing || uploadQueue.length === 0) {
    return;
  }

  isProcessing = true;
  const itemNode = uploadQueue.shift(); // Get the first file from the queue

  try {
    const formData = new FormData();
    const file = {
      uri: itemNode.image.uri,
      name: itemNode.image.filename || `media_${Date.now()}`,
      type: itemNode.type,
    };
    formData.append('mediaFiles', file);

    console.log(`[UploadManager] Starting upload for: ${file.name}`);

    const response = await fetch('https://vesafilip.eu/api/media/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed for ${file.name}: ${errorText}`);
    }

    console.log(`[UploadManager] Successfully uploaded: ${file.name}`);
  } catch (error) {
    console.error('[UploadManager] Error:', error);
    // Optional: Add the file back to the queue for a retry?
  } finally {
    isProcessing = false;
    // Process the next item in the queue
    processQueue();
  }
};

export const addFilesToUploadQueue = files => {
  uploadQueue.push(...files);
  console.log(
    `[UploadManager] ${files.length} files added to queue. Total: ${uploadQueue.length}`,
  );
  processQueue();
};
