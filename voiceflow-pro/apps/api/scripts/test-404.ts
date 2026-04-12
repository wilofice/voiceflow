import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

async function runTest() {
    const bucket = 'audio-files';
    const targetFile = '0b295286-c948-41b8-8941-0ef6ada0391a/1775976626726-gfj5vvod5ze.mp3';
    console.log(`Getting signed URL for: "${targetFile}"`);
    const { data: urlData, error: urlError } = await supabaseAdmin.storage
        .from(bucket)
        .createSignedUrl(targetFile, 3600);

    if (urlError) {
        console.error('URL FAILED:', urlError);
    } else {
        console.log('URL SUCCESS:', urlData?.signedUrl);
    }
}

runTest().catch(console.error);
