import * as keytar from 'keytar';
import * as log from 'electron-log';

const SERVICE_NAME = 'VoiceFlowPro';

export class SecureStorageService {
  private static instance: SecureStorageService;

  static getInstance(): SecureStorageService {
    if (!SecureStorageService.instance) {
      SecureStorageService.instance = new SecureStorageService();
    }
    return SecureStorageService.instance;
  }

  private constructor() {
    log.info('SecureStorageService initialized');
  }

  async get(key: string): Promise<string | null> {
    try {
      const value = await keytar.getPassword(SERVICE_NAME, key);
      log.debug(`Retrieved secure value for key: ${key}`);
      return value;
    } catch (error) {
      log.error(`Failed to get secure value for key ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    try {
      await keytar.setPassword(SERVICE_NAME, key, value);
      log.debug(`Stored secure value for key: ${key}`);
    } catch (error) {
      log.error(`Failed to set secure value for key ${key}:`, error);
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const result = await keytar.deletePassword(SERVICE_NAME, key);
      if (result) {
        log.debug(`Deleted secure value for key: ${key}`);
      } else {
        log.warn(`No secure value found for key: ${key}`);
      }
    } catch (error) {
      log.error(`Failed to delete secure value for key ${key}:`, error);
      throw error;
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      const value = await keytar.getPassword(SERVICE_NAME, key);
      return value !== null;
    } catch (error) {
      log.error(`Failed to check secure value for key ${key}:`, error);
      return false;
    }
  }

  async clear(): Promise<void> {
    try {
      // Get all credentials for our service
      const credentials = await keytar.findCredentials(SERVICE_NAME);
      
      // Delete each credential
      const deletePromises = credentials.map(cred => 
        keytar.deletePassword(SERVICE_NAME, cred.account)
      );
      
      await Promise.all(deletePromises);
      log.info(`Cleared ${credentials.length} secure storage entries`);
    } catch (error) {
      log.error('Failed to clear secure storage:', error);
      throw error;
    }
  }

  async getAllKeys(): Promise<string[]> {
    try {
      const credentials = await keytar.findCredentials(SERVICE_NAME);
      return credentials.map(cred => cred.account);
    } catch (error) {
      log.error('Failed to get all secure storage keys:', error);
      return [];
    }
  }
}