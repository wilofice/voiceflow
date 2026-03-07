import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addStoragePolicy() {
    console.log('Adding RLS policy to storage.objects...');
    try {
        await prisma.$executeRawUnsafe(`
      CREATE POLICY "Allow service role full access" 
      ON storage.objects FOR ALL 
      TO service_role 
      USING (true) 
      WITH CHECK (true);
    `);
        console.log('Policy added successfully for service_role.');
    } catch (err: any) {
        if (err.message.includes('already exists')) {
            console.log('Policy already exists.');
        } else {
            console.error('Error adding policy:', err.message);
        }
    }

    try {
        await prisma.$executeRawUnsafe(`
      CREATE POLICY "Allow anon insert" 
      ON storage.objects FOR INSERT 
      TO public 
      WITH CHECK ( bucket_id = 'audio-files' );
    `);
        console.log('Policy added successfully for public insert.');
    } catch (err: any) {
        console.error('Error adding public policy:', err.message);
    }

    await prisma.$disconnect();
}

addStoragePolicy();
