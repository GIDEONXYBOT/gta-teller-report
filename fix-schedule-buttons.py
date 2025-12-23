#!/usr/bin/env python3
import re

file_path = r"c:\Users\Gideon\OneDrive\Desktop\rmi-teller-report\frontend\src\pages\ScheduleRotation.jsx"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Find and replace the section with the previous/next day buttons
old_pattern = r'''        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
          <Clock className="w-5 h-5 text-indigo-500" /> Tomorrow's Assignments
          </h2>

          <div className="flex items-center gap-3 flex-wrap">'''

new_text = '''        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const newDate = new Date(useCustomDateRange && customRangeStart ? customRangeStart : new Date());
                newDate.setDate(newDate.getDate() - 1);
                const newDateStr = newDate.toISOString().slice(0, 10);
                setUseCustomDateRange(true);
                setCustomRangeStart(newDateStr);
                setCustomRangeEnd(newDateStr);
              }}
              className="px-3 py-1.5 text-sm bg-gray-600 text-white rounded-lg hover:opacity-90"
            >
              ← Previous Day
            </button>
            
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-500" /> 
              {useCustomDateRange && customRangeStart ? 
                `Assignments for ${new Date(customRangeStart).toLocaleDateString()}` 
                : "Tomorrow's Assignments"}
            </h2>
            
            <button
              onClick={() => {
                const newDate = new Date(useCustomDateRange && customRangeEnd ? customRangeEnd : new Date());
                newDate.setDate(newDate.getDate() + 1);
                const newDateStr = newDate.toISOString().slice(0, 10);
                setUseCustomDateRange(true);
                setCustomRangeStart(newDateStr);
                setCustomRangeEnd(newDateStr);
              }}
              className="px-3 py-1.5 text-sm bg-gray-600 text-white rounded-lg hover:opacity-90"
            >
              Next Day →
            </button>
          </div>

          <div className="flex items-center gap-3 flex-wrap">'''

# Try the replacement
if old_pattern in content:
    content = content.replace(old_pattern, new_text)
    print("✅ Pattern found and replaced!")
else:
    print("❌ Pattern not found, trying flexible regex...")
    # Try with flexible whitespace
    pattern = r'<div className="flex items-center justify-between mb-4">\s+<h2 className="text-lg font-semibold flex items-center gap-2">\s+<Clock className="w-5 h-5 text-indigo-500" />\s+Tomorrow.s Assignments\s+</h2>\s+<div className="flex items-center gap-3 flex-wrap">'
    if re.search(pattern, content):
        content = re.sub(pattern, new_text, content)
        print("✅ Regex pattern matched and replaced!")
    else:
        print("❌ Could not find pattern")
        exit(1)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ File updated successfully!")
