import { useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTransfer } from '../context/TransferContext'
import { formatFileSize, formatHash, getFileIcon } from '../utils/formatters'

export default function ResultPage() {
  const navigate = useNavigate()
  const { 
    role,
    file,
    fileMeta,
    fileHash,
    receivedFile,
    hashVerified,
    storageStrategyType,
    reset,
  } = useTransfer()

  const downloadTriggeredRef = useRef(false)

  const displayFile = role === 'sender' ? file : receivedFile
  const displayMeta = role === 'sender' 
    ? (file ? { name: file.name, size: file.size, type: file.type } : null)
    : fileMeta
  const displayHash = role === 'sender' ? fileHash : fileMeta?.hash

  // Download file function for receiver
  const downloadFile = useCallback(() => {
    if (!receivedFile) return
    
    const url = URL.createObjectURL(receivedFile)
    const a = document.createElement('a')
    a.href = url
    a.download = receivedFile.name || fileMeta?.name || 'downloaded-file'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [receivedFile, fileMeta])

  const handleSendAnother = () => {
    if (role === 'receiver') {
      reset()
      navigate('/receive')
    } else {
      reset()
      navigate('/')
    }
  }

  // Auto-download file for receiver when transfer completes (except for filesystem strategy which saves directly)
  useEffect(() => {
    if (role === 'receiver' && receivedFile && !downloadTriggeredRef.current && storageStrategyType !== 'filesystem') {
      downloadTriggeredRef.current = true
      // Small delay to ensure UI is rendered first
      setTimeout(() => {
        downloadFile()
      }, 500)
    }
  }, [role, receivedFile, storageStrategyType, downloadFile])

  // Redirect if no session data
  useEffect(() => {
    if (!displayFile && !displayMeta) {
      navigate('/')
    }
  }, [displayFile, displayMeta, navigate])

  const isSuccess = hashVerified !== false

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-3 sm:p-6 w-full max-w-[960px] mx-auto">
      {/* Success Card */}
      <div className="w-full max-w-[480px] bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden animate-fade-in-up">
        {/* Status Icon Area */}
        <div className="flex flex-col items-center justify-center pt-6 sm:pt-10 pb-4 sm:pb-6 px-4 sm:px-6">
          <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center mb-4 sm:mb-6 animate-scale-in ${
            isSuccess ? 'bg-green-50' : 'bg-red-50'
          }`}>
            <span className={`material-symbols-outlined text-[36px] sm:text-[48px] ${
              isSuccess ? 'text-green-600' : 'text-red-500'
            }`}>
              {isSuccess ? 'check_circle' : 'warning'}
            </span>
          </div>
          <h1 className="text-text-main tracking-tight text-2xl sm:text-[28px] lg:text-[32px] font-bold leading-tight text-center mb-2">
            {isSuccess ? 'Transfer completed' : 'Transfer failed'}
          </h1>
          <p className="text-text-secondary text-sm sm:text-base font-normal leading-normal text-center max-w-xs mx-auto px-2">
            {isSuccess 
              ? 'File hash verified. Your download is ready.'
              : 'Hash mismatch. File may be corrupted.'
            }
          </p>
        </div>

        {/* File Details Card */}
        <div className="px-4 sm:px-6 pb-4 sm:pb-6">
          <div className="bg-background-light rounded-lg p-3 sm:p-4 flex items-center gap-3 sm:gap-4 border border-gray-200">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-lg flex items-center justify-center text-primary shadow-sm shrink-0">
              <span className="material-symbols-outlined text-xl sm:text-2xl">
                {displayMeta ? getFileIcon(displayMeta.type) : 'description'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-text-main font-medium text-xs sm:text-sm truncate" title={displayMeta?.name || displayFile?.name}>
                {displayMeta?.name || displayFile?.name || 'Unknown file'}
              </p>
              <p className="text-text-secondary text-[10px] sm:text-xs">
                {displayMeta ? formatFileSize(displayMeta.size) : displayFile ? formatFileSize(displayFile.size) : '0 B'}
                {displayMeta?.type ? ` - ${displayMeta.type.split('/')[1]?.toUpperCase() || 'File'}` : ''}
              </p>
            </div>
            <div className={`shrink-0 ${isSuccess ? 'text-green-600' : 'text-red-500'}`} title={isSuccess ? 'Verified' : 'Failed'}>
              <span className="material-symbols-outlined text-lg sm:text-xl">
                {isSuccess ? 'verified_user' : 'gpp_bad'}
              </span>
            </div>
          </div>
        </div>

        {/* Hash Verification */}
        <div className="px-4 sm:px-6 pb-6 sm:pb-8 flex justify-center">
          <div className={`inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full border ${
            isSuccess 
              ? 'bg-gray-50 border-gray-200' 
              : 'bg-red-50 border-red-200'
          }`}>
            <span className={`material-symbols-outlined text-[14px] sm:text-[16px] ${
              isSuccess ? 'text-text-secondary' : 'text-red-500'
            }`}>
              fingerprint
            </span>
            <span className={`text-[10px] sm:text-xs font-mono tracking-wide truncate max-w-[180px] sm:max-w-none ${
              isSuccess ? 'text-text-secondary' : 'text-red-600'
            }`}>
              SHA-256: {displayHash ? formatHash(displayHash, 6) : 'N/A'}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="px-4 sm:px-6 pb-6 sm:pb-10 flex flex-col gap-2 sm:gap-3">
          {/* Download button for receiver (only show if file is available and not using filesystem strategy) */}
          {role === 'receiver' && receivedFile && storageStrategyType !== 'filesystem' && (
            <button
              onClick={downloadFile}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl h-11 sm:h-12 px-4 sm:px-6 bg-green-600 hover:bg-green-700 transition-colors text-white text-sm sm:text-base font-bold shadow-sm hover:shadow-md"
            >
              <span className="material-symbols-outlined text-lg sm:text-xl">download</span>
              Download File
            </button>
          )}
          {/* Info for filesystem strategy */}
          {role === 'receiver' && storageStrategyType === 'filesystem' && (
            <div className="flex w-full items-center justify-center gap-2 rounded-xl h-11 sm:h-12 px-4 sm:px-6 bg-green-50 border border-green-200 text-green-700 text-xs sm:text-sm font-medium">
              <span className="material-symbols-outlined text-lg sm:text-xl">check_circle</span>
              File saved to your selected location
            </div>
          )}
          <button
            onClick={handleSendAnother}
            className="flex w-full cursor-pointer items-center justify-center rounded-xl h-11 sm:h-12 px-4 sm:px-6 bg-primary hover:bg-primary-hover transition-colors text-text-main text-sm sm:text-base font-bold shadow-sm hover:shadow-md"
          >
            {role === 'sender' ? 'Send Another' : 'Receive Another'}
          </button>
        </div>

        {/* Secure Footer within card */}
        <div className="bg-gray-50 px-4 sm:px-6 py-2.5 sm:py-3 border-t border-gray-100 flex items-center justify-center gap-1.5 sm:gap-2">
          <span className="material-symbols-outlined text-[12px] sm:text-[14px] text-text-secondary">lock</span>
          <span className="text-[10px] sm:text-[12px] text-text-secondary font-medium">End-to-end encrypted P2P transfer</span>
        </div>
      </div>

      {/* Failure State Info (only show on failure) */}
      {!isSuccess && (
        <div className="mt-4 sm:mt-8 w-full max-w-[480px] px-1">
          <div className="w-full bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden p-4 sm:p-6 flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-yellow-50 rounded-full flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-xl sm:text-2xl text-yellow-600">help</span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-text-main font-bold text-xs sm:text-sm">What went wrong?</h3>
              <p className="text-text-secondary text-[10px] sm:text-xs mt-0.5">
                File integrity check failed. Try again.
              </p>
            </div>
            <button
              onClick={handleSendAnother}
              className="px-3 sm:px-4 py-1.5 sm:py-2 bg-primary rounded-lg text-[10px] sm:text-xs font-bold text-text-main shrink-0"
            >
              Retry
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
