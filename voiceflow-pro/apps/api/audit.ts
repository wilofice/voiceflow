import { prisma } from '@voiceflow-pro/database';
async function main() {
  const t = await prisma.transcript.findMany({
    orderBy: { createdAt: 'desc' },
    take: 3,
    select: { id: true, title: true, audioUrl: true, createdAt: true }
  });
  console.log(JSON.stringify(t, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
