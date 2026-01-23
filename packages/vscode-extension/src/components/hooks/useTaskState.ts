import { useState, useEffect } from 'react';
import { Issue } from '../types';

export const useTaskState = () => {
  const [allTasks, setAllTasks] = useState<Issue[]>([]);
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
        setAllTasks(message.tasks || []);
        console.log('Tasks count:', message.tasks?.length || 0);
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
    selectedStatuses,
    setSelectedStatuses,
    expandedTasks,
    expandedDescriptions,
    toggleExpand,
    toggleDescription,
  };
};