import 'dotenv/config';
import { supabaseAdmin } from '../src/lib/supabase';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDb() {
    console.log('Checking Auth User (Supabase)...');
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.listUsers();
    if (userError) {
        console.error('Error fetching auth users:', userError);
    } else {
        console.log(`Found ${userData.users.length} auth users.`);
    }

    console.log('Checking User table (Prisma Client)...');
    try {
        const userCount = await prisma.user.count();
        console.log(`User table exists! Count: ${userCount}`);
    } catch (tableError) {
        console.error('Error fetching from User table via Prisma:', tableError);
    } finally {
        await prisma.$disconnect();
    }
}

checkDb();
