import React, { useState, useEffect, useRef } from 'react';

interface EditableFieldProps {
  fieldName: string;
  placeholder: string;
  isTextarea?: boolean;
  value: string;
  onSave: (value: string) => void;
}

const EditableField: React.FC<EditableFieldProps> = ({ fieldName, placeholder, isTextarea = false, value, onSave }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  const startEditing = () => {
    setIsEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const save = () => {
    onSave(editValue);
    setIsEditing(false);
  };

  const cancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isTextarea) {
      e.preventDefault();
      save();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    }
  };

  return (
    <div className="editable-field">
      {!isEditing ? (
        <div className="field-display" onClick={startEditing}>
          <div className={`field-text ${!value ? 'placeholder' : ''}`}>
            {value || placeholder}
          </div>
          <svg className="edit-icon" viewBox="0 0 16 16" fill="currentColor">
            <path d="M13.23 1h-1.46L3.52 9.25l-.16.22L2 13.59l4.12-1.36.22-.16L14.59 3.23V1.77L13.23 1zM2.41 13.59l.72-2.17 1.45 1.45-2.17.72zm2.5-2.07L3.53 10.1 10.8 2.83l1.38 1.38-7.27 7.27z" />
          </svg>
        </div>
      ) : (
        <div className="field-edit">
          {isTextarea ? (
            <textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => setTimeout(() => cancel(), 100)}
              rows={4}
            />
          ) : (
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => setTimeout(() => cancel(), 100)}
            />
          )}
          <div className="edit-actions">
            <button type="button" className="icon-button accept" onClick={save} title="Save">
              <svg viewBox="0 0 16 16" fill="currentColor">
                <path d="M14.431 3.323l-8.47 10-.79-.036-3.35-4.77.818-.574 2.978 4.24 8.051-9.506.764.646z" />
              </svg>
            </button>
            <button type="button" className="icon-button cancel" onClick={cancel} title="Cancel">
              <svg viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 8.707l3.646 3.647.708-.707L8.707 8l3.647-3.646-.707-.708L8 7.293 4.354 3.646l-.707.708L7.293 8l-3.646 3.646.707.708L8 8.707z" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditableField;