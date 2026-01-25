import { useState, useEffect } from 'react';

export const useTaskInteractions = (postMessage: (message: any) => void) => {
  const [activeActionDropdown, setActiveActionDropdown] = useState<string | null>(null);
  const [deleteConfirmPopup, setDeleteConfirmPopup] = useState<string | null>(null);

  // Close action dropdown and delete popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Check if click is outside action dropdown
      if (activeActionDropdown) {
        const dropdown = target.closest('.action-dropdown');
        const kebabBtn = target.closest('.kebab-menu-btn');
        if (!dropdown && !kebabBtn) {
          setActiveActionDropdown(null);
        }
      }

      // Check if click is outside delete confirmation popup
      if (deleteConfirmPopup) {
        const popup = target.closest('.delete-confirm-popup');
        if (!popup) {
          setDeleteConfirmPopup(null);
        }
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [activeActionDropdown, deleteConfirmPopup]);

  // Close dropdowns on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (deleteConfirmPopup) {
          setDeleteConfirmPopup(null);
        } else if (activeActionDropdown) {
          setActiveActionDropdown(null);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeActionDropdown, deleteConfirmPopup]);

  const startTask = (id: string) => {
    console.log('Starting task', id);
    postMessage({ type: 'startTask', id });
  };

  const completeTask = (id: string) => {
    console.log('Completing task', id);
    postMessage({ type: 'completeTask', id });
  };

  const editTask = (id: string) => {
    console.log('Editing task', id);
    try {
      const message = { type: 'editTicket', id };
      console.log('Attempting to post message:', message);
      postMessage(message);
      console.log('Message posted successfully');
    } catch (error) {
      console.error('Error posting message:', error);
    }
  };

  const createNewTask = () => {
    console.log('Creating new task');
    try {
      const message = { type: 'createTicket' };
      console.log('Attempting to post message:', message);
      postMessage(message);
      console.log('Message posted successfully');
    } catch (error) {
      console.error('Error posting message:', error);
    }
  };

  const deleteTask = (id: string) => {
    console.log('Deleting task', id);
    postMessage({ type: 'deleteTask', id });
    setDeleteConfirmPopup(null);
  };

  const toggleActionDropdown = (taskId: string) => {
    if (activeActionDropdown === taskId) {
      setActiveActionDropdown(null);
    } else {
      setActiveActionDropdown(taskId);
    }
  };

  const showDeleteConfirmation = (taskId: string) => {
    setDeleteConfirmPopup(taskId);
    setActiveActionDropdown(null);
  };

  return {
    activeActionDropdown,
    deleteConfirmPopup,
    startTask,
    completeTask,
    editTask,
    createNewTask,
    deleteTask,
    toggleActionDropdown,
    showDeleteConfirmation,
  };
};