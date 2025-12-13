const http = require('http');

async function fixPlaylist() {
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

          // The API expects "displayDuration" in milliseconds, not "durationSeconds"
          // Setting to 0 = permanent display (no rotation)
          const updateData = JSON.stringify({
            displayDuration: 0  // 0 milliseconds = permanent/static display
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
            let responseData = '';
            updateRes.on('data', chunk => responseData += chunk);
            updateRes.on('end', () => {
              if (updateRes.statusCode === 200) {
                const result = JSON.parse(responseData);
                console.log('✅ Playlist item updated successfully!');
                console.log('   Duration:', result.durationSeconds, 'seconds (0 = permanent/static)');
                console.log('   Full response:', responseData);

                if (result.durationSeconds === 0) {
                  console.log('\n🎉 SUCCESS! Browser will no longer refresh!');
                } else {
                  console.log('\n⚠️  Warning: Duration is', result.durationSeconds, '- expected 0');
                }
                resolve();
              } else {
                console.error('❌ Failed:', updateRes.statusCode, responseData);
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

console.log('🔧 Setting playlist item to PERMANENT display (no rotation)...\n');
fixPlaylist()
  .then(() => {
    console.log('\n✅ Done! Restart the client to see the change.');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  });
