// Test the teller management API endpoints
import axios from "axios";

const API_BASE = "http://192.168.0.167:5000/api";

async function testAPIs() {
  console.log("🧪 Testing Teller Management APIs...\n");

  try {
    // Test 1: Get all users with role=teller (for form dropdown)
    console.log("1️⃣ Testing /api/users?role=teller");
    const usersRes = await axios.get(`${API_BASE}/users?role=teller`);
    console.log("✅ Success:", usersRes.data.length, "tellers found");
    usersRes.data.forEach(user => {
      console.log(`   - ${user.username} (${user.name}) - ${user.status}`);
    });
    
    console.log("");
    
    // Test 2: Get teller management overview (this is the one likely failing)
    console.log("2️⃣ Testing /api/teller-management/tellers");
    try {
      const mgmtRes = await axios.get(`${API_BASE}/teller-management/tellers`, {
        params: { supervisorId: "673b45845310260c7c2c8b9a" } // Sample supervisor ID from seed data
      });
      console.log("✅ Success:", mgmtRes.data);
    } catch (mgmtErr) {
      console.log("❌ Failed:", mgmtErr.response?.status, mgmtErr.response?.data || mgmtErr.message);
    }
    
    console.log("");
    
    // Test 3: Test schedule/tomorrow endpoint
    console.log("3️⃣ Testing /api/schedule/tomorrow");
    try {
      const scheduleRes = await axios.get(`${API_BASE}/schedule/tomorrow`);
      console.log("✅ Success:", scheduleRes.data);
    } catch (schedErr) {
      console.log("❌ Failed:", schedErr.response?.status, schedErr.response?.data || schedErr.message);
    }
    
  } catch (error) {
    console.error("❌ General error:", error.message);
  }
}

testAPIs();