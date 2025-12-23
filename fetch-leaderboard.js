const axios = require('axios');
const cheerio = require('cheerio');

async function fetchLeaderboardData() {
    try {
        const response = await axios.get('https://rmi-gideon.gtarena.ph/leaderboard');
        const $ = cheerio.load(response.data);

        // Extract the JSON data from the data-page attribute
        const dataPage = $('#app').attr('data-page');
        const pageData = JSON.parse(dataPage);

        // Extract the draws data
        const draws = pageData.props.draws;

        console.log('Recent draws:', draws.length);
        console.log('Latest draw:', draws[0]);

        return draws;
    } catch (error) {
        console.error('Error fetching leaderboard data:', error);
        return null;
    }
}

// Usage
fetchLeaderboardData().then(data => {
    if (data) {
        // Process your leaderboard data here
        data.forEach(draw => {
            console.log(`Draw ${draw.id}: ${draw.result1} - Total Bets: ${draw.totalBets}`);
        });
    }
});