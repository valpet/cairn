export interface Issue {
  id: string;
  title: string;
  description?: string;
  status: IssueStatus;
  priority?: Priority;
  assignee?: string;
  labels?: string[];
  dependencies?: Dependency[];
  dependents?: string[]; // computed
  created_at: string;
  updated_at: string;
  closed_at?: string;
  design?: string;
  notes?: string;
  acceptance_criteria?: string[];
}

export type IssueStatus = 'open' | 'in_progress' | 'closed' | 'blocked';

export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export interface Dependency {
  id: string;
  type: DependencyType;
}

export type DependencyType = 'blocks' | 'related' | 'parent-child' | 'discovered-from';

export interface HorizonConfig {
  horizonDir: string;
  gitEnabled: boolean;
}