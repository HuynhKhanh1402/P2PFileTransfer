/**
 * Calculate SHA-256 hash of a file
 */
export async function calculateSHA256(file) {
    if (!crypto || !crypto.subtle) {
        throw new Error('Web Crypto API not available. Please use HTTPS or localhost.')
    }
    const arrayBuffer = await file.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    return hashHex
}

/**
 * Calculate SHA-256 hash of an ArrayBuffer
 */
export async function calculateSHA256FromBuffer(buffer) {
    if (!crypto || !crypto.subtle) {
        throw new Error('Web Crypto API not available. Please use HTTPS or localhost.')
    }
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    return hashHex
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
