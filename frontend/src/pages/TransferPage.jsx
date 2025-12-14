import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTransfer } from '../context/TransferContext'
import { useSocket } from '../hooks/useSocket'
import { useWebRTC } from '../hooks/useWebRTC'
import { formatFileSize, formatSpeed, formatTimeRemaining, getFileIcon } from '../utils/formatters'
import { calculateSHA256FromBuffer, calculateSHA256 } from '../utils/crypto'
import { reassembleChunks, downloadFile } from '../utils/fileUtils'

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
  } = useTransfer()
  
  const { emit, on, off } = useSocket()
  const [progress, setProgress] = useState(0)
  const [speed, setSpeed] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState(null)
  const [status, setStatus] = useState('connecting') // connecting, transferring, verifying, complete, error
  const [isPaused, setIsPaused] = useState(false)
  
  // For receiver: store chunks
  const chunksRef = useRef([])
  const expectedChunksRef = useRef(0)
  const receivedBytesRef = useRef(0)
  const startTimeRef = useRef(null)
  const lastUpdateRef = useRef(Date.now())
  const lastBytesRef = useRef(0)

  // File meta for receiver
  const fileMetaRef = useRef(null)

  const handleMessage = useCallback((data) => {
    // Handle binary data (file chunks)
    if (data instanceof ArrayBuffer) {
      const chunk = {
        index: chunksRef.current.length,
        data: new Uint8Array(data),
      }
      chunksRef.current.push(chunk)
      receivedBytesRef.current += data.byteLength

      // Calculate progress and speed
      const totalSize = fileMetaRef.current?.size || fileMeta?.size || 1
      const currentProgress = Math.round((receivedBytesRef.current / totalSize) * 100)
      setProgress(currentProgress)
      setTransferProgress(currentProgress)

      // Calculate speed
      const now = Date.now()
      const timeDiff = (now - lastUpdateRef.current) / 1000
      if (timeDiff >= 0.5) {
        const bytesDiff = receivedBytesRef.current - lastBytesRef.current
        const currentSpeed = bytesDiff / timeDiff
        setSpeed(currentSpeed)
        
        // Estimate time remaining
        const remainingBytes = totalSize - receivedBytesRef.current
        if (currentSpeed > 0) {
          setTimeRemaining(remainingBytes / currentSpeed)
        }

        lastUpdateRef.current = now
        lastBytesRef.current = receivedBytesRef.current
      }
      return
    }

    // Handle JSON messages
    try {
      const message = typeof data === 'string' ? JSON.parse(data) : data
      
      if (message.type === 'meta') {
        console.log('Received file meta:', message)
        fileMetaRef.current = message
        expectedChunksRef.current = message.totalChunks
        startTimeRef.current = Date.now()
        setStatus('transferring')
      } else if (message.type === 'chunk') {
        // Chunk header - next message will be the data
        console.log(`Receiving chunk ${message.index + 1}/${expectedChunksRef.current}`)
      } else if (message.type === 'complete') {
        console.log('Transfer complete, verifying...')
        handleTransferComplete()
      }
    } catch (err) {
      console.error('Error parsing message:', err)
    }
  }, [fileMeta, setTransferProgress])

  const handleTransferComplete = async () => {
    setStatus('verifying')

    try {
      const meta = fileMetaRef.current || fileMeta
      if (!meta) {
        throw new Error('No file metadata')
      }

      // Reassemble file
      const receivedFile = reassembleChunks(chunksRef.current, meta.name, meta.mimeType)
      
      // Verify hash
      const receivedHash = await calculateSHA256(receivedFile)
      const originalHash = meta.hash || fileHash
      const isVerified = receivedHash === originalHash

      console.log('Hash verification:', isVerified ? 'PASSED' : 'FAILED')
      console.log('Expected:', originalHash)
      console.log('Received:', receivedHash)

      setReceivedFile(receivedFile)
      setHashVerified(isVerified)
      
      // Notify sender
      emit('transfer-complete', { verified: isVerified })

      setStatus('complete')
      navigate('/result')
    } catch (err) {
      console.error('Error verifying file:', err)
      setStatus('error')
    }
  }

  const handleStateChange = useCallback((state) => {
    console.log('WebRTC state:', state)
    if (state === 'connected') {
      setStatus('transferring')
    } else if (state === 'failed' || state === 'disconnected') {
      setStatus('error')
    }
  }, [])

  const { 
    connectionState,
    sendFile: sendFileRTC,
  } = useWebRTC({
    onMessage: handleMessage,
    onStateChange: handleStateChange,
  })

  // Sender: start sending file when connected
  useEffect(() => {
    if (role === 'sender' && connectionState === 'connected' && file && status === 'connecting') {
      setStatus('transferring')
      startTimeRef.current = Date.now()

      const sendFile = async () => {
        try {
          await sendFileRTC(file, (sent, total) => {
            const currentProgress = Math.round((sent / total) * 100)
            setProgress(currentProgress)
            setTransferProgress(currentProgress)

            // Calculate speed
            const now = Date.now()
            const elapsed = (now - startTimeRef.current) / 1000
            const bytesPerChunk = 64 * 1024
            const bytesSent = sent * bytesPerChunk
            const currentSpeed = bytesSent / elapsed
            setSpeed(currentSpeed)

            // Time remaining
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
  }, [role, connectionState, file, status, sendFileRTC, setTransferProgress])

  // Handle transfer complete from peer
  useEffect(() => {
    const handleComplete = (data) => {
      console.log('Peer signaled transfer complete:', data)
      if (role === 'sender') {
        setHashVerified(data.verified)
        navigate('/result')
      }
    }

    on('transfer-complete', handleComplete)
    return () => off('transfer-complete', handleComplete)
  }, [role, on, off, navigate, setHashVerified])

  const handleCancel = () => {
    emit('transfer-error', { message: 'Transfer cancelled' })
    navigate('/')
  }

  // Redirect if no session
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
      </div>
    </div>
  )
}
