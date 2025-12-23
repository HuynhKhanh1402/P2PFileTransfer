/**
 * Storage Strategy Module
 * 
 * Provides intelligent storage strategy selection based on browser capabilities,
 * platform type, and file size for optimal P2P file transfer handling.
 */

// Storage thresholds (in bytes)
export const THRESHOLDS = {
  LARGE_FILE_WARNING: 1 * 1024 * 1024 * 1024,      // 1GB
  MOBILE_WARNING: 500 * 1024 * 1024,               // 500MB
  MOBILE_INDEXEDDB_THRESHOLD: 100 * 1024 * 1024,   // 100MB
  INDEXEDDB_MAX: 2 * 1024 * 1024 * 1024,           // 2GB
  MEMORY_RECOMMENDED_MAX: 500 * 1024 * 1024,       // 500MB
}

// ============================================================================
// Capability Detection Functions
// ============================================================================

/**
 * Check if File System Access API is available
 * @returns {boolean} True if showSaveFilePicker is available in window
 */
export function hasFileSystemAccess() {
  return typeof window !== 'undefined' && 'showSaveFilePicker' in window
}

/**
 * Check if IndexedDB is available
 * @returns {boolean} True if IndexedDB is supported
 */
export function hasIndexedDB() {
  return typeof window !== 'undefined' && 'indexedDB' in window && window.indexedDB !== null
}

/**
 * Check if the current platform is mobile
 * Uses navigator.userAgent patterns to detect mobile devices
 * @returns {boolean} True if running on a mobile device
 */
export function isMobile() {
  if (typeof navigator === 'undefined') return false
  
  const userAgent = navigator.userAgent || ''
  
  // Check for common mobile indicators
  const mobilePatterns = [
    /Mobile/i,
    /Android/i,
    /iPhone/i,
    /iPad/i,
    /iPod/i,
    /webOS/i,
    /BlackBerry/i,
    /Windows Phone/i,
    /Opera Mini/i,
    /IEMobile/i,
  ]
  
  return mobilePatterns.some(pattern => pattern.test(userAgent))
}

/**
 * Check if the current platform is desktop
 * @returns {boolean} True if running on a desktop device
 */
export function isDesktop() {
  return !isMobile()
}

/**
 * Get browser information for debugging and logging
 * @returns {Object} Browser info object
 */
export function getBrowserInfo() {
  if (typeof navigator === 'undefined') {
    return {
      name: 'unknown',
      version: 'unknown',
      platform: 'unknown',
      supportsFileSystemAccess: false,
      supportsIndexedDB: false,
    }
  }

  const userAgent = navigator.userAgent || ''
  let name = 'unknown'
  let version = 'unknown'

  // Detect browser name and version
  if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
    name = 'Chrome'
    const match = userAgent.match(/Chrome\/(\d+)/)
    if (match) version = match[1]
  } else if (userAgent.includes('Edg')) {
    name = 'Edge'
    const match = userAgent.match(/Edg\/(\d+)/)
    if (match) version = match[1]
  } else if (userAgent.includes('Firefox')) {
    name = 'Firefox'
    const match = userAgent.match(/Firefox\/(\d+)/)
    if (match) version = match[1]
  } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    name = 'Safari'
    const match = userAgent.match(/Version\/(\d+)/)
    if (match) version = match[1]
  }

  return {
    name,
    version,
    platform: isMobile() ? 'mobile' : 'desktop',
    supportsFileSystemAccess: hasFileSystemAccess(),
    supportsIndexedDB: hasIndexedDB(),
  }
}


// ============================================================================
// Strategy Detection
// ============================================================================

/**
 * @typedef {Object} StrategyDetectionResult
 * @property {'filesystem' | 'indexeddb' | 'memory'} strategy - The selected storage strategy
 * @property {boolean} supported - Whether the strategy is supported
 * @property {string} [warning] - Optional warning message
 * @property {string} [recommendedBrowser] - Optional browser recommendation
 */

