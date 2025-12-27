/**
 * Property-Based Tests for Storage Strategy Module
 * 
 * Uses fast-check for property-based testing to verify correctness properties
 * defined in the design document.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'
import 'fake-indexeddb/auto'
import {
  isMobile,
  isDesktop,
  detectBestStrategy,
  THRESHOLDS,
  IndexedDBStrategy,
} from '../../src/utils/storageStrategy'

// ============================================================================
// Test Utilities
// ============================================================================

// Number of runs for property tests - reduced in CI environment
const NUM_RUNS = process.env.CI ? 20 : 100

/**
 * Arbitrary for generating mobile user agent strings
 */
const mobileUserAgentArb = fc.oneof(
  fc.constant('Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15'),
  fc.constant('Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15'),
  fc.constant('Mozilla/5.0 (Linux; Android 10; SM-G960F) AppleWebKit/537.36 Chrome/89.0'),
  fc.constant('Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 Mobile Safari/537.36'),
  fc.constant('Mozilla/5.0 (iPod touch; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15'),
  fc.constant('Mozilla/5.0 (webOS/1.0; U; en-US) AppleWebKit/525.27.1'),
  fc.constant('Mozilla/5.0 (BlackBerry; U; BlackBerry 9900; en) AppleWebKit/534.11'),
  fc.constant('Mozilla/5.0 (compatible; MSIE 10.0; Windows Phone 8.0; Trident/6.0; IEMobile/10.0)'),
  fc.constant('Opera/9.80 (Android; Opera Mini/36.2.2254/119.132; U; en) Presto/2.12.423'),
  // Generate random strings containing mobile keywords
  fc.string().map(s => `Mozilla/5.0 Mobile ${s}`),
  fc.string().map(s => `Mozilla/5.0 Android ${s}`),
  fc.string().map(s => `Mozilla/5.0 iPhone ${s}`),
  fc.string().map(s => `Mozilla/5.0 iPad ${s}`),
)

/**
 * Arbitrary for generating desktop user agent strings
 */
const desktopUserAgentArb = fc.oneof(
  fc.constant('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/91.0.4472.124'),
  fc.constant('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/91.0'),
  fc.constant('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/91.0.4472.124'),
  fc.constant('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0'),
  fc.constant('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/14.1.1'),
)

/**
 * Arbitrary for file sizes
 */
const fileSizeArb = fc.nat({ max: 5 * 1024 * 1024 * 1024 }) // 0 to 5GB

// ============================================================================
// Property 7: Platform Detection Accuracy
// **Feature: enhanced-storage-strategy, Property 7: Platform Detection Accuracy**
// **Validates: Requirements 4.2, 6.1**
// ============================================================================

describe('Property 7: Platform Detection Accuracy', () => {
  let originalNavigator

  beforeEach(() => {
    originalNavigator = global.navigator
  })

  afterEach(() => {
    global.navigator = originalNavigator
  })

  it('should identify mobile platforms from mobile user agent strings', () => {
    fc.assert(
      fc.property(mobileUserAgentArb, (userAgent) => {
        // Mock navigator with mobile user agent
        global.navigator = { userAgent }
        
        const result = isMobile()
        
        // Mobile user agents should be detected as mobile
        expect(result).toBe(true)
        // isDesktop should be the inverse
        expect(isDesktop()).toBe(false)
      }),
      { numRuns: NUM_RUNS }
    )
  })

  it('should identify desktop platforms from desktop user agent strings', () => {
    fc.assert(
      fc.property(desktopUserAgentArb, (userAgent) => {
        // Mock navigator with desktop user agent
        global.navigator = { userAgent }
        
        const result = isMobile()
        
        // Desktop user agents should not be detected as mobile
        expect(result).toBe(false)
        // isDesktop should be the inverse
        expect(isDesktop()).toBe(true)
      }),
      { numRuns: NUM_RUNS }
    )
  })

  it('should exclude filesystem strategy on mobile platforms', () => {
    fc.assert(
      fc.property(mobileUserAgentArb, fileSizeArb, (userAgent, fileSize) => {
        // Mock navigator with mobile user agent
        global.navigator = { userAgent }
        // Mock window with File System API available
        global.window = { 
          showSaveFilePicker: () => {},
          indexedDB: {}
        }
        
        const result = detectBestStrategy(fileSize)
        
        // On mobile, filesystem should never be selected even if API is available
        expect(result.strategy).not.toBe('filesystem')
      }),
      { numRuns: NUM_RUNS }
    )
  })
})


