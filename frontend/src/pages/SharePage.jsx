import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { useTransfer } from '../context/TransferContext'
import { useSocket } from '../hooks/useSocket'
import { useWebRTCContext } from '../context/WebRTCContext'
import { formatFileSize, formatHash, getFileIcon } from '../utils/formatters'

export default function SharePage() {
  const navigate = useNavigate()
  const { 
    file, 
    fileHash, 
    sessionCode, 
    fileMeta,
    setTransferStatus,
    setTransferProgress,
  } = useTransfer()
  
  const { socket, isConnected, emit, on, off } = useSocket()
  const [receiverConnected, setReceiverConnected] = useState(false)
  const [status, setStatus] = useState('waiting') // waiting, connecting, ready, transferring
  const [copied, setCopied] = useState(false)
  const offerSentRef = useRef(false)
  
  const { 
    createOffer, 
    setRemoteDescription,
    sendFile,
    close: closeRTC,
    setStateChangeHandler,
    connectionState,
  } = useWebRTCContext()

  // Handle WebRTC state changes
  useEffect(() => {
    setStateChangeHandler((state) => {
      console.log('WebRTC state:', state)
      if (state === 'connected') {
        setStatus('ready')
      }
    })
  }, [setStateChangeHandler])

  // Join session as sender
  useEffect(() => {
    if (isConnected && sessionCode) {
      emit('sender-join', sessionCode)
      
      // Send file metadata
      if (fileMeta) {
        emit('file-meta', fileMeta)
      }
    }
  }, [isConnected, sessionCode, emit, fileMeta])

  // Handle receiver connection and WebRTC signaling
  useEffect(() => {
    if (!socket) return

    const handleReceiverConnected = async () => {
      console.log('Receiver connected')
      setReceiverConnected(true)
      setStatus('connecting')

      // Create and send offer
      if (!offerSentRef.current) {
        offerSentRef.current = true
        try {
          const offer = await createOffer()
          emit('offer', offer)
        } catch (err) {
          console.error('Error creating offer:', err)
        }
      }
    }

    const handleAnswer = async (answer) => {
      console.log('Received answer')
      try {
        await setRemoteDescription(answer)
      } catch (err) {
        console.error('Error setting remote description:', err)
      }
    }

    const handleTransferAccepted = async () => {
      console.log('Transfer accepted, starting file transfer')
      setStatus('transferring')
      setTransferStatus('transferring')
      
      // Navigate to transfer page
      navigate('/transfer')
    }

    const handleTransferRejected = () => {
      console.log('Transfer rejected')
      setStatus('rejected')
      closeRTC()
    }

    const handlePeerDisconnected = () => {
      console.log('Peer disconnected')
      setReceiverConnected(false)
      setStatus('waiting')
      offerSentRef.current = false
    }

    on('receiver-connected', handleReceiverConnected)
    on('answer', handleAnswer)
    on('transfer-accepted', handleTransferAccepted)
    on('transfer-rejected', handleTransferRejected)
    on('peer-disconnected', handlePeerDisconnected)

    return () => {
      off('receiver-connected', handleReceiverConnected)
      off('answer', handleAnswer)
      off('transfer-accepted', handleTransferAccepted)
      off('transfer-rejected', handleTransferRejected)
      off('peer-disconnected', handlePeerDisconnected)
    }
  }, [socket, on, off, emit, createOffer, setRemoteDescription, navigate, closeRTC, setTransferStatus])

  const handleCopyCode = () => {
    navigator.clipboard.writeText(sessionCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCancel = () => {
    closeRTC()
    navigate('/')
  }

  // Redirect if no session
  useEffect(() => {
    if (!sessionCode || !file) {
      navigate('/')
    }
  }, [sessionCode, file, navigate])

  if (!sessionCode || !file) return null

  const shareUrl = `${window.location.origin}/receive?code=${sessionCode}`
  const codeDigits = sessionCode.split('')

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-md flex flex-col gap-6">
        {/* Central Card */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
          {/* Page Heading Section */}
          <div className="p-8 pb-4 text-center">
            <h1 className="text-3xl font-black leading-tight tracking-tight text-text-main mb-3">
              Ready to Share
            </h1>
            <p className="text-text-secondary text-base font-normal leading-normal">
              Share the code below or scan the QR code to start the transfer.
            </p>
          </div>

          {/* Confirmation Code Display */}
          <div className="flex flex-col items-center justify-center gap-4 px-6 py-4">
            <div className="flex gap-2 sm:gap-3">
              {codeDigits.map((digit, index) => (
                <div
                  key={index}
                  className="flex h-16 w-10 sm:w-14 items-center justify-center rounded-lg border-b-4 border-primary bg-background-light text-3xl font-bold text-text-main"
                >
                  {digit}
                </div>
              ))}
            </div>
            <button
              onClick={handleCopyCode}
              className="flex items-center gap-2 text-sm font-bold text-text-secondary hover:text-primary transition-colors mt-2"
            >
              <span className="material-symbols-outlined text-lg">
                {copied ? 'check' : 'content_copy'}
              </span>
              {copied ? 'Copied!' : 'Copy to clipboard'}
            </button>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-100 my-2"></div>

          {/* QR Code & Status Section */}
          <div className="p-6 flex flex-col items-center gap-6">
            {/* QR Code Container */}
            <div className="relative p-3 rounded-xl border border-gray-200 bg-white shadow-sm">
              <QRCodeSVG 
                value={shareUrl} 
                size={192}
                level="M"
                includeMargin={false}
              />
            </div>

            {/* Animated Status Badge */}
            <div className={`flex items-center gap-3 px-4 py-2.5 rounded-full border ${
              receiverConnected 
                ? 'bg-green-50 border-green-200' 
                : 'bg-primary/10 border-primary/20'
            }`}>
              <span className="relative flex h-3 w-3">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  receiverConnected ? 'bg-green-500' : 'bg-primary'
                }`}></span>
                <span className={`relative inline-flex rounded-full h-3 w-3 ${
                  receiverConnected ? 'bg-green-500' : 'bg-primary'
                }`}></span>
              </span>
              <span className={`text-sm font-bold ${
                receiverConnected ? 'text-green-700' : 'text-text-main'
              }`}>
                {status === 'waiting' && 'Waiting for receiver...'}
                {status === 'connecting' && 'Connecting...'}
                {status === 'ready' && 'Connected! Waiting for confirmation...'}
                {status === 'rejected' && 'Transfer rejected'}
              </span>
            </div>
          </div>

          {/* File Details */}
          <div className="bg-background-light p-5 border-t border-gray-100">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 overflow-hidden">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white text-text-main shadow-sm border border-gray-200">
                  <span className="material-symbols-outlined text-2xl">{getFileIcon(file.type)}</span>
                </div>
                <div className="flex flex-col justify-center min-w-0">
                  <p className="text-text-main text-base font-bold leading-normal truncate">{file.name}</p>
                  <div className="flex items-center gap-2 text-text-secondary text-sm">
                    <span className="font-medium">{formatFileSize(file.size)}</span>
                    <span className="text-xs">|</span>
                    <span className="font-mono text-xs truncate max-w-[120px]">
                      SHA: {formatHash(fileHash, 4)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="shrink-0 text-text-secondary" title="File Verified">
                <span className="material-symbols-outlined">verified</span>
              </div>
            </div>
          </div>
        </div>

        {/* Cancel Button */}
        <button
          onClick={handleCancel}
          className="w-full rounded-xl bg-white border border-gray-200 py-3.5 text-sm font-bold text-text-main shadow-sm hover:bg-gray-50 transition-colors focus:ring-2 focus:ring-primary focus:outline-none"
        >
          Cancel Transfer
        </button>
      </div>
    </div>
  )
}
