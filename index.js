/**
 * @format
 */

import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import notifee, { EventType } from '@notifee/react-native';

notifee.onBackgroundEvent(async ({ type, detail }) => {
  const { notification, pressAction } = detail;
  console.log('Background event:', EventType[type], detail);
  // Here you could handle background actions, e.g., cancelling an upload.
});

AppRegistry.registerComponent(appName, () => App);