// ============================================================================
// Property 1: File System API Detection
// **Feature: enhanced-storage-strategy, Property 1: File System API Detection**
// **Validates: Requirements 1.1**
// ============================================================================

describe('Property 1: File System API Detection', () => {
  let originalNavigator
  let originalWindow

  beforeEach(() => {
    originalNavigator = global.navigator
    originalWindow = global.window
  })

  afterEach(() => {
    global.navigator = originalNavigator
    global.window = originalWindow
  })

  it('should select filesystem strategy when showSaveFilePicker exists and platform is desktop', () => {
    fc.assert(
      fc.property(desktopUserAgentArb, fileSizeArb, (userAgent, fileSize) => {
        // Mock desktop navigator
        global.navigator = { userAgent }
        // Mock window with File System API available
        global.window = { 
          showSaveFilePicker: () => {},
          indexedDB: {}
        }
        
        const result = detectBestStrategy(fileSize)
        
        // On desktop with File System API, filesystem should be selected
        expect(result.strategy).toBe('filesystem')
        expect(result.supported).toBe(true)
      }),
      { numRuns: NUM_RUNS }
    )
  })

  it('should not select filesystem strategy when showSaveFilePicker is missing', () => {
    fc.assert(
      fc.property(desktopUserAgentArb, fileSizeArb, (userAgent, fileSize) => {
        // Mock desktop navigator
        global.navigator = { userAgent }
        // Mock window WITHOUT File System API
        global.window = { 
          indexedDB: {}
        }
        
        const result = detectBestStrategy(fileSize)
        
        // Without File System API, filesystem should not be selected
        expect(result.strategy).not.toBe('filesystem')
      }),
      { numRuns: NUM_RUNS }
    )
  })
})


// ============================================================================
// Property 2: Fallback Strategy Selection
// **Feature: enhanced-storage-strategy, Property 2: Fallback Strategy Selection**
// **Validates: Requirements 2.1**
// ============================================================================

// ============================================================================
// Property 6: Large File Warning Display
// **Feature: enhanced-storage-strategy, Property 6: Large File Warning Display**
// **Validates: Requirements 3.1, 6.2**
// ============================================================================

