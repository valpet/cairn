import React from 'react';

interface FileSelectorProps {
  currentFile: string; // What file is selected/being viewed
  systemActiveFile: string; // System-wide active file (for indicator)
  availableFiles: string[];
  onFileChange: (file: string) => void;
}

const FileSelector: React.FC<FileSelectorProps> = ({ currentFile, systemActiveFile, availableFiles, onFileChange }) => {
  const getFileName = (name: string): string => {
    return name === 'default' ? 'tasks.jsonl' : `${name}.jsonl`;
  };

  return (
    <div style={{ 
      marginBottom: '16px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px'
    }}>
      <label 
        htmlFor="file-selector" 
        style={{ 
          fontSize: '13px',
          color: 'var(--vscode-descriptionForeground)',
          fontWeight: 500
        }}
      >
        Task File:
      </label>
      <select
        id="file-selector"
        value={currentFile}
        onChange={(e) => onFileChange(e.target.value)}
        style={{
          backgroundColor: 'var(--vscode-dropdown-background)',
          color: 'var(--vscode-dropdown-foreground)',
          border: '1px solid var(--vscode-dropdown-border)',
          padding: '4px 8px',
          borderRadius: '2px',
          cursor: 'pointer',
          fontSize: '13px',
          outline: 'none',
          minWidth: '200px'
        }}
      >
        {availableFiles.map(file => (
          <option key={file} value={file}>
            {file === systemActiveFile ? '● ' : ''}{file} ({getFileName(file)})
          </option>
        ))}
      </select>
      <span style={{
        fontSize: '11px',
        color: 'var(--vscode-descriptionForeground)',
        fontStyle: 'italic'
      }}>
        {availableFiles.length} file{availableFiles.length !== 1 ? 's' : ''} available
      </span>
    </div>
  );
};

export default FileSelector;
