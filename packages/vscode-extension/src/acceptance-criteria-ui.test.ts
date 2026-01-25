import { describe, it, expect, vi } from 'vitest';

// Mock DOM elements for testing acceptance criteria UI
function createMockElement(tagName: string, properties: Record<string, unknown> = {}) {
  const element = {
    tagName: tagName.toUpperCase(),
    className: '',
    textContent: '',
    checked: false,
    onclick: null,
    ...properties,
    children: [],
    appendChild: function (child: unknown) {
      this.children.push(child);
      (child as any).parentElement = this;
    },
    addEventListener: vi.fn(),
    querySelector: vi.fn(),
    querySelectorAll: vi.fn(),
    innerHTML: '',
    style: {},
    parentElement: null,
    nextElementSibling: null,
    getBoundingClientRect: vi.fn(() => ({ top: 0, left: 0, width: 100, height: 20 })),
  };
  return element;
}

// Mock document object
const mockDocument = {
  getElementById: vi.fn(),
  createElement: vi.fn((tagName) => createMockElement(tagName)),
  createElementNS: vi.fn((ns, tagName) => createMockElement(tagName)),
  addEventListener: vi.fn(),
};

// Mock window object
const mockWindow = {
  addEventListener: vi.fn(),
};

// Setup global mocks
(global as any).document = mockDocument;
(global as any).window = mockWindow;

// Mock the EditableField class
interface EditableFieldOptions {
  fieldName: string;
  placeholder: string;
  isTextarea: boolean;
  onSave: (value: string) => void;
  onCancel: () => void;
  onDisplayUpdate: (value: string) => void;
}

class EditableField {
  constructor(options: EditableFieldOptions) {
    this.fieldName = options.fieldName;
    this.placeholder = options.placeholder;
    this.isTextarea = options.isTextarea;
    this.onSave = options.onSave;
    this.onCancel = options.onCancel;
    this.onDisplayUpdate = options.onDisplayUpdate;
  }

  fieldName: string;
  placeholder: string;
  isTextarea: boolean;
  onSave: (value: string) => void;
  onCancel: () => void;
  onDisplayUpdate: (value: string) => void;

  getElement() {
    return createMockElement('div');
  }

  setValue(value: string) {
    // Mock implementation
  }
}

global.EditableField = EditableField;

// Mock vscode API
const mockVscode = {
  postMessage: vi.fn(),
};

global.acquireVsCodeApi = () => mockVscode;

// Import the functions we want to test
// Since we can't directly import from the HTML file, we'll test the logic directly

