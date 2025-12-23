import axios from 'axios';
import fetch from 'node-fetch';

const API = process.env.API_URL || 'http://localhost:5000';

async function run() {
  try {
    console.log('🔐 Logging in as admin');
    const login = await axios.post(`${API}/api/auth/login`, { username: '006erika', password: '12345' }, { timeout: 10000 });
    const token = login.data?.token;
    if (!token) throw new Error('No token received');

    console.log('📥 Creating test image buffer using sharp');
    // Create a simple 600x600 solid color PNG using sharp to avoid external network calls
    import('sharp').then(async ({ default: sharp }) => {
      const buf = await sharp({
        create: { width: 600, height: 600, channels: 3, background: { r: 120, g: 160, b: 200 } }
      }).png().toBuffer();
      const base64 = Buffer.from(buf).toString('base64');
    const dataUrl = `data:image/png;base64,${base64}`;

    console.log('📤 Uploading media (POST /api/media/upload)');
    const resp = await axios.post(`${API}/api/media/upload`, { image: dataUrl, caption: 'Smoke test media upload' }, { headers: { Authorization: `Bearer ${token}` }, timeout: 20000 });
    console.log('✅ Upload response:', resp.data);
    process.exit(0);
    }).catch(err => { throw err; });
  } catch (err) {
    console.error('❌ Test failed:');
    if (err.response) {
      console.error('Status:', err.response.status);
      console.error('Data:', err.response.data);
    } else {
      console.error(err.stack || err.message || err);
    }
  }
}

run();
