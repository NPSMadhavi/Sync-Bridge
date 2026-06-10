const fetch = require('node-fetch');

async function testAssetsFetch() {
  try {
    console.log('Testing assets fetch...');
    
    // Test the assets endpoint
    const response = await fetch('http://localhost:3000/api/assets', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    console.log('Response status:', response.status);
    
    if (response.ok) {
      const assets = await response.json();
      console.log('Assets fetched successfully:', assets.length, 'assets found');
      if (assets.length > 0) {
        console.log('Sample asset:', assets[0]);
      }
    } else {
      const error = await response.text();
      console.log('Error response:', error);
    }
  } catch (error) {
    console.error('Error testing assets fetch:', error.message);
  }
}

testAssetsFetch(); 