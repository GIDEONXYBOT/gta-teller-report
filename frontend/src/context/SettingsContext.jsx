import React, { createContext, useEffect, useState } from "react";
import axios from "axios";
import { getSocket } from "../socket";
import { getApiUrl } from "../utils/apiConfig";

export const SettingsContext = createContext();

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  });
  const [userTheme, setUserTheme] = useState(null);

  // Fetch settings from backend (use VITE_API_URL when available)
  const fetchSettings = async () => {
    try {
      // Add timeout and cache busting for fresh data
      // Use longer timeout for mobile on initial load
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const timeout = isMobile ? 45000 : 30000; // 45s for mobile, 30s for desktop on settings fetch
      const res = await axios.get(`${getApiUrl()}/api/settings`, {
        timeout: timeout
      });
      setSettings(res.data);
    } catch (err) {
      // Suppress 429 rate limit errors from console
      if (err.response?.status !== 429) {
        console.error("❌ Failed to fetch settings:", err.message);
      }
      
      // Use default settings if fetch fails (don't block app load)
      console.log("⚠️ Using default settings due to fetch failure");
      setSettings({
        theme: {
          mode: "light",
          lightBg: "#ffffff",
          lightFont: "#000000",
          darkBg: "#1e1e1e",
          darkFont: "#ffffff"
        },
        baseSalaries: {
          teller: 450,
          supervisor: 600,
          admin: 0,
          head_watcher: 450,
          sub_watcher: 400
        }
      });
    } finally {
      setLoading(false);
    }
  };

  // Update settings to backend
  const updateSettings = async (newSettings) => {
    setSettings(newSettings);
    try {
      await axios.put(`${getApiUrl()}/api/settings`, newSettings);
    } catch (err) {
      console.error("❌ Failed to update settings:", err);
    }
  };

  // Update user theme
  const updateUserTheme = async (theme) => {
    if (!user?._id) return;
    
    setUserTheme(theme);
    try {
      const token = localStorage.getItem("token");
      await axios.put(
        `${getApiUrl()}/api/admin/users/${user._id}/theme`,
        { theme },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Update local user object with new theme
      const updatedUser = { ...user, theme };
      setUser(updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));
    } catch (err) {
      console.error("❌ Failed to update user theme:", err);
    }
  };

  // Auto-apply theme globally (use user theme if available, otherwise system theme)
  useEffect(() => {
    if (!settings) return;
    
    const activeTheme = userTheme || user?.theme || settings.theme;
    const html = document.documentElement;

    if (activeTheme.mode === "dark") {
      html.style.backgroundColor = activeTheme.darkBg;
      html.style.color = activeTheme.darkFont;
    } else {
      html.style.backgroundColor = activeTheme.lightBg;
      html.style.color = activeTheme.lightFont;
    }
  }, [settings, userTheme, user]);

  // Load user theme when user changes
  useEffect(() => {
    if (user?.theme) {
      setUserTheme(user.theme);
    }
  }, [user?._id]);

  // ✅ Socket.IO live settings sync
  useEffect(() => {
    fetchSettings();

    const socket = getSocket();
    if (socket) {
      socket.on("settingsUpdated", (updatedSettings) => {
        console.log("📡 Settings updated (live):", updatedSettings);
        setSettings(updatedSettings);
      });

      socket.on("settingsReset", (defaultSettings) => {
        console.log("🔁 Settings reset (live):", defaultSettings);
        setSettings(defaultSettings);
      });

      socket.on("newDayReset", (msg) => {
        console.log("🕛 Scheduler event:", msg.message);
      });

      return () => {
        socket.off("settingsUpdated");
        socket.off("settingsReset");
        socket.off("newDayReset");
      };
    }
  }, []);

  // 💾 Persist user info globally
  useEffect(() => {
    if (user) {
      localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem("userName", user.name || user.username);
    } else {
      localStorage.removeItem("user");
      localStorage.removeItem("userName");
    }
  }, [user]);

  const logout = () => {
    setUser(null);
    localStorage.removeItem("token");
    window.location.href = "/login";
  };

  return (
    <SettingsContext.Provider value={{ 
      settings, 
      updateSettings, 
      loading, 
      user, 
      setUser, 
      logout,
      userTheme,
      updateUserTheme
    }}>
      {children}
    </SettingsContext.Provider>
  );
}
