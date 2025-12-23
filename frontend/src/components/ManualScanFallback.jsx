import React from "react";

// Simple manual fallback component for QR data entry
export function ManualScanFallback({ onSubmit }) {
  const [text, setText] = React.useState("");
  return (
    <div className="flex gap-2">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder='{"d":"<deploymentId>","a":"<assetId>","s":"<seed>"}'
        className="flex-1 px-3 py-2 border rounded"
      />
      <button
        onClick={() => text && onSubmit(text)}
        className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >Submit</button>
    </div>
  );
}
