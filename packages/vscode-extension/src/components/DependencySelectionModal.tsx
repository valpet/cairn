import React from 'react';
import { getStatusLabel, getPriorityLabel } from './utils';

interface AvailableItem {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  priority: string;
  wouldCreateCycle?: boolean;
}

interface DependencySelectionModalProps {
  isOpen: boolean;
  availableDependencies: AvailableItem[];
  selectedIds: Set<string>;
  search: string;
  direction: 'blocks' | 'blocked_by';
  onClose: () => void;
  onSearchChange: (value: string) => void;
  onDirectionChange: (direction: 'blocks' | 'blocked_by') => void;
  onSelectionChange: (id: string) => void;
  onConfirm: () => void;
  copyToClipboard: (text: string) => void;
}

const DependencySelectionModal: React.FC<DependencySelectionModalProps> = ({
  isOpen,
  availableDependencies,
  selectedIds,
  search,
  direction,
  onClose,
  onSearchChange,
  onDirectionChange,
  onSelectionChange,
  onConfirm,
  copyToClipboard
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal">
      <div className="modal-content">
        <div className="modal-header">
          <h2 className="modal-title">Select Dependencies</h2>
        </div>
        <div className="modal-body">
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '500' }}>
              Dependency Direction:
            </label>
            <div style={{ display: 'flex', gap: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                <input
                  type="radio"
                  name="dependencyDirection"
                  value="blocks"
                  checked={direction === 'blocks'}
                  onChange={(e) => onDirectionChange(e.target.value as 'blocks' | 'blocked_by')}
                />
                This task depends on selected tasks (Blocked by)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                <input
                  type="radio"
                  name="dependencyDirection"
                  value="blocked_by"
                  checked={direction === 'blocked_by'}
                  onChange={(e) => onDirectionChange(e.target.value as 'blocks' | 'blocked_by')}
                />
                Selected tasks depend on this task (Blocking)
              </label>
            </div>
          </div>
          <input
            type="text"
            className="search-input"
            placeholder="Search by ID, title, or description..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          <div className="dependency-list-modal">
            {availableDependencies
              .filter(dep =>
                `${dep.id} ${dep.title} ${dep.description}`
                  .toLowerCase()
                  .includes(search.toLowerCase())
              )
              .map(dep => (
                <div
                  key={dep.id}
                  className={`dependency-item ${selectedIds.has(dep.id) ? 'selected' : ''} ${dep.wouldCreateCycle ? 'disabled' : ''}`}
                  onClick={() => !dep.wouldCreateCycle && onSelectionChange(dep.id)}
                  style={{
                    opacity: dep.wouldCreateCycle ? 0.5 : 1,
                    cursor: dep.wouldCreateCycle ? 'not-allowed' : 'pointer'
                  }}
                >
                  <input
                    type="checkbox"
                    className="dependency-checkbox"
                    checked={selectedIds.has(dep.id)}
                    disabled={dep.wouldCreateCycle}
                    onChange={() => { }} // Handled by onClick
                  />
                  <div className="dependency-content">
                    <div className="dependency-info">
                      <span className={`type-badge ${dep.type}`}>{dep.type}</span>
                      <div className="task-id-container">
                        <div className="task-id">
                          {dep.id}
                          <button
                            className="copy-id-btn"
                            disabled={dep.wouldCreateCycle}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!dep.wouldCreateCycle) {
                                copyToClipboard(dep.id);
                              }
                            }}
                          >
                            <svg fill="#000000" viewBox="0 0 36 36">
                              <path d="M22.6,4H21.55a3.89,3.89,0,0,0-7.31,0H13.4A2.41,2.41,0,0,0,11,6.4V10H25V6.4A2.41,2.41,0,0,0,22.6,4ZM23,8H13V6.25A.25.25,0,0,1,13.25,6h2.69l.12-1.11A1.24,1.24,0,0,1,16.61,4a2,2,0,0,1,3.15,1.18l.09.84h2.9a.25.25,0,0,1,.25.25Z" />
                              <path d="M33.25,18.06H21.33l2.84-2.83a1,1,0,1,0-1.42-1.42L17.5,19.06l5.25,5.25a1,1,0,0,0,.71.29,1,1,0,0,0,.71-1.7l-2.84-2.84H33.25a1,1,0,0,0,0-2Z" />
                              <path d="M29,16h2V6.68A1.66,1.66,0,0,0,29.35,5H27.08V7H29Z" />
                              <path d="M29,31H7V7H9V5H6.64A1.66,1.66,0,0,0,5,6.67V31.32A1.66,1.66,0,0,0,6.65,33H29.36A1.66,1.66,0,0,0,31,31.33V22.06H29Z" />
                            </svg>
                          </button>
                        </div>
                        <span className="dependency-title">{dep.title}</span>
                        {dep.wouldCreateCycle && (
                          <span style={{ fontSize: '11px', color: '#f85149', marginLeft: '8px' }}>
                            Would create circular dependency
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`dependency-status ${dep.status}`}>{getStatusLabel(dep.status)}</span>
                    <span className={`dependency-priority ${dep.priority}`}>{getPriorityLabel(dep.priority)}</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={selectedIds.size === 0}>
            Add Selected Dependencies
          </button>
        </div>
      </div>
    </div>
  );
};

export default DependencySelectionModal;