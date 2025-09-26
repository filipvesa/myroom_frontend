import messaging from '@react-native-firebase/messaging';
import { Platform } from 'react-native';
import notifee, { AndroidImportance } from '@notifee/react-native';

/**
 * Requests permission from the user to send push notifications.
 */
async function requestUserPermission() {
  const authStatus = await messaging().requestPermission();
  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;

  // For local notifications via Notifee on Android 13+
  if (Platform.OS === 'android') {
    // This will prompt the user for permission on API 33+
    await notifee.requestPermission();
  }

  if (enabled) {
    console.log('Notification Authorization status:', authStatus);
    await getFcmToken();
  }
}

/**
 * Retrieves the FCM token for the device.
 */
async function getFcmToken() {
  try {
    const token = await messaging().getToken();
    if (token) {
      console.log('FCM Token:', token);
    } else {
      console.log('Failed to get FCM token.');
    }
  } catch (error) {
    console.error('Error getting FCM token:', error);
  }
}

/**
 * Sets up listeners for incoming notifications.
 */
function setupNotificationListeners() {
  // When a notification is received while the app is in the foreground
  messaging().onMessage(async remoteMessage => {
    console.log('FCM message received in foreground:', remoteMessage);

    // Create a channel (required for Android)
    const channelId = await notifee.createChannel({
      id: 'default',
      name: 'Default Channel',
      importance: AndroidImportance.HIGH,
    });

    // Display the notification using Notifee
    await notifee.displayNotification({
      title: remoteMessage.notification.title,
      body: remoteMessage.notification.body,
      android: {
        channelId,
      },
    });
  });

  // Listener for when a user taps on a notification and the app is in the background or closed
  messaging().onNotificationOpenedApp(remoteMessage => {
    console.log(
      'Notification caused app to open from background state:',
      remoteMessage.notification,
    );
  });

  // Check if the app was opened from a quit state by a notification
  messaging()
    .getInitialNotification()
    .then(remoteMessage => {
      if (remoteMessage) {
        console.log(
          'Notification caused app to open from quit state:',
          remoteMessage.notification,
        );
      }
    });
}

export async function initializeNotifications() {
  await requestUserPermission();
  setupNotificationListeners();
}
