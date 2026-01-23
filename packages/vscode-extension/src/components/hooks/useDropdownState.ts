import { useEffect } from 'react';

export const useDropdownState = (
  activeActionDropdown: string | null,
  deleteConfirmPopup: string | null,
  setActiveActionDropdown: (value: string | null) => void,
  setDeleteConfirmPopup: (value: string | null) => void
) => {
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
  }, [activeActionDropdown, deleteConfirmPopup, setActiveActionDropdown, setDeleteConfirmPopup]);

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
  }, [activeActionDropdown, deleteConfirmPopup, setActiveActionDropdown, setDeleteConfirmPopup]);
};