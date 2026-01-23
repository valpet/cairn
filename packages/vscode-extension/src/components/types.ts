export interface Issue {
  id: string;
  title: string;
  description?: string;
  type?: string;
  status: string;
  priority?: string;
  completion_percentage?: number;
  dependencies?: Array<{
    id: string;
    type: string;
  }>;
  children: Issue[];
}

export interface IssueListProps {
  // Props will be added as needed
}

// IssueEdit-specific types
export interface IssueEditIssue {
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

export interface IssueEditProps {
  vscode: any;
}

// VSCode Message Types
export interface VSCodeMessage {
  type: string;
  [key: string]: any;
}

export interface LoadTicketMessage extends VSCodeMessage {
  type: 'loadTicket';
  ticket: IssueEditIssue;
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