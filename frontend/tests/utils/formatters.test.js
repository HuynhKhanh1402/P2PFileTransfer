import { describe, it, expect } from 'vitest'
import { formatFileSize, formatTimeRemaining, formatSpeed, formatHash } from '../../src/utils/formatters'

describe('formatters utils', () => {
    describe('formatFileSize', () => {
        it('should format 0 bytes', () => {
            expect(formatFileSize(0)).toBe('0 Bytes')
        })

        it('should format bytes correctly', () => {
            expect(formatFileSize(500)).toBe('500 Bytes')
        })

        it('should format kilobytes correctly', () => {
            expect(formatFileSize(1024)).toBe('1 KB')
            expect(formatFileSize(2048)).toBe('2 KB')
        })

        it('should format megabytes correctly', () => {
            expect(formatFileSize(1024 * 1024)).toBe('1 MB')
            expect(formatFileSize(5 * 1024 * 1024)).toBe('5 MB')
        })

        it('should format gigabytes correctly', () => {
            expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB')
        })

        it('should handle decimal values', () => {
            expect(formatFileSize(1536)).toBe('1.5 KB')
        })
    })

    describe('formatTimeRemaining', () => {
        it('should format seconds', () => {
            expect(formatTimeRemaining(30)).toBe('30s')
            expect(formatTimeRemaining(45)).toBe('45s')
        })

        it('should format minutes and seconds', () => {
            expect(formatTimeRemaining(90)).toBe('1m 30s')
            expect(formatTimeRemaining(150)).toBe('2m 30s')
        })

        it('should format hours and minutes', () => {
            expect(formatTimeRemaining(3600)).toBe('1h 0m')
            expect(formatTimeRemaining(7200)).toBe('2h 0m')
        })

        it('should handle edge cases', () => {
            expect(formatTimeRemaining(0)).toBe('0s')
            expect(formatTimeRemaining(1)).toBe('1s')
        })
    })

    describe('formatSpeed', () => {
        it('should format zero speed', () => {
            expect(formatSpeed(0)).toBe('0 B/s')
        })

        it('should format bytes per second', () => {
            expect(formatSpeed(500)).toBe('500 B/s')
        })

        it('should format kilobytes per second', () => {
            expect(formatSpeed(1024)).toBe('1 KB/s')
            expect(formatSpeed(2048)).toBe('2 KB/s')
        })

        it('should format megabytes per second', () => {
            expect(formatSpeed(1024 * 1024)).toBe('1 MB/s')
        })

        it('should handle decimal values', () => {
            expect(formatSpeed(1536)).toBe('1.5 KB/s')
        })
    })

    describe('formatHash', () => {
        it('should return empty string for no hash', () => {
            expect(formatHash('')).toBe('')
            expect(formatHash(null)).toBe('')
        })

        it('should truncate long hash', () => {
            const longHash = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6'
            const formatted = formatHash(longHash, 8)
            expect(formatted).toBe('a1b2c3d4...m3n4o5p6')
        })

        it('should return full hash if shorter than limit', () => {
            const shortHash = 'abcd1234'
            expect(formatHash(shortHash, 8)).toBe('abcd1234')
        })

        it('should use default length of 8', () => {
            const hash = 'a1b2c3d4e5f6g7h8i9j0'
            const formatted = formatHash(hash)
            expect(formatted).toContain('...')
        })
    })
})
