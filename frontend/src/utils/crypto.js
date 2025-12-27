/**
 * Calculate SHA-256 hash of a file using streaming for large files
 * Uses chunked reading to avoid memory issues with large files
 * @param {File} file - The file to hash
 * @param {Function} onProgress - Optional callback for progress updates (0-100)
 */
export async function calculateSHA256(file, onProgress) {
    if (!crypto || !crypto.subtle) {
        throw new Error('Web Crypto API not available. Please use HTTPS or localhost.')
    }

    console.log(`[SHA256] Starting hash calculation for file: ${file.name}, size: ${file.size}, type: ${file.type}`)

    // For small files (< 100MB), use Web Crypto API directly (fastest)
    const SMALL_FILE_THRESHOLD = 100 * 1024 * 1024 // 100MB
    
    if (file.size < SMALL_FILE_THRESHOLD) {
        try {
            console.log(`[SHA256] Using Web Crypto API (native) for small file`)
            onProgress?.(10)
            const arrayBuffer = await file.arrayBuffer()
            console.log(`[SHA256] ArrayBuffer size: ${arrayBuffer.byteLength}`)
            
            // Log first and last 16 bytes for debugging
            const bytes = new Uint8Array(arrayBuffer)
            const first16 = Array.from(bytes.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' ')
            const last16 = Array.from(bytes.slice(-16)).map(b => b.toString(16).padStart(2, '0')).join(' ')
            console.log(`[SHA256] First 16 bytes: ${first16}`)
            console.log(`[SHA256] Last 16 bytes: ${last16}`)
            
            onProgress?.(50)
            const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
            const hash = arrayBufferToHex(hashBuffer)
            console.log(`[SHA256] Calculated hash (native): ${hash}`)
            onProgress?.(100)
            return hash
        } catch (error) {
            console.warn('Simple hash failed, falling back to streaming:', error.message)
        }
    }

    // For large files, use optimized chunked approach
    console.log(`[SHA256] Using chunked approach for large file`)
    return await calculateSHA256Chunked(file, onProgress)
}

/**
 * Convert ArrayBuffer to hex string (optimized)
 */
function arrayBufferToHex(buffer) {
    const bytes = new Uint8Array(buffer)
    const hexChars = new Array(bytes.length * 2)
    const hexLookup = '0123456789abcdef'
    
    for (let i = 0; i < bytes.length; i++) {
        hexChars[i * 2] = hexLookup[bytes[i] >> 4]
        hexChars[i * 2 + 1] = hexLookup[bytes[i] & 0x0f]
    }
    
    return hexChars.join('')
}

/**
 * Calculate SHA-256 hash by reading file in chunks
 * Optimized for large files with progress reporting
 */
async function calculateSHA256Chunked(file, onProgress) {
    const CHUNK_SIZE = 16 * 1024 * 1024 // 16MB chunks - smaller for better progress updates
    
    // Initialize optimized SHA-256 state
    const state = sha256Init()
    let offset = 0
    const totalSize = file.size
    
    while (offset < totalSize) {
        const end = Math.min(offset + CHUNK_SIZE, totalSize)
        const blob = file.slice(offset, end)
        
        try {
            const arrayBuffer = await blob.arrayBuffer()
            sha256Update(state, new Uint8Array(arrayBuffer))
            
            // Report progress
            const progress = Math.round((end / totalSize) * 100)
            onProgress?.(progress)
        } catch (error) {
            throw new Error(`Failed to read file chunk at offset ${offset}: ${error.message}`)
        }
        
        offset = end
        
        // Yield to UI thread periodically
        if (offset < totalSize) {
            await new Promise(resolve => setTimeout(resolve, 0))
        }
    }
    
    return sha256Final(state)
}

// ============================================================================
// Optimized SHA-256 implementation for incremental hashing
// Uses pre-allocated buffers and optimized operations
// ============================================================================

// SHA-256 constants (pre-computed)
const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
])

// Pre-allocated work buffer for block processing
const W = new Uint32Array(64)

function sha256Init() {
    return {
        h: new Uint32Array([
            0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
            0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
        ]),
        buffer: new Uint8Array(64),
        bufferLength: 0,
        totalLength: 0
    }
}

function sha256Update(state, data) {
    let offset = 0
    const dataLen = data.length
    state.totalLength += dataLen
    
    // If we have buffered data, try to complete a block
    if (state.bufferLength > 0) {
        const needed = 64 - state.bufferLength
        const toCopy = needed < dataLen ? needed : dataLen
        state.buffer.set(data.subarray(0, toCopy), state.bufferLength)
        state.bufferLength += toCopy
        offset = toCopy
        
        if (state.bufferLength === 64) {
            sha256ProcessBlock(state.h, state.buffer, 0)
            state.bufferLength = 0
        }
    }
    
    // Process complete blocks directly from input
    while (offset + 64 <= dataLen) {
        sha256ProcessBlock(state.h, data, offset)
        offset += 64
    }
    
    // Buffer remaining data
    const remaining = dataLen - offset
    if (remaining > 0) {
        state.buffer.set(data.subarray(offset), 0)
        state.bufferLength = remaining
    }
}

