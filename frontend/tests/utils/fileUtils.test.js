import { describe, it, expect } from 'vitest'
import { reassembleChunks } from '../../src/utils/fileUtils'

describe('fileUtils', () => {
    describe('reassembleChunks', () => {
        it('should reassemble chunks in correct order', () => {
            const chunks = [
                { index: 0, data: new Uint8Array([1, 2, 3]) },
                { index: 1, data: new Uint8Array([4, 5, 6]) },
                { index: 2, data: new Uint8Array([7, 8, 9]) }
            ]

            const file = reassembleChunks(chunks, 'test.bin', 'application/octet-stream')
            
            expect(file).toBeInstanceOf(File)
            expect(file.name).toBe('test.bin')
            expect(file.type).toBe('application/octet-stream')
            expect(file.size).toBe(9)
        })

        it('should handle unordered chunks', () => {
            const chunks = [
                { index: 2, data: new Uint8Array([7, 8, 9]) },
                { index: 0, data: new Uint8Array([1, 2, 3]) },
                { index: 1, data: new Uint8Array([4, 5, 6]) }
            ]

            const file = reassembleChunks(chunks, 'test.bin', 'application/octet-stream')
            
            expect(file.size).toBe(9)
        })

        it('should handle single chunk', () => {
            const chunks = [
                { index: 0, data: new Uint8Array([1, 2, 3, 4, 5]) }
            ]

            const file = reassembleChunks(chunks, 'single.bin', 'application/octet-stream')
            
            expect(file.size).toBe(5)
            expect(file.name).toBe('single.bin')
        })

        it('should handle empty chunks array', () => {
            const chunks = []
            const file = reassembleChunks(chunks, 'empty.bin', 'application/octet-stream')
            
            expect(file.size).toBe(0)
        })
    })
})
