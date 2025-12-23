const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/pages/ScheduleRotation.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// Find and replace the fetchSuggestedTellers function
const oldFunc = `  // ✅ Fetch suggested tellers (visible card)
  const fetchSuggestedTellers = async () => {
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const formatted = tomorrow.toISOString().slice(0, 10);

      const token = localStorage.getItem("token");
      const res = await axios.get(\`\${API}/api/schedule/suggest/\${formatted}\`, {
        headers: { Authorization: \`Bearer \${token}\` }
      });
      setSuggestedTellers(res.data.suggestions || []);
    } catch (err) {
      console.error("❌ Failed to load suggested tellers:", err);
    }
  };`;

const newFunc = `  // ✅ Fetch suggested tellers for the currently displayed date
  const fetchSuggestedTellers = async (dateParam = null) => {
    try {
      // Determine which date to use: custom range date or tomorrow
      let dateToFetch;
      if (useCustomDateRange && customRangeStart) {
        // Use the custom date range start date
        dateToFetch = customRangeStart;
        console.log(\`📋 Fetching suggestions for custom date: \${dateToFetch}\`);
      } else if (dateParam) {
        dateToFetch = dateParam;
        console.log(\`📋 Fetching suggestions for provided date: \${dateToFetch}\`);
      } else {
        // Default: tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        dateToFetch = tomorrow.toISOString().slice(0, 10);
        console.log(\`📋 Fetching suggestions for tomorrow: \${dateToFetch}\`);
      }

      const token = localStorage.getItem("token");
      const res = await axios.get(\`\${API}/api/schedule/suggest/\${dateToFetch}\`, {
        headers: { Authorization: \`Bearer \${token}\` }
      });
      setSuggestedTellers(res.data.suggestions || []);
      console.log(\`✅ Loaded \${res.data.suggestions?.length || 0} suggested tellers\${res.data.cached ? ' (cached)' : ''}\`);
    } catch (err) {
      console.error("❌ Failed to load suggested tellers:", err);
      setSuggestedTellers([]);
    }
  };`;

if (content.includes(oldFunc)) {
  content = content.replace(oldFunc, newFunc);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Updated fetchSuggestedTellers function');
} else {
  console.log('❌ Could not find old function. Checking alternative approach...');
  // Try finding the line number  
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('// ✅ Fetch suggested tellers') && lines[i].includes('visible card')) {
      console.log(`Found at line ${i + 1}: ${lines[i]}`);
    }
  }
}
