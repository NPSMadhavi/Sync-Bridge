const http = require('http');

async function testEmployeeAPI() {
  console.log('🔍 Testing Employee API Endpoint...\n');
  
  // Test data that matches the form schema
  const testEmployeeData = {
    employeeId: "EMP_TEST_001",
    name: "Test Employee",
    department: "IT",
    designation: "Developer",
    joinDate: new Date().toISOString(),
    status: "active",
    nationality: "foreigner",
    finNumber: "F1234567A",
    passportNumber: "A12345678",
    passportExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    visaNumber: "V1234567",
    visaExpiry: new Date(Date.now() + 730 * 24 * 60 * 60 * 1000).toISOString(),
    visaType: "employment_pass",
    visaRemarks: "Test remarks"
  };
  
  console.log('📋 Test Employee Data:');
  console.log(JSON.stringify(testEmployeeData, null, 2));
  
  const postData = JSON.stringify(testEmployeeData);
  
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/employees',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };
  
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`\n📊 Response Status: ${res.statusCode}`);
        console.log('📋 Response Headers:', res.headers);
        
        try {
          const responseData = JSON.parse(data);
          console.log('📄 Response Body:');
          console.log(JSON.stringify(responseData, null, 2));
          
          if (res.statusCode === 201) {
            console.log('✅ Employee created successfully!');
          } else if (res.statusCode === 400) {
            console.log('❌ Validation error occurred:');
            if (responseData.errors) {
              responseData.errors.forEach((error, index) => {
                console.log(`   ${index + 1}. Field: ${error.path.join('.')} - ${error.message}`);
              });
            }
          } else {
            console.log('❌ Unexpected response');
          }
        } catch (parseError) {
          console.log('📄 Raw Response:', data);
        }
        
        resolve();
      });
    });
    
    req.on('error', (error) => {
      console.error('❌ Request failed:', error.message);
      reject(error);
    });
    
    req.write(postData);
    req.end();
  });
}

testEmployeeAPI().catch(console.error); 