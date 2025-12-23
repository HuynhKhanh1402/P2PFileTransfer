import { useEffect } from 'react'
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
    reset,
  } = useTransfer()

  const displayFile = role === 'sender' ? file : receivedFile
  const displayMeta = role === 'sender' 
    ? (file ? { name: file.name, size: file.size, type: file.type } : null)
    : fileMeta
  const displayHash = role === 'sender' ? fileHash : fileMeta?.hash

  const handleSendAnother = () => {
    if (role === 'receiver') {
      reset()
      navigate('/receive')
    } else {
      reset()
      navigate('/')
    }
  }

  // Redirect if no session data
  useEffect(() => {
    if (!displayFile && !displayMeta) {
      navigate('/')
    }
  }, [displayFile, displayMeta, navigate])

  const isSuccess = hashVerified !== false

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 w-full max-w-[960px] mx-auto">
      {/* Success Card */}
      <div className="w-full max-w-[480px] bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden animate-fade-in-up">
        {/* Status Icon Area */}
        <div className="flex flex-col items-center justify-center pt-10 pb-6 px-6">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 animate-scale-in ${
            isSuccess ? 'bg-green-50' : 'bg-red-50'
          }`}>
            <span className={`material-symbols-outlined text-[48px] ${
              isSuccess ? 'text-green-600' : 'text-red-500'
            }`}>
              {isSuccess ? 'check_circle' : 'warning'}
            </span>
          </div>
          <h1 className="text-text-main tracking-tight text-[28px] sm:text-[32px] font-bold leading-tight text-center mb-2">
            {isSuccess ? 'Transfer completed' : 'Transfer failed'}
          </h1>
          <p className="text-text-secondary text-base font-normal leading-normal text-center max-w-xs mx-auto">
            {isSuccess 
              ? 'The file hash has been verified securely. Your download is ready.'
              : 'Hash mismatch detected. The file may be corrupted or modified.'
            }
          </p>
        </div>

        {/* File Details Card */}
        <div className="px-6 pb-6">
          <div className="bg-background-light rounded-lg p-4 flex items-center gap-4 border border-gray-200">
            <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center text-primary shadow-sm shrink-0">
              <span className="material-symbols-outlined text-2xl">
                {displayMeta ? getFileIcon(displayMeta.type) : 'description'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-text-main font-medium text-sm truncate">
                {displayMeta?.name || displayFile?.name || 'Unknown file'}
              </p>
              <p className="text-text-secondary text-xs">
                {displayMeta ? formatFileSize(displayMeta.size) : displayFile ? formatFileSize(displayFile.size) : '0 B'}
                {displayMeta?.type ? ` - ${displayMeta.type.split('/')[1]?.toUpperCase() || 'File'}` : ''}
              </p>
            </div>
            <div className={`shrink-0 ${isSuccess ? 'text-green-600' : 'text-red-500'}`} title={isSuccess ? 'Verified' : 'Failed'}>
              <span className="material-symbols-outlined text-xl">
                {isSuccess ? 'verified_user' : 'gpp_bad'}
              </span>
            </div>
          </div>
        </div>

        {/* Hash Verification */}
        <div className="px-6 pb-8 flex justify-center">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${
            isSuccess 
              ? 'bg-gray-50 border-gray-200' 
              : 'bg-red-50 border-red-200'
          }`}>
            <span className={`material-symbols-outlined text-[16px] ${
              isSuccess ? 'text-text-secondary' : 'text-red-500'
            }`}>
              fingerprint
            </span>
            <span className={`text-xs font-mono tracking-wide ${
              isSuccess ? 'text-text-secondary' : 'text-red-600'
            }`}>
              SHA-256: {displayHash ? formatHash(displayHash, 6) : 'N/A'}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-10 flex flex-col gap-3">
          <button
            onClick={handleSendAnother}
            className="flex w-full cursor-pointer items-center justify-center rounded-xl h-12 px-6 bg-primary hover:bg-primary-hover transition-colors text-text-main text-base font-bold shadow-sm hover:shadow-md"
          >
            {role === 'sender' ? 'Send Another File' : 'Receive Another File'}
          </button>
        </div>

        {/* Secure Footer within card */}
        <div className="bg-gray-50 px-6 py-3 border-t border-gray-100 flex items-center justify-center gap-2">
          <span className="material-symbols-outlined text-[14px] text-text-secondary">lock</span>
          <span className="text-[12px] text-text-secondary font-medium">End-to-end encrypted P2P transfer</span>
        </div>
      </div>

      {/* Failure State Info (only show on failure) */}
      {!isSuccess && (
        <div className="mt-8 w-full max-w-[480px]">
          <div className="w-full bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden p-6 flex items-center gap-4">
            <div className="w-12 h-12 bg-yellow-50 rounded-full flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-2xl text-yellow-600">help</span>
            </div>
            <div className="flex-1">
              <h3 className="text-text-main font-bold text-sm">What went wrong?</h3>
              <p className="text-text-secondary text-xs mt-0.5">
                The file integrity check failed. This could be due to network issues or file corruption during transfer.
              </p>
            </div>
            <button
              onClick={handleSendAnother}
              className="px-4 py-2 bg-primary rounded-lg text-xs font-bold text-text-main"
            >
              Retry
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
