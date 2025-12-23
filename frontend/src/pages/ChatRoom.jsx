import React, { useEffect, useState, useRef, useContext, useMemo } from "react";
import axios from "axios";
import io from "socket.io-client";
import { SettingsContext } from "../context/SettingsContext";
import { Send, MessageCircle, Trash2, Circle, Check, CheckCheck, Phone, PhoneOff } from "lucide-react";
import { NOTIFICATION_SOUND } from "../utils/constants.js";
import { getSocket } from "../socket";
import { getApiUrl } from "../utils/apiConfig";

let globalSocket = null;

export default function FloatingChat() {
  const API = getApiUrl();
  const { user, settings } = useContext(SettingsContext);
  const dark = settings?.theme?.mode === "dark";

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [typingUser, setTypingUser] = useState(null);

  const chatBoxRef = useRef(null);
  const messagesEndRef = useRef(null);
  const dingSound = useRef(null);
  const textareaRef = useRef(null);

  // ✅ SOCKET SETUP (DISABLED - Socket.IO not available)
  useEffect(() => {
    if (!user?._id) return;

    // Socket.IO disabled on backend - skip socket setup
    console.log('🔇 Chat socket disabled - Socket.IO not available on backend');
    return;
  }, [user?._id]);

  // ✅ LOAD CHAT HISTORY
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const params = selectedUser ? { userId: user._id, receiverId: selectedUser._id } : {};
        const res = await axios.get(`${API}/api/chat`, { params });
        setMessages(res.data.messages || []);
        scrollToBottom();
      } catch {
        setMessages([]);
      }
    };
    load();
  }, [user, selectedUser]);

  // ✅ Outside click close
  useEffect(() => {
    const handleClick = (e) => {
      if (isOpen && chatBoxRef.current && !chatBoxRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  // ✅ Always scroll to latest
  const scrollToBottom = () => {
    if (!messagesEndRef.current) return;
    requestAnimationFrame(() => {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  };
  useEffect(scrollToBottom, [messages]);

  // ✅ Formatting
  const formatTime = (d) =>
    new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const formatDay = (d) => {
    const date = new Date(d);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) return "Today";
    const y = new Date();
    y.setDate(now.getDate() - 1);
    if (date.toDateString() === y.toDateString()) return "Yesterday";
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };
  const grouped = useMemo(() => {
    const g = {};
    messages.forEach((m) => {
      const d = formatDay(m.createdAt);
      if (!g[d]) g[d] = [];
      g[d].push(m);
    });
    return g;
  }, [messages]);

  // ✅ Send message
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const msg = {
      _id: Date.now().toString(),
      senderId: user._id,
      senderName: user.name || "You",
      role: user.role || "user",
      receiverId: selectedUser?._id || null,
      text: input.trim(),
      createdAt: new Date(),
      seen: false,
    };

    try {
      // 1️⃣ Save to backend (DB)
      await axios.post(`${API}/api/chat`, msg);

      // 2️⃣ Emit live via socket
      if (globalSocket && globalSocket.connected) {
        globalSocket.emit("sendMessage", msg);
      }

      // 3️⃣ Add to sender’s screen immediately
      setMessages((prev) => [...prev, msg]);
      setInput("");
      scrollToBottom();
    } catch (err) {
      console.error("❌ Send failed:", err);
    }
  };

  // ✅ Typing
  const handleTyping = (e) => {
    setInput(e.target.value);
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
    globalSocket?.emit("typing", {
      userId: user._id,
      name: user.name,
      receiverId: selectedUser?._id || null,
    });
  };

  // ✅ Seen messages
  useEffect(() => {
    if (!isOpen || !selectedUser) return;
    const unseenMessages = messages.filter(
      (m) => !m.seen && m.receiverId === user._id
    );
    unseenMessages.forEach((m) => {
      globalSocket?.emit("messageSeen", m._id);
    });
  }, [isOpen, messages, selectedUser]);

  const deleteAll = async () => {
    if ((user.role !== "admin" && user.role !== "super_admin") || !confirm("⚠️ Delete all messages?")) return;
    try {
      await axios.delete(`${API}/api/chat`);
      setMessages([]);
      if (globalSocket && globalSocket.connected) {
        globalSocket.emit("messagesCleared");
      }
    } catch (err) {
      console.error("❌ Delete failed:", err);
    }
  };

  // ✅ Helper: online status
  const isUserOnline = (id) => onlineUsers.some((u) => u._id === id);

  return (
    <>
      <audio
        ref={dingSound}
        src={NOTIFICATION_SOUND}
        preload="auto"
        onError={(e) => console.warn("Audio not loaded:", e.target.error)}
      />

      {!isOpen && (
        <button
          onClick={() => {
            setIsOpen(true);
            setUnreadCount(0);
          }}
          className="!fixed !bottom-6 !right-6 z-[9999] bg-indigo-600 text-white p-4 rounded-full shadow-lg hover:bg-indigo-700 transition relative"
        >
          <MessageCircle className="w-6 h-6" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-600 text-xs px-1.5 py-0.5 rounded-full text-white font-semibold shadow">
              {unreadCount}
            </span>
          )}
        </button>
      )}

      {isOpen && (
        <div
          ref={chatBoxRef}
          className={`!fixed !bottom-20 !right-6 z-[9999] w-80 h-[470px] rounded-2xl shadow-2xl border backdrop-blur-lg ${
            dark
              ? "bg-gray-900/90 border-gray-700 text-gray-100"
              : "bg-white/90 border-gray-300 text-gray-900"
          } flex flex-col`}
        >
          {/* Header */}
          <div
            className={`flex flex-col p-3 rounded-t-2xl ${
              dark ? "bg-gray-800" : "bg-indigo-600 text-white"
            }`}
          >
            <div className="flex justify-between items-center">
              <span className="font-semibold tracking-wide flex items-center gap-2">
                💬{" "}
                {selectedUser ? (
                  <>
                    Chat with {selectedUser.name}
                    <Circle
                      size={10}
                      className={
                        isUserOnline(selectedUser._id)
                          ? "text-green-400"
                          : "text-gray-400"
                      }
                      fill={isUserOnline(selectedUser._id) ? "green" : "gray"}
                    />
                    <span className="text-xs opacity-80">
                      {isUserOnline(selectedUser._id) ? "Online" : "Offline"}
                    </span>
                  </>
                ) : (
                  "Group Chat"
                )}
              </span>
              <div className="flex items-center gap-2">
                {(user.role === "admin" || user.role === "super_admin") && (
                  <button onClick={deleteAll} title="Delete all">
                    <Trash2 size={18} />
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="font-bold hover:opacity-80"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Online user selector */}
            <select
              value={selectedUser?._id || ""}
              onChange={(e) => {
                const id = e.target.value;
                const found = onlineUsers.find((u) => u._id === id);
                setSelectedUser(found || null);
              }}
              className={`mt-2 text-sm rounded-lg px-2 py-1 border ${
                dark
                  ? "bg-gray-700 border-gray-600 text-gray-100"
                  : "bg-white/25 text-white"
              }`}
            >
              <option value="">Group Chat (All)</option>
              {onlineUsers.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name} ({u.role}) 🟢
                </option>
              ))}
            </select>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {Object.keys(grouped).map((day) => (
              <div key={day}>
                <div className="text-center text-xs mb-2 opacity-70 italic">
                  {day}
                </div>
                {grouped[day].map((msg) => (
                  <div
                    key={msg._id}
                    className={`flex ${
                      msg.senderId === user._id
                        ? "justify-end"
                        : "justify-start"
                    }`}
                  >
                    <div
                      className={`px-3 py-2 rounded-2xl max-w-[75%] break-words whitespace-pre-wrap ${
                        msg.senderId === user._id
                          ? "bg-indigo-600 text-white"
                          : dark
                          ? "bg-gray-700 text-gray-100"
                          : "bg-gray-200 text-gray-900"
                      }`}
                    >
                      <p className="text-xs opacity-70 mb-1">
                        {msg.senderName} ({msg.role})
                      </p>
                      <p className="text-sm leading-snug">{msg.text}</p>
                      <div className="flex justify-between items-center mt-1 text-[10px] opacity-80">
                        <span>🕒 {formatTime(msg.createdAt)}</span>
                        {msg.senderId === user._id && (
                          <span className="flex items-center gap-1">
                            {msg.seen ? (
                              <>
                                <CheckCheck
                                  size={12}
                                  className="text-blue-400"
                                />
                                Seen
                              </>
                            ) : (
                              <>
                                <Check size={12} className="text-gray-300" />
                                Sent
                              </>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {typingUser && (
              <div
                className={`text-xs italic mt-1 ${
                  dark ? "text-white" : "text-black"
                }`}
              >
                ✍️ {typingUser} is typing...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={sendMessage} className="p-3 border-t flex gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleTyping}
              rows={1}
              placeholder={
                selectedUser ? `Message ${selectedUser.name}...` : "Type message..."
              }
              className={`flex-1 resize-none overflow-hidden px-3 py-2 rounded-lg border focus:ring-2 focus:ring-indigo-500 ${
                dark
                  ? "bg-gray-800 border-gray-600 text-white placeholder-gray-400"
                  : "bg-white border-gray-300 text-black placeholder-gray-500"
              }`}
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
