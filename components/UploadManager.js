import BackgroundUpload from 'react-native-background-upload';

/**
 * Starts a background upload for a list of selected files.
 * This will create a separate upload task for each file.
 *
 * @param {Array} files - An array of file nodes from CameraRoll.
 */
const startBackgroundUpload = files => {
  console.log(`Queueing ${files.length} file(s) for background upload.`);

  files.forEach(itemNode => {
    const fileUri = itemNode.image.uri;

    const options = {
      url: 'https://vesafilip.eu/api/media/upload',
      path: fileUri,
      method: 'POST',
      type: 'multipart',
      field: 'mediaFiles', // The field name your server expects for the file
      notification: {
        enabled: true,
        title: 'MyRoom Upload',
        message: 'Your media is being uploaded to the cloud.',
        autoclear: true, // Automatically clear notification on success
      },
    };

    BackgroundUpload.startUpload(options)
      .then(uploadId => {
        // You can listen to events for more granular control
        BackgroundUpload.addListener('progress', uploadId, data => {
          console.log(`Upload ${uploadId} Progress: ${data.progress}%`);
        });
        BackgroundUpload.addListener('completed', uploadId, () => {
          console.log(`Upload ${uploadId} completed successfully.`);
        });
        BackgroundUpload.addListener('error', uploadId, data => {
          console.error(`Error in upload ${uploadId}:`, data.error);
        });
      })
      .catch(err => {
        console.error('Failed to start upload!', err);
      });
  });
};

export { startBackgroundUpload };
