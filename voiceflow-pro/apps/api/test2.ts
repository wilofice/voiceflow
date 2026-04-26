import 'dotenv/config';
import { PrismaClient } from '@voiceflow-pro/database';

const prisma = new PrismaClient();

async function main() {
  const trans = await prisma.transcript.findUnique({
    where: { id: "5a23ee4b-379f-442d-91dc-ebea4362d323" },
    select: { id: true, title: true, audioUrl: true, createdAt: true }
  });
  console.log(JSON.stringify(trans, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