/**
 * Detect the best storage strategy based on browser capabilities and file size
 * 
 * Strategy selection priority:
 * 1. File System Access API (desktop Chrome/Edge only)
 * 2. IndexedDB (for files under 2GB)
 * 3. Memory (fallback)
 * 
 * @param {number} fileSize - Size of the file in bytes
 * @returns {StrategyDetectionResult} The detection result with strategy and warnings
 */
export function detectBestStrategy(fileSize) {
  const mobile = isMobile()
  const hasFS = hasFileSystemAccess()
  const hasIDB = hasIndexedDB()

  // Desktop with File System Access API - best option
  if (!mobile && hasFS) {
    return {
      strategy: 'filesystem',
      supported: true,
    }
  }

  // Mobile or no File System API - use IndexedDB if available
  if (hasIDB) {
    // Check file size thresholds
    if (fileSize > THRESHOLDS.INDEXEDDB_MAX) {
      // File too large for IndexedDB
      return {
        strategy: 'memory',
        supported: true,
        warning: `File size (${formatBytes(fileSize)}) exceeds IndexedDB limit. Transfer may fail for very large files.`,
        recommendedBrowser: 'Chrome or Edge desktop browser',
      }
    }

    // Generate warnings based on platform and file size
    let warning
    let recommendedBrowser

    if (mobile && fileSize > THRESHOLDS.MOBILE_WARNING) {
      warning = `Large file (${formatBytes(fileSize)}) on mobile device may cause memory issues.`
      recommendedBrowser = 'Desktop browser for large files'
    } else if (!mobile && !hasFS && fileSize > THRESHOLDS.LARGE_FILE_WARNING) {
      warning = `Large file (${formatBytes(fileSize)}) without File System API may cause performance issues.`
      recommendedBrowser = 'Chrome or Edge for optimal performance'
    }

    return {
      strategy: 'indexeddb',
      supported: true,
      warning,
      recommendedBrowser,
    }
  }

  // Fallback to memory strategy
  let warning
  let recommendedBrowser

  if (fileSize > THRESHOLDS.MEMORY_RECOMMENDED_MAX) {
    warning = `Large file (${formatBytes(fileSize)}) with memory storage may cause browser crashes.`
    recommendedBrowser = 'Chrome or Edge desktop browser'
  }

  return {
    strategy: 'memory',
    supported: true,
    warning,
    recommendedBrowser,
  }
}

/**
 * Helper function to format bytes to human-readable string
 * @param {number} bytes - Number of bytes
 * @returns {string} Formatted string (e.g., "1.5 GB")
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}


// ============================================================================
// Storage Strategy Classes
// ============================================================================

/**
 * FileSystemStrategy - Uses File System Access API for direct disk writing
 * Best for desktop Chrome/Edge browsers with large files
 * 
 * Requirements: 1.2, 1.3, 1.4, 4.3, 7.1
 */
export class FileSystemStrategy {
  constructor() {
    this.type = 'filesystem'
    this.fileHandle = null
    this.writable = null
    this.bytesWritten = 0
    this.fileName = ''
    this.fileSize = 0
    this.mimeType = ''
    this.isClosing = false
    this.isClosed = false
    this.writeQueue = Promise.resolve()
  }

  /**
   * Initialize the file system strategy by prompting user to select save location
   * @param {string} fileName - Name of the file to save
   * @param {number} fileSize - Expected size of the file
   * @param {string} mimeType - MIME type of the file
   * @returns {Promise<boolean>} True if initialization successful
   * @throws {Error} If user cancels or permission denied
   */
  async init(fileName, fileSize, mimeType) {
    this.fileName = fileName
    this.fileSize = fileSize
    this.mimeType = mimeType || 'application/octet-stream'
    this.isClosing = false
    this.isClosed = false
    this.writeQueue = Promise.resolve()

    try {
      // Prompt user to select save location (Requirement 1.2)
      this.fileHandle = await window.showSaveFilePicker({
        suggestedName: fileName,
        types: [{
          description: 'File',
          accept: { [this.mimeType]: [this._getExtension(fileName)] },
        }],
      })

      // Create writable stream for direct disk writing
      this.writable = await this.fileHandle.createWritable()
      this.bytesWritten = 0
      return true
    } catch (error) {
      // Handle specific error types (Requirement 4.3, 7.1)
      if (error.name === 'AbortError') {
        // User cancelled the file picker
        throw new Error('USER_CANCELLED: User cancelled file selection')
      }
      if (error.name === 'NotAllowedError') {
        // Permission denied
        throw new Error('PERMISSION_DENIED: File system access permission denied')
      }
      // Other errors
      throw new Error(`FILESYSTEM_ERROR: ${error.message}`)
    }
  }

