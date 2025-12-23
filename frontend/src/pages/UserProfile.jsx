import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { getApiUrl } from '../utils/apiConfig';
import { useParams } from 'react-router-dom';

export default function UserProfile(){
  const { id } = useParams();
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(()=>{
    (async ()=>{
      try{
        const API = getApiUrl();
        const token = localStorage.getItem('token');
        const opts = token ? { headers: { Authorization: `Bearer ${token}` }, timeout: 8000 } : { timeout: 8000 };
        const [uRes, fRes] = await Promise.all([
          axios.get(`${API}/api/users/${id}`, opts),
          axios.get(`${API}/api/media/feed?userId=${id}`, opts)
        ]);
        setUser(uRes.data);
        setItems(fRes.data?.items || []);
      }catch(e){ setErr(e.response?.data?.message || e.message || 'Failed'); }
      finally{ setLoading(false); }
    })();
  }, [id]);

  if (loading) return <div className="p-6">Loading…</div>;
  if (err) return <div className="p-6 text-red-500">{err}</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-4">
        <img src={user.avatarUrl ? `${getApiUrl()}${user.avatarUrl}?t=${Date.now()}` : '/favicon.ico'} className="w-20 h-20 rounded-full object-cover" alt="avatar" onError={(e) => e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iNDAiIGN5PSI0MCIgcj0iNDAiIGZpbGw9IiNFNUU3RUIiLz4KPHBhdGggZD0iTTQwIDQwQzQ1LjUyMjggNDAgNTAgMzQuNDc3MiA1MCAyOUM1MCAyMy40NzcyIDQ1LjUyMjggMTggNDAgMThDMzQuNDc3MiAxOCAzMCAyMy40NzcyIDMwIDI5QzMwIDM0LjQ3NzIgMzQuNDc3MiAzNC40NzcyIDQwIDQwIDQwIDQwWiIgZmlsbD0iIzlDQTQ5RiIvPgo8cGF0aCBkPSJNNjAgNTJDNTYgNDYuODYzNiA0MCA0MiA0MCA0Mkg0MEMxMy41NzI5IDQyIDEwIDQ2Ljg2MzYgMTAgNTJWODJINjBWNTRaIiBmaWxsPSIjOUNBNEFGIi8+Cjwvc3ZnPgo='} />
        <div>
          <div className="text-xl font-semibold">{user.name || user.username}</div>
          <div className="text-sm text-gray-400">{user.username} • {user.role}</div>
        </div>
      </div>

      <h3 className="text-lg font-semibold mb-2">Posts</h3>
      <div className="space-y-3">
        {items.length === 0 && <div className="text-sm text-gray-500">No posts yet</div>}
        {items.map(it => (
          <div key={it._id} className="border rounded overflow-hidden">
            {it.imageUrl && <img src={`${getApiUrl()}${it.imageUrl}`} alt="post" className="w-full object-cover max-h-[600px]" />}
            {it.caption && <div className="p-3 text-sm text-gray-700 dark:text-gray-300">{it.caption}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
