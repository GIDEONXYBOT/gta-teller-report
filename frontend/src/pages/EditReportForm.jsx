import React, { useState } from "react";

export default function EditReportForm({ selected, onCancel, onSave }) {
  const [fields, setFields] = useState({
    systemBalance: selected.systemBalance ?? "",
    cashOnHand: selected.cashOnHand ?? "",
    over: selected.over ?? "",
    short: selected.short ?? "",
    date: selected.createdAt ? new Date(selected.createdAt).toISOString().slice(0,10) : (selected.date ? new Date(selected.date).toISOString().slice(0,10) : ""),
    remarks: selected.remarks || ""
  });

  const calcShortOver = (sysVal, cashVal) => {
    const sys = Number(sysVal || 0);
    const cash = Number(cashVal || 0);
    const diff = Number((cash - sys).toFixed(2));
    if (isNaN(diff)) return { over: "", short: "" };
    if (diff > 0) return { over: diff.toFixed(2), short: "" };
    if (diff < 0) return { over: "", short: Math.abs(diff).toFixed(2) };
    return { over: "", short: "" };
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFields((prev) => {
      const next = { ...prev, [name]: value };
      // Auto-calc short/over when systemBalance or cashOnHand changes
      if (name === "systemBalance" || name === "cashOnHand") {
        const { over, short } = calcShortOver(next.systemBalance, next.cashOnHand);
        next.over = over;
        next.short = short;
      }
      return next;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(fields);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded bg-gray-50 dark:bg-gray-900">
      <h3 className="text-lg font-semibold mb-2">Edit Teller Report</h3>
      <div>
        <label className="block text-sm mb-1">System Balance</label>
        <input type="number" name="systemBalance" value={fields.systemBalance} onChange={handleChange} className="input-box w-full" />
      </div>
      <div>
        <label className="block text-sm mb-1">Cash On Hand</label>
        <input type="number" name="cashOnHand" value={fields.cashOnHand} onChange={handleChange} className="input-box w-full" />
      </div>
      <div>
        <label className="block text-sm mb-1">Over</label>
        <input type="number" name="over" value={fields.over} onChange={handleChange} className="input-box w-full" />
      </div>
      <div>
        <label className="block text-sm mb-1">Short</label>
        <input type="number" name="short" value={fields.short} onChange={handleChange} className="input-box w-full" />
      </div>
      <div>
        <label className="block text-sm mb-1">Date</label>
        <input type="date" name="date" value={fields.date} onChange={handleChange} className="input-box w-full" />
      </div>
      <div>
        <label className="block text-sm mb-1">Remarks</label>
        <input type="text" name="remarks" value={fields.remarks} onChange={handleChange} className="input-box w-full" />
      </div>
      <div className="flex gap-3 mt-4">
        <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded">Save</button>
        <button type="button" className="bg-gray-400 text-white px-4 py-2 rounded" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}