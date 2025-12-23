import os from 'os';

function getLocalIPAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const localIP = getLocalIPAddress();

console.log('\n📱 Mobile Device Setup Instructions:\n');
console.log('1. Make sure your mobile device is on the SAME Wi-Fi network as this computer');
console.log('2. Update your frontend .env file with these values:\n');
console.log(`   VITE_API_URL=http://${localIP}:5000`);
console.log(`   VITE_API_BASE_URL=http://${localIP}:5173\n`);
console.log('3. Restart your frontend dev server');
console.log(`4. Access from mobile browser: http://${localIP}:5173\n`);
console.log('Backend is listening on:');
console.log(`   Local:   http://localhost:5000`);
console.log(`   Network: http://${localIP}:5000\n`);
