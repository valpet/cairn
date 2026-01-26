import React from 'react';
import { createRoot } from 'react-dom/client';
import TaskList from './TaskList';

const App: React.FC = () => {
  return <TaskList />;
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}