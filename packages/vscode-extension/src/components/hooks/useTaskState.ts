import { useState, useEffect } from 'react';
import { Task } from '../types';
import { useVSCodeMessaging } from './useVSCodeMessaging';

export const useTaskState = () => {
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [viewingFile, setViewingFile] = useState<string>('default'); // What this panel is viewing
  const [systemActiveFile, setSystemActiveFile] = useState<string>('default'); // System-wide active file
  const [availableFiles, setAvailableFiles] = useState<string[]>(['default']);
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set(['ready', 'open', 'in_progress']));
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());
  const [showRecentlyClosed, setShowRecentlyClosed] = useState<boolean>(false);
  const [recentlyClosedDuration, setRecentlyClosedDuration] = useState<string>('60');
  const [timeFilter, setTimeFilter] = useState<string>('all');

  const { postMessage } = useVSCodeMessaging();

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
      } else if (message.type === 'filterState') {
        // Load saved filter state
        if (message.selectedStatuses) {
          setSelectedStatuses(new Set(message.selectedStatuses));
        }
        if (message.showRecentlyClosed !== undefined) {
          setShowRecentlyClosed(message.showRecentlyClosed);
        }
        if (message.recentlyClosedDuration) {
          setRecentlyClosedDuration(message.recentlyClosedDuration);
        }
        if (message.timeFilter) {
          setTimeFilter(message.timeFilter);
        }
      }
    };

    window.addEventListener('message', messageHandler);

    return () => {
      window.removeEventListener('message', messageHandler);
    };
  }, []);

  // Save filter state whenever it changes
  useEffect(() => {
    postMessage({
      type: 'filterStateChanged',
      selectedStatuses: Array.from(selectedStatuses),
      showRecentlyClosed,
      recentlyClosedDuration,
      timeFilter
    });
  }, [selectedStatuses, showRecentlyClosed, recentlyClosedDuration, timeFilter]);

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
    showRecentlyClosed,
    setShowRecentlyClosed,
    recentlyClosedDuration,
    setRecentlyClosedDuration,
    timeFilter,
    setTimeFilter,
  };
};