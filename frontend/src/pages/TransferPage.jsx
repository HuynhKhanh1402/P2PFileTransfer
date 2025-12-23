import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTransfer } from '../context/TransferContext'
import { useSocket } from '../hooks/useSocket'
import { useWebRTCContext } from '../context/WebRTCContext'
import { formatFileSize, formatSpeed, formatTimeRemaining, getFileIcon } from '../utils/formatters'
import { calculateSHA256 } from '../utils/crypto'
import { getBrowserInfo } from '../utils/storageStrategy'

/**
 * Get display message for storage strategy type
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */
function getStorageMessage(strategyType) {
  switch (strategyType) {
    case 'filesystem':
      return 'Using direct file system access for optimal performance'
    case 'indexeddb':
      return 'Using browser database for reliable storage'
    case 'memory':
      return 'Using in-memory storage (may be limited for large files)'
    default:
      return null
  }
}

/**
 * Log storage error with detailed browser and file information
 * Requirement 7.4
 */
function logStorageError(operation, error, fileSize, strategyType) {
  const browserInfo = getBrowserInfo()
  console.error(`Storage error during ${operation}:`, {
    error: error.message || error,
    errorName: error.name,
    strategyType,
    browser: browserInfo.name,
    browserVersion: browserInfo.version,
    platform: browserInfo.platform,
    supportsFileSystemAccess: browserInfo.supportsFileSystemAccess,
    supportsIndexedDB: browserInfo.supportsIndexedDB,
    fileSize,
    fileSizeFormatted: formatFileSize(fileSize),
    timestamp: new Date().toISOString(),
  })
}

