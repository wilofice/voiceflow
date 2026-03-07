import 'dotenv/config';
import { supabaseAdmin, AUDIO_BUCKET } from '../src/lib/supabase';
import fs from 'fs';

async function testUpload() {
    console.log('Testing upload to Supabase Storage as admin...');
    const testBuffer = Buffer.from('test file content');
    const testFileName = `test-upload-${Date.now()}.txt`;

    const { data, error } = await supabaseAdmin.storage
        .from(AUDIO_BUCKET)
        .upload(testFileName, testBuffer, {
            contentType: 'audio/mpeg',
            upsert: false,
        });

    if (error) {
        console.error('Upload failed with error:', error);
    } else {
        console.log('Upload successful!', data);
    }
}

testUpload();
