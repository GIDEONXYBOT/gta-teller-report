import React, { useEffect, useState, useRef, Suspense, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getApiUrl } from '../utils/apiConfig';

// Lazy load heavy components
const CommentsSection = React.lazy(() => import('../components/CommentsSection'));

function TimeAgo({ time }) {
  // Memoize the calculation
  return useMemo(() => {
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
  }, [time]);
}

export default function FeedPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [comments, setComments] = useState({});
  const [showComments, setShowComments] = useState({});

  // Get current user
  const getCurrentUser = () => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  };
  const currentUser = getCurrentUser();

  async function load() {
    setLoading(true);
    setError('');
    try {
      const API = getApiUrl();
      const res = await axios.get(`${API}/api/media/feed`, { timeout: 15000 }); // Reduced from 30s to 15s
      if (res.data?.success) setItems(res.data.items || []);
      else setError(res.data?.message || 'Failed to fetch feed');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to fetch');
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [refreshTrigger]);

  // Preload first few images for better initial loading experience
  useEffect(() => {
    if (items.length > 0) {
      // Preload first 3 images
      const preloadImages = items.slice(0, 3);
      preloadImages.forEach((item) => {
        if (item.imageUrl) {
          const img = new Image();
          const src = item.imageUrl.startsWith('http') ? item.imageUrl : `${getApiUrl()}${item.imageUrl}`;
          img.src = src;
        }
      });
    }
  }, [items]);

  // Function to refresh feed (can be called from other components)
  window.refreshFeed = () => setRefreshTrigger(prev => prev + 1);

  // Handle like/unlike
  const handleLike = useCallback(async (feedId) => {
    if (!currentUser) return;

    try {
      const API = getApiUrl();
      const res = await axios.post(`${API}/api/media/feed/${feedId}/like`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      if (res.data?.success) {
        // Update the item in state
        setItems(prev => prev.map(item =>
          item._id === feedId
            ? {
                ...item,
                likes: res.data.liked
                  ? [...item.likes, currentUser]
                  : item.likes.filter(user => user._id !== currentUser._id)
              }
            : item
        ));
      }
    } catch (err) {
      console.error('Failed to toggle like:', err);
    }
  }, [currentUser]);

  // Handle delete post
  const handleDelete = useCallback(async (feedId) => {
    if (!confirm('Are you sure you want to delete this post?')) return;

    try {
      const API = getApiUrl();
      const res = await axios.delete(`${API}/api/media/feed/${feedId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      if (res.data?.success) {
        setItems(prev => prev.filter(item => item._id !== feedId));
      }
    } catch (err) {
      console.error('Failed to delete post:', err);
      alert('Failed to delete post');
    }
  }, []);

  // Load comments for a post
  const loadComments = async (feedId) => {
    try {
      const API = getApiUrl();
      const res = await axios.get(`${API}/api/media/feed/${feedId}/comments`);

      if (res.data?.success) {
        setComments(prev => ({ ...prev, [feedId]: res.data.comments }));
      }
    } catch (err) {
      console.error('Failed to load comments:', err);
    }
  };

  // Toggle comments visibility
  const toggleComments = useCallback((feedId) => {
    const currentlyVisible = showComments[feedId];
    setShowComments(prev => ({ ...prev, [feedId]: !currentlyVisible }));

    if (!currentlyVisible && !comments[feedId]) {
      loadComments(feedId);
    }
  }, [showComments, comments]);

  // Generate a friendly placeholder/random feed for empty state
  function makeRandomFeed(count = 4) {
    const sampleNames = [
      'Alex', 'Marisol', 'Chris', 'Aisha', 'Diego', 'Nora', 'Sam', 'Maya'
    ];
    const sampleCaptions = [
      'Loving this view!',
      'Trying something new today 🌟',
      'Quick snap on my walk',
      'Testing the new upload feature — hello!',
      'Catch of the day',
      'Coffee break ☕️',
      'Sunset magic',
    ];

    return new Array(count).fill(0).map((_, i) => {
      const seed = Math.floor(Math.random() * 10000) + i;
      const name = sampleNames[Math.floor(Math.random() * sampleNames.length)];
      const caption = sampleCaptions[Math.floor(Math.random() * sampleCaptions.length)];
      return {
        _id: `placeholder-${seed}`,
        uploader: {
          name,
          avatarUrl: `https://i.pravatar.cc/140?u=${seed}`
        },
        createdAt: new Date(Date.now() - ((i + 1) * 1000 * 60 * 60)).toISOString(),
        caption,
        imageUrl: `https://picsum.photos/seed/${seed}/1200/800`,
        thumbUrl: `https://picsum.photos/seed/${seed}/640/360`,
        width: 1200,
        height: 800,
        _placeholder: true
      };
    });
  }

  const [loaded, setLoaded] = useState({});
  const [imageErrors, setImageErrors] = useState({});

  // Use connection hints to prefer smaller images on slow networks
  const connection = typeof navigator !== 'undefined' && navigator.connection ? navigator.connection : null;
  const effectiveType = connection?.effectiveType || '';

  function markLoaded(id) {
    setLoaded(prev => ({ ...prev, [id]: true }));
  }

  function markError(id) {
    setImageErrors(prev => ({ ...prev, [id]: true }));
    setLoaded(prev => ({ ...prev, [id]: true })); // Mark as loaded to hide skeleton
  }

  // Intersection Observer for efficient lazy loading
  const [visibleImages, setVisibleImages] = useState(new Set());
  const imageRefs = useRef({});

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const imgId = entry.target.dataset.imgId;
            setVisibleImages(prev => new Set([...prev, imgId]));
          }
        });
      },
      { rootMargin: '50px' } // Start loading 50px before image enters viewport
    );

    Object.values(imageRefs.current).forEach((img) => {
      if (img) observer.observe(img);
    });

    return () => observer.disconnect();
  }, [items]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-xl font-semibold mb-4">Activity Feed</h2>
      {loading && <div className="text-sm text-gray-500">Loading…</div>}
      {error && <div className="text-sm text-red-500 mb-3">{error}</div>}

      <div className="space-y-4">
        {items.length === 0 && !loading && (
          <div className="text-sm text-gray-500 mb-2">No posts yet — here are some sample posts to get you started.</div>
        )}

        {((items.length > 0) ? items : makeRandomFeed(4)).map((it) => (
          <article key={it._id} className="bg-white dark:bg-gray-800 rounded shadow-sm overflow-hidden border dark:border-gray-700">
            <div className="p-3 flex items-center gap-3">
              <img
                src={it.uploader?.avatarUrl ? (it.uploader.avatarUrl.startsWith('http') ? `${it.uploader.avatarUrl}?t=${Date.now()}` : `${getApiUrl()}${it.uploader.avatarUrl}?t=${Date.now()}`) : '/favicon.ico'}
                alt="avatar"
                className="w-10 h-10 rounded-full object-cover cursor-pointer hover:opacity-80 transition"
                onClick={() => navigate(`/users/${it.uploader?._id}`)}
                onError={(e) => e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiNFNUU3RUIiLz4KPHBhdGggZD0iTTIwIDIwQzIyLjc2MTQgMjAgMjUgMTcuNzYxNCAyNSAxNUMyNSAxMi4yMzg2IDIyLjc2MTQgMTAgMjAgMTBDMTcuMjM4NiAxMCAxNSAxMi4yMzg2IDE1IDE1QzE1IDE3Ljc2MTQgMTcuNzYxNCAyMCAyMFoiIGZpbGw9IiM5Q0E0QUYiLz4KPHBhdGggZD0iTTMwIDI4QzMwIDI0LjY4NjMgMjYuNDI3MSAyMiAyMiAyMkgxOEMxMy41NzI5IDIyIDEwIDI0LjY4NjMgMTAgMjhWMzBIMzBWMjhaIiBmaWxsPSIjOUNBNEFGIi8+Cjwvc3ZnPgo='}
              />
              <div className="flex-1">
                <div className="flex items-center justify-between gap-3">
                  <div
                    className="text-sm font-semibold cursor-pointer hover:text-blue-600 transition"
                    onClick={() => navigate(`/users/${it.uploader?._id}`)}
                  >
                    {it.uploader?.name || it.uploader?.username || 'User'}
                  </div>
                  <div className="text-xs text-gray-400"><TimeAgo time={it.createdAt} /></div>
                </div>
                {it.caption && <div className="text-sm text-gray-600 mt-1">{it.caption}</div>}
              </div>
            </div>

            {it.imageUrl && (
              <div className="w-full bg-black/5 dark:bg-white/5 relative overflow-hidden" style={{ aspectRatio: (it.width && it.height) ? `${it.width} / ${it.height}` : '16 / 9' }}>
                {/* Use smaller thumb on mobile/slow networks when available */}
                <picture>
                  {(it.thumbUrl || it.imageUrl) && (
                    <source media="(max-width:640px)" srcSet={(it.thumbUrl || it.imageUrl).startsWith('http') || (it.thumbUrl || it.imageUrl).startsWith('data:') ? (it.thumbUrl || it.imageUrl) : `${getApiUrl()}${it.thumbUrl || it.imageUrl}`} />
                  )}
                  {/* If connection is slow prefer thumb to save bandwidth */}
                  <source media="(max-width:1024px)" srcSet={effectiveType.includes('2g') || effectiveType.includes('slow-2g') ? ((it.thumbUrl || it.imageUrl).startsWith('http') || (it.thumbUrl || it.imageUrl).startsWith('data:') ? (it.thumbUrl || it.imageUrl) : `${getApiUrl()}${it.thumbUrl || it.imageUrl}`) : ((it.imageUrl).startsWith('http') || (it.imageUrl).startsWith('data:') ? it.imageUrl : `${getApiUrl()}${it.imageUrl}`)} />
                  <img
                    ref={(el) => imageRefs.current[it._id] = el}
                    data-img-id={it._id}
                    src={(it.imageUrl).startsWith('http') || (it.imageUrl).startsWith('data:') ? it.imageUrl : `${getApiUrl()}${it.imageUrl}`}
                    alt="feed"
                    loading={visibleImages.has(it._id) ? "eager" : "lazy"}
                    onLoad={() => markLoaded(it._id)}
                    onError={(e) => {
                      // If image fails to load and it's a relative path, try with base64 data
                      if (it.imageData && !e.target.src.includes('data:')) {
                        e.target.src = `data:image/png;base64,${it.imageData}`;
                      } else {
                        markError(it._id);
                      }
                    }}
                    className={`w-full h-full object-cover transition-opacity duration-300 ${loaded[it._id] ? 'opacity-100' : 'opacity-0'}`}
                  />
                </picture>

                {/* skeleton / placeholder while image is loading */}
                {!loaded[it._id] && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-24 h-24 rounded-lg bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 animate-pulse" />
                  </div>
                )}

                {/* Error state for failed images */}
                {imageErrors[it._id] && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-700">
                    <div className="text-center text-gray-500 p-4">
                      <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      <p className="text-sm mb-2">Image failed to load</p>
                      {currentUser?.role === 'admin' && it.imageUrl?.startsWith('/uploads/') && (
                        <button
                          onClick={async () => {
                            try {
                              const API = getApiUrl();
                              const res = await axios.post(`${API}/api/media/migrate-images`, {}, {
                                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                              });
                              if (res.data?.success) {
                                alert(`Migration completed: ${res.data.message}`);
                                // Refresh the feed to show migrated images
                                window.refreshFeed && window.refreshFeed();
                              }
                            } catch (err) {
                              alert('Migration failed: ' + err.message);
                            }
                          }}
                          className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
                        >
                          Migrate Image
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="p-3 flex items-center justify-between text-sm text-gray-500">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleLike(it._id)}
                  className={`px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-1 ${
                    it.likes?.some(user => user._id === currentUser?._id) ? 'text-red-500' : ''
                  }`}
                >
                  <svg className="w-4 h-4" fill={it.likes?.some(user => user._id === currentUser?._id) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  {it.likes?.length || 0}
                </button>
                <button
                  onClick={() => toggleComments(it._id)}
                  className="px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  {(comments[it._id]?.length || 0)}
                </button>
                <button className="px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">Share</button>
                {currentUser && it.uploader?._id === currentUser._id && (
                  <button
                    onClick={() => handleDelete(it._id)}
                    className="px-2 py-1 rounded hover:bg-red-100 dark:hover:bg-red-900 text-red-600"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
              <div className="text-xs">ID: {String(it._id).slice(-6)}{it._placeholder ? ' • sample' : ''}</div>
            </div>

            {/* Comments Section */}
            {showComments[it._id] && (
              <Suspense fallback={<div className="px-3 pb-3 text-sm text-gray-500">Loading comments...</div>}>
                <CommentsSection
                  feedId={it._id}
                  currentUser={currentUser}
                  comments={comments}
                  setComments={setComments}
                />
              </Suspense>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
