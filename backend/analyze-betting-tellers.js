import fetch from 'node-fetch';

async function analyzeBettingTellers() {
  try {
    console.log('Fetching betting event data from RMI API...');

    const response = await fetch('https://rmi-gideon.gtarena.ph/api/m/secure/report/event', {
      method: 'GET',
      headers: {
        'X-TOKEN': 'af9735e1c7857a07f0b078df36842ace',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    console.log('Betting Event Report Structure:');
    console.log('================================');
    console.log('Full response keys:', Object.keys(data));

    if (data.data) {
      console.log('Data keys:', Object.keys(data.data));

      if (data.data.staffReports && Array.isArray(data.data.staffReports)) {
        console.log(`Found ${data.data.staffReports.length} tellers in betting API:`);
        console.log('----------------------------------');

        data.data.staffReports.forEach((staff, i) => {
          console.log(`${i+1}. Username: ${staff.username || 'N/A'} | Name: ${staff.name || 'N/A'}`);
          console.log(`   Bet Amount: ${staff.betAmount || 0} | System Balance: ${staff.systemBalance || 0}`);
          console.log('');
        });
      } else if (data.data.data && data.data.data.staffReports && Array.isArray(data.data.data.staffReports)) {
        console.log(`Found ${data.data.data.staffReports.length} tellers in betting API (nested):`);
        console.log('----------------------------------');

        data.data.data.staffReports.forEach((staff, i) => {
          console.log(`${i+1}. Username: ${staff.username || 'N/A'} | Name: ${staff.name || 'N/A'}`);
          console.log(`   Bet Amount: ${staff.betAmount || 0} | System Balance: ${staff.systemBalance || 0}`);
          console.log('');
        });
      } else {
        console.log('No staffReports found. Available nested keys:');
        if (data.data.data) {
          console.log('data.data keys:', Object.keys(data.data.data));
        }
      }
    } else {
      console.log('No data key found in response');
    }

  } catch (error) {
    console.error('Error fetching betting data:', error);
  }
}

analyzeBettingTellers();