  /**
   * Write a chunk directly to disk (Requirement 1.3)
   * Uses a write queue to ensure sequential writes and prevent race conditions
   * @param {number} chunkIndex - Index of the chunk (for ordering)
   * @param {Uint8Array} data - Chunk data to write
   * @returns {Promise<void>}
   */
  async writeChunk(chunkIndex, data) {
    if (!this.writable || this.isClosed) {
      throw new Error('FileSystemStrategy not initialized')
    }

    // Check if stream is closing or closed
    if (this.isClosing) {
      throw new Error('Cannot write to a closing writable stream')
    }

    // Queue writes to ensure sequential execution and prevent race conditions
    this.writeQueue = this.writeQueue.then(async () => {
      // Double-check state before writing
      if (!this.writable || this.isClosing || this.isClosed) {
        return
      }

      try {
        // Write chunk directly to disk via FileSystemWritableFileStream
        await this.writable.write(data)
        this.bytesWritten += data.byteLength
      } catch (error) {
        // If write fails due to stream being closed, mark as closed
        if (error.message?.includes('closing') || error.message?.includes('closed')) {
          this.isClosed = true
        }
        throw error
      }
    })

    return this.writeQueue
  }

  /**
   * Finalize the file by closing the writable stream (Requirement 1.4)
   * @returns {Promise<Object>} Storage result with file handle
   */
  async finalize() {
    if (!this.writable || this.isClosed) {
      throw new Error('FileSystemStrategy not initialized')
    }

    // Wait for all pending writes to complete
    await this.writeQueue

    // Mark as closing to prevent new writes
    this.isClosing = true

    try {
      // Close the writable stream - file is already saved to disk
      await this.writable.close()
      this.isClosed = true
      this.writable = null

      return {
        type: 'filesystem',
        fileHandle: this.fileHandle,
        bytesWritten: this.bytesWritten,
      }
    } catch (error) {
      this.isClosed = true
      this.writable = null
      throw error
    }
  }

  /**
   * Cleanup resources - for filesystem strategy, file is already saved
   * @returns {Promise<void>}
   */
  async cleanup() {
    // Wait for any pending writes
    try {
      await this.writeQueue
    } catch {
      // Ignore errors from pending writes during cleanup
    }

    // Close writable if still open
    if (this.writable && !this.isClosed) {
      this.isClosing = true
      try {
        await this.writable.close()
      } catch {
        // Ignore errors during cleanup
      }
      this.isClosed = true
      this.writable = null
    }
    this.fileHandle = null
    this.bytesWritten = 0
  }

  /**
   * Get file extension from filename
   * @private
   */
  _getExtension(fileName) {
    const parts = fileName.split('.')
    if (parts.length > 1) {
      return '.' + parts.pop()
    }
    return ''
  }
}


/**
 * IndexedDBStrategy - Uses IndexedDB for buffered chunk storage
 * Good for Firefox, Safari, and mobile browsers
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */
export class IndexedDBStrategy {
  static DB_NAME = 'FileTransferDB'
  static STORE_NAME = 'chunks'
  static DB_VERSION = 1
  static BUFFER_SIZE = 50 // Flush buffer at 50 chunks (Requirement 2.2)

  constructor() {
    this.type = 'indexeddb'
    this.db = null
    this.buffer = []
    this.sessionId = ''
    this.fileName = ''
    this.fileSize = 0
    this.mimeType = ''
    this.totalChunks = 0
    this.chunksWritten = 0
  }

