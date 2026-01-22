import React from 'react';
import { createRoot } from 'react-dom/client';
import IssueList from './IssueList';

const App: React.FC = () => {
  return <IssueList />;
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}