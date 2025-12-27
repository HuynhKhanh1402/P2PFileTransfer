import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSession, checkSession } from '../../src/services/api'

// Mock fetch globally
global.fetch = vi.fn()

describe('API Service', () => {
    beforeEach(() => {
        // Clear mock before each test
        vi.clearAllMocks()
    })

    describe('createSession', () => {
        it('should create a session successfully', async () => {
            const mockResponse = { code: '123456' }
            
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse
            })

            const result = await createSession()
            
            expect(result).toEqual(mockResponse)
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/create-session'),
                expect.objectContaining({
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                })
            )
        })

        it('should throw error on failed request', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 500
            })

            await expect(createSession()).rejects.toThrow()
        })

        it('should handle network errors', async () => {
            global.fetch.mockRejectedValueOnce(new Error('Network error'))

            await expect(createSession()).rejects.toThrow('Network error')
        })
    })

    describe('checkSession', () => {
        it('should check session successfully', async () => {
            const mockResponse = { 
                exists: true, 
                hasReceiver: false,
                fileMeta: null 
            }
            
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse
            })

            const result = await checkSession('123456')
            
            expect(result).toEqual(mockResponse)
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/session/123456')
            )
        })

        it('should handle non-existent session', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ exists: false })
            })

            const result = await checkSession('999999')
            
            expect(result.exists).toBe(false)
        })

        it('should throw error on failed request', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 404
            })

            await expect(checkSession('123456')).rejects.toThrow()
        })
    })
})
