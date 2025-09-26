import { getAuthToken } from '../utils/authUtils';

const LOG_SERVER_URL = 'https://vesafilip.eu/api/logs/client';
const BATCH_SIZE = 50; // Send logs in batches of 50
const BATCH_INTERVAL = 10 * 1000; // Send logs every 10 seconds

let logQueue = [];
let intervalId = null;

/**
 * Sends a batch of logs to the remote server.
 */
async function sendLogBatch() {
  if (logQueue.length === 0) {
    return;
  }

  const batch = [...logQueue];
  logQueue = []; // Clear the queue immediately

  try {
    const token = await getAuthToken();

    const headers = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    await fetch(LOG_SERVER_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ logs: batch }),
    });
  } catch (error) {
    // If sending fails, prepend the batch back to the queue to retry later.
    // This prevents log loss on temporary network issues.
    logQueue = [...batch, ...logQueue];
    console.error('RemoteLog: Failed to send log batch', error);
  }
}

/**
 * Overrides the global console methods to capture logs.
 */
export function initializeRemoteLogging() {
  const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info,
  };

  const logToQueue = (level, messages) => {
    // Also call the original console method so logs still appear in the debug console.
    originalConsole[level](...messages);

    logQueue.push({
      level,
      timestamp: new Date().toISOString(),
      // Improved serialization to handle Error objects correctly
      messages: messages.map(m => {
        if (m instanceof Error) {
          return `Error: ${m.name} - ${m.message}\nStack: ${m.stack}`;
        }
        return typeof m === 'object' ? JSON.stringify(m, null, 2) : String(m);
      }),
    });

    if (logQueue.length >= BATCH_SIZE) {
      sendLogBatch();
    }
  };

  console.log = (...args) => logToQueue('log', args);
  console.warn = (...args) => logToQueue('warn', args);
  console.error = (...args) => logToQueue('error', args);
  console.info = (...args) => logToQueue('info', args);

  // Start the interval to periodically send logs
  if (!intervalId) {
    intervalId = setInterval(sendLogBatch, BATCH_INTERVAL);
  }

  console.log('Remote logging initialized.');
}