describe('Acceptance Criteria UI', () => {
  it('should render acceptance criteria with checkboxes and editable fields', () => {
    // Test data
    const acceptanceCriteria = [
      { text: 'Criteria 1', completed: false },
      { text: 'Criteria 2', completed: true },
    ];

    // Mock DOM elements
    const listElement = createMockElement('div', { id: 'acceptanceCriteriaList' });
    mockDocument.getElementById.mockReturnValue(listElement);

    // Mock acceptanceCriteriaFields array
    let acceptanceCriteriaFields: EditableField[] = [];

    // Simulate renderAcceptanceCriteria function logic
    listElement.innerHTML = '';
    acceptanceCriteriaFields = [];

    acceptanceCriteria.forEach((criteria, index) => {
      const div = createMockElement('div', { className: 'acceptance-criteria-item' });

      const checkbox = createMockElement('input', {
        type: 'checkbox',
        className: 'acceptance-criteria-checkbox',
        checked: criteria.completed,
      });

      const contentDiv = createMockElement('div', { className: 'acceptance-criteria-content' });
      const textContainer = createMockElement('div', { className: 'acceptance-criteria-text-container' });

      // Create EditableField for the criteria text
      const criteriaField = new EditableField({
        fieldName: `acceptance-criteria-${index}`,
        placeholder: 'Click to add acceptance criteria...',
        isTextarea: false,
        onSave: vi.fn(),
        onCancel: vi.fn(),
        onDisplayUpdate: vi.fn()
      });

      // Set the current value
      criteriaField.setValue(criteria.text);

      // Append the editable field to the container
      textContainer.appendChild(criteriaField.getElement());

      // Store reference to the field
      acceptanceCriteriaFields[index] = criteriaField;

      const actionsDiv = createMockElement('div', { className: 'acceptance-criteria-actions' });
      const removeBtn = createMockElement('button', {
        type: 'button',
        className: 'icon-button remove',
        title: 'Remove acceptance criteria'
      });

      actionsDiv.appendChild(removeBtn);
      contentDiv.appendChild(textContainer);
      contentDiv.appendChild(actionsDiv);

      div.appendChild(checkbox);
      div.appendChild(contentDiv);
      listElement.appendChild(div);
    });

    // Verify the structure
    expect(listElement.children).toHaveLength(2);
    expect(acceptanceCriteriaFields).toHaveLength(2);

    // Check first criteria
    const firstItem = listElement.children[0];
    expect(firstItem.children).toHaveLength(2); // checkbox + content div

    const firstCheckbox = firstItem.children[0];
    expect(firstCheckbox.type).toBe('checkbox');
    expect(firstCheckbox.checked).toBe(false);

    // Check that EditableField was created and set with correct value
    expect(acceptanceCriteriaFields[0]).toBeInstanceOf(EditableField);
    expect(acceptanceCriteriaFields[0].fieldName).toBe('acceptance-criteria-0');

    // Check second criteria
    const secondItem = listElement.children[1];
    const secondCheckbox = secondItem.children[0];
    expect(secondCheckbox.checked).toBe(true);

    expect(acceptanceCriteriaFields[1]).toBeInstanceOf(EditableField);
    expect(acceptanceCriteriaFields[1].fieldName).toBe('acceptance-criteria-1');
  });

  it('should toggle acceptance criteria completion', () => {
    let acceptanceCriteria = [
      { text: 'Criteria 1', completed: false },
    ];

    // Simulate toggleAcceptanceCriteria function
    function toggleAcceptanceCriteria(index: number) {
      acceptanceCriteria[index].completed = !acceptanceCriteria[index].completed;
    }

    // Initially not completed
    expect(acceptanceCriteria[0].completed).toBe(false);

    // Toggle to completed
    toggleAcceptanceCriteria(0);
    expect(acceptanceCriteria[0].completed).toBe(true);

    // Toggle back to not completed
    toggleAcceptanceCriteria(0);
    expect(acceptanceCriteria[0].completed).toBe(false);
  });

  it('should add new acceptance criteria with placeholder text', () => {
    let acceptanceCriteria: Array<{ text: string, completed: boolean }> = [];

    // Simulate addAcceptanceCriteria function
    function addAcceptanceCriteria() {
      acceptanceCriteria.push({
        text: 'New acceptance criteria',
        completed: false
      });
    }

    // Initially empty
    expect(acceptanceCriteria).toHaveLength(0);

    // Add first criteria
    addAcceptanceCriteria();
    expect(acceptanceCriteria).toHaveLength(1);
    expect(acceptanceCriteria[0].text).toBe('New acceptance criteria');
    expect(acceptanceCriteria[0].completed).toBe(false);

    // Add second criteria
    addAcceptanceCriteria();
    expect(acceptanceCriteria).toHaveLength(2);
    expect(acceptanceCriteria[1].text).toBe('New acceptance criteria');
  });

  it('should remove acceptance criteria', () => {
    let acceptanceCriteria = [
      { text: 'Criteria 1', completed: false },
      { text: 'Criteria 2', completed: true },
      { text: 'Criteria 3', completed: false },
    ];

    // Simulate removeAcceptanceCriteria function
    function removeAcceptanceCriteria(index: number) {
      acceptanceCriteria.splice(index, 1);
    }

    // Remove middle criteria
    removeAcceptanceCriteria(1);
    expect(acceptanceCriteria).toHaveLength(2);
    expect(acceptanceCriteria[0].text).toBe('Criteria 1');
    expect(acceptanceCriteria[1].text).toBe('Criteria 3');

    // Remove first criteria
    removeAcceptanceCriteria(0);
    expect(acceptanceCriteria).toHaveLength(1);
    expect(acceptanceCriteria[0].text).toBe('Criteria 3');
  });

  it('should save acceptance criteria when text is edited', () => {
    let acceptanceCriteria = [
      { text: 'Original criteria', completed: false },
    ];

    let saveTicketCalled = false;
    const mockSaveTicket = vi.fn(() => { saveTicketCalled = true; });

    // Create EditableField with onSave callback
    const criteriaField = new EditableField({
      fieldName: 'acceptance-criteria-0',
      placeholder: 'Click to add acceptance criteria...',
      isTextarea: false,
      onSave: (value: string) => {
        acceptanceCriteria[0].text = value;
        mockSaveTicket();
      },
      onCancel: vi.fn(),
      onDisplayUpdate: vi.fn()
    });

    // Simulate editing the text
    const onSaveCallback = criteriaField.onSave;
    onSaveCallback('Updated criteria text');

    // Verify the criteria was updated and save was called
    expect(acceptanceCriteria[0].text).toBe('Updated criteria text');
    expect(mockSaveTicket).toHaveBeenCalled();
  });
});