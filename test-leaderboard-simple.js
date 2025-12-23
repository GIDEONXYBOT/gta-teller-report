// Simple test to verify leaderboard data fetching
async function testLeaderboardAPI() {
  console.log('🧪 Testing Leaderboard API...');

  // Helper function to decode HTML entities
  function decodeHtmlEntities(text) {
    // For Node.js environment, use a simple replacement approach
    return text
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'");
  }

  try {
    const response = await fetch('https://rmi-gideon.gtarena.ph/leaderboard');

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    console.log('✅ Successfully fetched leaderboard HTML');

    // Extract JSON data
    const dataMatch = html.match(/data-page="([^"]*)"/);
    if (!dataMatch) {
      throw new Error('Could not find leaderboard data in response');
    }

    // Decode HTML entities before parsing JSON
    const decodedData = decodeHtmlEntities(dataMatch[1]);
    const pageData = JSON.parse(decodedData);
    const draws = pageData.props.draws;

    console.log(`✅ Successfully parsed ${draws.length} draws from leaderboard`);
    console.log('📊 Sample draw data:', draws[0]);

    // Show some statistics
    const completedDraws = draws.filter(d => d.status === 'completed');
    const totalBets = completedDraws.reduce((sum, d) => sum + d.totalBets, 0);
    const totalAmount = completedDraws.reduce((sum, d) => sum + d.totalBetAmount, 0);

    console.log(`📈 Statistics:`);
    console.log(`   - Completed draws: ${completedDraws.length}`);
    console.log(`   - Total bets: ${totalBets}`);
    console.log(`   - Total bet amount: ₱${totalAmount.toLocaleString()}`);

    return draws;

  } catch (error) {
    console.error('❌ Leaderboard API test failed:', error.message);
    return null;
  }
}

// Run the test
testLeaderboardAPI().then(data => {
  if (data) {
    console.log('🎉 Leaderboard integration test completed successfully!');
  }
});