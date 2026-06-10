const { Pool } = require('pg');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, 'server', '.env') });

async function testCustomers() {
  console.log('🔍 Testing Customer Functionality...\n');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:Welcome123@localhost:5432/syncbridge'
  });
  
  try {
    // Check if customers table exists and has data
    console.log('📊 Checking customers table...');
    const tableInfo = await pool.query(`
      SELECT column_name, is_nullable, data_type, column_default
      FROM information_schema.columns 
      WHERE table_name = 'customers' 
      ORDER BY ordinal_position
    `);
    
    if (tableInfo.rows.length === 0) {
      console.log('❌ Customers table does not exist');
      return;
    }
    
    console.log('Customers table columns:');
    tableInfo.rows.forEach(col => {
      const required = col.is_nullable === 'NO' ? 'REQUIRED' : 'OPTIONAL';
      console.log(`   ${col.column_name}: ${col.data_type} (${required})`);
    });
    
    // Check existing customers
    console.log('\n📋 Checking existing customers...');
    const existingCustomers = await pool.query('SELECT id, name, company, email FROM customers LIMIT 5');
    
    if (existingCustomers.rows.length === 0) {
      console.log('No customers found. Creating test customers...');
      
      // Get a tenant ID
      const tenants = await pool.query('SELECT id FROM tenants LIMIT 1');
      if (tenants.rows.length === 0) {
        console.log('❌ No tenants found. Cannot create customers.');
        return;
      }
      
      const tenantId = tenants.rows[0].id;
      console.log(`Using tenant ID: ${tenantId}`);
      
      // Create test customers
      const testCustomers = [
        {
          name: 'John Smith',
          company: 'ABC Corporation',
          email: 'john.smith@abccorp.com',
          phone: '+65 9123 4567',
          address: '123 Business Street',
          city: 'Singapore',
          state: 'Singapore',
          zipCode: '123456',
          country: 'Singapore',
          taxId: 'T12345678A',
          website: 'www.abccorp.com',
          industry: 'Technology',
          notes: 'Premium customer',
          tenantId: tenantId
        },
        {
          name: 'Jane Doe',
          company: 'XYZ Industries',
          email: 'jane.doe@xyzindustries.com',
          phone: '+65 8765 4321',
          address: '456 Industrial Avenue',
          city: 'Singapore',
          state: 'Singapore',
          zipCode: '654321',
          country: 'Singapore',
          taxId: 'T87654321B',
          website: 'www.xyzindustries.com',
          industry: 'Manufacturing',
          notes: 'Regular customer',
          tenantId: tenantId
        }
      ];
      
      for (const customerData of testCustomers) {
        try {
          const result = await pool.query(`
            INSERT INTO customers (
              name, company, email, phone, address, city, state, zip_code, 
              country, tax_id, website, industry, notes, tenant_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            RETURNING id, name, company
          `, [
            customerData.name,
            customerData.company,
            customerData.email,
            customerData.phone,
            customerData.address,
            customerData.city,
            customerData.state,
            customerData.zipCode,
            customerData.country,
            customerData.taxId,
            customerData.website,
            customerData.industry,
            customerData.notes,
            customerData.tenantId
          ]);
          
          console.log(`✅ Created customer: ${result.rows[0].name} (${result.rows[0].company})`);
        } catch (error) {
          console.error(`❌ Failed to create customer ${customerData.name}:`, error.message);
        }
      }
    } else {
      console.log('Existing customers:');
      existingCustomers.rows.forEach(customer => {
        console.log(`   ${customer.id}: ${customer.name} - ${customer.company || 'No company'} - ${customer.email || 'No email'}`);
      });
    }
    
    // Test the API endpoint
    console.log('\n🔄 Testing customer API endpoint...');
    const http = require('http');
    
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/customers',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    return new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          console.log(`📊 API Response Status: ${res.statusCode}`);
          
          try {
            const responseData = JSON.parse(data);
            if (res.statusCode === 200) {
              console.log(`✅ API returned ${responseData.length} customers`);
              if (responseData.length > 0) {
                console.log('Sample customers from API:');
                responseData.slice(0, 3).forEach(customer => {
                  console.log(`   ${customer.id}: ${customer.name} - ${customer.company || 'No company'}`);
                });
              }
            } else {
              console.log('❌ API error:', responseData);
            }
          } catch (parseError) {
            console.log('📄 Raw Response:', data);
          }
          
          resolve();
        });
      });
      
      req.on('error', (error) => {
        console.error('❌ API request failed:', error.message);
        console.log('💡 Make sure the backend server is running on port 5000');
        resolve();
      });
      
      req.end();
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await pool.end();
  }
}

testCustomers().catch(console.error); 