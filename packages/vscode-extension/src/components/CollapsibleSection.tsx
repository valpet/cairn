import React from 'react';

interface CollapsibleSectionProps {
  title: string;
  isCollapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  className?: string;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  isCollapsed,
  onToggle,
  children,
  className = ''
}) => {
  return (
    <div className={`collapsible-section ${className}`}>
      <div
        className={`collapsible-header ${isCollapsed ? 'collapsed' : ''}`}
        onClick={onToggle}
      >
        <h3>{title}</h3>
        <svg className="collapsible-caret" viewBox="0 0 16 16" fill="currentColor">
          <path d="M4.427 7.427l3.396 3.396a.25.25 0 00.354 0l3.396-3.396A.25.25 0 0011.396 7H4.604a.25.25 0 00-.177.427z" />
        </svg>
      </div>
      <div className={`collapsible-body ${isCollapsed ? 'collapsed' : ''}`}>
        <div className="collapsible-content">
          {children}
        </div>
      </div>
    </div>
  );
};

export default CollapsibleSection;