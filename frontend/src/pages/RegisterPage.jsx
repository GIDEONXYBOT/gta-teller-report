import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { API_URL } from "../utils/apiConfig";

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    confirmPassword: "",
    name: "",
    role: "teller",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const navigate = useNavigate();

  const API = API_URL;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    console.log('📝 Registration attempt:', { username: formData.username, role: formData.role });

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      const payload = {
        username: formData.username.trim(),
        password: formData.password,
        name: formData.name.trim(),
        role: formData.role
      };
      console.log('📤 Sending registration to:', `${API}/api/auth/register`);
      
      const response = await axios.post(`${API}/api/auth/register`, payload);
      console.log('✅ Registration response:', response.data);
      
      setSuccess("✅ Registration successful! Waiting for admin approval.");
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      console.error("❌ Registration failed:", err.response?.data || err.message);
      console.error("❌ Full error:", err);
      setError(err.response?.data?.message || "Registration error");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 px-4">
      <div className="bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-lg shadow-xl w-full max-w-md">
        <h1 className="text-xl sm:text-2xl font-bold mb-6 text-center text-indigo-600 dark:text-indigo-400">
          Register Account
        </h1>

        {error && <p className="text-red-500 text-sm mb-3 text-center">{error}</p>}
        {success && <p className="text-green-500 text-sm mb-3 text-center">{success}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name */}
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300"
            >
              Full Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              value={formData.name}
              onChange={handleChange}
              className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-base"
              required
              autoComplete="name"
            />
          </div>

          {/* Username */}
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300"
            >
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              value={formData.username}
              onChange={handleChange}
              className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-base"
              required
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
            />
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-base"
              required
              autoComplete="new-password"
            />
          </div>

          {/* Confirm Password */}
          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300"
            >
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={handleChange}
              className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-base"
              required
              autoComplete="new-password"
            />
          </div>

          {/* Role */}
          <div>
            <label
              htmlFor="role"
              className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300"
            >
              Role
            </label>
            <select
              id="role"
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-base"
            >
              <option value="teller">Teller</option>
              <option value="supervisor">Supervisor</option>
              <option value="supervisor_teller">Supervisor/Teller</option>
              <option value="declarator">Declarator</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <button
            type="submit"
            className="w-full bg-indigo-600 text-white py-2.5 rounded-md hover:bg-indigo-700 transition text-base font-medium"
          >
            Register
          </button>

          <p className="text-sm text-center text-gray-600 dark:text-gray-400 mt-3">
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Login
            </button>
          </p>
        </form>
      </div>

      <p className="mt-6 text-sm text-gray-600 dark:text-gray-400">
        © Gideonbot.XY — All Rights Reserved
      </p>
    </div>
  );
}
