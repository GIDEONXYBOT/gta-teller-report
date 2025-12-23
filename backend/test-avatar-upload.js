import axios from 'axios';
import fetch from 'node-fetch';

const API = process.env.API_URL || 'http://192.168.0.167:5000';

async function run() {
  try {
    console.log('🔐 Logging in as admin');
    let login;
    try {
      login = await axios.post(`${API}/api/auth/login`, { username: 'admin', password: '12345' });
    } catch (le) {
      console.error('❌ Login request failed:', le.response?.status, le.response?.data || le.message);
      throw le;
    }
    const token = login.data?.token;
    if (!token) throw new Error('No token received');

    console.log('📥 Fetching test image from placeholder service');
    let res;
    try {
      res = await fetch('https://via.placeholder.com/256.png');
    } catch (fe) {
      console.error('❌ Failed to fetch placeholder image:', fe.message || fe);
      throw fe;
    }

    const buf = await res.arrayBuffer();
    const base64 = Buffer.from(buf).toString('base64');
    const dataUrl = `data:image/png;base64,${base64}`;

    console.log('📤 Uploading avatar (PUT /api/users/me/avatar)');
    try {
      const resp = await axios.put(`${API}/api/users/me/avatar`, { image: dataUrl }, { headers: { Authorization: `Bearer ${token}` } });
      console.log('✅ Upload response:', resp.data);
    } catch (ue) {
      console.error('❌ Upload failed:', ue.response?.status, ue.response?.data || ue.message);
      throw ue;
    }
  } catch (err) {
    console.error('❌ Test script ended with error:', err.stack || err.message || err);
  }
}

run();
