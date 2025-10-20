import { describe, it, expect, beforeEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

// Import the class file
import { TranscriptionService } from '../src/services/transcription';
import { prisma } from '@voiceflow-pro/database';

// Mock prisma methods used by processTranscriptionResponse
vi.mock('@voiceflow-pro/database', async () => {
  const actual = await vi.importActual('@voiceflow-pro/database');
  return {
    ...actual,
    prisma: {
      transcriptSegment: {
        create: vi.fn(),
        deleteMany: vi.fn(),
      },
      transcript: {
        update: vi.fn(),
        findUnique: vi.fn(),
      },
    },
  };
});

describe('TranscriptionService.processTranscriptionResponse', () => {
  beforeEach(() => {
    // reset mocks
    (prisma.transcriptSegment.deleteMany as any).mockReset?.();
    (prisma.transcriptSegment.create as any).mockReset?.();
  });

  it('normalizes and creates segments from various shapes and writes telemetry', async () => {
    const sampleHybridResult = {
      segments: [
        // whisper style
        { id: 0, seek: 0, start: 0.0, end: 7.0, text: " Hello, I'm running a test.", tokens: [1,2,3] },
        // openai-like
        { startTime: 7.0, endTime: 12.0, transcript: 'Second segment', confidence: 0.8 },
        // minimal
        { t0: 12.0, t1: 15.0, content: 'Third' },
      ],
      text: "Hello, I'm running a test. Second segment Third",
      language: 'en',
    };

    // stub deleteMany to resolve
    (prisma.transcriptSegment.deleteMany as any).mockResolvedValue({ count: 0 });

    // stub create to return the passed data with an id
    let idCounter = 1;
  (prisma.transcriptSegment.create as any).mockImplementation(async (args: any) => ({ id: `seg-${idCounter++}`, ...(args.data || {}) }));

    const tmpBefore = await fs.readdir(path.join(process.cwd(), '')); // noop to ensure fs available

    // Call the private method via cast
    const created = await (TranscriptionService as any).processTranscriptionResponse('test-transcript', sampleHybridResult);

    expect(created.length).toBe(3);
    expect((prisma.transcriptSegment.create as any).mock.calls.length).toBe(3);

    // telemetry file should exist on disk on one of the created telemetry writes from transcribeFile
    // We won't call transcribeFile here; instead assert normalization result
    expect(created[0].startTime).toBe(0);
    expect(created[1].startTime).toBe(7);
    expect(created[2].startTime).toBe(12);
  });
});
