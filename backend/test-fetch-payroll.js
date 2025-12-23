import axios from "axios";

const API = "http://localhost:5000";

async function test() {
  try {
    // Get Shane's payroll
    const shaneId = "692f3e1a4119844fba4c88cf";
    
    console.log(`🔍 Fetching payroll for Shane (ID: ${shaneId})...`);
    
    const response = await axios.get(`${API}/api/payroll/user/${shaneId}`);
    
    console.log(`\n✅ Response:`, JSON.stringify(response.data, null, 2));
    
  } catch (err) {
    console.error("❌ Error:", err.response?.data || err.message);
  }
}

test();
