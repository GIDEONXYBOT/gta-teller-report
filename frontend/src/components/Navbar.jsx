import React from "react";
import { Link, useNavigate } from "react-router-dom";

export default function Navbar() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("rmi_user") || "null");

  const logout = () => {
    localStorage.removeItem("rmi_token");
    localStorage.removeItem("rmi_user");
    navigate("/login");
  };

  return (
    <nav className="bg-white shadow px-4 py-3">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <div className="font-bold text-lg">RMI Teller Report</div>
        <div className="flex items-center gap-4">
          {user ? (
            <>
              <span className="text-sm">Welcome, {user.name}</span>
              <Link to="/" className="text-sm text-blue-600">Home</Link>
              {(user.role === "admin" || user.role === "super_admin") && <Link to="/admin" className="text-sm text-blue-600">Admin</Link>}
              <Link to="/supervisor" className="text-sm text-blue-600">Teller</Link>
              <button onClick={logout} className="text-sm text-red-600">Logout</button>
            </>
          ) : (
            <Link to="/login" className="text-sm text-blue-600">Login</Link>
          )}
        </div>
      </div>
    </nav>
  );
}