function sha256Final(state) {
    // Padding
    const totalBits = state.totalLength * 8
    const padLength = state.bufferLength < 56 ? 56 - state.bufferLength : 120 - state.bufferLength
    const padding = new Uint8Array(padLength + 8)
    padding[0] = 0x80
    
    // Length in bits (big-endian) - handle large files correctly
    const highBits = Math.floor(totalBits / 0x100000000)
    const lowBits = totalBits >>> 0
    padding[padLength] = (highBits >>> 24) & 0xff
    padding[padLength + 1] = (highBits >>> 16) & 0xff
    padding[padLength + 2] = (highBits >>> 8) & 0xff
    padding[padLength + 3] = highBits & 0xff
    padding[padLength + 4] = (lowBits >>> 24) & 0xff
    padding[padLength + 5] = (lowBits >>> 16) & 0xff
    padding[padLength + 6] = (lowBits >>> 8) & 0xff
    padding[padLength + 7] = lowBits & 0xff
    
    sha256Update(state, padding)
    
    // Convert hash to hex string (optimized)
    const h = state.h
    const hexChars = new Array(64)
    const hexLookup = '0123456789abcdef'
    
    for (let i = 0; i < 8; i++) {
        const val = h[i]
        const base = i * 8
        hexChars[base] = hexLookup[(val >>> 28) & 0xf]
        hexChars[base + 1] = hexLookup[(val >>> 24) & 0xf]
        hexChars[base + 2] = hexLookup[(val >>> 20) & 0xf]
        hexChars[base + 3] = hexLookup[(val >>> 16) & 0xf]
        hexChars[base + 4] = hexLookup[(val >>> 12) & 0xf]
        hexChars[base + 5] = hexLookup[(val >>> 8) & 0xf]
        hexChars[base + 6] = hexLookup[(val >>> 4) & 0xf]
        hexChars[base + 7] = hexLookup[val & 0xf]
    }
    
    return hexChars.join('')
}

function sha256ProcessBlock(h, data, offset) {
    // Read block into W (big-endian)
    for (let i = 0; i < 16; i++) {
        const j = offset + i * 4
        W[i] = (data[j] << 24) | (data[j + 1] << 16) | (data[j + 2] << 8) | data[j + 3]
    }
    
    // Extend the sixteen 32-bit words into sixty-four 32-bit words
    for (let i = 16; i < 64; i++) {
        const w15 = W[i - 15]
        const w2 = W[i - 2]
        const s0 = ((w15 >>> 7) | (w15 << 25)) ^ ((w15 >>> 18) | (w15 << 14)) ^ (w15 >>> 3)
        const s1 = ((w2 >>> 17) | (w2 << 15)) ^ ((w2 >>> 19) | (w2 << 13)) ^ (w2 >>> 10)
        W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0
    }
    
    // Initialize working variables
    let a = h[0], b = h[1], c = h[2], d = h[3]
    let e = h[4], f = h[5], g = h[6], hh = h[7]
    
    // Main loop (unrolled for performance)
    for (let i = 0; i < 64; i++) {
        const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))
        const ch = (e & f) ^ (~e & g)
        const temp1 = (hh + S1 + ch + K[i] + W[i]) | 0
        const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))
        const maj = (a & b) ^ (a & c) ^ (b & c)
        const temp2 = (S0 + maj) | 0
        
        hh = g
        g = f
        f = e
        e = (d + temp1) | 0
        d = c
        c = b
        b = a
        a = (temp1 + temp2) | 0
    }
    
    // Add compressed chunk to hash value
    h[0] = (h[0] + a) | 0
    h[1] = (h[1] + b) | 0
    h[2] = (h[2] + c) | 0
    h[3] = (h[3] + d) | 0
    h[4] = (h[4] + e) | 0
    h[5] = (h[5] + f) | 0
    h[6] = (h[6] + g) | 0
    h[7] = (h[7] + hh) | 0
}

/**
 * Calculate SHA-256 hash of an ArrayBuffer
 */
export async function calculateSHA256FromBuffer(buffer) {
    if (!crypto || !crypto.subtle) {
        throw new Error('Web Crypto API not available. Please use HTTPS or localhost.')
    }
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
    return arrayBufferToHex(hashBuffer)
}

/**
 * Generate AES-256-GCM key
 */
export async function generateKey() {
    return await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    )
}

/**
 * Export key to raw format for sharing
 */
export async function exportKey(key) {
    const exported = await crypto.subtle.exportKey('raw', key)
    return new Uint8Array(exported)
}

/**
 * Import key from raw format
 */
export async function importKey(rawKey) {
    return await crypto.subtle.importKey(
        'raw',
        rawKey,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    )
}

/**
 * Encrypt data with AES-GCM
 */
export async function encryptData(data, key) {
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        data
    )
    // Prepend IV to encrypted data
    const result = new Uint8Array(iv.length + encrypted.byteLength)
    result.set(iv, 0)
    result.set(new Uint8Array(encrypted), iv.length)
    return result
}

/**
 * Decrypt data with AES-GCM
 */
export async function decryptData(encryptedData, key) {
    const iv = encryptedData.slice(0, 12)
    const data = encryptedData.slice(12)
    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        data
    )
    return new Uint8Array(decrypted)
}

/**
 * Generate random bytes
 */
export function generateRandomBytes(length) {
    return crypto.getRandomValues(new Uint8Array(length))
}
