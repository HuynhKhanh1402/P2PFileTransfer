import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTransfer } from '../context/TransferContext'
import { useSocket } from '../hooks/useSocket'
import { useWebRTCContext } from '../context/WebRTCContext'
import { formatFileSize, formatHash, getFileIcon } from '../utils/formatters'

export default function ConfirmPage() {
  const navigate = useNavigate()
  const { 
    sessionCode, 
    role, 
    fileMeta, 
    setFileMeta,
    setTransferStatus,
  } = useTransfer()
  
  const { socket, emit, on, off } = useSocket()
  const [isAccepting, setIsAccepting] = useState(false)

  const { 
    createAnswer, 
    setRemoteDescription,
    setStateChangeHandler,
  } = useWebRTCContext()

  // Handle WebRTC state changes
  useEffect(() => {
    setStateChangeHandler((state) => {
      console.log('WebRTC state:', state)
      if (state === 'connected') {
        setTransferStatus('connected')
      }
    })
  }, [setStateChangeHandler, setTransferStatus])

  // Handle incoming file meta and WebRTC signaling
  useEffect(() => {
    if (!socket) return

    const handleFileMeta = (data) => {
      console.log('Received file meta:', data)
      setFileMeta(data)
    }

    const handleOffer = async (offer) => {
      console.log('Received offer')
      try {
        const answer = await createAnswer(offer)
        emit('answer', answer)
      } catch (err) {
        console.error('Error creating answer:', err)
      }
    }

    on('file-meta', handleFileMeta)
    on('offer', handleOffer)

    return () => {
      off('file-meta', handleFileMeta)
      off('offer', handleOffer)
    }
  }, [socket, on, off, emit, createAnswer, setFileMeta])

  const handleAccept = () => {
    setIsAccepting(true)
    emit('accept-transfer')
    setTransferStatus('transferring')
    navigate('/transfer')
  }

  const handleReject = () => {
    emit('reject-transfer')
    navigate('/')
  }

  // Redirect if not a receiver or no session
  useEffect(() => {
    if (!sessionCode || role !== 'receiver') {
      navigate('/receive')
    }
  }, [sessionCode, role, navigate])

  if (!sessionCode || role !== 'receiver') return null

  return (
    <div className="flex h-full grow flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="flex flex-col w-full max-w-[520px]">
        {/* Central Card */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          {/* Card Header with Visual */}
          <div 
            className="relative h-48 sm:h-56 bg-gradient-to-b from-primary/20 to-primary/5 flex flex-col items-center justify-center text-center p-6 gap-4"
          >
            {/* File Icon Badge */}
            <div className="bg-white rounded-full p-4 shadow-lg mb-2">
              <span className="material-symbols-outlined text-4xl text-primary">
                {fileMeta ? getFileIcon(fileMeta.type) : 'description'}
              </span>
            </div>
            <div className="flex flex-col gap-1 z-10">
              <h1 className="text-text-main tracking-tight text-2xl font-bold leading-tight">
                Incoming File Request
              </h1>
              <p className="text-text-secondary text-sm font-medium leading-normal flex items-center justify-center gap-2">
                Secure P2P Transfer
                <span className="material-symbols-outlined text-[16px] text-green-500" title="Secure Connection">
                  lock
                </span>
              </p>
            </div>
          </div>

          {/* Description List (File Details) */}
          <div className="p-6 sm:p-8">
            {fileMeta ? (
              <div className="flex flex-col gap-0">
                {/* Item 1: File Name */}
                <div className="flex flex-col sm:flex-row sm:justify-between py-4 border-b border-gray-100">
                  <p className="text-text-secondary text-sm font-medium mb-1 sm:mb-0">File Name</p>
                  <p className="text-text-main text-base font-semibold leading-normal break-all sm:text-right">
                    {fileMeta.name}
                  </p>
                </div>

                {/* Item 2: File Size */}
                <div className="flex flex-col sm:flex-row sm:justify-between py-4 border-b border-gray-100">
                  <p className="text-text-secondary text-sm font-medium mb-1 sm:mb-0">File Size</p>
                  <p className="text-text-main text-base font-semibold leading-normal sm:text-right">
                    {formatFileSize(fileMeta.size)}
                  </p>
                </div>

                {/* Item 3: Hash */}
                <div className="flex flex-col py-4">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-text-secondary text-sm font-medium">Integrity (SHA-256)</p>
                    <span className="px-2 py-0.5 rounded bg-green-100 text-green-700 text-xs font-bold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">check_circle</span> 
                      Verified
                    </span>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-between gap-3 group cursor-pointer hover:bg-gray-100 transition-colors">
                    <p className="text-text-main text-xs sm:text-sm font-mono leading-normal truncate">
                      {fileMeta.hash || 'Calculating...'}
                    </p>
                    <button 
                      onClick={() => navigator.clipboard.writeText(fileMeta.hash)}
                      className="text-text-secondary hover:text-text-main transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">content_copy</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8">
                <span className="material-symbols-outlined text-4xl text-gray-300 animate-spin mb-4">
                  progress_activity
                </span>
                <p className="text-text-secondary">Waiting for file information...</p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="bg-gray-50 px-6 py-6 sm:px-8 border-t border-gray-100">
            <div className="flex flex-col-reverse sm:flex-row gap-3">
              <button
                onClick={handleReject}
                className="flex flex-1 cursor-pointer items-center justify-center overflow-hidden rounded-xl h-12 px-5 bg-transparent border border-gray-200 text-text-main hover:bg-gray-100 text-base font-bold leading-normal tracking-tight transition-all"
              >
                <span className="material-symbols-outlined mr-2 text-[20px]">close</span>
                Reject
              </button>
              <button
                onClick={handleAccept}
                disabled={!fileMeta || isAccepting}
                className="flex flex-1 cursor-pointer items-center justify-center overflow-hidden rounded-xl h-12 px-5 bg-primary hover:bg-primary-hover text-text-main text-base font-bold leading-normal tracking-tight transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAccepting ? (
                  <>
                    <span className="material-symbols-outlined mr-2 text-[20px] animate-spin">progress_activity</span>
                    Connecting...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined mr-2 text-[20px]">download</span>
                    Accept Transfer
                  </>
                )}
              </button>
            </div>
            <p className="text-center text-text-secondary text-xs mt-4">
              By accepting, you confirm the file integrity matches your expectation.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
