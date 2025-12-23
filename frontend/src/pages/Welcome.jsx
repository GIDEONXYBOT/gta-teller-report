import React from "react";
import { Link } from "react-router-dom";

export default function Welcome() {
  const user = JSON.parse(localStorage.getItem("rmi_user") || "null");

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">Welcome, {user?.name}</h1>
      <p className="mb-6">Choose an action below:</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {user?.role === "supervisor" && (
          <>
            <Link to="/supervisor" className="p-4 bg-white shadow rounded text-center">Open Teller Form</Link>
            <Link to="/history" className="p-4 bg-white shadow rounded text-center">View My Transactions</Link>
          </>
        )}

        {(user?.role === "admin" || user?.role === "super_admin") && (
          <>
            <Link to="/admin" className="p-4 bg-white shadow rounded text-center">Admin Dashboard</Link>
            <Link to="/history" className="p-4 bg-white shadow rounded text-center">View All Transactions</Link>
          </>
        )}
      </div>
    </div>
  );
}