  /**
   * Initialize IndexedDB database (Requirement 2.1)
   * @param {string} fileName - Name of the file
   * @param {number} fileSize - Expected size of the file
   * @param {string} mimeType - MIME type of the file
   * @returns {Promise<boolean>} True if initialization successful
   */
  async init(fileName, fileSize, mimeType) {
    this.fileName = fileName
    this.fileSize = fileSize
    this.mimeType = mimeType || 'application/octet-stream'
    this.sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
    this.buffer = []
    this.chunksWritten = 0

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(IndexedDBStrategy.DB_NAME, IndexedDBStrategy.DB_VERSION)

      request.onerror = () => {
        reject(new Error(`INDEXEDDB_ERROR: Failed to open database: ${request.error?.message}`))
      }

      request.onsuccess = () => {
        this.db = request.result
        resolve(true)
      }

      request.onupgradeneeded = (event) => {
        const db = event.target.result
        
        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(IndexedDBStrategy.STORE_NAME)) {
          const store = db.createObjectStore(IndexedDBStrategy.STORE_NAME, { keyPath: 'id' })
          store.createIndex('sessionId', 'sessionId', { unique: false })
          store.createIndex('index', 'index', { unique: false })
        }
      }
    })
  }

  /**
   * Write a chunk to buffer, flush to IndexedDB when buffer is full (Requirement 2.2)
   * @param {number} chunkIndex - Index of the chunk
   * @param {Uint8Array} data - Chunk data
   * @returns {Promise<void>}
   */
  async writeChunk(chunkIndex, data) {
    if (!this.db) {
      throw new Error('IndexedDBStrategy not initialized')
    }

    // Create a copy of the data to avoid issues with shared ArrayBuffer views
    // This is important because WebRTC may reuse the underlying buffer
    const dataCopy = new Uint8Array(data)

    // Add chunk to buffer
    this.buffer.push({
      id: `${this.sessionId}_${chunkIndex}`,
      sessionId: this.sessionId,
      index: chunkIndex,
      data: dataCopy,
    })

    // Flush buffer when it reaches BUFFER_SIZE
    if (this.buffer.length >= IndexedDBStrategy.BUFFER_SIZE) {
      await this._flushBuffer()
    }
  }

  /**
   * Flush buffered chunks to IndexedDB
   * @private
   */
  async _flushBuffer() {
    if (this.buffer.length === 0) return

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([IndexedDBStrategy.STORE_NAME], 'readwrite')
      const store = transaction.objectStore(IndexedDBStrategy.STORE_NAME)

      transaction.oncomplete = () => {
        this.chunksWritten += this.buffer.length
        this.buffer = []
        resolve()
      }

      transaction.onerror = () => {
        reject(new Error(`INDEXEDDB_ERROR: Failed to write chunks: ${transaction.error?.message}`))
      }

      // Write all buffered chunks
      for (const chunk of this.buffer) {
        store.put(chunk)
      }
    })
  }

  /**
   * Finalize by reassembling chunks into a File object (Requirement 2.3)
   * @returns {Promise<Object>} Storage result with File object
   */
  async finalize() {
    if (!this.db) {
      throw new Error('IndexedDBStrategy not initialized')
    }

    // Flush any remaining buffered chunks
    await this._flushBuffer()

    // Retrieve all chunks from IndexedDB and reassemble
    const chunks = await this._getAllChunks()
    
    // Sort chunks by index
    chunks.sort((a, b) => a.index - b.index)

    // Combine chunks into a single Blob/File
    // Note: IndexedDB may return data as ArrayBuffer instead of Uint8Array
    // We need to ensure consistent handling by converting to Uint8Array first
    const blobParts = chunks.map(chunk => {
      const data = chunk.data
      // Handle different data types that IndexedDB might return
      if (data instanceof Uint8Array) {
        return data
      } else if (data instanceof ArrayBuffer) {
        return new Uint8Array(data)
      } else if (data && data.buffer instanceof ArrayBuffer) {
        // Handle other TypedArray views
        return new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
      }
      // Fallback: assume it's already a valid BlobPart
      return data
    })
    const file = new File(blobParts, this.fileName, { type: this.mimeType })

    return {
      type: 'indexeddb',
      file: file,
    }
  }

  /**
   * Get all chunks for this session from IndexedDB
   * @private
   */
  async _getAllChunks() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([IndexedDBStrategy.STORE_NAME], 'readonly')
      const store = transaction.objectStore(IndexedDBStrategy.STORE_NAME)
      const index = store.index('sessionId')
      const request = index.getAll(this.sessionId)

      request.onsuccess = () => {
        resolve(request.result || [])
      }

      request.onerror = () => {
        reject(new Error(`INDEXEDDB_ERROR: Failed to retrieve chunks: ${request.error?.message}`))
      }
    })
  }

  /**
   * Cleanup by removing all session chunks from IndexedDB (Requirement 2.4)
   * @returns {Promise<void>}
   */
  async cleanup() {
    if (!this.db) return

    // Clear buffer
    this.buffer = []

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([IndexedDBStrategy.STORE_NAME], 'readwrite')
      const store = transaction.objectStore(IndexedDBStrategy.STORE_NAME)
      const index = store.index('sessionId')
      const request = index.getAllKeys(this.sessionId)

      request.onsuccess = () => {
        const keys = request.result || []
        
        // Delete all chunks for this session
        for (const key of keys) {
          store.delete(key)
        }
      }

      transaction.oncomplete = () => {
        this.db.close()
        this.db = null
        resolve()
      }

      transaction.onerror = () => {
        reject(new Error(`INDEXEDDB_ERROR: Failed to cleanup: ${transaction.error?.message}`))
      }
    })
  }
}


