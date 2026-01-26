import React from 'react';
import { createRoot } from 'react-dom/client';
import TaskEdit from './TaskEdit';

declare const acquireVsCodeApi: () => any;

const App: React.FC = () => {
  const vscode = acquireVsCodeApi();
  return <TaskEdit vscode={vscode} />;
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}