describe('Property 6: Large File Warning Display', () => {
  let originalNavigator
  let originalWindow

  beforeEach(() => {
    originalNavigator = global.navigator
    originalWindow = global.window
  })

  afterEach(() => {
    global.navigator = originalNavigator
    global.window = originalWindow
  })

  /**
   * Arbitrary for file sizes larger than 1GB (desktop warning threshold)
   */
  const fileSizeOver1GBArb = fc.integer({ 
    min: THRESHOLDS.LARGE_FILE_WARNING + 1, 
    max: THRESHOLDS.INDEXEDDB_MAX - 1 
  })

  /**
   * Arbitrary for file sizes larger than 500MB (mobile warning threshold)
   */
  const fileSizeOver500MBArb = fc.integer({ 
    min: THRESHOLDS.MOBILE_WARNING + 1, 
    max: THRESHOLDS.INDEXEDDB_MAX - 1 
  })

  it('should return warning for files > 1GB on desktop without File System API', () => {
    fc.assert(
      fc.property(desktopUserAgentArb, fileSizeOver1GBArb, (userAgent, fileSize) => {
        // Mock desktop navigator
        global.navigator = { userAgent }
        // Mock window WITHOUT File System API but WITH IndexedDB
        global.window = { 
          indexedDB: {}
        }
        
        const result = detectBestStrategy(fileSize)
        
        // Should have a warning for large files without FS API on desktop
        expect(result.warning).toBeDefined()
        expect(result.warning).toContain('Large file')
        expect(result.recommendedBrowser).toBeDefined()
      }),
      { numRuns: NUM_RUNS }
    )
  })

  it('should return warning for files > 500MB on mobile browsers', () => {
    fc.assert(
      fc.property(mobileUserAgentArb, fileSizeOver500MBArb, (userAgent, fileSize) => {
        // Mock mobile navigator
        global.navigator = { userAgent }
        // Mock window with IndexedDB
        global.window = { 
          indexedDB: {}
        }
        
        const result = detectBestStrategy(fileSize)
        
        // Should have a warning for large files on mobile
        expect(result.warning).toBeDefined()
        expect(result.warning).toContain('Large file')
        expect(result.recommendedBrowser).toBeDefined()
      }),
      { numRuns: NUM_RUNS }
    )
  })

  it('should NOT return warning for files <= 1GB on desktop without File System API', () => {
    fc.assert(
      fc.property(
        desktopUserAgentArb, 
        fc.integer({ min: 0, max: THRESHOLDS.LARGE_FILE_WARNING }),
        (userAgent, fileSize) => {
          // Mock desktop navigator
          global.navigator = { userAgent }
          // Mock window WITHOUT File System API but WITH IndexedDB
          global.window = { 
            indexedDB: {}
          }
          
          const result = detectBestStrategy(fileSize)
          
          // Should NOT have a warning for smaller files
          expect(result.warning).toBeUndefined()
        }
      ),
      { numRuns: NUM_RUNS }
    )
  })

  it('should NOT return warning for files <= 500MB on mobile browsers', () => {
    fc.assert(
      fc.property(
        mobileUserAgentArb, 
        fc.integer({ min: 0, max: THRESHOLDS.MOBILE_WARNING }),
        (userAgent, fileSize) => {
          // Mock mobile navigator
          global.navigator = { userAgent }
          // Mock window with IndexedDB
          global.window = { 
            indexedDB: {}
          }
          
          const result = detectBestStrategy(fileSize)
          
          // Should NOT have a warning for smaller files on mobile
          expect(result.warning).toBeUndefined()
        }
      ),
      { numRuns: NUM_RUNS }
    )
  })

  it('should NOT return warning on desktop WITH File System API regardless of file size', () => {
    fc.assert(
      fc.property(desktopUserAgentArb, fileSizeArb, (userAgent, fileSize) => {
        // Mock desktop navigator
        global.navigator = { userAgent }
        // Mock window WITH File System API
        global.window = { 
          showSaveFilePicker: () => {},
          indexedDB: {}
        }
        
        const result = detectBestStrategy(fileSize)
        
        // Should NOT have a warning when FS API is available on desktop
        expect(result.warning).toBeUndefined()
      }),
      { numRuns: NUM_RUNS }
    )
  })
})


