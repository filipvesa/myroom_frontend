import { getAuth } from '@react-native-firebase/auth';

/**
 * Retrieves the Firebase authentication token for the current user.
 * @returns {Promise<string|null>} The user's ID token, or null if not authenticated or an error occurs.
 */
export const getAuthToken = async () => {
  try {
    const authInstance = getAuth();
    // The '?' ensures that if currentUser is null, it returns undefined instead of throwing an error.
    // The '|| null' at the end ensures we always return null for consistency if the token is not found.
    return (await authInstance.currentUser?.getIdToken()) || null;
  } catch (error) {
    console.error('Failed to get auth token', error);
    return null;
  }
};
