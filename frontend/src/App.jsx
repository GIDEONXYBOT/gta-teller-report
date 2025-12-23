import React, { useEffect, useState } from "react";
import io from "socket.io-client";
import { useToast } from "./context/ToastContext.jsx";
import { getApiUrl } from "./utils/apiConfig.js";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

// Create socket connection lazily when component mounts (in browser, not during build)
let socket = null;
function getSocketApp() {
  // Socket.IO disabled on backend - return null
  console.log('🔇 App socket disabled - Socket.IO not available on backend');
  return null;
}

export default function App() {
  const { showToast } = useToast();
  const [appSocket] = useState(() => getSocketApp());
  const [newDayMessage, setNewDayMessage] = useState(null);

  useEffect(() => {
    if (!appSocket) {
      console.log('🔇 Skipping socket event listeners - socket disabled');
      return;
    }

    appSocket.on("connect", () => {
      console.log("⚡ Connected to server:", appSocket.id);
      showToast({ type: "info", message: "Connected to RMI Server" });
    });

    appSocket.on("toast", (toast) => {
      showToast(toast);
    });

    appSocket.on("disconnect", () => {
      showToast({ type: "warning", message: "Disconnected from server" });
    });

    // ✅ NEW — system reset listener
    appSocket.on("systemReset", (data) => {
      console.log("🌙 System Reset Triggered:", data);
      showToast({
        type: "info",
        message: `New day initialized — ${data.date}`,
      });

      // show banner message
      setNewDayMessage(`🕐 New Day: Teller data reset successfully — ${data.date}`);

      // optional: reload after 3 seconds (to refresh dashboards)
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    });

    return () => {
      appSocket.off("connect");
      appSocket.off("toast");
      appSocket.off("disconnect");
      appSocket.off("systemReset");
    };
  }, [showToast]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white transition-all relative">
      {/* ✅ Banner message shown when daily reset triggers */}
      {newDayMessage && (
        <div className="fixed top-0 left-0 w-full bg-indigo-600 text-white text-center py-2 text-sm font-medium shadow-md z-50 animate-pulse">
          {newDayMessage}
        </div>
      )}

      {/* Your routes are already inside main.jsx */}
      <div className="flex items-center justify-center h-full text-center text-gray-500 p-8">
        RMI Teller Report System Active
      </div>
    </div>
  );
}
