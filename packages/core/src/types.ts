export interface AcceptanceCriteria {
  text: string;
  completed: boolean;
}

export interface Issue {
  id: string;
  title: string;
  description?: string;
  type?: IssueType;
  status: IssueStatus;
  priority?: Priority;
  assignee?: string;
  labels?: string[];
  dependencies?: Dependency[];
  dependents?: string[]; // computed
  created_at: string;
  updated_at: string;
  closed_at?: string;
  comments?: Comment[];
  acceptance_criteria?: AcceptanceCriteria[];
  completion_percentage?: number | null; // computed
}

export interface Comment {
  id: string;
  author: string;
  content: string;
  created_at: string;
}

export type IssueStatus = 'open' | 'in_progress' | 'closed';

export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export type IssueType = 'epic' | 'feature' | 'task' | 'bug' | 'chore' | 'docs' | 'refactor';

export interface Dependency {
  id: string;
  type: DependencyType;
}

// Stored dependency types: only 'blocked_by' for blocking relationships.
// 'blocks' is supported for backward compatibility during migration and
// may appear in legacy data, but new writes should use 'blocked_by' only.
export type DependencyType = 'blocked_by' | 'blocks' | 'related' | 'parent-child' | 'discovered-from';

export interface CairnConfig {
  cairnDir: string;
  gitEnabled: boolean;
}