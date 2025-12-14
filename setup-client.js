const http = require('http');
const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:5001';

function request(method, endpoint, data, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, API_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(body ? JSON.parse(body) : null);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function setup() {
  console.log('🚀 Setting up kiosk client...\n');

  try {
    // Step 1: Try to login, or register if needed
    console.log('Step 1: Authenticating...');
    let token;
    try {
      const loginResult = await request('POST', '/auth/login', {
        username: 'admin',
        password: 'admin123',
      });
      token = loginResult.accessToken;
      console.log('✅ Logged in as admin');
    } catch (err) {
      console.log('   No admin user found, creating one...');
      const registerResult = await request('POST', '/auth/register', {
        username: 'admin',
        password: 'admin123',
      });
      token = registerResult.accessToken;
      console.log('✅ Created admin user: admin');
    }

    // Step 2: Create or get device
    console.log('\nStep 2: Registering device...');
    console.log('   Using token:', token.substring(0, 20) + '...');
    let device;
    try {
      device = await request(
        'POST',
        '/devices',
        {
          deviceId: 'dev-001',
          name: 'Test Device',
          description: 'Local development device',
          location: 'Development Machine',
        },
        token
      );
      console.log('✅ Device created: dev-001');
    } catch (err) {
      console.log('   Error details:', err.message);
      if (err.message.includes('already exists') || err.message.includes('409')) {
        console.log('   Device already exists, fetching info...');
        const devices = await request('GET', '/devices', null, token);
        device = devices.find((d) => d.deviceId === 'dev-001');
        if (!device) throw new Error('Could not find device dev-001');
        console.log('✅ Found existing device: dev-001');
      } else {
        throw err;
      }
    }

    // Step 3: Get device token
    console.log('\nStep 3: Getting device token...');
    const tokenResponse = await request('GET', `/devices/${device.id}/token`, null, token);
    const deviceToken = tokenResponse.token;
    console.log('✅ Device token retrieved');

    // Step 4: Update .env file
    console.log('\nStep 4: Updating client configuration...');
    const envPath = path.join(__dirname, 'client', '.env');
    const envContent = `SERVER_URL=http://127.0.0.1:5001
DEVICE_ID=dev-001
DEVICE_TOKEN=${deviceToken}
LOG_LEVEL=info
DISPLAY_WIDTH=1280
DISPLAY_HEIGHT=720
KIOSK_MODE=false
SCREENSHOT_INTERVAL=30000
HEALTH_REPORT_INTERVAL=60000
`;
    fs.writeFileSync(envPath, envContent);
    console.log('✅ Updated client/.env file');

    console.log('\n✅ Setup complete!');
    console.log('\nTo start the client, run:');
    console.log('  cd client && npm start');
    console.log('\nCredentials for admin panel:');
    console.log('  Username: admin');
    console.log('  Password: admin123');
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  }
}

setup();
