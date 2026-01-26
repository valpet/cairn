import { useState, useEffect } from 'react';
import { Task } from '../types';

export const useTaskState = () => {
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [viewingFile, setViewingFile] = useState<string>('default'); // What this panel is viewing
  const [systemActiveFile, setSystemActiveFile] = useState<string>('default'); // System-wide active file
  const [availableFiles, setAvailableFiles] = useState<string[]>(['default']);
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set(['ready', 'open', 'in_progress']));
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());

  // Listen for messages from extension
  useEffect(() => {
    const messageHandler = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'updateTasks') {
        setAllTasks(message.tasks || []);
        if (message.currentFile) {
          setViewingFile(message.currentFile);
          setSystemActiveFile(message.currentFile);
        } else {
          console.warn('No currentFile in message');
        }
        if (message.availableFiles) {
          setAvailableFiles(message.availableFiles);
        } else {
          console.warn('No availableFiles in message');
        }
      } else if (message.type === 'updateViewTasks') {
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