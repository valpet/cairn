import React from 'react';

interface MetadataDropdownProps {
  label: string;
  currentValue: string;
  className: string;
  options: { value: string; label: string }[];
  getIcon: (value: string) => string;
  onSelect: (value: string) => void;
  activeDropdown: string | null;
  onToggle: (field: string) => void;
  displayText?: string;
}

const MetadataDropdown: React.FC<MetadataDropdownProps> = ({
  label,
  currentValue,
  className,
  options,
  getIcon,
  onSelect,
  activeDropdown,
  onToggle,
  displayText
}) => {
  const field = label.toLowerCase();
  return (
    <div className="property-item">
      <label className="property-label">{label}</label>
      <div className="property-value">
        <button
          type="button"
          className={`metadata-dropdown-button ${className}`}
          onClick={() => onToggle(field)}
        >
          <span className="button-content">
            <span className="button-icon">{getIcon(currentValue)}</span>
            <span>{displayText || options.find(o => o.value === currentValue)?.label || currentValue}</span>
          </span>
          <span className="metadata-dropdown-caret">▼</span>
        </button>
        {activeDropdown === field && (
          <div className="metadata-dropdown-menu visible">
            {options.map(option => (
              <button
                key={option.value}
                type="button"
                className={`metadata-dropdown-item ${currentValue === option.value ? 'selected' : ''}`}
                onClick={() => onSelect(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MetadataDropdown;