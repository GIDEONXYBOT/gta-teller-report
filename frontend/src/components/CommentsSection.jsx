import React, { useState } from 'react';
import axios from 'axios';
import { getApiUrl } from '../utils/apiConfig';

function TimeAgo({ time }) {
  try {
    const diff = Date.now() - new Date(time).getTime();
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return <span>{sec}s</span>;
    const min = Math.floor(sec / 60);
    if (min < 60) return <span>{min}m</span>;
    const hr = Math.floor(min / 60);
    if (hr < 24) return <span>{hr}h</span>;
    const d = Math.floor(hr / 24);
    return <span>{d}d</span>;
  } catch {
    return <span>-</span>;
  }
}

export default function CommentsSection({ feedId, currentUser, comments, setComments }) {
  const [newComment, setNewComment] = useState('');

  const handleAddComment = async () => {
    const content = newComment.trim();
    if (!content || !currentUser) return;

    try {
      const API = getApiUrl();
      const res = await axios.post(`${API}/api/media/feed/${feedId}/comments`,
        { content },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );

      if (res.data?.success) {
        setComments(prev => ({
          ...prev,
          [feedId]: [...(prev[feedId] || []), res.data.comment]
        }));
        setNewComment('');
      }
    } catch (err) {
      console.error('Failed to add comment:', err);
    }
  };

  return (
    <div className="px-3 pb-3 border-t dark:border-gray-700">
      {/* Add Comment */}
      {currentUser && (
        <div className="flex gap-2 mt-3">
          <img
            src={currentUser.avatarUrl ? (currentUser.avatarUrl.startsWith('http') ? currentUser.avatarUrl : `${getApiUrl()}${currentUser.avatarUrl}`) : '/favicon.ico'}
            alt="your avatar"
            className="w-8 h-8 rounded-full object-cover flex-shrink-0"
            onError={(e) => {
              e.target.src = `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#e5e7eb"/><circle cx="16" cy="12" r="5" fill="#9ca3af"/><path d="M5 27c0-5.5 4.5-10 10-10s10 4.5 10 10" fill="#9ca3af"/></svg>')}`;
            }}
          />
          <div className="flex-1 flex gap-2">
            <input
              type="text"
              placeholder="Write a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
              className="flex-1 px-3 py-2 text-sm border rounded-full dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleAddComment}
              disabled={!newComment.trim()}
              className="px-4 py-2 bg-blue-500 text-white text-sm rounded-full hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Post
            </button>
          </div>
        </div>
      )}

      {/* Comments List */}
      <div className="mt-3 space-y-3">
        {comments[feedId]?.map((comment) => (
          <div key={comment._id} className="flex gap-2">
            <img
              src={comment.author?.avatarUrl ? (comment.author.avatarUrl.startsWith('http') ? comment.author.avatarUrl : `${getApiUrl()}${comment.author.avatarUrl}`) : '/favicon.ico'}
              alt="avatar"
              className="w-8 h-8 rounded-full object-cover flex-shrink-0"
              onError={(e) => {
                e.target.src = `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#e5e7eb"/><circle cx="16" cy="12" r="5" fill="#9ca3af"/><path d="M5 27c0-5.5 4.5-10 10-10s10 4.5 10 10" fill="#9ca3af"/></svg>')}`;
              }}
            />
            <div className="flex-1">
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{comment.author?.name || comment.author?.username || 'User'}</span>
                  <div className="flex items-center gap-2">
                    <TimeAgo time={comment.createdAt} />
                    {currentUser && comment.author?._id === currentUser._id && (
                      <button
                        onClick={async () => {
                          if (confirm('Delete this comment?')) {
                            try {
                              const API = getApiUrl();
                              await axios.delete(`${API}/api/media/comments/${comment._id}`, {
                                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                              });
                              setComments(prev => ({
                                ...prev,
                                [feedId]: prev[feedId].filter(c => c._id !== comment._id)
                              }));
                            } catch (err) {
                              console.error('Failed to delete comment:', err);
                            }
                          }
                        }}
                        className="text-xs text-gray-500 hover:text-red-500"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-sm mt-1">{comment.content}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}