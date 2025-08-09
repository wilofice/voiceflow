import { supabaseAdmin, uploadFile, deleteFile, getSignedUrl, AUDIO_BUCKET } from '../lib/supabase';

export class StorageService {
  static async uploadAudioFile(
    userId: string,
    file: Buffer,
    fileName: string,
    mimeType: string
  ): Promise<{ path: string; signedUrl: string }> {
    // Generate a unique path for the file
    const fileExtension = fileName.split('.').pop() || 'mp3';
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 15);
    const filePath = `${userId}/${timestamp}-${randomStr}.${fileExtension}`;

    // Upload the file
    await uploadFile(AUDIO_BUCKET, filePath, file, mimeType);

    // Get a signed URL for immediate access
    const signedUrl = await getSignedUrl(AUDIO_BUCKET, filePath, 3600); // 1 hour

    return { path: filePath, signedUrl };
  }

  static async getFileUrl(filePath: string, expiresIn = 3600): Promise<string> {
    return getSignedUrl(AUDIO_BUCKET, filePath, expiresIn);
  }

  static async deleteAudioFile(filePath: string): Promise<void> {
    await deleteFile(AUDIO_BUCKET, filePath);
  }

  static async getUserStorageUsage(userId: string): Promise<{
    fileCount: number;
    totalSize: number;
  }> {
    const { data, error } = await supabaseAdmin.storage
      .from(AUDIO_BUCKET)
      .list(userId, {
        limit: 1000,
      });

    if (error) {
      throw error;
    }

    let totalSize = 0;
    let fileCount = 0;

    if (data) {
      fileCount = data.length;
      totalSize = data.reduce((sum, file) => sum + (file.metadata?.size || 0), 0);
    }

    return { fileCount, totalSize };
  }
}