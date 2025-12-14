const http = require('http');

// Update playlist item to have null duration (permanent display)
const data = JSON.stringify({
  durationSeconds: null  // null = permanent display
});

const options = {
  hostname: 'localhost',
  port: 5001,
  path: '/playlists/items/16',  // Playlist item ID from logs
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length,
    'Authorization': 'Bearer demo-token'  // You'll need a real token
  }
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  res.on('data', (d) => {
    console.log('Response:', d.toString());
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.write(data);
req.end();

console.log('Updating playlist item 16 duration to NULL (permanent)...');
