import { useState, useEffect } from 'react';
import {
  IssueEditIssue,
  Comment,
  AvailableItem,
  LoadTicketMessage,
  AvailableSubtasksMessage,
  AvailableDependenciesMessage,
  CommentAddedMessage,
  GitUserInfoMessage,
  SaveFailedMessage
} from './types';
import { showErrorMessage } from './utils';

interface UseVSCodeMessagingReturn {
  issue: IssueEditIssue | null;
  comments: Comment[];
  subtasks: IssueEditIssue['subtasks'];
  dependencies: IssueEditIssue['dependencies'];
  acceptanceCriteria: IssueEditIssue['acceptance_criteria'];
  availableSubtasks: AvailableItem[];
  availableDependencies: AvailableItem[];
  currentCommentAuthor: string;
  subtaskModalOpen: boolean;
  dependencyModalOpen: boolean;
  subtaskSearch: string;
  dependencySearch: string;
  setComments: React.Dispatch<React.SetStateAction<Comment[]>>;
  setSubtasks: React.Dispatch<React.SetStateAction<IssueEditIssue['subtasks']>>;
  setDependencies: React.Dispatch<React.SetStateAction<IssueEditIssue['dependencies']>>;
  setAcceptanceCriteria: React.Dispatch<React.SetStateAction<IssueEditIssue['acceptance_criteria']>>;
  setCurrentCommentAuthor: React.Dispatch<React.SetStateAction<string>>;
  setNewComment: React.Dispatch<React.SetStateAction<string>>;
  setSubtaskModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setDependencyModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSubtaskSearch: React.Dispatch<React.SetStateAction<string>>;
  setDependencySearch: React.Dispatch<React.SetStateAction<string>>;
  setPreviousStatus: React.Dispatch<React.SetStateAction<string>>;
}

export const useVSCodeMessaging = (vscode: any): UseVSCodeMessagingReturn => {
  const [issue, setIssue] = useState<IssueEditIssue | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [subtasks, setSubtasks] = useState<IssueEditIssue['subtasks']>([]);
  const [dependencies, setDependencies] = useState<IssueEditIssue['dependencies']>([]);
  const [acceptanceCriteria, setAcceptanceCriteria] = useState<IssueEditIssue['acceptance_criteria']>([]);
  const [currentCommentAuthor, setCurrentCommentAuthor] = useState('user');
  const [newComment, setNewComment] = useState('');

  // Modal states
  const [subtaskModalOpen, setSubtaskModalOpen] = useState(false);
  const [dependencyModalOpen, setDependencyModalOpen] = useState(false);
  const [availableSubtasks, setAvailableSubtasks] = useState<AvailableItem[]>([]);
  const [availableDependencies, setAvailableDependencies] = useState<AvailableItem[]>([]);
  const [subtaskSearch, setSubtaskSearch] = useState('');
  const [dependencySearch, setDependencySearch] = useState('');

  // Status management
  const [previousStatus, setPreviousStatus] = useState('open');

  useEffect(() => {
    // Notify extension that webview is ready
    vscode.postMessage({ type: 'webviewReady' });
    vscode.postMessage({ type: 'getGitUser' });

    // Listen for messages from extension
    const messageHandler = (event: MessageEvent) => {
      const message = event.data;
      console.log('Webview received message:', message);

      if (message.type === 'loadTicket') {
        const loadMessage = message as LoadTicketMessage;
        const ticket = loadMessage.ticket;
        setIssue(ticket);
        setComments(ticket.comments || []);
        setSubtasks(ticket.subtasks || []);
        setDependencies(ticket.dependencies || []);
        setAcceptanceCriteria(ticket.acceptance_criteria || []);
        setPreviousStatus(ticket.status || 'open');
      } else if (message.type === 'availableSubtasks') {
        const subtasksMessage = message as AvailableSubtasksMessage;
        setAvailableSubtasks(subtasksMessage.subtasks);
        setSubtaskModalOpen(true);
        setSubtaskSearch('');
      } else if (message.type === 'availableDependencies') {
        const depsMessage = message as AvailableDependenciesMessage;
        setAvailableDependencies(depsMessage.dependencies);
        setDependencyModalOpen(true);
        setDependencySearch('');
      } else if (message.type === 'commentAdded') {
        const commentMessage = message as CommentAddedMessage;
        setComments(prev => [...prev, commentMessage.comment]);
        setNewComment('');
      } else if (message.type === 'gitUserInfo') {
        const gitMessage = message as GitUserInfoMessage;
        let authorName = 'user';
        if (gitMessage.userName) {
          authorName = gitMessage.userName;
        } else if (gitMessage.userEmail) {
          authorName = gitMessage.userEmail;
        }
        setCurrentCommentAuthor(authorName);
      } else if (message.type === 'saveFailed') {
        const failedMessage = message as SaveFailedMessage;
        showErrorMessage(failedMessage.error, failedMessage.errorCode);
      }
    };

    window.addEventListener('message', messageHandler);
    return () => window.removeEventListener('message', messageHandler);
  }, [vscode]);

  return {
    issue,
    comments,
    subtasks,
    dependencies,
    acceptanceCriteria,
    availableSubtasks,
    availableDependencies,
    currentCommentAuthor,
    subtaskModalOpen,
    dependencyModalOpen,
    subtaskSearch,
    dependencySearch,
    setComments,
    setSubtasks,
    setDependencies,
    setAcceptanceCriteria,
    setCurrentCommentAuthor,
    setNewComment,
    setSubtaskModalOpen,
    setDependencyModalOpen,
    setSubtaskSearch,
    setDependencySearch,
    setPreviousStatus,
  };
};