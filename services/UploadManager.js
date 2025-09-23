import { Alert } from 'react-native';
import notifee, { AndroidImportance } from '@notifee/react-native';
import { getAuth } from '@react-native-firebase/auth';
import RNFB from 'react-native-blob-util';
import RNFS from 'react-native-fs';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import uuid from 'react-native-uuid';

// --- Global State for the Upload Queue ---
let uploadQueue = [];
let isProcessing = false;
let totalFilesInSession = 0;
let completedFilesInSession = 0;
let successfulUploads = [];
let duplicateUploads = [];
let failedUploads = [];

const NOTIFICATION_ID = 'upload-progress';

async function showUploadNotification(totalFiles) {
  const channelId = await notifee.createChannel({
    id: 'upload-progress-channel',
    name: 'File Upload Progress',
    importance: AndroidImportance.LOW, // Use LOW to make it silent
  });

  await notifee.displayNotification({
    id: NOTIFICATION_ID,
    title: 'Uploading Media',
    body: `Starting upload of ${totalFiles} file(s)...`,
    android: {
      channelId,
      // The progress will be indeterminate until the first file starts
      progress: { indeterminate: true },
      ongoing: true,
      asForegroundService: true,
      foregroundService: {
        type: 'dataSync', // This is the critical change
      },
      autoCancel: false,
    },
  });
}

