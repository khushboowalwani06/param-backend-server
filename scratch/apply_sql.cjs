const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function applySql() {
  const connectionString = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('Connected to Supabase PostgreSQL database.');

    const sqlPath = path.join(__dirname, 'outstanding_flow_fix.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Applying SQL script...');
    await client.query(sql);
    console.log('SQL script applied successfully.');

  } catch (err) {
    console.error('Error applying SQL:', err);
  } finally {
    await client.end();
  }
}

applySql();
