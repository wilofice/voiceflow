import 'dotenv/config';
import { PrismaClient } from '@voiceflow-pro/database';

const prisma = new PrismaClient();

async function main() {
    const trans = await prisma.transcript.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            title: true,
            audioUrl: true,
            status: true,
            createdAt: true
        }
    });
    console.log(JSON.stringify(trans, null, 2));
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
