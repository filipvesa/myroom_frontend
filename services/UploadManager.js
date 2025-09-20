import { Alert } from 'react-native';
import notifee, { AndroidImportance } from '@notifee/react-native';
import auth from '@react-native-firebase/auth';
import RNFS from 'react-native-fs';
import uuid from 'react-native-uuid';

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
      progress: {
        max: 100,
        current: 0, // Start with an empty bar, consistent with per-file progress
      },
      ongoing: true,
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
  const body = `File ${completedFiles + 1} of ${totalFiles} (${formatEta(
    etaSeconds,
  )})`;

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

async function showProcessingNotification() {
  // A temporary notification for when a file is done and the next is starting
  await updateUploadProgress(
    'Processing...',
    100,
    -1,
    totalFilesInSession,
    completedFilesInSession,
  );
}

async function showSummaryNotification() {
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
  // In a real app, you would retrieve this from secure storage after a login process.
  const currentUser = auth().currentUser;
  if (currentUser) {
    return await currentUser.getIdToken();
  }
  return null;
};

const processQueue = async () => {
  if (isProcessing || uploadQueue.length === 0) {
    // If processing is done and the queue is empty, the session is complete.
    if (!isProcessing && completedFilesInSession > 0) {
      await showSummaryNotification();
      // Reset session counters
      totalFilesInSession = 0;
      completedFilesInSession = 0;
      successfulUploads = [];
      duplicateUploads = [];
      failedUploads = [];
    }
    return;
  }

  isProcessing = true;
  const { itemNode, originalIndex } = uploadQueue.shift(); // Get the first file from the queue

  let tempFilePath = null;

  try {
    // --- 1. Prepare the file and its URI ---
    const formData = new FormData();
    let fileUri = itemNode.image.uri;

    // For videos on Android, copy to a temporary file to get a stable file path
    if (itemNode.type.startsWith('video/')) {
      const destPath = `${RNFS.CachesDirectoryPath}/temp_upload_${Date.now()}`;
      await RNFS.copyFile(fileUri, destPath);
      tempFilePath = destPath;
      fileUri = `file://${destPath}`;
    }

    const filename =
      itemNode.image.filename || `media_${Date.now()}_${originalIndex}`;
    const mimeType = itemNode.type;
    const fileStat = await RNFS.stat(fileUri.replace('file://', ''));
    const totalSize = fileStat.size;

    // --- 2. Chunk and Upload the file ---
    let completedChunks = 0;
    const uploadStartTime = Date.now();
    let lastUpdateTime = 0;
    const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks - a safer size to prevent memory issues.
    const CONCURRENT_UPLOAD_LIMIT = 3; // 2 * 5MB = 10MB, well under memory and network limits.
    const uploadId = uuid.v4();
    const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);

    console.log(
      `[UploadManager] Starting chunked upload for ${filename} (ID: ${uploadId}). Size: ${totalSize} bytes, Chunks: ${totalChunks}, Concurrency: ${CONCURRENT_UPLOAD_LIMIT}`,
    );

    // Create a pool of workers for concurrent uploads
    const chunkQueue = Array.from({ length: totalChunks }, (_, i) => i);

    const worker = async () => {
      while (chunkQueue.length > 0) {
        const chunkIndex = chunkQueue.shift();
        if (chunkIndex === undefined) continue;

        try {
          const offset = chunkIndex * CHUNK_SIZE;
          const chunkData = await RNFS.read(
            fileUri.replace('file://', ''),
            CHUNK_SIZE,
            offset,
            'base64',
          );

          const token = await getAuthToken();
          const headers = { 'Content-Type': 'application/json' };
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }

          const chunkResponse = await fetch(
            'https://vesafilip.eu/api/media/upload-chunk',
            {
              method: 'POST',
              headers: headers,
              body: JSON.stringify({
                uploadId: uploadId,
                chunkIndex: chunkIndex,
                fileChunk: chunkData,
              }),
            },
          );

          if (!chunkResponse.ok) {
            throw new Error(
              `Chunk ${chunkIndex} upload failed with status ${chunkResponse.status}`,
            );
          }

          // --- Progress Update Logic ---
          completedChunks++;
          const now = Date.now();
          // Throttle updates to prevent flickering (e.g., once per 500ms)
          if (now - lastUpdateTime > 500) {
            lastUpdateTime = now;
            const progress = Math.floor((completedChunks / totalChunks) * 100);
            const elapsedTime = (now - uploadStartTime) / 1000; // in seconds
            const bytesUploaded = Math.min(
              completedChunks * CHUNK_SIZE,
              totalSize,
            );
            const uploadSpeed =
              elapsedTime > 0 ? bytesUploaded / elapsedTime : 0; // bytes/sec
            const remainingBytes = totalSize - bytesUploaded;
            const etaSeconds =
              uploadSpeed > 0 ? remainingBytes / uploadSpeed : -1;

            await updateUploadProgress(
              filename,
              progress,
              etaSeconds,
              totalFilesInSession,
              completedFilesInSession,
            );
          }
        } catch (error) {
          // Re-add the failed chunk to the queue to be retried by another worker
          chunkQueue.push(chunkIndex);
          throw error; // Propagate error to stop the upload process
        }
      }
    };

    const workers = Array(CONCURRENT_UPLOAD_LIMIT).fill(null).map(worker);

    // Wait for all chunks to be uploaded.
    await Promise.all(workers);

    // --- 3. Finalize the upload ---
    const token = await getAuthToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const completeResponse = await fetch(
      'https://vesafilip.eu/api/media/upload-complete',
      {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          uploadId: uploadId,
          filename: filename,
          mimeType: mimeType,
        }),
      },
    );

    if (!completeResponse.ok) {
      throw new Error('File assembly failed on server.');
    }

    const result = await completeResponse.json();
    if (result.status === 'uploaded') {
      successfulUploads.push(filename);
    } else if (result.status === 'duplicate') {
      duplicateUploads.push(filename);
    } else {
      failedUploads.push(filename);
    }
  } catch (error) {
    // Use itemNode here to avoid a ReferenceError if the 'file' object was never created.
    const fallbackFileName =
      itemNode.image.filename || `media_${Date.now()}_${originalIndex}`;
    console.error(
      '[UploadManager] Error processing file:',
      fallbackFileName,
      error,
    );
    failedUploads.push(fallbackFileName);
  } finally {
    completedFilesInSession++;
    // Clean up the temporary file if one was created
    if (tempFilePath) {
      await RNFS.unlink(tempFilePath).catch(e => console.log(e));
    }
    await showProcessingNotification();
    isProcessing = false;
    // Process the next item in the queue
    processQueue();
  }
};

export const addFilesToUploadQueue = async files => {
  if (files.length === 0) return;

  // Map files to include an original index for unique fallback names
  const filesWithIndex = files.map((file, index) => ({
    itemNode: file,
    originalIndex: completedFilesInSession + uploadQueue.length + index,
  }));

  // If this is the start of a new batch, reset counters and show notification
  if (uploadQueue.length === 0) {
    totalFilesInSession = filesWithIndex.length;
    completedFilesInSession = 0;
    successfulUploads = [];
    duplicateUploads = [];
    failedUploads = [];
    await showUploadNotification(totalFilesInSession);
  } else {
    totalFilesInSession += filesWithIndex.length;
    await showUploadNotification(totalFilesInSession); // Re-display to update total
  }

  uploadQueue.push(...filesWithIndex);
  processQueue();
};