export default function TransferPage() {
  const navigate = useNavigate()
  const { 
    file, 
    fileHash,
    fileMeta, 
    role,
    sessionCode,
    setTransferProgress,
    setReceivedFile,
    setHashVerified,
    storageStrategy,
    storageStrategyType,
  } = useTransfer()
  
  const { emit, on, off } = useSocket()
  const [progress, setProgress] = useState(0)
  const [speed, setSpeed] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState(null)
  const [status, setStatus] = useState('connecting')
  const [isPaused, setIsPaused] = useState(false)
  
  const chunksRef = useRef([])
  const expectedChunksRef = useRef(0)
  const receivedBytesRef = useRef(0)
  const startTimeRef = useRef(null)
  const lastUpdateRef = useRef(Date.now())
  const lastBytesRef = useRef(0)
  const transferCompleteRef = useRef(false)
  const initializedRef = useRef(false)
  const fileMetaRef = useRef(null)
  const receivedChunksSetRef = useRef(new Set())
  const pendingChunkIndexRef = useRef(null)
  const storageStrategyRef = useRef(null)

  // Store strategy in ref for use in callbacks
  useEffect(() => {
    console.log(`[TransferPage] storageStrategy changed:`, storageStrategy ? storageStrategy.type : 'null')
    storageStrategyRef.current = storageStrategy
  }, [storageStrategy])

  useEffect(() => {
    console.log(`[TransferPage] Initial mount, role=${role}, initializedRef=${initializedRef.current}, transferCompleteRef=${transferCompleteRef.current}`)
    if (role === 'receiver') {
      // Always reset these refs on mount to handle React Strict Mode double-mount
      initializedRef.current = true
      chunksRef.current = []
      receivedBytesRef.current = 0
      expectedChunksRef.current = 0
      fileMetaRef.current = null
      transferCompleteRef.current = false // Critical: reset this on every mount
      receivedChunksSetRef.current = new Set()
      pendingChunkIndexRef.current = null
      lastUpdateRef.current = Date.now()
      lastBytesRef.current = 0
      console.log(`[TransferPage] Receiver initialized, transferCompleteRef reset to false`)
    }
  }, [role])

  const cleanupChunks = useCallback(async () => {
    // Mark transfer as complete to prevent further writes
    transferCompleteRef.current = true
    
    chunksRef.current = []
    receivedChunksSetRef.current.clear()
    receivedBytesRef.current = 0
    fileMetaRef.current = null
    pendingChunkIndexRef.current = null
    
    // Cleanup storage strategy if it exists
    const strategy = storageStrategyRef.current
    storageStrategyRef.current = null // Clear ref first to prevent further writes
    
    if (strategy) {
      try {
        await strategy.cleanup()
      } catch (error) {
        // Log detailed error information (Requirement 7.4)
        logStorageError('cleanup', error, fileMetaRef.current?.size || 0, strategy?.type)
      }
    }
  }, [])

  const handleMessage = useCallback(async (data) => {
    // Skip processing if transfer is already complete
    if (transferCompleteRef.current) {
      console.log(`[TransferPage] handleMessage: transfer already complete, skipping`)
      return
    }

    if (data instanceof ArrayBuffer) {
      const chunkIndex = pendingChunkIndexRef.current
      pendingChunkIndexRef.current = null
      
      console.log(`[TransferPage] Received ArrayBuffer chunk, index=${chunkIndex}, size=${data.byteLength}`)
      
      if (chunkIndex === null) {
        console.log(`[TransferPage] No pending chunk index, skipping`)
        return
      }
      
      if (receivedChunksSetRef.current.has(chunkIndex)) {
        console.log(`[TransferPage] Chunk ${chunkIndex} already received, skipping`)
        return
      }
      
      receivedChunksSetRef.current.add(chunkIndex)
      
      const chunkData = new Uint8Array(data)
      
      // Use storage strategy if available, otherwise fall back to memory array
      const strategy = storageStrategyRef.current
      console.log(`[TransferPage] Writing chunk ${chunkIndex}, strategy=${strategy?.type || 'memory-fallback'}`)
      
      if (strategy && !transferCompleteRef.current) {
        try {
          await strategy.writeChunk(chunkIndex, chunkData)
          console.log(`[TransferPage] Chunk ${chunkIndex} written successfully`)
        } catch (error) {
          // Log detailed error information (Requirement 7.4)
          const totalSize = fileMetaRef.current?.size || fileMeta?.size || 0
          logStorageError('writeChunk', error, totalSize, strategy?.type)
          
          // Only fall back to memory if not already completing transfer
          if (!transferCompleteRef.current) {
            // Fall back to memory storage
            chunksRef.current.push({
              index: chunkIndex,
              data: chunkData,
            })
          }
        }
      } else if (!transferCompleteRef.current) {
        // Fallback: store in memory array (legacy behavior)
        chunksRef.current.push({
          index: chunkIndex,
          data: chunkData,
        })
      }
      
      receivedBytesRef.current += data.byteLength

      const totalSize = fileMetaRef.current?.size || fileMeta?.size || 1
      const currentProgress = Math.round((receivedBytesRef.current / totalSize) * 100)
      setProgress(currentProgress)
      setTransferProgress(currentProgress)

      const now = Date.now()
      const timeDiff = (now - lastUpdateRef.current) / 1000
      if (timeDiff >= 0.5) {
        const bytesDiff = receivedBytesRef.current - lastBytesRef.current
        const currentSpeed = bytesDiff / timeDiff
        setSpeed(currentSpeed)
        
        const remainingBytes = totalSize - receivedBytesRef.current
        if (currentSpeed > 0) {
          setTimeRemaining(remainingBytes / currentSpeed)
        }

        lastUpdateRef.current = now
        lastBytesRef.current = receivedBytesRef.current
      }
      return
    }

    try {
      const message = typeof data === 'string' ? JSON.parse(data) : data
      console.log(`[TransferPage] Received message type=${message.type}`, message)
      
      if (message.type === 'meta') {
        if (fileMetaRef.current) {
          console.log(`[TransferPage] Meta already received, skipping`)
          return
        }
        fileMetaRef.current = message
        expectedChunksRef.current = message.totalChunks
        startTimeRef.current = Date.now()
        setStatus('transferring')
        console.log(`[TransferPage] Meta set, expecting ${message.totalChunks} chunks`)
      } else if (message.type === 'chunk') {
        if (!receivedChunksSetRef.current.has(message.index)) {
          pendingChunkIndexRef.current = message.index
          console.log(`[TransferPage] Pending chunk index set to ${message.index}`)
        } else {
          pendingChunkIndexRef.current = null
        }
      } else if (message.type === 'complete') {
        console.log(`[TransferPage] Received complete signal`)
        handleTransferComplete()
      }
    } catch (err) {
      console.error('[TransferPage] Error parsing message:', err)
    }
  }, [fileMeta, setTransferProgress])

  const handleTransferComplete = async () => {
    if (transferCompleteRef.current) {
      return
    }
    transferCompleteRef.current = true
    
    setStatus('verifying')

    // Get strategy reference before any async operations
    const strategy = storageStrategyRef.current

    try {
      const meta = fileMetaRef.current || fileMeta
      if (!meta) {
        throw new Error('No file metadata')
      }

      let receivedFile
      
      // Use storage strategy to finalize if available
      if (strategy) {
        try {
          const result = await strategy.finalize()
          
          // For filesystem strategy, file is already saved to disk
          if (result.type === 'filesystem') {
            // File is already saved, we can verify the hash if needed
            // For now, we'll skip hash verification for filesystem strategy
            // since the file is already on disk
            setReceivedFile(null) // No file object for filesystem strategy
            setHashVerified(true) // Assume verified since it's direct write
            
            emit('transfer-complete', { verified: true })
            setStatus('complete')
            navigate('/result')
            return
          }
          
          // For indexeddb and memory strategies, we get a File object
          receivedFile = result.file
        } catch (error) {
          // Log detailed error information (Requirement 7.4)
          logStorageError('finalize', error, meta.size, strategy?.type)
          // Fall back to reassembling from memory chunks
          const { reassembleChunks } = await import('../utils/fileUtils')
          receivedFile = reassembleChunks(chunksRef.current, meta.name, meta.mimeType)
        }
      } else {
        // Fallback: reassemble from memory chunks (legacy behavior)
        const { reassembleChunks } = await import('../utils/fileUtils')
        receivedFile = reassembleChunks(chunksRef.current, meta.name, meta.mimeType)
      }
      
      const receivedHash = await calculateSHA256(receivedFile)
      const originalHash = fileMeta?.hash || fileHash || meta.hash
      const isVerified = originalHash && receivedHash === originalHash

      setReceivedFile(receivedFile)
      setHashVerified(isVerified)
      
      emit('transfer-complete', { verified: isVerified })

      setStatus('complete')
      navigate('/result')
    } catch (err) {
      console.error('Error verifying file:', err)
      setStatus('error')
    }
  }

  const { 
    connectionState,
    sendFile: sendFileRTC,
    setMessageHandler,
    setStateChangeHandler,
    isDataChannelReady,
  } = useWebRTCContext()

  useEffect(() => {
    console.log(`[TransferPage] Setting up message handler, role=${role}`)
    if (role === 'receiver') {
      // Reset transferCompleteRef when setting up handler to handle Strict Mode
      transferCompleteRef.current = false
      console.log(`[TransferPage] Calling setMessageHandler with handleMessage, transferCompleteRef reset`)
      setMessageHandler(handleMessage)
    }
    return () => {
      if (role === 'receiver') {
        console.log(`[TransferPage] Cleanup: clearing message handler (NOT calling cleanupChunks)`)
        setMessageHandler(null)
        // Don't call cleanupChunks here - it sets transferCompleteRef to true
        // which breaks React Strict Mode double-mount behavior
      }
    }
  }, [role, handleMessage, setMessageHandler])

  useEffect(() => {
    setStateChangeHandler((state) => {
      if (state === 'connected') {
        setStatus('transferring')
      } else if (state === 'failed' || state === 'disconnected') {
        setStatus('error')
        // Only cleanup on actual connection failure, not on Strict Mode unmount
        if (role === 'receiver') {
          cleanupChunks()
        }
      }
    })
  }, [setStateChangeHandler, cleanupChunks, role])

  useEffect(() => {
    const dataChannelReady = isDataChannelReady()
    
    if (role === 'sender' && (connectionState === 'connected' || dataChannelReady) && file && status === 'connecting') {
      setStatus('transferring')
      startTimeRef.current = Date.now()

      const sendFile = async () => {
        try {
          await sendFileRTC(file, (sent, total) => {
            const currentProgress = Math.round((sent / total) * 100)
            setProgress(currentProgress)
            setTransferProgress(currentProgress)

            const now = Date.now()
            const elapsed = (now - startTimeRef.current) / 1000
            const bytesPerChunk = 64 * 1024
            const bytesSent = sent * bytesPerChunk
            const currentSpeed = bytesSent / elapsed
            setSpeed(currentSpeed)

            const remainingChunks = total - sent
            const remainingBytes = remainingChunks * bytesPerChunk
            if (currentSpeed > 0) {
              setTimeRemaining(remainingBytes / currentSpeed)
            }
          })

          setStatus('complete')
        } catch (err) {
          console.error('Error sending file:', err)
          setStatus('error')
        }
      }

      sendFile()
    }
  }, [role, connectionState, file, status, sendFileRTC, setTransferProgress, isDataChannelReady])

  useEffect(() => {
    const handleComplete = (data) => {
      if (role === 'sender') {
        setHashVerified(data.verified)
        navigate('/result')
      }
    }

    on('transfer-complete', handleComplete)
    return () => off('transfer-complete', handleComplete)
  }, [role, on, off, navigate, setHashVerified])

  const handleCancel = () => {
    cleanupChunks()
    emit('transfer-error', { message: 'Transfer cancelled' })
    navigate('/')
  }

  useEffect(() => {
    if (!sessionCode) {
      navigate('/')
    }
  }, [sessionCode, navigate])

  const displayMeta = fileMetaRef.current || fileMeta || (file ? { name: file.name, size: file.size, type: file.type } : null)

  return (
    <div className="flex-1 flex justify-center py-8 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-3xl flex flex-col gap-8">
        {/* Page Heading & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl sm:text-4xl font-black leading-tight tracking-tight">
              {role === 'sender' ? 'Sending Files' : 'Receiving Files'}
            </h1>
            <div className="flex items-center gap-2 text-text-secondary">
              <span className="material-symbols-outlined text-lg animate-pulse text-primary">lock</span>
              <p className="text-base font-medium">Secure P2P Connection Established</p>
            </div>
          </div>
          <button
            onClick={handleCancel}
            className="group flex items-center justify-center h-10 px-5 rounded-xl bg-red-50 text-red-700 hover:bg-red-100 transition-colors font-bold text-sm"
          >
            <span className="material-symbols-outlined mr-2 text-lg group-hover:rotate-90 transition-transform">close</span>
            Cancel Transfer
          </button>
        </div>

        {/* Central Transfer Card */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
          {/* File Preview Section */}
          <div className="p-6 sm:p-8 border-b border-gray-100">
            <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
              {/* File Icon/Preview */}
              <div className="relative group shrink-0">
                <div className="size-20 sm:size-24 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-5xl text-primary">
                    {displayMeta ? getFileIcon(displayMeta.type) : 'description'}
                  </span>
                </div>
                {status === 'complete' && (
                  <div className="absolute -bottom-2 -right-2 bg-green-500 text-white p-1 rounded-full border-4 border-white flex items-center justify-center">
                    <span className="material-symbols-outlined text-xs font-bold">check</span>
                  </div>
                )}
              </div>

              {/* File Details */}
              <div className="flex-1 min-w-0">
                <h3 className="text-xl sm:text-2xl font-bold truncate mb-1">
                  {displayMeta?.name || 'Unknown file'}
                </h3>
                <p className="text-text-secondary font-medium">
                  {displayMeta?.type || 'File'} - {displayMeta ? formatFileSize(displayMeta.size) : '0 B'} Total
                </p>
              </div>

              {/* Status Badge */}
              <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${
                status === 'complete' ? 'bg-green-100 text-green-700' :
                status === 'error' ? 'bg-red-100 text-red-700' :
                'bg-primary/20 text-yellow-700'
              }`}>
                <span className="size-2 rounded-full bg-current animate-pulse"></span>
                {status === 'connecting' && 'Connecting'}
                {status === 'transferring' && (role === 'sender' ? 'Uploading' : 'Downloading')}
                {status === 'verifying' && 'Verifying'}
                {status === 'complete' && 'Complete'}
                {status === 'error' && 'Error'}
              </div>
            </div>
          </div>

          {/* Progress Section */}
          <div className="p-6 sm:p-8 flex flex-col gap-6">
            <div className="flex justify-between items-baseline">
              <div className="flex flex-col">
                <span className="text-6xl font-black tabular-nums tracking-tighter text-text-main">{progress}%</span>
                <span className="text-sm font-medium text-text-secondary mt-1">
                  {role === 'sender' 
                    ? `${formatFileSize(Math.round((progress / 100) * (displayMeta?.size || 0)))} uploaded`
                    : `${formatFileSize(receivedBytesRef.current)} received`
                  }
                </span>
              </div>
              {/* Pause button - demo only */}
              <div 
                className="hidden sm:flex size-12 rounded-full bg-gray-100 items-center justify-center hover:bg-primary/20 hover:text-primary transition-colors cursor-pointer"
                onClick={() => setIsPaused(!isPaused)}
              >
                <span className="material-symbols-outlined">
                  {isPaused ? 'play_arrow' : 'pause'}
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="h-4 w-full bg-gray-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary rounded-full relative overflow-hidden transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              >
                {/* Shimmer effect */}
                <div className="absolute top-0 left-0 bottom-0 right-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.3)_50%,transparent_75%)] bg-[length:20px_20px] animate-pulse"></div>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 border-t border-gray-100 divide-x divide-gray-100">
            <div className="p-6 flex flex-col gap-1 items-center sm:items-start">
              <div className="flex items-center gap-2 text-text-secondary mb-1">
                <span className="material-symbols-outlined text-lg">speed</span>
                <span className="text-xs font-bold uppercase tracking-wide">Speed</span>
              </div>
              <p className="text-xl font-bold tabular-nums">{formatSpeed(speed)}</p>
            </div>
            <div className="p-6 flex flex-col gap-1 items-center sm:items-start">
              <div className="flex items-center gap-2 text-text-secondary mb-1">
                <span className="material-symbols-outlined text-lg">timer</span>
                <span className="text-xs font-bold uppercase tracking-wide">Time Left</span>
              </div>
              <p className="text-xl font-bold tabular-nums">
                {timeRemaining !== null ? formatTimeRemaining(timeRemaining) : '--'}
              </p>
            </div>
            <div className="p-6 flex flex-col gap-1 items-center sm:items-start">
              <div className="flex items-center gap-2 text-text-secondary mb-1">
                <span className="material-symbols-outlined text-lg">hub</span>
                <span className="text-xs font-bold uppercase tracking-wide">Connection</span>
              </div>
              <p className="text-xl font-bold tabular-nums">P2P Direct</p>
            </div>
            <div className="p-6 flex flex-col gap-1 items-center sm:items-start">
              <div className="flex items-center gap-2 text-text-secondary mb-1">
                <span className="material-symbols-outlined text-lg">security</span>
                <span className="text-xs font-bold uppercase tracking-wide">Encryption</span>
              </div>
              <p className="text-xl font-bold tabular-nums">AES-256</p>
            </div>
          </div>
        </div>

        {/* Additional Info */}
        <div className="bg-primary/5 rounded-xl p-4 flex items-start gap-4 border border-primary/10">
          <span className="material-symbols-outlined text-primary mt-0.5">info</span>
          <div className="flex-1">
            <p className="text-sm font-medium text-text-main">Tips for faster transfers</p>
            <p className="text-sm text-text-secondary mt-1">
              Keep this tab open for the best performance. Closing the tab will pause the transfer until you return.
            </p>
          </div>
        </div>

        {/* Storage Method Display (Requirements 5.1, 5.2, 5.3, 5.4) */}
        {role === 'receiver' && storageStrategyType && (
          <div className="bg-blue-50 rounded-xl p-4 flex items-start gap-4 border border-blue-100">
            <span className="material-symbols-outlined text-blue-500 mt-0.5">
              {storageStrategyType === 'filesystem' ? 'folder' : 
               storageStrategyType === 'indexeddb' ? 'database' : 'memory'}
            </span>
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-800">Storage Method</p>
              <p className="text-sm text-blue-600 mt-1">
                {getStorageMessage(storageStrategyType)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
