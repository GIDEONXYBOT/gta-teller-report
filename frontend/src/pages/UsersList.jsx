import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { getApiUrl } from '../utils/apiConfig';
import { useNavigate } from 'react-router-dom';

export default function UsersList(){
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(()=>{ (async ()=>{
    setLoading(true); setError('');
    try{
      const API = getApiUrl();
      const token = localStorage.getItem('token');
      const opts = token ? { headers: { Authorization: `Bearer ${token}` }, timeout: 8000 } : { timeout: 8000 };
      const res = await axios.get(`${API}/api/users`, opts);
      setUsers(res.data || []);
    }catch(err){
      // If unauthorised, redirect to login for a better UX
      if (err?.response?.status === 401) {
        setError('Unauthorized. Please log in again.');
        return;
      }
      setError(err.response?.data?.message || err.message || 'Failed');
    }finally{ setLoading(false); }
  })(); }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-xl font-semibold mb-4">People</h2>
      {loading && <div className="text-sm text-gray-500">Loading…</div>}
      {error && <div className="text-sm text-red-500">{error}</div>}

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
        {users.map(u => (
          <div key={u._id} className="p-3 border rounded flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer" onClick={()=>navigate(`/users/${u._id}`)}>
            <img src={u.avatarUrl ? `${getApiUrl()}${u.avatarUrl}` : '/favicon.ico'} className="w-12 h-12 rounded-full object-cover" alt="a" onError={(e) => e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjQiIGN5PSIyNCIgcj0iMjQiIGZpbGw9IiNFNUU3RUIiLz4KPHBhdGggZD0iTTI0IDI0QzI3LjMxMzcgMjQgMzAgMjAuNjg2MyAzMCAxOEMzMCAxNS4zMTM3IDI3LjMxMzcgMTIgMjQgMTJDMTkuNjg2MyAxMiAxNSAxNS4zMTM3IDE1IDE4QzE1IDIwLjY4NjMgMTkuNjg2MyAyMC42ODYzIDI0IDI0IDI0IDI0WiIgZmlsbD0iIzlDQTQ5RiIvPgo8cGF0aCBkPSJNMzYgMzJDNTYgMjguNjg2MyAzMiAyNCAyOCAyNEgyMEMxMy41NzI5IDI0IDEwIDI4LjY4NjMgMTAgMzJWNDJIMzZWMzJaIiBmaWxsPSIjOUNBNEFGIi8+Cjwvc3ZnPgo='} />
            <div className="flex-1">
              <div className="font-semibold">{u.name || u.username}</div>
              <div className="text-xs text-gray-400">{u.role} • {u.status}</div>
            </div>
            <div className="text-sm text-indigo-600">View</div>
          </div>
        ))}
      </div>
    </div>
  );
}
