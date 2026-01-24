import { useState, useEffect } from 'react';
import { Issue } from '../types';

export const useTaskState = () => {
  const [allTasks, setAllTasks] = useState<Issue[]>([]);
  const [viewingFile, setViewingFile] = useState<string>('default'); // What this panel is viewing
  const [systemActiveFile, setSystemActiveFile] = useState<string>('default'); // System-wide active file
  const [availableFiles, setAvailableFiles] = useState<string[]>(['default']);
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set(['ready', 'open', 'in_progress']));
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());

  // Listen for messages from extension
  useEffect(() => {
    const messageHandler = (event: MessageEvent) => {
      console.log('Message received:', event.data);
      const message = event.data;
      if (message.type === 'updateTasks') {
        console.log('Processing updateTasks');
        console.log('Current file in message:', message.currentFile);
        console.log('Available files in message:', message.availableFiles);
        setAllTasks(message.tasks || []);
        if (message.currentFile) {
          console.log('Setting viewing file to:', message.currentFile);
          setViewingFile(message.currentFile);
          setSystemActiveFile(message.currentFile);
        } else {
          console.warn('No currentFile in message');
        }
        if (message.availableFiles) {
          console.log('Setting available files to:', message.availableFiles);
          setAvailableFiles(message.availableFiles);
        } else {
          console.warn('No availableFiles in message');
        }
        console.log('Tasks count:', message.tasks?.length || 0);
      } else if (message.type === 'updateViewTasks') {
        console.log('Processing updateViewTasks (viewing file only)');
        console.log('Viewing file:', message.viewingFile);
        console.log('System active file:', message.systemActiveFile);
        setAllTasks(message.tasks || []);
        if (message.viewingFile) {
          setViewingFile(message.viewingFile);
        }
        if (message.systemActiveFile) {
          setSystemActiveFile(message.systemActiveFile);
        }
        if (message.availableFiles) {
          setAvailableFiles(message.availableFiles);
        }
      } else if (message.type === 'updateActiveFile') {
        console.log('Processing updateActiveFile (indicator only)');
        console.log('New system active file:', message.currentFile);
        if (message.currentFile) {
          setSystemActiveFile(message.currentFile);
        }
        if (message.availableFiles) {
          setAvailableFiles(message.availableFiles);
        }
      }
    };

    window.addEventListener('message', messageHandler);

    return () => {
      window.removeEventListener('message', messageHandler);
    };
  }, []);

  const toggleExpand = (taskId: string) => {
    setExpandedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const toggleDescription = (taskId: string) => {
    setExpandedDescriptions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  return {
    allTasks,
    viewingFile,
    systemActiveFile,
    availableFiles,
    selectedStatuses,
    setSelectedStatuses,
    expandedTasks,
    expandedDescriptions,
    toggleExpand,
    toggleDescription,
  };
};