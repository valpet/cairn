export interface Task {
  id: string;
  title: string;
  description?: string;
  type?: string;
  status: string;
  priority?: string;
  completion_percentage?: number;
  acceptance_criteria?: Array<{
    text: string;
    completed: boolean;
  }>;
  dependencies?: Array<{
    id: string;
    type: string;
  }>;
  children: Task[];
  closed_at?: string;
  updated_at: string;
}

// Webview-specific task format
export interface WebviewTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  description: string;
  type: string;
  completion_percentage: number | null;
  acceptance_criteria: Array<{
    text: string;
    completed: boolean;
  }>;
  dependencies: Array<{
    id: string;
    type: string;
  }>;
  closed_at: string | undefined;
  updated_at: string;
  subtasks: Array<{
    id: string;
    title: string;
    type: string;
    status: string;
    priority: string;
    completion_percentage: number | null;
  }>;
}

export interface TaskListProps {
  // Props will be added as needed
}

// TaskEdit-specific types
export interface TaskEditTask {
  id: string;
  title: string;
  description: string;
  type: string;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string;
  closed_at?: string;
  comments: Comment[];
  subtasks: Subtask[];
  dependencies: Dependency[];
  acceptance_criteria: AcceptanceCriteria[];
  completion_percentage: number;
}

export interface Comment {
  author: string;
  content: string;
  created_at: string;
}

export interface Subtask {
  id: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  completion_percentage: number;
}

export interface Dependency {
  id: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  direction: 'blocks' | 'blocked_by';
  completion_percentage: number;
}

export interface AcceptanceCriteria {
  text: string;
  completed: boolean;
}

export interface AvailableItem {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  priority: string;
}

export interface TaskEditProps {
  vscode: any;
}

// VSCode Message Types
export interface VSCodeMessage {
  type: string;
  [key: string]: any;
}

export interface LoadTaskMessage extends VSCodeMessage {
  type: 'loadTask';
  task: TaskEditTask;
}

export interface AvailableSubtasksMessage extends VSCodeMessage {
  type: 'availableSubtasks';
  subtasks: AvailableItem[];
}

export interface AvailableDependenciesMessage extends VSCodeMessage {
  type: 'availableDependencies';
  dependencies: AvailableItem[];
}

export interface CommentAddedMessage extends VSCodeMessage {
  type: 'commentAdded';
  comment: Comment;
}

export interface GitUserInfoMessage extends VSCodeMessage {
  type: 'gitUserInfo';
  userName?: string;
  userEmail?: string;
}

export interface SaveFailedMessage extends VSCodeMessage {
  type: 'saveFailed';
  error: string;
  errorCode?: string;
}