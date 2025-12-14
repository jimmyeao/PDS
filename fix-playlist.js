const http = require('http');

async function fixPlaylist() {
  // First, login to get a token
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

          // Now update the playlist item
          const updateData = JSON.stringify({
            durationSeconds: null  // null = permanent display, no refreshing
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
                console.log('✅ Playlist item updated - browser will no longer refresh!');
                console.log('   Duration set to NULL (permanent display)');
                resolve();
              } else {
                console.error('❌ Failed to update playlist item:', updateRes.statusCode, updateData);
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

console.log('🔧 Fixing playlist duration to stop constant refreshing...\n');
fixPlaylist()
  .then(() => {
    console.log('\n✅ Done! Restart the client to apply changes.');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  });
