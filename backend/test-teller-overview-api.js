// Quick test of the admin teller overview API endpoint
import axios from "axios";

const API_BASE = "http://192.168.0.167:5000/api";

async function testTellerOverviewAPI() {
  try {
    console.log("🧪 Testing admin teller overview API...");
    
    const response = await axios.get(`${API_BASE}/admin/teller-overview`, {
      params: { date: "2025-11-13" }
    });
    
    console.log("✅ API Response received:");
    console.log("- Success:", response.data.success);
    console.log("- Tellers count:", response.data.tellers?.length || 0);
    console.log("- Summary:", response.data.summary);
    
    if (response.data.tellers?.length > 0) {
      console.log("\n📋 Sample teller data:");
      response.data.tellers.slice(0, 3).forEach(teller => {
        console.log(`  - ${teller.name} (${teller.username}) - Capital: ₱${teller.capital || 0}`);
      });
    }
    
  } catch (error) {
    console.error("❌ API Test Failed:");
    console.error("- Status:", error.response?.status);
    console.error("- Message:", error.response?.data?.message || error.message);
    console.error("- Full error:", error.response?.data);
  }
}

testTellerOverviewAPI();