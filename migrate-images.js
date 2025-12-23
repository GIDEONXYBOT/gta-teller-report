// Migration script to convert existing file-based images to base64
// Run this after backend deployment to migrate existing images

const axios = require('axios');

async function migrateImages() {
  const API_URL = 'https://rmi-backend-zhdr.onrender.com';
  const token = 'your-admin-token-here'; // You'll need to get this from the browser

  try {
    console.log('Starting image migration...');

    while (true) {
      const response = await axios.post(`${API_URL}/api/media/migrate-images`, {}, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Migration batch result:', response.data);

      if (response.data.migrated === 0) {
        console.log('Migration complete!');
        break;
      }

      // Wait a bit between batches
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (error) {
    console.error('Migration failed:', error.response?.data || error.message);
  }
}

// Uncomment to run:
// migrateImages();

module.exports = { migrateImages };