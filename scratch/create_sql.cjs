const fs = require('fs');
const { execSync } = require('child_process');

try {
  const panImg = fs.readFileSync('C:\\Users\\walwani\'s\\.gemini\\antigravity-ide\\brain\\efcec692-a531-463d-8096-749cacb926cf\\dummy_pan_card_1789125365030.jpg');
  const gstImg = fs.readFileSync('C:\\Users\\walwani\'s\\.gemini\\antigravity-ide\\brain\\efcec692-a531-463d-8096-749cacb926cf\\dummy_gst_cert_1789125382551.jpg');

  const panB64 = 'data:image/jpeg;base64,' + panImg.toString('base64');
  const gstB64 = 'data:image/jpeg;base64,' + gstImg.toString('base64');

  const sql = `UPDATE profiles SET document_pan = '${panB64}', document_gst = '${gstB64}', approval_status = 'Pending' WHERE email = 'kyc@test.com';`;

  fs.writeFileSync('e:\\ParamApplication\\scratch\\update_docs.sql', sql);
  
  execSync('docker exec -i supabase_db_ParamApplication psql -U postgres -d postgres < e:\\ParamApplication\\scratch\\update_docs.sql');
  console.log('Update successful');
} catch (e) {
  console.error(e);
}
