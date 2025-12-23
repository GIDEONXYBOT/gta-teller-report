import React, { useState } from "react";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL;

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [signupMode, setSignupMode] = useState(false);
  const [fullName, setFullName] = useState("");
  const [message, setMessage] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_BASE}/api/auth/login`, { username, password });
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("role", res.data.role);
      localStorage.setItem("username", res.data.username);

      // Send all users to the public feed page after login (social-style feed)
      // This keeps the app unified: users see other uploads immediately after signing in.
      window.location.href = "/feed";
    } catch (err) {
      setMessage(err.response?.data?.message || "Login failed");
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_BASE}/api/auth/signup`, {
        username,
        password,
        fullName,
      });
      setMessage(res.data.message);
      setSignupMode(false);
    } catch (err) {
      setMessage(err.response?.data?.message || "Signup failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-6">
          {signupMode ? "Sign Up" : "Login"}
        </h1>

        <form onSubmit={signupMode ? handleSignup : handleLogin}>
          {signupMode && (
            <input
              type="text"
              placeholder="Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full border p-2 mb-3 rounded"
              required
            />
          )}
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full border p-2 mb-3 rounded"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border p-2 mb-4 rounded"
            required
          />
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
          >
            {signupMode ? "Sign Up" : "Login"}
          </button>
        </form>

        <p className="text-center text-gray-600 mt-4">
          {signupMode ? "Already have an account?" : "Don’t have an account?"}{" "}
          <button
            onClick={() => setSignupMode(!signupMode)}
            className="text-blue-500 hover:underline"
          >
            {signupMode ? "Login here" : "Sign up here"}
          </button>
        </p>

        {message && <p className="text-center mt-4 text-red-600">{message}</p>}
      </div>
    </div>
  );
}
