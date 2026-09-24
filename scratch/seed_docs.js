const fs = require('fs');
const { execSync } = require('child_process');

try {
  const panImg = fs.readFileSync(C:\\Users\\walwani\\'s\\.gemini\\antigravity-ide\\brain\\efcec692-a531-463d-8096-749cacb926cf\\dummy_pan_card_1789125365030.jpg);
  const gstImg = fs.readFileSync(C:\\Users\\walwani\\'s\\.gemini\\antigravity-ide\\brain\\efcec692-a531-463d-8096-749cacb926cf\\dummy_gst_cert_1789125382551.jpg);

  const panB64 = 'data:image/jpeg;base64,' + panImg.toString('base64');
  const gstB64 = 'data:image/jpeg;base64,' + gstImg.toString('base64');

  // Escape quotes
  const safePan = panB64.replace(/'/g, "''");
  const safeGst = gstB64.replace(/'/g, "''");

  const sql = \
    INSERT INTO profiles (user_id, role, name, company, document_pan, document_gst, approval_status)
    VALUES ('USR-PENDING-KYC', 'customer', 'New KYC User', 'Startup Inc', '\', '\', 'Pending')
    ON CONFLICT (user_id) DO UPDATE SET 
      document_pan = '\',
      document_gst = '\',
      approval_status = 'Pending';
  \;

  fs.writeFileSync('e:\\\\ParamApplication\\\\scratch\\\\seed_docs.sql', sql);
  console.log('SQL generated. Executing...');
  execSync('docker exec -i supabase_db_ParamApplication psql -U postgres -d postgres < e:\\\\ParamApplication\\\\scratch\\\\seed_docs.sql');
  console.log('Success!');
} catch (e) {
  console.error(e);
}
