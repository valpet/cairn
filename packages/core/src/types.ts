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
}

export interface Comment {
  id: string;
  author: string;
  content: string;
  created_at: string;
}

export type IssueStatus = 'open' | 'in_progress' | 'closed' | 'blocked';

export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export type IssueType = 'epic' | 'feature' | 'task' | 'bug' | 'chore' | 'docs' | 'refactor';

export interface Dependency {
  id: string;
  type: DependencyType;
}

export type DependencyType = 'blocks' | 'related' | 'parent-child' | 'discovered-from';

export interface CairnConfig {
  cairnDir: string;
  gitEnabled: boolean;
}