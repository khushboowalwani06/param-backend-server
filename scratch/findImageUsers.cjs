const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'http://127.0.0.1:8431';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function findUsers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('name, document_pan, document_aadhar')
    .in('role', ['customer', 'dealer', 'retailer']);
    
  if (error) {
    console.error("Error:", error);
    return;
  }
  
  const usersWithImages = data.filter(u => 
    (u.document_pan && u.document_pan.length > 200) || 
    (u.document_aadhar && u.document_aadhar.length > 200)
  );
  
  if (usersWithImages.length > 0) {
    console.log("Customers with actual images uploaded:");
    usersWithImages.forEach(u => console.log("- " + u.name));
  } else {
    console.log("No customers have images uploaded in the database yet.");
  }
}

findUsers();
