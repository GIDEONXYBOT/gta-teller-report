import axios from 'axios';

// Test the API endpoint directly
async function testResultsAPI() {
  try {
    console.log('🧪 Testing Chicken Fight Results API\n');

    const backendUrl = 'https://rmi-backend-zhdr.onrender.com';
    
    // Create a test token (you'd need a real one)
    const testGameDate = new Date().toISOString().split('T')[0];
    
    console.log(`📝 Test Data:`);
    console.log(`  Backend: ${backendUrl}`);
    console.log(`  Endpoint: /api/chicken-fight/game/results`);
    console.log(`  Game Date: ${testGameDate}`);

    // Test with sample data (without authentication)
    const testData = {
      gameDate: testGameDate,
      entryResults: [
        {
          entryId: '507f1f77bcf86cd799439011',
          entryName: 'Test Entry A',
          gameType: '2wins',
          legResults: [
            { legNumber: 1, result: 'win' }
          ]
        }
      ]
    };

    console.log(`\n📤 Sending request...`);
    
    try {
      const response = await axios.put(
        `${backendUrl}/api/chicken-fight/game/results`,
        testData,
        { 
          headers: { 
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json'
          },
          timeout: 5000
        }
      );

      console.log('✅ API Response:', response.data);
    } catch (apiError) {
      if (apiError.response) {
        console.log('❌ API Error Response:');
        console.log(`  Status: ${apiError.response.status}`);
        console.log(`  Message: ${apiError.response.data?.message || apiError.message}`);
      } else if (apiError.code === 'ECONNABORTED') {
        console.log('❌ Request timeout - backend may be sleeping on Render');
      } else {
        console.log('❌ Network Error:', apiError.message);
      }
    }

  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

testResultsAPI();
