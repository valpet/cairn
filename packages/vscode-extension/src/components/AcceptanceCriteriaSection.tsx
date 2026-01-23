import React, { useState } from 'react';
import EditableField from './EditableField';

interface AcceptanceCriteria {
  text: string;
  completed: boolean;
}

interface AcceptanceCriteriaSectionProps {
  acceptanceCriteria: AcceptanceCriteria[];
  onAdd: (text: string) => void;
  onToggle: (index: number) => void;
  onRemove: (index: number) => void;
  onEdit: (fieldName: string, value: string) => void;
}

const AcceptanceCriteriaSection: React.FC<AcceptanceCriteriaSectionProps> = ({
  acceptanceCriteria,
  onAdd,
  onToggle,
  onRemove,
  onEdit
}) => {
  const [newCriteriaText, setNewCriteriaText] = useState('');

  const handleAdd = () => {
    if (newCriteriaText.trim()) {
      onAdd(newCriteriaText.trim());
      setNewCriteriaText('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <>
      <div className="acceptance-criteria-list">
        {acceptanceCriteria.length === 0 ? (
          <div className="acceptance-criteria-empty">
            No acceptance criteria yet. Add criteria to define what needs to be completed.
          </div>
        ) : (
          acceptanceCriteria.map((criteria, index) => (
            <div key={index} className="acceptance-criteria-item">
              <input
                type="checkbox"
                className="acceptance-criteria-checkbox"
                checked={criteria.completed}
                onChange={() => onToggle(index)}
              />
              <div className="acceptance-criteria-content">
                <div className="acceptance-criteria-text-container">
                  <EditableField
                    fieldName={`acceptance-criteria-${index}`}
                    placeholder="Click to add acceptance criteria..."
                    value={criteria.text}
                    onSave={(value) => onEdit(`acceptance-criteria-${index}`, value)}
                  />
                </div>
                <div className="acceptance-criteria-actions">
                  <button
                    type="button"
                    className="icon-button remove"
                    title="Remove acceptance criteria"
                    onClick={() => onRemove(index)}
                  >
                    <svg viewBox="0 0 1024 1024" fill="currentColor">
                      <path d="M195.2 195.2a64 64 0 0 1 90.496 0L512 421.504 738.304 195.2a64 64 0 0 1 90.496 90.496L602.496 512 828.8 738.304a64 64 0 0 1-90.496 90.496L512 602.496 285.696 828.8a64 64 0 0 1-90.496-90.496L421.504 512 195.2 285.696a64 64 0 0 1 0-90.496z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="add-acceptance-criteria">
        <input
          type="text"
          className="acceptance-criteria-input"
          placeholder="Enter acceptance criteria..."
          value={newCriteriaText}
          onChange={(e) => setNewCriteriaText(e.target.value)}
          onKeyPress={handleKeyPress}
        />
        <button
          type="button"
          className="primary add-button"
          onClick={handleAdd}
          disabled={!newCriteriaText.trim()}
        >
          Add
        </button>
      </div>
    </>
  );
};

export default AcceptanceCriteriaSection;