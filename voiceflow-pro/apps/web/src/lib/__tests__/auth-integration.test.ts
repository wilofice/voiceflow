/**
 * Authentication Integration Tests
 * Tests the complete Supabase Auth integration
 */

import { getSupabaseToken, authenticatedFetch } from '../api-client';

// Mock Supabase
jest.mock('../supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      refreshSession: jest.fn(),
    },
  },
  isSupabaseConfigured: true,
}));

describe('Authentication Integration', () => {
  const mockSupabase = require('../supabase').supabase;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset fetch mock
    global.fetch = jest.fn();
  });

  describe('getSupabaseToken', () => {
    it('should return token when session exists', async () => {
      const mockSession = {
        access_token: 'test-token-123',
        user: { id: 'user-123' },
      };

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const token = await getSupabaseToken();
      expect(token).toBe('test-token-123');
    });

    it('should return null when no session exists', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const token = await getSupabaseToken();
      expect(token).toBeNull();
    });

    it('should return null when session fetch fails', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: new Error('Session fetch failed'),
      });

      const token = await getSupabaseToken();
      expect(token).toBeNull();
    });
  });

  describe('authenticatedFetch', () => {
    it('should include Authorization header with token', async () => {
      const mockSession = {
        access_token: 'test-token-123',
        user: { id: 'user-123' },
      };

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

      await authenticatedFetch('/api/test');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3002/api/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token-123',
          }),
        })
      );
    });

    it('should handle 401 and attempt token refresh', async () => {
      const mockSession = {
        access_token: 'test-token-123',
        user: { id: 'user-123' },
      };

      const refreshedSession = {
        access_token: 'new-token-456',
        user: { id: 'user-123' },
      };

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      // First call returns 401, second call with refreshed token succeeds
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ success: true }),
        });

      mockSupabase.auth.refreshSession.mockResolvedValue({
        data: { session: refreshedSession },
        error: null,
      });

      const response = await authenticatedFetch('/api/test');

      expect(response.ok).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(2);
      
      // Second call should use refreshed token
      expect(global.fetch).toHaveBeenLastCalledWith(
        'http://localhost:3002/api/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer new-token-456',
          }),
        })
      );
    });

    it('should work without token when not authenticated', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

      await authenticatedFetch('/api/test');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3002/api/test',
        expect.objectContaining({
          headers: expect.not.objectContaining({
            Authorization: expect.anything(),
          }),
        })
      );
    });
  });
});