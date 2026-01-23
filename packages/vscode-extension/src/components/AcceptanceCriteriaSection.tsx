import React from 'react';
import EditableField from './EditableField';

interface AcceptanceCriteria {
  text: string;
  completed: boolean;
}

interface AcceptanceCriteriaSectionProps {
  acceptanceCriteria: AcceptanceCriteria[];
  onAdd: () => void;
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
      <button type="button" className="secondary" onClick={onAdd}>
        Add Acceptance Criteria
      </button>
    </>
  );
};

export default AcceptanceCriteriaSection;