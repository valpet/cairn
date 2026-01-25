import { useEffect, useRef } from 'react';

// VS Code API declaration
declare const acquireVsCodeApi: () => any;

export const useVSCodeMessaging = () => {
  const vscode = useRef<any>(null);

  // Acquire VS Code API immediately
  if (!vscode.current) {
    vscode.current = (window as any).acquireVsCodeApi();
  }

  useEffect(() => {
    // Notify extension that webview is ready
    vscode.current.postMessage({ type: 'webviewReady' });
  }, []);

  const postMessage = (message: any) => {
    vscode.current?.postMessage(message);
  };

  return { postMessage };
};