describe('Property 2: Fallback Strategy Selection', () => {
  let originalNavigator
  let originalWindow

  beforeEach(() => {
    originalNavigator = global.navigator
    originalWindow = global.window
  })

  afterEach(() => {
    global.navigator = originalNavigator
    global.window = originalWindow
  })

  /**
   * Arbitrary for file sizes under 2GB (IndexedDB limit)
   */
  const fileSizeUnder2GBArb = fc.nat({ max: THRESHOLDS.INDEXEDDB_MAX - 1 })

  it('should select indexeddb strategy when File System API is unavailable and IndexedDB is available for files under 2GB', () => {
    fc.assert(
      fc.property(
        fc.oneof(desktopUserAgentArb, mobileUserAgentArb),
        fileSizeUnder2GBArb,
        (userAgent, fileSize) => {
          // Mock navigator
          global.navigator = { userAgent }
          // Mock window WITHOUT File System API but WITH IndexedDB
          global.window = { 
            indexedDB: {}
          }
          
          const result = detectBestStrategy(fileSize)
          
          // Without File System API but with IndexedDB, indexeddb should be selected for files under 2GB
          expect(result.strategy).toBe('indexeddb')
          expect(result.supported).toBe(true)
        }
      ),
      { numRuns: NUM_RUNS }
    )
  })

  it('should select memory strategy when both File System API and IndexedDB are unavailable', () => {
    fc.assert(
      fc.property(
        fc.oneof(desktopUserAgentArb, mobileUserAgentArb),
        fileSizeArb,
        (userAgent, fileSize) => {
          // Mock navigator
          global.navigator = { userAgent }
          // Mock window WITHOUT File System API and WITHOUT IndexedDB
          global.window = {}
          
          const result = detectBestStrategy(fileSize)
          
          // Without both APIs, memory should be selected
          expect(result.strategy).toBe('memory')
          expect(result.supported).toBe(true)
        }
      ),
      { numRuns: NUM_RUNS }
    )
  })

  it('should select memory strategy for files over 2GB even when IndexedDB is available', () => {
    fc.assert(
      fc.property(
        fc.oneof(desktopUserAgentArb, mobileUserAgentArb),
        fc.integer({ min: THRESHOLDS.INDEXEDDB_MAX + 1, max: 5 * 1024 * 1024 * 1024 }),
        (userAgent, fileSize) => {
          // Mock navigator
          global.navigator = { userAgent }
          // Mock window WITHOUT File System API but WITH IndexedDB
          global.window = { 
            indexedDB: {}
          }
          
          const result = detectBestStrategy(fileSize)
          
          // For files over 2GB without File System API, memory should be selected
          expect(result.strategy).toBe('memory')
          expect(result.supported).toBe(true)
          expect(result.warning).toBeDefined()
        }
      ),
      { numRuns: NUM_RUNS }
    )
  })
})


// ============================================================================
// Property 4: IndexedDB Buffer Flush
// **Feature: enhanced-storage-strategy, Property 4: IndexedDB Buffer Flush**
// **Validates: Requirements 2.2**
// ============================================================================

describe('Property 4: IndexedDB Buffer Flush', () => {
  /**
   * Arbitrary for generating chunk data
   */
  const chunkDataArb = fc.uint8Array({ minLength: 1, maxLength: 1024 })

  /**
   * Arbitrary for number of chunks that triggers a flush (>= BUFFER_SIZE)
   */
  const chunksToFlushArb = fc.integer({ 
    min: IndexedDBStrategy.BUFFER_SIZE, 
    max: IndexedDBStrategy.BUFFER_SIZE + 20 
  })

  /**
   * Arbitrary for number of chunks that doesn't trigger a flush (< BUFFER_SIZE)
   */
  const chunksNoFlushArb = fc.integer({ 
    min: 1, 
    max: IndexedDBStrategy.BUFFER_SIZE - 1 
  })

  it('should flush buffer to IndexedDB when buffer reaches BUFFER_SIZE chunks', async () => {
    await fc.assert(
      fc.asyncProperty(chunksToFlushArb, chunkDataArb, async (numChunks, chunkTemplate) => {
        const strategy = new IndexedDBStrategy()
        await strategy.init('test.bin', numChunks * chunkTemplate.length, 'application/octet-stream')

        // Write exactly BUFFER_SIZE chunks
        for (let i = 0; i < IndexedDBStrategy.BUFFER_SIZE; i++) {
          await strategy.writeChunk(i, chunkTemplate)
        }

        // After writing BUFFER_SIZE chunks, buffer should be empty (flushed)
        expect(strategy.buffer.length).toBe(0)
        // And chunksWritten should equal BUFFER_SIZE
        expect(strategy.chunksWritten).toBe(IndexedDBStrategy.BUFFER_SIZE)

        await strategy.cleanup()
      }),
      { numRuns: NUM_RUNS }
    )
  })

  it('should NOT flush buffer when buffer has fewer than BUFFER_SIZE chunks', async () => {
    await fc.assert(
      fc.asyncProperty(chunksNoFlushArb, chunkDataArb, async (numChunks, chunkTemplate) => {
        const strategy = new IndexedDBStrategy()
        await strategy.init('test.bin', numChunks * chunkTemplate.length, 'application/octet-stream')

        // Write fewer than BUFFER_SIZE chunks
        for (let i = 0; i < numChunks; i++) {
          await strategy.writeChunk(i, chunkTemplate)
        }

        // Buffer should still contain the chunks (not flushed)
        expect(strategy.buffer.length).toBe(numChunks)
        // And chunksWritten should be 0 (nothing flushed yet)
        expect(strategy.chunksWritten).toBe(0)

        await strategy.cleanup()
      }),
      { numRuns: NUM_RUNS }
    )
  })

  it('should flush remaining buffer on finalize', async () => {
    await fc.assert(
      fc.asyncProperty(chunksNoFlushArb, chunkDataArb, async (numChunks, chunkTemplate) => {
        const strategy = new IndexedDBStrategy()
        await strategy.init('test.bin', numChunks * chunkTemplate.length, 'application/octet-stream')

        // Write fewer than BUFFER_SIZE chunks
        for (let i = 0; i < numChunks; i++) {
          await strategy.writeChunk(i, chunkTemplate)
        }

        // Finalize should flush remaining buffer
        const result = await strategy.finalize()

        // Buffer should be empty after finalize
        expect(strategy.buffer.length).toBe(0)
        // Result should contain a file
        expect(result.type).toBe('indexeddb')
        expect(result.file).toBeDefined()
        expect(result.file.name).toBe('test.bin')

        await strategy.cleanup()
      }),
      { numRuns: NUM_RUNS }
    )
  })
})