function formatEta(seconds) {
  if (seconds < 0 || !isFinite(seconds)) {
    return 'Calculating...';
  }
  if (seconds < 60) {
    return `${Math.round(seconds)}s remaining`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s remaining`;
}

async function updateUploadProgress(
  currentFilename,
  progress,
  etaSeconds,
  totalFiles,
  completedFiles,
) {
  const title = `Uploading: ${currentFilename}`;
  const body = `File ${completedFiles + 1} of ${totalFiles} (${progress.toFixed(
    0,
  )}%)`;

  await notifee.displayNotification({
    id: NOTIFICATION_ID,
    title: title,
    body: body,
    android: {
      channelId: 'upload-progress-channel',
      progress: {
        max: 100,
        current: progress,
      },
      ongoing: true,
      autoCancel: false,
    },
  });
}

async function showSummaryNotification(
  successfulUploads,
  duplicateUploads,
  failedUploads,
) {
  let title = 'Upload Complete';
  const bodyLines = [];

  if (successfulUploads.length > 0) {
    bodyLines.push(`• Uploaded: ${successfulUploads.length} file(s)`);
  }
  if (duplicateUploads.length > 0) {
    bodyLines.push(`• Duplicates: ${duplicateUploads.length} file(s)`);
  }
  if (failedUploads.length > 0) {
    bodyLines.push(`• Failed: ${failedUploads.length} file(s)`);
    title = 'Upload Finished with Errors';
  }

  const summaryBody =
    bodyLines.length > 0
      ? bodyLines.join('\n')
      : 'All files processed successfully.';

  // Create a separate, high-importance channel for the final summary
  const summaryChannelId = await notifee.createChannel({
    id: 'upload-summary-channel',
    name: 'Upload Summaries',
    importance: AndroidImportance.HIGH, // HIGH importance makes it pop up
  });

  await notifee.displayNotification({
    id: NOTIFICATION_ID,
    title: title,
    body: summaryBody,
    android: {
      channelId: summaryChannelId,
      // Use BigText style to show the full summary
      style: { type: notifee.AndroidStyle.BIGTEXT, text: summaryBody },
      ongoing: false,
      autoCancel: true,
    },
  });
}

const getAuthToken = async () => {
  try {
    const authInstance = getAuth();
    return await authInstance.currentUser?.getIdToken();
  } catch (error) {
    console.error('Failed to get auth token', error);
    return null;
  }
};

/**
 * Deletes a local file from the device's gallery after it has been uploaded.
 * @param {string} fileUri The URI of the local file to delete.
 */
const deleteLocalFile = async fileUri => {
  try {
    // The CameraRoll.deletePhotos method is the correct way to delete media
    // from the device's gallery, as it handles both the file deletion and
    // updating the Android MediaStore or iOS Photos library.
    await CameraRoll.deletePhotos([fileUri]);
    console.log(`[UploadManager] Successfully deleted local file: ${fileUri}`);
  } catch (error) {
    console.error(
      `[UploadManager] Failed to delete local file ${fileUri}:`,
      error,
    );
    // We log the error but don't re-throw. The upload was successful,
    // so failing to delete the local file shouldn't be treated as a critical failure.
  }
};

const processFile = async (itemNode, originalIndex) => {
  try {
    const fileUri = itemNode.image.uri;
    const filename = itemNode.image.filename || `media_${Date.now()}`;
    const mimeType = itemNode.type;
    const fileStat = await RNFS.stat(fileUri);
    const totalSize = fileStat.size;

    const CLOUDFLARE_LIMIT = 95 * 1024 * 1024; // 95MB to be safe

    if (totalSize < CLOUDFLARE_LIMIT) {
      // --- Strategy 1: Small file, upload in a single request ---
      await uploadSingleFile(
        fileUri,
        filename,
        mimeType,
        totalFilesInSession,
        completedFilesInSession,
      );
    } else {
      // --- Strategy 2: Large file, upload in chunks ---
      await uploadFileInChunks(
        fileUri,
        filename,
        mimeType,
        totalSize,
        totalFilesInSession,
        completedFilesInSession,
      );
    }
  } catch (error) {
    const fallbackFileName =
      itemNode.image.filename || `media_${Date.now()}_${originalIndex}`;
    console.error(
      `[UploadManager] Critial failure for ${fallbackFileName}:`,
      error,
    );
    failedUploads.push(fallbackFileName);
  }
};

const uploadSingleFile = async (
  fileUri,
  filename,
  mimeType,
  totalFiles,
  completedFiles,
) => {
  try {
    console.log(`[UploadManager] Uploading small file: ${filename}`);
    const token = await getAuthToken();
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'multipart/form-data',
    };

    const SINGLE_FILE_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

    const resp = await RNFB.config({ timeout: SINGLE_FILE_TIMEOUT_MS })
      .fetch('POST', 'https://vesafilip.eu/api/media/upload', headers, [
        {
          name: 'mediaFiles',
          filename: filename,
          type: mimeType,
          data: RNFB.wrap(fileUri),
        },
      ])
      .uploadProgress((written, total) => {
        const progress = (written / total) * 100;
        updateUploadProgress(
          filename,
          progress,
          null,
          totalFiles,
          completedFiles,
        );
      });

    if (resp.info().status >= 200 && resp.info().status < 300) {
      const result = resp.json();
      if (result.status === 'uploaded') {
        successfulUploads.push(filename);
        await deleteLocalFile(fileUri); // Delete after successful upload
      } else if (result.status === 'duplicate') {
        duplicateUploads.push(filename);
        await deleteLocalFile(fileUri); // Also delete if it's a duplicate
      } else failedUploads.push(filename);
    } else {
      throw new Error(`Server returned status ${resp.info().status}`);
    }
  } catch (error) {
    // Add more context to the error before re-throwing
    throw new Error(
      `Failed during single file upload for "${filename}": ${error.message}`,
    );
  }
};

const uploadFileInChunks = async (
  fileUri,
  filename,
  mimeType,
  totalSize,
  totalFiles,
  completedFiles,
) => {
  try {
    const CHUNK_TIMEOUT_MS = 30 * 1000; // 30 seconds per chunk
    const MAX_CHUNK_RETRIES = 3;

    console.log(`[UploadManager] Uploading large file in chunks: ${filename}`);
    const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
    const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);
    const uploadId = uuid.v4();

    for (let i = 0; i < totalChunks; i++) {
      const offset = i * CHUNK_SIZE;
      const chunkData = await RNFS.read(
        fileUri.replace('file://', ''),
        CHUNK_SIZE,
        offset,
        'base64',
      );

      const token = await getAuthToken();
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };

      let attempt = 0;
      let chunkSuccess = false;
      while (attempt < MAX_CHUNK_RETRIES && !chunkSuccess) {
        try {
          const chunkResponse = await RNFB.config({
            timeout: CHUNK_TIMEOUT_MS,
          }).fetch(
            'POST',
            'https://vesafilip.eu/api/media/upload-chunk',
            headers,
            JSON.stringify({
              uploadId,
              chunkIndex: i,
              fileChunk: chunkData,
            }),
          );

          const info = chunkResponse.info();
          if (info.status < 200 || info.status >= 300) {
            throw new Error(`Chunk ${i} failed with status ${info.status}`);
          }
          chunkSuccess = true; // Mark as successful to exit retry loop
        } catch (error) {
          attempt++;
          console.warn(
            `[UploadManager] Chunk ${i} failed on attempt ${attempt}/${MAX_CHUNK_RETRIES}. Retrying...`,
            error.message,
          );
          if (attempt >= MAX_CHUNK_RETRIES) {
            throw error; // All retries failed, so fail the entire file upload.
          }
        }
      }

      const progress = ((i + 1) / totalChunks) * 100;
      await updateUploadProgress(
        filename,
        progress,
        null,
        totalFiles,
        completedFiles,
      );
    }

    // --- Finalize Upload ---
    const FINALIZE_TIMEOUT_MS = 2 * 60 * 1000; // 2 minute timeout for finalization
    console.log(`[UploadManager] All chunks sent. Finalizing ${filename}...`);
    const token = await getAuthToken();
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    const completeResponse = await RNFB.config({
      timeout: FINALIZE_TIMEOUT_MS,
    }).fetch(
      'POST',
      'https://vesafilip.eu/api/media/upload-complete',
      headers,
      JSON.stringify({ uploadId, filename, mimeType }),
    );

    const completeInfo = completeResponse.info();
    if (completeInfo.status < 200 || completeInfo.status >= 300) {
      throw new Error(`Assembly failed with status ${completeInfo.status}`);
    }

    const result = await completeResponse.json();
    if (result.status === 'uploaded') {
      successfulUploads.push(filename);
      await deleteLocalFile(fileUri); // Delete after successful upload
    } else if (result.status === 'duplicate') {
      duplicateUploads.push(filename);
      await deleteLocalFile(fileUri); // Also delete if it's a duplicate
    } else failedUploads.push(filename);
  } catch (error) {
    // Add more context to the error before re-throwing
    throw new Error(
      `Failed during chunked upload for "${filename}": ${error.message}`,
    );
  }
};

const processQueue = async () => {
  if (isProcessing || uploadQueue.length === 0) {
    if (!isProcessing && completedFilesInSession > 0) {
      await showSummaryNotification(
        successfulUploads,
        duplicateUploads,
        failedUploads,
      );
      // Reset for next session
      totalFilesInSession = completedFilesInSession = 0;
      successfulUploads = [];
      duplicateUploads = [];
      failedUploads = [];
    }
    return;
  }

  isProcessing = true;
  const { itemNode, originalIndex } = uploadQueue.shift();

  try {
    await processFile(itemNode, originalIndex);
  } catch (e) {
    // The error is already logged inside processFile,
    // but we catch it here to ensure the queue continues.
    console.error(
      `[UploadManager] Unrecoverable error for ${itemNode.image.filename}, moving to next file.`,
      e,
    );
  } finally {
    completedFilesInSession++;
    isProcessing = false;
    processQueue(); // Always process the next file
  }
};

export const addFilesToUploadQueue = async files => {
  if (files.length === 0) return;

  if (uploadQueue.length === 0 && !isProcessing) {
    totalFilesInSession = files.length;
    completedFilesInSession = 0;
    successfulUploads = [];
    duplicateUploads = [];
    failedUploads = [];
    await showUploadNotification(totalFilesInSession);
  } else {
    totalFilesInSession += files.length;
    await showUploadNotification(totalFilesInSession);
  }

  // The 'file' objects from GalleryScreen are already the 'node' objects we need.
  // We just need to wrap them for the queue with their original index.
  const itemsToQueue = files.map((node, index) => ({
    itemNode: node,
    originalIndex: completedFilesInSession + uploadQueue.length + index,
  }));

  uploadQueue.push(...itemsToQueue);

  if (!isProcessing) {
    processQueue();
  }
};
