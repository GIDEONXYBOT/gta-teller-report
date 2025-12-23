import React, { useState, useContext } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { SettingsContext } from "../context/SettingsContext.jsx";
import { getApiUrl } from "../utils/apiConfig.js";
import { FadeInUp, ScaleIn, BounceIn, HoverScale } from "../components/UIEffects.jsx";

export default function LoginPage() {
  const { setUser } = useContext(SettingsContext);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Enhanced mobile debugging
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    console.log('🔐 Frontend login attempt:', { 
      username, 
      passwordLength: password.length,
      isMobile,
      userAgent: navigator.userAgent,
      apiUrl: getApiUrl(),
      windowLocation: window.location.href
    });

    // Validate inputs
    if (!username || !password) {
      setError("Please enter both username and password.");
      return;
    }

    // Clean inputs (especially important for mobile)
    const cleanUsername = username.trim();
    const cleanPassword = password.trim();

    if (cleanUsername.length === 0 || cleanPassword.length === 0) {
      setError("Username and password cannot be empty.");
      return;
    }

    try {
      const payload = { username: cleanUsername, password: cleanPassword };
      const apiUrl = getApiUrl();
      console.log('📤 Sending login request to:', `${apiUrl}/api/auth/login`);
      console.log('📱 Payload:', { username: cleanUsername, passwordLength: cleanPassword.length });
      console.log('🌐 Current hostname:', window.location.hostname);
      console.log('🎯 API URL from getApiUrl():', apiUrl);
      
      // ⚡ Optimized timeout for mobile (faster on good connection, reasonable fallback)
      const timeoutMs = isMobile ? 15000 : 30000; // 15s mobile, 30s desktop
      
      const res = await axios.post(`${apiUrl}/api/auth/login`, payload, {
        timeout: timeoutMs,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      console.log('✅ Login response:', res.data);
      
      const { token, user } = res.data;

      if (!token || !user) {
        console.error('❌ Missing token or user in response');
        setError("Invalid response from server.");
        return;
      }

      // Store user data
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem("userName", user.name || user.username);
      setUser(user); // ✅ Update context dynamically

      console.log('✅ Login successful — redirecting to feed page', user.role);
      // After login send everyone to the social feed where uploads from other users are visible
      navigate('/feed');
    } catch (err) {
      console.error("❌ Login failed:", err.response?.data || err.message);
      console.error("❌ Full error:", err);
      
      // Enhanced error handling for mobile
      if (err.code === 'NETWORK_ERROR' || err.message.includes('Network Error')) {
        setError("Network connection failed. Please check your WiFi connection.");
      } else if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
        setError("Request timed out. Please try again.");
      } else if (err.response?.status === 404) {
        setError("Server not found. Please check network connection.");
      } else {
        setError(err.response?.data?.message || "Login failed. Please try again.");
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-50 to-blue-100 dark:from-gray-900 dark:to-gray-800 px-4">
      <ScaleIn>
        <div className="bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-xl shadow-2xl w-full max-w-md card-hover">
          {/* Title */}
          <FadeInUp>
            <h1 className="text-xl sm:text-2xl font-bold mb-6 text-center text-indigo-600 dark:text-indigo-400">
              RMI Teller Report System
            </h1>
          </FadeInUp>

          {/* Error Message */}
          {error && (
            <BounceIn>
              <p className="text-red-500 text-sm mb-3 text-center bg-red-50 dark:bg-red-900/20 p-2 rounded-md">
                {error}
              </p>
            </BounceIn>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <FadeInUp delay={0.1}>
              <div>
                <label
                  htmlFor="login-username"
                  className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300"
                >
                  Username
                </label>
                <input
                  id="login-username"
                  name="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus-ring text-base transition-all duration-200"
                  required
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck="false"
                />
              </div>
            </FadeInUp>

            <FadeInUp delay={0.2}>
              <div>
                <label
                  htmlFor="login-password"
                  className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300"
                >
                  Password
                </label>
                <input
                  id="login-password"
                  name="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus-ring text-base transition-all duration-200"
              required
              autoComplete="current-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
              inputMode="text"
            />
          </div>
            </FadeInUp>

          <FadeInUp delay={0.3}>
            <HoverScale>
              <button
                type="submit"
                className="w-full bg-indigo-600 text-white py-3 rounded-lg btn-effect hover:bg-indigo-700 transition-all duration-200 text-base font-medium shadow-lg"
              >
                Login
              </button>
            </HoverScale>
          </FadeInUp>

          <FadeInUp delay={0.4}>
            <p className="text-sm text-center text-gray-600 dark:text-gray-400 mt-4">
              Don’t have an account?{" "}
              <button
                type="button"
                onClick={() => navigate("/register")}
                className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors duration-200 font-medium"
              >
                Sign up
              </button>
            </p>
          </FadeInUp>
        </form>
      </div>
      </ScaleIn>

      {/* Footer */}
      <FadeInUp delay={0.6}>
        <p className="mt-6 text-sm text-gray-600 dark:text-gray-400">
          © Gideonbot.XY — All Rights Reserved
        </p>
      </FadeInUp>
    </div>
  );
}
