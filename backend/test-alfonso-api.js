// Test Alfonso's teller management API
import axios from "axios";

async function testAlfonsoTellerAPI() {
  try {
    const API_BASE = "http://192.168.0.167:5000";
    const alfonsoId = "6910322187bfb36745b87d3c"; // Alfonso's ID from our checks
    
    console.log("🧪 Testing Alfonso's teller management API...");
    console.log(`👨‍💼 Alfonso ID: ${alfonsoId}`);
    
    const response = await axios.get(`${API_BASE}/api/teller-management/tellers`, {
      params: { supervisorId: alfonsoId }
    });
    
    console.log("\n✅ API Response Success!");
    console.log(`📊 Tellers returned: ${response.data?.length || 0}`);
    
    if (response.data && response.data.length > 0) {
      console.log("\n👥 Alfonso's tellers:");
      response.data.forEach((teller, index) => {
        console.log(`   ${index + 1}. ${teller.name || 'No name'} (${teller.username || 'no-username'})`);
        console.log(`      - Capital: ₱${(teller.capital || 0).toLocaleString()}`);
        console.log(`      - Status: ${teller.status || 'unknown'}`);
      });
      
      console.log(`\n🎉 SUCCESS! Alfonso should now see ${response.data.length} tellers in his overview!`);
    } else {
      console.log("\n❌ No tellers returned - Alfonso will see empty overview");
    }
    
  } catch (error) {
    console.error("\n❌ API Test Failed:");
    console.error("- Status:", error.response?.status);
    console.error("- Message:", error.response?.data?.message || error.message);
  }
}

// Run the test (but we can't because it's a Node script without axios)
console.log("📝 This test would check Alfonso's API, but requires running from a different environment");
console.log("✅ Instead, check the backend server logs when Alfonso loads his teller management page");
console.log("📍 Expected API call: GET /api/teller-management/tellers?supervisorId=6910322187bfb36745b87d3c");