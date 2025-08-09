import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase environment variables');
}

// Admin client for server-side operations
export const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Verify Supabase JWT token
export async function verifySupabaseToken(token: string) {
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    
    if (error || !user) {
      return null;
    }
    
    return user;
  } catch (error) {
    console.error('Error verifying Supabase token:', error);
    return null;
  }
}

// Get user by ID
export async function getUserById(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();
    
  if (error) {
    console.error('Error fetching user:', error);
    return null;
  }
  
  return data;
}

// Storage helpers
export const AUDIO_BUCKET = 'audio-files';

export async function createStorageBucket() {
  const { data, error } = await supabaseAdmin.storage.createBucket(AUDIO_BUCKET, {
    public: false,
    fileSizeLimit: 2147483648, // 2GB
    allowedMimeTypes: [
      'audio/mpeg',
      'audio/wav',
      'audio/mp4',
      'audio/ogg',
      'audio/opus',
      'video/quicktime',
      'video/mp4',
    ],
  });

  if (error && !error.message.includes('already exists')) {
    throw error;
  }

  return data;
}

export async function uploadFile(
  bucketName: string,
  filePath: string,
  file: Buffer,
  contentType: string
) {
  const { data, error } = await supabaseAdmin.storage
    .from(bucketName)
    .upload(filePath, file, {
      contentType,
      upsert: false,
    });

  if (error) {
    throw error;
  }

  return data;
}

export async function getSignedUrl(bucketName: string, filePath: string, expiresIn = 3600) {
  const { data, error } = await supabaseAdmin.storage
    .from(bucketName)
    .createSignedUrl(filePath, expiresIn);

  if (error) {
    throw error;
  }

  return data.signedUrl;
}

export async function deleteFile(bucketName: string, filePath: string) {
  const { error } = await supabaseAdmin.storage
    .from(bucketName)
    .remove([filePath]);

  if (error) {
    throw error;
  }
}