// ============================================================================
// Property 5: IndexedDB Cleanup
// **Feature: enhanced-storage-strategy, Property 5: IndexedDB Cleanup**
// **Validates: Requirements 2.4**
// ============================================================================

describe('Property 5: IndexedDB Cleanup', () => {
  /**
   * Arbitrary for generating chunk data
   */
  const chunkDataArb = fc.uint8Array({ minLength: 1, maxLength: 1024 })

  /**
   * Arbitrary for number of chunks
   */
  const numChunksArb = fc.integer({ min: 1, max: 100 })

  it('should remove all session chunks from IndexedDB after cleanup', async () => {
    await fc.assert(
      fc.asyncProperty(numChunksArb, chunkDataArb, async (numChunks, chunkTemplate) => {
        const strategy = new IndexedDBStrategy()
        await strategy.init('test.bin', numChunks * chunkTemplate.length, 'application/octet-stream')
        const sessionId = strategy.sessionId

        // Write chunks
        for (let i = 0; i < numChunks; i++) {
          await strategy.writeChunk(i, chunkTemplate)
        }

        // Finalize to flush all chunks to IndexedDB
        await strategy.finalize()

        // Cleanup should remove all chunks
        await strategy.cleanup()

        // Verify no chunks remain by creating a new strategy and checking the DB
        const verifyStrategy = new IndexedDBStrategy()
        await verifyStrategy.init('verify.bin', 0, 'application/octet-stream')

        // Access the database directly to check for remaining chunks
        const remainingChunks = await new Promise((resolve, reject) => {
          const request = indexedDB.open(IndexedDBStrategy.DB_NAME, IndexedDBStrategy.DB_VERSION)
          request.onsuccess = () => {
            const db = request.result
            const transaction = db.transaction([IndexedDBStrategy.STORE_NAME], 'readonly')
            const store = transaction.objectStore(IndexedDBStrategy.STORE_NAME)
            const index = store.index('sessionId')
            const getRequest = index.getAll(sessionId)
            
            getRequest.onsuccess = () => {
              db.close()
              resolve(getRequest.result || [])
            }
            getRequest.onerror = () => {
              db.close()
              reject(getRequest.error)
            }
          }
          request.onerror = () => reject(request.error)
        })

        // No chunks should remain for the cleaned up session
        expect(remainingChunks.length).toBe(0)

        await verifyStrategy.cleanup()
      }),
      { numRuns: NUM_RUNS }
    )
  })

  it('should not affect chunks from other sessions during cleanup', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 20 }), 
        chunkDataArb, 
        async (numChunks, chunkTemplate) => {
          // Create two strategies with different sessions
          const strategy1 = new IndexedDBStrategy()
          const strategy2 = new IndexedDBStrategy()

          await strategy1.init('file1.bin', numChunks * chunkTemplate.length, 'application/octet-stream')
          await strategy2.init('file2.bin', numChunks * chunkTemplate.length, 'application/octet-stream')

          const sessionId1 = strategy1.sessionId
          const sessionId2 = strategy2.sessionId

          // Write chunks to both strategies
          for (let i = 0; i < numChunks; i++) {
            await strategy1.writeChunk(i, chunkTemplate)
            await strategy2.writeChunk(i, chunkTemplate)
          }

          // Finalize both to flush chunks
          await strategy1.finalize()
          await strategy2.finalize()

          // Cleanup only strategy1
          await strategy1.cleanup()

          // Verify strategy2's chunks still exist
          const remainingChunks = await new Promise((resolve, reject) => {
            const request = indexedDB.open(IndexedDBStrategy.DB_NAME, IndexedDBStrategy.DB_VERSION)
            request.onsuccess = () => {
              const db = request.result
              const transaction = db.transaction([IndexedDBStrategy.STORE_NAME], 'readonly')
              const store = transaction.objectStore(IndexedDBStrategy.STORE_NAME)
              const index = store.index('sessionId')
              const getRequest = index.getAll(sessionId2)
              
              getRequest.onsuccess = () => {
                db.close()
                resolve(getRequest.result || [])
              }
              getRequest.onerror = () => {
                db.close()
                reject(getRequest.error)
              }
            }
            request.onerror = () => reject(request.error)
          })

          // Strategy2's chunks should still exist
          expect(remainingChunks.length).toBe(numChunks)

          // Cleanup strategy2
          await strategy2.cleanup()
        }
      ),
      { numRuns: NUM_RUNS }
    )
  })
})


