import React, { useState } from "react";
import { LayoutDashboard, Users, FileText, FileBarChart, Settings } from "lucide-react";

const defaultSidebarConfig = {
  super_admin: [
    { to: '/super_admin/dashboard', icon: <LayoutDashboard size={18} />, text: 'Dashboard' },
    { to: '/super_admin/manage-sidebars', icon: <Settings size={18} />, text: 'Sidebar Control' },
  ],
  admin: [
    { to: '/admin/dashboard', icon: <LayoutDashboard size={18} />, text: 'Dashboard' },
    { to: '/admin/supervisor-report', icon: <Users size={18} />, text: 'Supervisor Reports' },
    { to: '/admin/teller-reports', icon: <FileText size={18} />, text: 'Teller Reports' },
    { to: '/admin/teller-reports/viewer', icon: <FileBarChart size={18} />, text: 'Reports Viewer' },
    { to: '/admin/teller-management', icon: <Users size={18} />, text: 'Teller Management' },
  ],
  supervisor: [
    { to: '/supervisor/dashboard', icon: <LayoutDashboard size={18} />, text: 'Dashboard' },
  ],
  teller: [
    { to: '/teller/dashboard', icon: <LayoutDashboard size={18} />, text: 'Dashboard' },
  ],
};

export default function SuperAdminSidebarControl() {
  const [sidebarConfig, setSidebarConfig] = useState(defaultSidebarConfig);
  const [selectedRole, setSelectedRole] = useState("admin");
  const [newText, setNewText] = useState("");
  const [newTo, setNewTo] = useState("");

  const handleAdd = () => {
    if (!newText || !newTo) return;
    setSidebarConfig((prev) => ({
      ...prev,
      [selectedRole]: [
        ...prev[selectedRole],
        { to: newTo, icon: <Settings size={18} />, text: newText },
      ],
    }));
    setNewText("");
    setNewTo("");
  };

  const handleRemove = (idx) => {
    setSidebarConfig((prev) => ({
      ...prev,
      [selectedRole]: prev[selectedRole].filter((_, i) => i !== idx),
    }));
  };

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h2 className="text-2xl font-bold mb-4">Sidebar Control (Super Admin)</h2>
      <div className="mb-4">
        <label className="font-semibold mr-2">Role:</label>
        <select value={selectedRole} onChange={e => setSelectedRole(e.target.value)} className="border rounded px-2 py-1">
          {Object.keys(sidebarConfig).map(role => (
            <option key={role} value={role}>{role}</option>
          ))}
        </select>
      </div>
      <ul className="mb-4">
        {sidebarConfig[selectedRole].map((item, idx) => (
          <li key={item.to + idx} className="flex items-center gap-2 mb-2">
            <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{item.to}</span>
            <span className="font-semibold">{item.text}</span>
            <button onClick={() => handleRemove(idx)} className="ml-2 px-2 py-1 text-xs bg-red-100 text-red-700 rounded">Remove</button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2 mb-4">
        <input value={newText} onChange={e => setNewText(e.target.value)} placeholder="Link Text" className="border rounded px-2 py-1" />
        <input value={newTo} onChange={e => setNewTo(e.target.value)} placeholder="Path (e.g. /admin/new)" className="border rounded px-2 py-1" />
        <button onClick={handleAdd} className="px-3 py-1 bg-green-600 text-white rounded">Add</button>
      </div>
      <p className="text-xs text-gray-500">Note: This is a demo UI. To persist changes, connect to backend or settings storage.</p>
    </div>
  );
}
