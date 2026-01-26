import { useState, useEffect } from 'react';
import {
  TaskEditTask,
  Comment,
  AvailableItem,
  LoadTaskMessage,
  AvailableSubtasksMessage,
  AvailableDependenciesMessage,
  CommentAddedMessage,
  GitUserInfoMessage,
  SaveFailedMessage
} from './types';
import { showErrorMessage } from './utils';

interface UseVSCodeMessagingReturn {
  task: TaskEditTask | null;
  comments: Comment[];
  subtasks: TaskEditTask['subtasks'];
  dependencies: TaskEditTask['dependencies'];
  acceptanceCriteria: TaskEditTask['acceptance_criteria'];
  availableSubtasks: AvailableItem[];
  availableDependencies: AvailableItem[];
  currentCommentAuthor: string;
  newComment: string;
  subtaskModalOpen: boolean;
  dependencyModalOpen: boolean;
  subtaskSearch: string;
  dependencySearch: string;
  setComments: React.Dispatch<React.SetStateAction<Comment[]>>;
  setSubtasks: React.Dispatch<React.SetStateAction<TaskEditTask['subtasks']>>;
  setDependencies: React.Dispatch<React.SetStateAction<TaskEditTask['dependencies']>>;
  setAcceptanceCriteria: React.Dispatch<React.SetStateAction<TaskEditTask['acceptance_criteria']>>;
  setCurrentCommentAuthor: React.Dispatch<React.SetStateAction<string>>;
  setNewComment: React.Dispatch<React.SetStateAction<string>>;
  setSubtaskModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setDependencyModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSubtaskSearch: React.Dispatch<React.SetStateAction<string>>;
  setDependencySearch: React.Dispatch<React.SetStateAction<string>>;
}

export const useVSCodeMessaging = (vscode: any): UseVSCodeMessagingReturn => {
  const [task, setTask] = useState<TaskEditTask | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [subtasks, setSubtasks] = useState<TaskEditTask['subtasks']>([]);
  const [dependencies, setDependencies] = useState<TaskEditTask['dependencies']>([]);
  const [acceptanceCriteria, setAcceptanceCriteria] = useState<TaskEditTask['acceptance_criteria']>([]);
  const [currentCommentAuthor, setCurrentCommentAuthor] = useState('user');
  const [newComment, setNewComment] = useState('');

  // Modal states
  const [subtaskModalOpen, setSubtaskModalOpen] = useState(false);
  const [dependencyModalOpen, setDependencyModalOpen] = useState(false);
  const [availableSubtasks, setAvailableSubtasks] = useState<AvailableItem[]>([]);
  const [availableDependencies, setAvailableDependencies] = useState<AvailableItem[]>([]);
  const [subtaskSearch, setSubtaskSearch] = useState('');
  const [dependencySearch, setDependencySearch] = useState('');

  useEffect(() => {
    // Notify extension that webview is ready
    vscode.postMessage({ type: 'webviewReady' });
    vscode.postMessage({ type: 'getGitUser' });

    // Listen for messages from extension
    const messageHandler = (event: MessageEvent) => {
      const message = event.data;

      if (message.type === 'loadTask') {
        const loadMessage = message as LoadTaskMessage;
        const taskData = loadMessage.task;
        setTask(taskData);
        setComments(taskData.comments || []);
        setSubtasks(taskData.subtasks || []);
        setDependencies(taskData.dependencies || []);
        setAcceptanceCriteria(taskData.acceptance_criteria || []);
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
    task,
    comments,
    subtasks,
    dependencies,
    acceptanceCriteria,
    availableSubtasks,
    availableDependencies,
    currentCommentAuthor,
    newComment,
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
  };
};