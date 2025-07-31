import { PrismaClient, SubscriptionTier, TranscriptStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create demo users
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@voiceflowpro.com' },
    update: {},
    create: {
      email: 'demo@voiceflowpro.com',
      name: 'Demo User',
      subscriptionTier: SubscriptionTier.FREE,
    },
  });

  const proUser = await prisma.user.upsert({
    where: { email: 'pro@voiceflowpro.com' },
    update: {},
    create: {
      email: 'pro@voiceflowpro.com',
      name: 'Pro User',
      subscriptionTier: SubscriptionTier.PRO,
    },
  });

  console.log('👤 Created demo users');

  // Create sample transcripts
  const sampleTranscript = await prisma.transcript.create({
    data: {
      userId: demoUser.id,
      title: 'Sample Meeting Transcript',
      duration: 1800, // 30 minutes
      language: 'en',
      status: TranscriptStatus.COMPLETED,
      audioUrl: 'https://example.com/sample-audio.mp3',
      segments: {
        create: [
          {
            startTime: 0.0,
            endTime: 5.5,
            text: 'Welcome everyone to today\'s meeting.',
            speakerId: 'SPEAKER_1',
            confidence: 0.95,
          },
          {
            startTime: 5.5,
            endTime: 12.3,
            text: 'Let\'s start by reviewing the agenda for today.',
            speakerId: 'SPEAKER_1',
            confidence: 0.92,
          },
          {
            startTime: 12.3,
            endTime: 18.7,
            text: 'First, we\'ll discuss the quarterly results.',
            speakerId: 'SPEAKER_1',
            confidence: 0.94,
          },
          {
            startTime: 18.7,
            endTime: 25.2,
            text: 'Then we\'ll move on to the product roadmap updates.',
            speakerId: 'SPEAKER_1',
            confidence: 0.93,
          },
          {
            startTime: 25.2,
            endTime: 30.8,
            text: 'Thank you for the introduction. I\'d like to share our Q4 performance.',
            speakerId: 'SPEAKER_2',
            confidence: 0.91,
          },
        ],
      },
    },
  });

  // Create another transcript in processing
  const processingTranscript = await prisma.transcript.create({
    data: {
      userId: demoUser.id,
      title: 'Podcast Episode - Tech Trends 2024',
      duration: 3600, // 60 minutes
      language: 'en',
      status: TranscriptStatus.PROCESSING,
      audioUrl: 'https://example.com/podcast-audio.mp3',
    },
  });

  // Create a failed transcript
  const failedTranscript = await prisma.transcript.create({
    data: {
      userId: proUser.id,
      title: 'Corrupted Audio File',
      duration: 0,
      language: 'en',
      status: TranscriptStatus.FAILED,
      audioUrl: 'https://example.com/corrupted-audio.mp3',
    },
  });

  console.log('📝 Created sample transcripts');

  // Add some comments
  await prisma.transcriptComment.create({
    data: {
      transcriptId: sampleTranscript.id,
      userId: proUser.id,
      segmentId: sampleTranscript.segments[0].id,
      content: 'Great opening! Very clear introduction.',
      timestampPosition: 2.5,
    },
  });

  await prisma.transcriptComment.create({
    data: {
      transcriptId: sampleTranscript.id,
      userId: demoUser.id,
      content: 'Action item: Send Q4 report to all stakeholders',
      timestampPosition: 28.0,
    },
  });

  console.log('💬 Created sample comments');

  // Create a share
  await prisma.transcriptShare.create({
    data: {
      transcriptId: sampleTranscript.id,
      sharedById: demoUser.id,
      sharedWithId: proUser.id,
      accessLevel: 'COMMENT',
    },
  });

  console.log('🔗 Created sample share');

  console.log('✅ Database seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });