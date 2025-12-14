/**
 * Format file size to human readable string
 */
export function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * Format time remaining in seconds to human readable string
 */
export function formatTimeRemaining(seconds) {
    if (seconds < 60) {
        return `${Math.ceil(seconds)}s`
    }
    if (seconds < 3600) {
        const mins = Math.floor(seconds / 60)
        const secs = Math.ceil(seconds % 60)
        return `${mins}m ${secs}s`
    }
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${mins}m`
}

/**
 * Format transfer speed
 */
export function formatSpeed(bytesPerSecond) {
    if (bytesPerSecond === 0) return '0 B/s'
    const k = 1024
    const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s']
    const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k))
    return parseFloat((bytesPerSecond / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

/**
 * Format hash for display (truncated)
 */
export function formatHash(hash, length = 8) {
    if (!hash) return ''
    if (hash.length <= length * 2) return hash
    return `${hash.slice(0, length)}...${hash.slice(-length)}`
}

/**
 * Get file icon based on MIME type
 */
export function getFileIcon(mimeType) {
    if (!mimeType) return 'description'
    if (mimeType.startsWith('image/')) return 'image'
    if (mimeType.startsWith('video/')) return 'movie'
    if (mimeType.startsWith('audio/')) return 'audio_file'
    if (mimeType.includes('pdf')) return 'picture_as_pdf'
    if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z') || mimeType.includes('tar')) return 'folder_zip'
    if (mimeType.includes('word') || mimeType.includes('document')) return 'article'
    if (mimeType.includes('excel') || mimeType.includes('sheet')) return 'table_chart'
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'slideshow'
    return 'description'
}
