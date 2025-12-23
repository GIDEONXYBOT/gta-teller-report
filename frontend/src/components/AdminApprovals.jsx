import React, { useState, useEffect } from "react";
import axios from "axios";
import { getApiUrl } from "../utils/apiConfig";
import { getGlobalSocket } from "../utils/globalSocket";

export default function AdminUserApproval() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    fetchUsers();

    // ✅ Listen for live new user registration
    const socket = getGlobalSocket();
    if (socket) {
      socket.on("newUserRegistered", (newUser) => {
        setUsers((prev) => [...prev, newUser]);
      });
    }

    return () => {
      if (socket) {
        socket.off("newUserRegistered");
      }
    };
  }, []);

  const fetchUsers = async () => {
    try {
      const API = getApiUrl(); // Get fresh API URL
      const res = await axios.get(`${API}/api/admin/pending-users`);
      setUsers(res.data || []);
    } catch (err) {
      console.error("❌ Failed to fetch users:", err);
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4 text-indigo-600 dark:text-indigo-400">
        User Approval
      </h2>

      {users.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400">No pending users</p>
      ) : (
        <table className="w-full border dark:border-gray-700">
          <thead className="bg-gray-100 dark:bg-gray-800">
            <tr>
              <th className="p-2 text-left">Name</th>
              <th className="p-2 text-left">Username</th>
              <th className="p-2 text-left">Role</th>
              <th className="p-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user._id} className="border-t dark:border-gray-700">
                <td className="p-2">{user.name}</td>
                <td className="p-2">{user.username}</td>
                <td className="p-2 capitalize">{user.role}</td>
                <td className="p-2">
                  <span
                    className={`px-2 py-1 rounded text-sm ${
                      user.status === "approved"
                        ? "bg-green-200 text-green-800"
                        : "bg-yellow-200 text-yellow-800"
                    }`}
                  >
                    {user.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
