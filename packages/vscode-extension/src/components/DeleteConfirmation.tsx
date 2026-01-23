import React from 'react';

interface DeleteConfirmationProps {
  isVisible: boolean;
  title: string;
  subtaskCount: number;
  onCancel: () => void;
  onConfirm: () => void;
}

const DeleteConfirmation: React.FC<DeleteConfirmationProps> = ({
  isVisible,
  title,
  subtaskCount,
  onCancel,
  onConfirm
}) => {
  if (!isVisible) return null;

  return (
    <div className="delete-confirm-popup visible">
      <div className="delete-confirm-text">
        Delete <strong>{title}</strong>?<br /><br />
        This will unparent {subtaskCount} subtask{subtaskCount === 1 ? '' : 's'}.
      </div>
      <div className="delete-confirm-buttons">
        <button
          className="delete-confirm-btn cancel"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          className="delete-confirm-btn delete"
          onClick={onConfirm}
        >
          Delete
        </button>
      </div>
    </div>
  );
};

export default DeleteConfirmation;