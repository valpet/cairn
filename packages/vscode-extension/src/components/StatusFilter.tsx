import React, { useState, useEffect } from 'react';
import { getStatusIcon, getStatusLabel, toggleStatusFilter, removeStatusFilter, clearAllFilters } from './statusFilterUtils';

interface StatusFilterProps {
  selectedStatuses: Set<string>;
  onStatusChange: (statuses: Set<string>) => void;
  showRecentlyClosed: boolean;
  onShowRecentlyClosedChange: (show: boolean) => void;
  recentlyClosedDuration: string;
  onRecentlyClosedDurationChange: (duration: string) => void;
  timeFilter: string;
  onTimeFilterChange: (timeFilter: string) => void;
}

const StatusFilter: React.FC<StatusFilterProps> = ({ 
  selectedStatuses, 
  onStatusChange,
  showRecentlyClosed,
  onShowRecentlyClosedChange,
  recentlyClosedDuration,
  onRecentlyClosedDurationChange,
  timeFilter,
  onTimeFilterChange
}) => {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const togglePopover = () => {
    setIsPopoverOpen(!isPopoverOpen);
  };

  const handleToggleStatus = (status: string) => {
    onStatusChange(toggleStatusFilter(status, selectedStatuses));
  };

  const handleRemoveStatus = (status: string) => {
    onStatusChange(removeStatusFilter(status, selectedStatuses));
  };

  const handleClearAll = () => {
    onStatusChange(clearAllFilters());
  };

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const trigger = document.getElementById('status-filter-trigger');
      if (!trigger?.contains(target) && isPopoverOpen) {
        setIsPopoverOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isPopoverOpen]);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      marginBottom: '16px',
      padding: '8px 0',
      fontSize: '13px'
    }}>
      <div style={{ position: 'relative' }}>
        <button
          id="status-filter-trigger"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            border: 'none',
            borderRadius: '6px',
            color: 'var(--vscode-foreground)',
            cursor: 'pointer',
            fontSize: '13px',
            position: 'relative',
            transition: 'all 0.15s',
            backgroundColor: selectedStatuses.size > 0 ? 'rgba(255, 255, 255, 0.05)' : 'transparent'
          }}
          onClick={togglePopover}
        >
          <span style={{
            opacity: 0.5,
            fontSize: '16px',
            marginRight: '2px',
            display: 'inline-flex',
            alignItems: 'center'
          }}>
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="16" height="16">
              <path d="M19 3H5C3.58579 3 2.87868 3 2.43934 3.4122C2 3.8244 2 4.48782 2 5.81466V6.50448C2 7.54232 2 8.06124 2.2596 8.49142C2.5192 8.9216 2.99347 9.18858 3.94202 9.72255L6.85504 11.3624C7.49146 11.7206 7.80967 11.8998 8.03751 12.0976C8.51199 12.5095 8.80408 12.9935 8.93644 13.5872C9 13.8722 9 14.2058 9 14.8729L9 17.5424C9 18.452 9 18.9067 9.25192 19.2613C9.50385 19.6158 9.95128 19.7907 10.8462 20.1406C12.7248 20.875 13.6641 21.2422 14.3321 20.8244C15 20.4066 15 19.4519 15 17.5424V14.8729C15 14.2058 15 13.8722 15.0636 13.5872C15.1959 12.9935 15.488 12.5095 15.9625 12.0976C16.1903 11.8998 16.5085 11.7206 17.145 11.3624L20.058 9.72255C21.0065 9.18858 21.4808 8.9216 21.7404 8.49142C22 8.06124 22 7.54232 22 6.50448V5.81466C22 4.48782 22 3.8244 21.5607 3.4122C21.1213 3 20.4142 3 19 3Z" fill="currentColor"></path>
            </svg>
          </span>
          <span style={{ fontWeight: 500, opacity: 0.9 }}>Status:</span>
          <span style={{ opacity: 0.5, fontSize: '10px', marginLeft: '2px' }}>▼</span>
        </button>

        {/* Status Popover */}
        <div
          id="status-popover"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            minWidth: '180px',
            backgroundColor: 'var(--vscode-dropdown-background)',
            border: '1px solid var(--vscode-dropdown-border)',
            borderRadius: '4px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            zIndex: 1000,
            padding: '6px 0',
            display: isPopoverOpen ? 'block' : 'none'
          }}
        >
          <div style={{
            padding: '8px 12px',
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            opacity: 0.6,
            letterSpacing: '0.5px'
          }}>Status</div>

          {['ready', 'open', 'in_progress', 'closed', 'blocked'].map(status => (
            <div
              key={status}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                cursor: 'pointer',
                fontSize: '13px',
                transition: 'background-color 0.1s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <div
                onClick={() => handleToggleStatus(status)}
                style={{
                  width: '14px',
                  height: '14px',
                  border: '1.5px solid var(--vscode-input-border)',
                  borderRadius: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'all 0.15s',
                  backgroundColor: selectedStatuses.has(status) ? 'var(--vscode-button-background)' : 'transparent',
                  borderColor: selectedStatuses.has(status) ? 'var(--vscode-button-background)' : 'var(--vscode-input-border)'
                }}>
                {selectedStatuses.has(status) && (
                  <span style={{
                    color: 'var(--vscode-button-foreground)',
                    fontSize: '10px',
                    fontWeight: 'bold'
                  }}>✓</span>
                )}
              </div>
              <span onClick={() => handleToggleStatus(status)}>{getStatusLabel(status)}</span>
            </div>
          ))}

          <div style={{
            height: '1px',
            backgroundColor: 'var(--vscode-dropdown-border)',
            margin: '4px 0'
          }}></div>

          <div
            style={{
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: '12px',
              opacity: 0.8,
              transition: 'all 0.1s'
            }}
            onClick={handleClearAll}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)';
              e.currentTarget.style.opacity = '1';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.opacity = '0.8';
            }}
          >
            Clear
          </div>
        </div>
      </div>

      {/* Filter Chips */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {Array.from(selectedStatuses).map(status => (
          <div
            key={status}
            className={`filter-chip ${status}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'default',
              transition: 'all 0.15s'
            }}
          >
            <span style={{ fontSize: '14px', lineHeight: 1 }}>{getStatusIcon(status)}</span>
            <span>{getStatusLabel(status)}</span>
            <span
              style={{
                cursor: 'pointer',
                opacity: 0.7,
                fontSize: '16px',
                lineHeight: 1,
                padding: '0 0 0 4px',
                transition: 'opacity 0.15s'
              }}
              onClick={() => handleRemoveStatus(status)}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
            >✕</span>
          </div>
        ))}
      </div>

      {/* Time Filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
          <span style={{ opacity: 0.9 }}>Time:</span>
          <select
            value={timeFilter}
            onChange={(e) => onTimeFilterChange(e.target.value)}
            style={{
              padding: '4px 8px',
              border: '1px solid var(--vscode-input-border)',
              borderRadius: '4px',
              backgroundColor: 'var(--vscode-input-background)',
              color: 'var(--vscode-input-foreground)',
              fontSize: '12px',
              cursor: 'pointer',
              minWidth: '100px'
            }}
          >
            <option value="all">All time</option>
            <option value="hour">Last hour</option>
            <option value="6hours">Last 6 hours</option>
            <option value="12hours">Last 12 hours</option>
            <option value="24hours">Last 24 hours</option>
            <option value="3days">Last 3 days</option>
            <option value="week">Last week</option>
            <option value="month">Last month</option>
          </select>
        </label>
      </div>

      {/* Recently Closed Toggle and Duration */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showRecentlyClosed}
            onChange={(e) => onShowRecentlyClosedChange(e.target.checked)}
            style={{
              margin: 0,
              cursor: 'pointer'
            }}
          />
          <span style={{ opacity: 0.9 }}>Show recently closed</span>
        </label>
        
        {showRecentlyClosed && (
          <select
            value={recentlyClosedDuration}
            onChange={(e) => onRecentlyClosedDurationChange(e.target.value)}
            style={{
              padding: '4px 8px',
              border: '1px solid var(--vscode-input-border)',
              borderRadius: '4px',
              backgroundColor: 'var(--vscode-input-background)',
              color: 'var(--vscode-input-foreground)',
              fontSize: '12px',
              cursor: 'pointer',
              minWidth: '80px'
            }}
          >
            <option value="5">5 min</option>
            <option value="60">1 hour</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="week">This week</option>
          </select>
        )}
      </div>
    </div>
  );
};

export default StatusFilter;