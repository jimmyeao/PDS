const http = require('http');

async function fixPlaylist() {
  // Login
  const loginData = JSON.stringify({
    username: 'admin',
    password: 'admin'
  });

  return new Promise((resolve, reject) => {
    const loginReq = http.request({
      hostname: 'localhost',
      port: 5001,
      path: '/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': loginData.length
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          const { accessToken } = JSON.parse(data);
          console.log('✅ Logged in successfully');

          // Update with durationSeconds = 0 (permanent display)
          const updateData = JSON.stringify({
            durationSeconds: 0  // 0 = permanent, no refreshing
          });

          const updateReq = http.request({
            hostname: 'localhost',
            port: 5001,
            path: '/playlists/items/16',
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': updateData.length,
              'Authorization': `Bearer ${accessToken}`
            }
          }, (updateRes) => {
            let updateData = '';
            updateRes.on('data', chunk => updateData += chunk);
            updateRes.on('end', () => {
              if (updateRes.statusCode === 200) {
                console.log('✅ Playlist item updated!');
                console.log('   Duration set to 0 (PERMANENT - no more refreshing!)');
                console.log('   Response:', updateData);
                resolve();
              } else {
                console.error('❌ Failed:', updateRes.statusCode, updateData);
                reject(new Error('Update failed'));
              }
            });
          });

          updateReq.on('error', reject);
          updateReq.write(updateData);
          updateReq.end();
        } else {
          console.error('❌ Login failed:', res.statusCode, data);
          reject(new Error('Login failed'));
        }
      });
    });

    loginReq.on('error', reject);
    loginReq.write(loginData);
    loginReq.end();
  });
}

console.log('🔧 Setting playlist duration to 0 (permanent display)...\n');
fixPlaylist()
  .then(() => {
    console.log('\n✅ Done! Restart client and backend to apply changes.');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  });