// ============================================================================
// Property 10: Mobile IndexedDB Preference
// **Feature: enhanced-storage-strategy, Property 10: Mobile IndexedDB Preference**
// **Validates: Requirements 6.3**
// ============================================================================

describe('Property 10: Mobile IndexedDB Preference', () => {
  let originalNavigator
  let originalWindow

  beforeEach(() => {
    originalNavigator = global.navigator
    originalWindow = global.window
  })

  afterEach(() => {
    global.navigator = originalNavigator
    global.window = originalWindow
  })

  /**
   * Arbitrary for file sizes larger than 100MB (mobile IndexedDB threshold)
   */
  const fileSizeOver100MBArb = fc.integer({ 
    min: THRESHOLDS.MOBILE_INDEXEDDB_THRESHOLD + 1, 
    max: THRESHOLDS.INDEXEDDB_MAX - 1 
  })

  /**
   * Arbitrary for file sizes under 100MB
   */
  const fileSizeUnder100MBArb = fc.integer({ 
    min: 0, 
    max: THRESHOLDS.MOBILE_INDEXEDDB_THRESHOLD 
  })

  it('should prefer indexeddb over memory for files > 100MB on mobile with IndexedDB support', () => {
    fc.assert(
      fc.property(mobileUserAgentArb, fileSizeOver100MBArb, (userAgent, fileSize) => {
        // Mock mobile navigator
        global.navigator = { userAgent }
        // Mock window with IndexedDB but without File System API
        global.window = { 
          indexedDB: {}
        }
        
        const result = detectBestStrategy(fileSize)
        
        // On mobile with IndexedDB for files > 100MB, should prefer indexeddb
        expect(result.strategy).toBe('indexeddb')
        expect(result.supported).toBe(true)
      }),
      { numRuns: NUM_RUNS }
    )
  })

  it('should select indexeddb for files <= 100MB on mobile with IndexedDB support', () => {
    fc.assert(
      fc.property(mobileUserAgentArb, fileSizeUnder100MBArb, (userAgent, fileSize) => {
        // Mock mobile navigator
        global.navigator = { userAgent }
        // Mock window with IndexedDB but without File System API
        global.window = { 
          indexedDB: {}
        }
        
        const result = detectBestStrategy(fileSize)
        
        // On mobile with IndexedDB, should use indexeddb even for smaller files
        expect(result.strategy).toBe('indexeddb')
        expect(result.supported).toBe(true)
      }),
      { numRuns: NUM_RUNS }
    )
  })

  it('should fall back to memory on mobile when IndexedDB is unavailable', () => {
    fc.assert(
      fc.property(mobileUserAgentArb, fileSizeOver100MBArb, (userAgent, fileSize) => {
        // Mock mobile navigator
        global.navigator = { userAgent }
        // Mock window WITHOUT IndexedDB
        global.window = {}
        
        const result = detectBestStrategy(fileSize)
        
        // On mobile without IndexedDB, should fall back to memory
        expect(result.strategy).toBe('memory')
        expect(result.supported).toBe(true)
      }),
      { numRuns: NUM_RUNS }
    )
  })
})


