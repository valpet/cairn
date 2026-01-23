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
    console.log('Cairn issues webview script loaded');
    console.log('VS Code API acquired:', !!vscode.current);

    // Notify extension that webview is ready
    vscode.current.postMessage({ type: 'webviewReady' });
    console.log('Task list webview ready message sent');
  }, []);

  const postMessage = (message: any) => {
    vscode.current?.postMessage(message);
  };

  return { postMessage };
};