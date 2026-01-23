import React from 'react';

interface TaskItem {
  id: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  completion_percentage: number;
}

interface TaskListProps {
  items: TaskItem[];
  onEdit: (id: string) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
  addButtonText: string;
  emptyMessage: string;
  copyToClipboard: (text: string) => void;
  getStatusLabel: (status: string) => string;
  getPriorityLabel: (priority: string) => string;
  getTypeLabel: (type: string) => string;
}

const TaskList: React.FC<TaskListProps> = ({
  items,
  onEdit,
  onRemove,
  onAdd,
  addButtonText,
  emptyMessage,
  copyToClipboard,
  getStatusLabel,
  getPriorityLabel,
  getTypeLabel,
}) => {
  return (
    <>
      <div className="subtask-list">
        {items.length === 0 ? (
          <div className="subtasks-empty">
            {emptyMessage}
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="subtask">
              <div className="subtask-info">
                <span className={`type-badge ${item.type}`}>{item.type}</span>
                <div className="task-id-container">
                  <div className="task-id">
                    {item.id}
                    <button
                      className="copy-id-btn"
                      title="Copy ID to clipboard"
                      onClick={() => copyToClipboard(item.id)}
                    >
                      <svg fill="#000000" viewBox="0 0 36 36">
                        <path d="M22.6,4H21.55a3.89,3.89,0,0,0-7.31,0H13.4A2.41,2.41,0,0,0,11,6.4V10H25V6.4A2.41,2.41,0,0,0,22.6,4ZM23,8H13V6.25A.25.25,0,0,1,13.25,6h2.69l.12-1.11A1.24,1.24,0,0,1,16.61,4a2,2,0,0,1,3.15,1.18l.09.84h2.9a.25.25,0,0,1,.25.25Z" />
                        <path d="M33.25,18.06H21.33l2.84-2.83a1,1,0,1,0-1.42-1.42L17.5,19.06l5.25,5.25a1,1,0,0,0,.71.29,1,1,0,0,0,.71-1.7l-2.84-2.84H33.25a1,1,0,0,0,0-2Z" />
                        <path d="M29,16h2V6.68A1.66,1.66,0,0,0,29.35,5H27.08V7H29Z" />
                        <path d="M29,31H7V7H9V5H6.64A1.66,1.66,0,0,0,5,6.67V31.32A1.66,1.66,0,0,0,6.65,33H29.36A1.66,1.66,0,0,0,31,31.33V22.06H29Z" />
                      </svg>
                    </button>
                  </div>
                  <span
                    className="subtask-title"
                    style={{ cursor: 'pointer' }}
                    onClick={() => onEdit(item.id)}
                  >
                    {item.title}
                  </span>
                </div>
              </div>
              <span className="completion-percentage">{item.completion_percentage}%</span>
              <span className={`subtask-status ${item.status}`}>{getStatusLabel(item.status)}</span>
              <span className={`subtask-priority ${item.priority}`}>{getPriorityLabel(item.priority)}</span>
              <button
                type="button"
                className="icon-button remove"
                title="Remove"
                onClick={() => onRemove(item.id)}
              >
                <svg viewBox="0 0 1024 1024" fill="currentColor">
                  <path d="M195.2 195.2a64 64 0 0 1 90.496 0L512 421.504 738.304 195.2a64 64 0 0 1 90.496 90.496L602.496 512 828.8 738.304a64 64 0 0 1-90.496 90.496L512 602.496 285.696 828.8a64 64 0 0 1-90.496-90.496L421.504 512 195.2 285.696a64 64 0 0 1 0-90.496z" />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>
      <button
        type="button"
        className="secondary"
        onClick={onAdd}
      >
        {addButtonText}
      </button>
    </>
  );
};

export default TaskList;