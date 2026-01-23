import React from 'react';
import { formatDate } from './utils';
import { ProgressPie } from './Icons';

interface Issue {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  closed_at?: string;
  completion_percentage: number;
  acceptance_criteria?: Array<{
    text: string;
    completed: boolean;
  }>;
  subtasks?: Array<{
    id: string;
    title: string;
    completion_percentage: number;
  }>;
}

interface HeaderSectionProps {
  issue: Issue;
  copyToClipboard: (text: string) => void;
}

const HeaderSection: React.FC<HeaderSectionProps> = ({ issue, copyToClipboard }) => {
  return (
    <div className="header-row">
      <div className="header-left">
        <h1>
          Edit Issue <span id="headerTicketId">#{issue.id}</span>
          <button
            className="copy-id-btn"
            title="Copy ID to clipboard"
            onClick={() => copyToClipboard(issue.id)}
          >
            <svg fill="#000000" viewBox="0 0 36 36" version="1.1" preserveAspectRatio="xMidYMidMeet" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.6,4H21.55a3.89,3.89,0,0,0-7.31,0H13.4A2.41,2.41,0,0,0,11,6.4V10H25V6.4A2.41,2.41,0,0,0,22.6,4ZM23,8H13V6.25A.25.25,0,0,1,13.25,6h2.69l.12-1.11A1.24,1.24,0,0,1,16.61,4a2,2,0,0,1,3.15,1.18l.09.84h2.9a.25.25,0,0,1,.25.25Z" />
              <path d="M33.25,18.06H21.33l2.84-2.83a1,1,0,1,0-1.42-1.42L17.5,19.06l5.25,5.25a1,1,0,0,0,.71.29,1,1,0,0,0,.71-1.7l-2.84-2.84H33.25a1,1,0,0,0,0-2Z" />
              <path d="M29,16h2V6.68A1.66,1.66,0,0,0,29.35,5H27.08V7H29Z" />
              <path d="M29,31H7V7H9V5H6.64A1.66,1.66,0,0,0,5,6.67V31.32A1.66,1.66,0,0,0,6.65,33H29.36A1.66,1.66,0,0,0,31,31.33V22.06H29Z" />
              <rect x="0" y="0" width="36" height="36" fillOpacity="0" />
            </svg>
          </button>
          <ProgressPie 
            percentage={issue.completion_percentage} 
            size={16}
            tooltip={`${issue.completion_percentage}%\n${(issue.acceptance_criteria?.filter(ac => ac.completed).length || 0)} of ${(issue.acceptance_criteria?.length || 0)} acceptance criteria\n${(issue.subtasks?.filter(st => st.completion_percentage === 100).length || 0)} of ${(issue.subtasks?.length || 0)} sub-issues`}
          />
        </h1>
      </div>
      <div className="header-metadata">
        <div className="header-metadata-item">
          <span className="header-metadata-label">Created:</span>
          <div className="header-metadata-value">{formatDate(issue.created_at)}</div>
        </div>
        <div className="header-metadata-item">
          <span className="header-metadata-label">Updated:</span>
          <div className="header-metadata-value">{formatDate(issue.updated_at)}</div>
        </div>
        {issue.closed_at && (
          <div className="header-metadata-item">
            <span className="header-metadata-label">Closed:</span>
            <div className="header-metadata-value">{formatDate(issue.closed_at)}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HeaderSection;