// ============================================================================
// Property 8: IndexedDB Fallback on Missing FS API
// **Feature: enhanced-storage-strategy, Property 8: IndexedDB Fallback on Missing FS API**
// **Validates: Requirements 4.4**
// ============================================================================

describe('Property 8: IndexedDB Fallback on Missing FS API', () => {
  let originalNavigator
  let originalWindow

  beforeEach(() => {
    originalNavigator = global.navigator
    originalWindow = global.window
  })

  afterEach(() => {
    global.navigator = originalNavigator
    global.window = originalWindow
  })

  /**
   * Arbitrary for file sizes under IndexedDB max (2GB)
   */
  const fileSizeUnder2GBArb = fc.integer({ 
    min: 0, 
    max: THRESHOLDS.INDEXEDDB_MAX - 1 
  })

  it('should never return filesystem strategy when File System API is missing but IndexedDB is available', () => {
    fc.assert(
      fc.property(
        fc.oneof(desktopUserAgentArb, mobileUserAgentArb),
        fileSizeUnder2GBArb,
        (userAgent, fileSize) => {
          // Mock navigator
          global.navigator = { userAgent }
          // Mock window WITHOUT File System API but WITH IndexedDB
          global.window = { 
            indexedDB: {}
          }
          
          const result = detectBestStrategy(fileSize)
          
          // Without File System API, filesystem should never be selected
          expect(result.strategy).not.toBe('filesystem')
          // Should select indexeddb for files under 2GB
          expect(result.strategy).toBe('indexeddb')
          expect(result.supported).toBe(true)
        }
      ),
      { numRuns: NUM_RUNS }
    )
  })

  it('should never return filesystem strategy on desktop when showSaveFilePicker is not present in window', () => {
    fc.assert(
      fc.property(
        desktopUserAgentArb,
        fileSizeUnder2GBArb,
        (userAgent, fileSize) => {
          // Mock desktop navigator
          global.navigator = { userAgent }
          // Mock window WITHOUT showSaveFilePicker property (not in window object)
          global.window = { 
            indexedDB: {}
          }
          
          const result = detectBestStrategy(fileSize)
          
          // Without showSaveFilePicker in window, filesystem should never be selected
          expect(result.strategy).not.toBe('filesystem')
          // Should fall back to indexeddb for files under 2GB
          expect(result.strategy).toBe('indexeddb')
        }
      ),
      { numRuns: NUM_RUNS }
    )
  })

  it('should select memory strategy when both File System API and IndexedDB are unavailable', () => {
    fc.assert(
      fc.property(
        fc.oneof(desktopUserAgentArb, mobileUserAgentArb),
        fileSizeArb,
        (userAgent, fileSize) => {
          // Mock navigator
          global.navigator = { userAgent }
          // Mock window WITHOUT both APIs
          global.window = {}
          
          const result = detectBestStrategy(fileSize)
          
          // Without both APIs, should fall back to memory
          expect(result.strategy).toBe('memory')
          expect(result.supported).toBe(true)
        }
      ),
      { numRuns: NUM_RUNS }
    )
  })
})
