import React from 'react';
import EditableField from './EditableField';
import { UserIcon, AgentIcon } from './Icons';
import { formatTimestamp } from './utils';

interface Comment {
  author: string;
  content: string;
  created_at: string;
}

interface CommentsSectionProps {
  comments: Comment[];
  currentCommentAuthor: string;
  newComment: string;
  onAuthorChange: (value: string) => void;
  onCommentChange: (value: string) => void;
  onAddComment: () => void;
}

const CommentsSection: React.FC<CommentsSectionProps> = ({
  comments,
  currentCommentAuthor,
  newComment,
  onAuthorChange,
  onCommentChange,
  onAddComment
}) => {
  return (
    <>
      <div className="comments-thread">
        {comments.length === 0 ? (
          <div className="comments-empty">
            No comments yet. Add a comment below to start the conversation.
          </div>
        ) : (
          comments.map((comment, index) => (
            <div key={index} className="comment-item">
              <div className="comment-header">
                {comment.author === 'agent' || comment.author === 'developer' ? (
                  <AgentIcon />
                ) : (
                  <UserIcon />
                )}
                <span className={`comment-author ${comment.author === 'agent' ? 'agent' : ''}`}>
                  {comment.author === 'agent' ? 'Agent' : comment.author}
                </span>
                <span>•</span>
                <span className="comment-timestamp">{formatTimestamp(comment.created_at)}</span>
              </div>
              <div className="comment-content">{comment.content}</div>
            </div>
          ))
        )}
      </div>
      <div className="add-comment-form">
        <div className="add-comment-header">
          <UserIcon />
          <label>Commenting as:</label>
          <div className="commenting-as-field">
            <EditableField
              fieldName="commentAuthor"
              placeholder="your-name"
              value={currentCommentAuthor}
              onSave={onAuthorChange}
            />
          </div>
        </div>
        <textarea
          id="commentInput"
          placeholder="Add a comment..."
          value={newComment}
          onChange={(e) => onCommentChange(e.target.value)}
        />
        <div className="add-comment-actions">
          <button type="button" onClick={onAddComment}>Add Comment</button>
        </div>
      </div>
    </>
  );
};

export default CommentsSection;