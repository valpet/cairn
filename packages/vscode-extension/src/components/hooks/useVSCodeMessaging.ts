import { useEffect } from 'react';

// VS Code API declaration
declare const acquireVsCodeApi: () => {
  postMessage: (message: any) => void;
  setState: (state: any) => void;
  getState: () => any;
};

/**
 * Module-level singleton to ensure VS Code API is acquired only once.
 * 
 * IMPORTANT: This relies on VS Code's webview isolation guarantee - each webview panel
 * runs in its own isolated JavaScript context (separate iframe). This means:
 * 
 * 1. Each webview gets its own module instance and separate `vscodeApi` variable
 * 2. Multiple webviews cannot interfere with each other's API instances
 * 3. The singleton pattern is safe because it's scoped to a single webview context
 * 
 * VS Code documentation guarantees that `acquireVsCodeApi()` must only be called once
 * per webview context, and subsequent calls will fail. This module-level variable
 * enforces that requirement.
 * 
 * Reference: https://code.visualstudio.com/api/extension-guides/webview#passing-messages-from-a-webview-to-an-extension
 */
let vscodeApi: ReturnType<typeof acquireVsCodeApi> | null = null;

export const useVSCodeMessaging = () => {
  // Acquire VS Code API only once per module
  if (!vscodeApi) {
    // Safety check: Ensure we're in a VS Code webview context
    if (typeof acquireVsCodeApi !== 'function') {
      throw new Error(
        'useVSCodeMessaging must be used within a VS Code webview context. ' +
        'The acquireVsCodeApi function is not available.'
      );
    }
    
    try {
      vscodeApi = (window as any).acquireVsCodeApi();
    } catch (error) {
      throw new Error(
        'Failed to acquire VS Code API. This can happen if acquireVsCodeApi() ' +
        'was already called elsewhere in this webview context. ' +
        `Original error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  useEffect(() => {
    // Notify extension that webview is ready
    vscodeApi?.postMessage({ type: 'webviewReady' });
  }, []);

  const postMessage = (message: any) => {
    vscodeApi?.postMessage(message);
  };

  return { postMessage };
};