/**
 * MemoryStrategy - Stores all chunks in memory
 * Fallback strategy when other options are unavailable
 * 
 * Requirements: 4.4
 */
export class MemoryStrategy {
  constructor() {
    this.type = 'memory'
    this.chunks = []
    this.fileName = ''
    this.fileSize = 0
    this.mimeType = ''
  }

  /**
   * Initialize memory strategy
   * @param {string} fileName - Name of the file
   * @param {number} fileSize - Expected size of the file
   * @param {string} mimeType - MIME type of the file
   * @returns {Promise<boolean>} True if initialization successful
   */
  async init(fileName, fileSize, mimeType) {
    this.fileName = fileName
    this.fileSize = fileSize
    this.mimeType = mimeType || 'application/octet-stream'
    this.chunks = []
    return true
  }

  /**
   * Write a chunk to memory
   * @param {number} chunkIndex - Index of the chunk
   * @param {Uint8Array} data - Chunk data
   * @returns {Promise<void>}
   */
  async writeChunk(chunkIndex, data) {
    // Create a copy of the data to avoid issues with shared ArrayBuffer views
    const dataCopy = new Uint8Array(data)
    this.chunks.push({
      index: chunkIndex,
      data: dataCopy,
    })
  }

  /**
   * Finalize by combining chunks into a File object
   * @returns {Promise<Object>} Storage result with File object
   */
  async finalize() {
    // Sort chunks by index
    this.chunks.sort((a, b) => a.index - b.index)

    // Combine chunks into a single File
    const blobParts = this.chunks.map(chunk => chunk.data)
    const file = new File(blobParts, this.fileName, { type: this.mimeType })

    return {
      type: 'memory',
      file: file,
    }
  }

  /**
   * Cleanup by clearing chunks from memory
   * @returns {Promise<void>}
   */
  async cleanup() {
    this.chunks = []
  }
}


// ============================================================================
// Strategy Factory
// ============================================================================

/**
 * Create a storage strategy instance based on strategy type
 * 
 * Requirements: 1.1, 2.1
 * 
 * @param {'filesystem' | 'indexeddb' | 'memory'} strategyType - Type of strategy to create
 * @returns {FileSystemStrategy | IndexedDBStrategy | MemoryStrategy} Strategy instance
 * @throws {Error} If invalid strategy type provided
 */
export function createStrategy(strategyType) {
  switch (strategyType) {
    case 'filesystem':
      return new FileSystemStrategy()
    case 'indexeddb':
      return new IndexedDBStrategy()
    case 'memory':
      return new MemoryStrategy()
    default:
      throw new Error(`Unknown strategy type: ${strategyType}`)
  }
}
