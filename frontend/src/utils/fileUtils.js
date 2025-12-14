const CHUNK_SIZE = 64 * 1024 // 64KB chunks

/**
 * Read file as ArrayBuffer
 */
export function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = () => reject(reader.error)
        reader.readAsArrayBuffer(file)
    })
}

/**
 * Split file into chunks
 */
export async function* chunkFile(file, chunkSize = CHUNK_SIZE) {
    const totalChunks = Math.ceil(file.size / chunkSize)

    for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize
        const end = Math.min(start + chunkSize, file.size)
        const blob = file.slice(start, end)
        const arrayBuffer = await blob.arrayBuffer()

        yield {
            index: i,
            total: totalChunks,
            data: new Uint8Array(arrayBuffer),
            size: end - start
        }
    }
}

/**
 * Reassemble chunks into a file
 */
export function reassembleChunks(chunks, fileName, mimeType) {
    // Sort chunks by index
    const sorted = [...chunks].sort((a, b) => a.index - b.index)

    // Calculate total size
    const totalSize = sorted.reduce((sum, chunk) => sum + chunk.data.length, 0)

    // Create combined buffer
    const combined = new Uint8Array(totalSize)
    let offset = 0
    for (const chunk of sorted) {
        combined.set(chunk.data, offset)
        offset += chunk.data.length
    }

    // Create blob and file
    const blob = new Blob([combined], { type: mimeType })
    return new File([blob], fileName, { type: mimeType })
}

/**
 * Download file to user's device
 */
export function downloadFile(file) {
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
}

/**
 * Create URL for file preview
 */
export function createFilePreviewUrl(file) {
    return URL.createObjectURL(file)
}

/**
 * Revoke file preview URL
 */
export function revokeFilePreviewUrl(url) {
    URL.revokeObjectURL(url)
}
