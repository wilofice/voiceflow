/**
 * Audio processing utilities for Whisper
 * Handles various audio formats and converts them to PCM data suitable for Whisper
 */

export class AudioProcessor {
  private audioContext: AudioContext | null = null;

  constructor() {
    // Initialize audio context lazily
  }

  /**
   * Process an audio file and convert it to PCM Float32Array
   * Handles various formats including M4A, MP3, WAV, etc.
   */
  async processAudioFile(file: File): Promise<Float32Array> {
    console.log(`Processing audio file: ${file.name} (${file.type}, ${file.size} bytes)`);
    
    // Try multiple methods to decode the audio
    const methods = [
      () => this.decodeWithAudioContext(file),
      () => this.decodeWithOfflineContext(file),
      () => this.decodeWithFileReader(file),
    ];

    for (const method of methods) {
      try {
        const result = await method();
        if (result && result.length > 0) {
          console.log(`Successfully decoded audio: ${result.length} samples`);
          return result;
        }
      } catch (error) {
        console.warn(`Decoding method failed:`, error);
        continue;
      }
    }

    throw new Error(`Unable to decode audio file: ${file.name}. The file may be corrupted or in an unsupported format.`);
  }

  /**
   * Decode using standard AudioContext
   */
  private async decodeWithAudioContext(file: File): Promise<Float32Array> {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer.slice(0));
    
    return this.audioBufferToFloat32Array(audioBuffer);
  }

  /**
   * Decode using OfflineAudioContext for better compatibility
   */
  private async decodeWithOfflineContext(file: File): Promise<Float32Array> {
    const arrayBuffer = await file.arrayBuffer();
    
    // Create a temporary context just for decoding
    const tempContext = new (window.OfflineAudioContext || (window as any).webkitOfflineAudioContext)(
      2, // channels
      44100 * 30, // length (30 seconds at 44.1kHz, will be adjusted)
      44100 // sample rate
    );

    const audioBuffer = await tempContext.decodeAudioData(arrayBuffer.slice(0));
    
    return this.audioBufferToFloat32Array(audioBuffer);
  }

  /**
   * Fallback method using FileReader and manual parsing
   */
  private async decodeWithFileReader(file: File): Promise<Float32Array> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          
          // Try to decode with a fresh AudioContext
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          
          try {
            const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
            const result = this.audioBufferToFloat32Array(audioBuffer);
            ctx.close();
            resolve(result);
          } catch (error) {
            ctx.close();
            reject(error);
          }
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Convert AudioBuffer to mono Float32Array at 16kHz
   */
  private audioBufferToFloat32Array(audioBuffer: AudioBuffer): Float32Array {
    console.log(`Converting audio: ${audioBuffer.numberOfChannels} channels, ${audioBuffer.sampleRate}Hz, ${audioBuffer.length} samples`);
    
    // Step 1: Convert to mono
    let monoData: Float32Array;
    
    if (audioBuffer.numberOfChannels === 1) {
      monoData = new Float32Array(audioBuffer.getChannelData(0));
    } else {
      // Mix multiple channels to mono
      monoData = new Float32Array(audioBuffer.length);
      for (let i = 0; i < audioBuffer.length; i++) {
        let sum = 0;
        for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
          sum += audioBuffer.getChannelData(channel)[i];
        }
        monoData[i] = sum / audioBuffer.numberOfChannels;
      }
      console.log('Converted to mono');
    }

    // Step 2: Resample to 16kHz if needed
    if (audioBuffer.sampleRate !== 16000) {
      console.log(`Resampling from ${audioBuffer.sampleRate}Hz to 16000Hz`);
      monoData = this.resample(monoData, audioBuffer.sampleRate, 16000);
    }

    return monoData;
  }

  /**
   * Resample audio data from one sample rate to another
   */
  private resample(data: Float32Array, fromSampleRate: number, toSampleRate: number): Float32Array {
    const ratio = toSampleRate / fromSampleRate;
    const newLength = Math.floor(data.length * ratio);
    const result = new Float32Array(newLength);

    // Use linear interpolation for resampling
    for (let i = 0; i < newLength; i++) {
      const srcIndex = i / ratio;
      const srcIndexFloor = Math.floor(srcIndex);
      const srcIndexCeil = Math.min(srcIndexFloor + 1, data.length - 1);
      const fraction = srcIndex - srcIndexFloor;
      
      result[i] = data[srcIndexFloor] * (1 - fraction) + data[srcIndexCeil] * fraction;
    }

    console.log(`Resampled: ${data.length} samples -> ${result.length} samples`);
    return result;
  }

  /**
   * Validate audio data
   */
  validateAudioData(data: Float32Array): boolean {
    if (!data || data.length === 0) {
      console.error('Audio data is empty');
      return false;
    }

    // Check for NaN or Infinity values
    for (let i = 0; i < Math.min(data.length, 1000); i++) {
      if (!isFinite(data[i])) {
        console.error(`Invalid audio data at index ${i}: ${data[i]}`);
        return false;
      }
    }

    // Check if audio is not completely silent
    const maxAmplitude = Math.max(...data.slice(0, Math.min(data.length, 10000)).map(Math.abs));
    if (maxAmplitude === 0) {
      console.warn('Audio appears to be completely silent');
    }

    return true;
  }

  /**
   * Clean up resources
   */
  dispose() {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

// Export singleton instance
export const audioProcessor = new AudioProcessor();