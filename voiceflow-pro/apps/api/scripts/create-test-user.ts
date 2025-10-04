import 'dotenv/config';
import { supabaseAdmin } from '../src/lib/supabase'; // adjust path if you put this elsewhere

async function createTestUser() {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: 'test-user@example.com',
    password: 'Gazerty123!',
    email_confirm: true,           // marks the user as verified immediately
    user_metadata: {
      name: 'Test User',
      source: 'admin-seed',
    },
  });

  if (error) {
    console.error('Failed to create user:', error);
    process.exit(1);
  }

  console.log('Created user:', data.user?.id, data.user?.email);
}

createTestUser();