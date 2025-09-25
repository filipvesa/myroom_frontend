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
let successfulUploads = []; // Will store { filename, fileUri }
let duplicateUploads = []; // Will store { filename, fileUri }
let failedUploads = []; // Will store filename

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

async function updateUploadProgress(
  currentFilename,
  progress,
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

const getAuthToken = async () => {
  try {
    const authInstance = getAuth();
    return await authInstance.currentUser?.getIdToken();
  } catch (error) {
    console.error('Failed to get auth token', error);
    return null;
  }
};

const processFile = async (itemNode, originalIndex) => {
  try {
    const fileUri = itemNode.image.uri;
    const filename = itemNode.image.filename || `media_${Date.now()}`;
    const mimeType = itemNode.type;
    let fileStat;
    try {
      fileStat = await RNFS.stat(fileUri);
    } catch (statError) {
      // This is a critical failure, as we can't read the file.
      // Re-throw a more informative error.
      throw new Error(
        `Could not get file stats for URI: ${fileUri}. Original error: ${statError.message}`,
      );
    }
    const totalSize = fileStat.size;

    const CLOUDFLARE_LIMIT = 95 * 1024 * 1024; // 95MB to be safe

    // Force all videos to use the chunked upload strategy for better reliability
    // and to avoid server timeouts, regardless of their size.
    let isVideo = mimeType.startsWith('video/');
    // Fallback check: if mimeType is generic, check the file extension.
    if (!isVideo) {
      const extension = (filename.split('.').pop() || '').toLowerCase();
      isVideo = ['mp4', 'mov', 'avi', 'mkv'].includes(extension);
    }
    if (totalSize < CLOUDFLARE_LIMIT && !isVideo) {
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
      `[UploadManager] Critical failure for ${fallbackFileName}:`,
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
        updateUploadProgress(filename, progress, totalFiles, completedFiles);
      });

    if (resp.info().status >= 200 && resp.info().status < 300) {
      // Explicitly update progress to 100% for this file to ensure it doesn't get "stuck".
      await updateUploadProgress(filename, 100, totalFiles, completedFiles);
      const result = resp.json();
      if (result.status === 'processing') {
        successfulUploads.push({ filename, fileUri });
      } else if (result.status === 'processing') {
        // This logic seems to handle duplicates based on your comment.
        duplicateUploads.push({ filename, fileUri });
      } else failedUploads.push(filename); // Keep track of failures
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

    // Explicitly update progress to 100% for the chunked file upon successful finalization.
    await updateUploadProgress(filename, 100, totalFiles, completedFiles);
    const result = await completeResponse.json();
    if (result.status === 'processing') {
      successfulUploads.push({ filename, fileUri });
    } else if (result.status === 'processing') {
      // This logic seems to handle duplicates based on your comment.
      duplicateUploads.push({ filename, fileUri });
    } else failedUploads.push(filename); // Keep track of failures
  } catch (error) {
    // Add more context to the error before re-throwing
    throw new Error(
      `Failed during chunked upload for "${filename}": ${error.message}`,
    );
  }
};

const processQueue = async () => {
  if (isProcessing) {
    return;
  }

  // If the queue is empty, it's time to finalize the session.
  if (uploadQueue.length === 0) {
    // Use a timeout to delay the final actions. This allows the user to see
    // the "100%" completion status on the notification for a few seconds.
    setTimeout(async () => {
      if (completedFilesInSession > 0) {
        // 1. Stop the foreground service.
        await notifee.stopForegroundService();

        // 2. Now, ask the user if they want to delete the local files.
        const filesToDelete = [...successfulUploads, ...duplicateUploads];
        if (filesToDelete.length > 0) {
          Alert.alert(
            'Delete Uploaded Files?',
            `Successfully processed ${filesToDelete.length} file(s). Would you like to delete them from your device to save space?`,
            [
              {
                text: 'Keep Files',
                style: 'cancel',
                onPress: () =>
                  console.log(
                    '[UploadManager] User chose to keep local files.',
                  ),
              },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                  console.log(
                    `[UploadManager] User confirmed deletion of ${filesToDelete.length} files.`,
                  );
                  const urisToDelete = filesToDelete.map(f => f.fileUri);
                  try {
                    await CameraRoll.deletePhotos(urisToDelete);
                    Alert.alert('Success', 'Local files have been deleted.');
                  } catch (error) {
                    console.error('Failed to delete one or more files:', error);
                    Alert.alert('Error', 'Could not delete local files.');
                  }
                },
              },
            ],
          );
        }

        // 3. Finally, reset the session state for the next batch.
        totalFilesInSession = 0;
        completedFilesInSession = 0; // Reset counter
        successfulUploads = [];
        duplicateUploads = [];
        failedUploads = [];
      }
    }, 2500); // 2.5-second delay before hiding the notification and showing the alert.
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
    // This block runs whether the upload succeeded or failed, ensuring the queue always progresses.
    completedFilesInSession++;
    isProcessing = false;
    // Use setTimeout to schedule the next queue processing. This allows the
    // current function stack to unwind completely, preventing race conditions
    // and ensuring the final summary call is executed correctly.
    setTimeout(processQueue, 0);
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
