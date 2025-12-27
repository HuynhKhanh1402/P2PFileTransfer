import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTransfer } from '../context/TransferContext'
import { calculateSHA256 } from '../utils/crypto'
import { formatFileSize, formatHash, getFileIcon } from '../utils/formatters'
import { createSession } from '../services/api'

export default function HomePage() {
  const navigate = useNavigate()
  const { setFile, setFileHash, setRole, setSessionCode, setFileMeta } = useTransfer()
  const [selectedFile, setSelectedFile] = useState(null)
  const [hash, setHash] = useState(null)
  const [isHashing, setIsHashing] = useState(false)
  const [hashProgress, setHashProgress] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [isCreatingSession, setIsCreatingSession] = useState(false)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)

  const handleFileSelect = useCallback(async (file) => {
    setSelectedFile(file)
    setError(null)
    setHash(null)
    setIsHashing(true)
    setHashProgress(0)

    try {
      console.log(`[HomePage] Starting hash calculation for file: ${file.name}, size: ${file.size}`)
      const fileHash = await calculateSHA256(file, (progress) => {
        setHashProgress(progress)
      })
      console.log(`[HomePage] Hash calculated: ${fileHash}`)
      setHash(fileHash)
    } catch (err) {
      console.error('Error calculating hash:', err)
      if (err.message.includes('Web Crypto API')) {
        setError('Crypto API not available. Please use HTTPS or localhost.')
      } else {
        setError('Failed to calculate file hash')
      }
    } finally {
      setIsHashing(false)
      setHashProgress(100)
    }
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
    
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }, [handleFileSelect])

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleInputChange = useCallback((e) => {
    const files = e.target.files
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }, [handleFileSelect])

  const handleGenerateCode = async () => {
    if (!selectedFile || !hash) return

    setIsCreatingSession(true)
    setError(null)

    try {
      const data = await createSession()

      // Set global state
      setFile(selectedFile)
      setFileHash(hash)
      setSessionCode(data.code)
      setRole('sender')
      setFileMeta({
        name: selectedFile.name,
        size: selectedFile.size,
        type: selectedFile.type,
        hash: hash,
      })

      // Navigate to share page
      navigate('/share')
    } catch (err) {
      console.error('Error creating session:', err)
      setError('Failed to create session. Make sure the server is running.')
    } finally {
      setIsCreatingSession(false)
    }
  }

  const handleClear = () => {
    setSelectedFile(null)
    setHash(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="flex-grow flex flex-col items-center justify-center p-3 sm:px-6 lg:px-8 py-6 sm:py-12">
      <div className="w-full max-w-[640px] flex flex-col gap-6 sm:gap-10">
        {/* Hero Heading */}
        <div className="text-center space-y-3 sm:space-y-4 px-2">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-text-main leading-tight">
            Secure P2P <br />
            <span className="text-primary relative inline-block">
              File Transfer
              <svg className="absolute w-full h-2 sm:h-3 -bottom-0.5 sm:-bottom-1 left-0 text-primary opacity-30 -z-10" preserveAspectRatio="none" viewBox="0 0 100 10">
                <path d="M0 5 Q 50 10 100 5" fill="none" stroke="currentColor" strokeWidth="8"></path>
              </svg>
            </span>
          </h1>
          <p className="text-text-secondary text-sm sm:text-lg max-w-lg mx-auto leading-relaxed">
            Send files directly to your peers. <br className="hidden sm:block"/>No storage limits, end-to-end encrypted.
          </p>
        </div>

        {/* Upload/File Card */}
        <div className="bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden relative">
          {/* Card Header / Status Indicator */}
          {selectedFile && (
            <div className="px-4 sm:px-6 pt-4 sm:pt-6 pb-2 flex justify-between items-center">
              <span className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 rounded-full bg-green-100 text-green-700 text-[10px] sm:text-xs font-bold uppercase tracking-wider">
                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-green-500 animate-pulse"></span>
                File Ready
              </span>
              <button
                onClick={handleClear}
                className="text-text-secondary hover:text-red-500 transition-colors text-xs sm:text-sm font-medium flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-xs sm:text-sm">delete</span>
                Clear
              </button>
            </div>
          )}

          {/* Drop Zone / File Preview */}
          <div className="px-4 sm:px-6 py-3 sm:py-4">
            {!selectedFile ? (
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  border-2 border-dashed rounded-xl p-6 sm:p-12 text-center cursor-pointer
                  transition-all duration-200
                  ${isDragging 
                    ? 'border-primary bg-primary/5' 
                    : 'border-gray-200 hover:border-primary/50 hover:bg-gray-50'
                  }
                `}
              >
                <div className="flex flex-col items-center gap-3 sm:gap-4">
                  <div className="size-12 sm:size-16 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400">
                    <span className="material-symbols-outlined text-2xl sm:text-4xl">cloud_upload</span>
                  </div>
                  <div>
                    <p className="text-text-main font-semibold mb-1 text-sm sm:text-base">Drag & Drop File Here</p>
                    <p className="text-text-secondary text-xs sm:text-sm">or tap to browse</p>
                  </div>
                  <p className="text-text-secondary text-[10px] sm:text-xs">(Max size: Unlimited)</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleInputChange}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-5 items-start sm:items-center bg-background-light p-3 sm:p-4 rounded-xl border border-gray-200 hover:border-primary/50 transition-colors">
                {/* Icon */}
                <div className="shrink-0 size-12 sm:size-16 rounded-xl bg-white shadow-sm flex items-center justify-center text-primary border border-gray-100">
                  <span className="material-symbols-outlined text-2xl sm:text-4xl">{getFileIcon(selectedFile.type)}</span>
                </div>
                {/* Details */}
                <div className="flex-1 min-w-0 space-y-1 w-full">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-text-main text-sm sm:text-lg font-bold truncate" title={selectedFile.name}>{selectedFile.name}</p>
                    {hash && <span className="material-symbols-outlined text-green-500 text-lg sm:text-xl shrink-0" title="Hash Calculated">check_circle</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 sm:gap-x-4 gap-y-1 text-xs sm:text-sm text-text-secondary">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm sm:text-base">hard_drive</span>
                      {formatFileSize(selectedFile.size)}
                    </span>
                    <span className="hidden sm:inline w-1 h-1 rounded-full bg-gray-300"></span>
                    {isHashing ? (
                      <span className="flex items-center gap-1 text-[10px] sm:text-xs">
                        <span className="material-symbols-outlined text-sm sm:text-base animate-spin">progress_activity</span>
                        Hashing... {hashProgress}%
                      </span>
                    ) : hash ? (
                      <span className="font-mono text-[10px] sm:text-xs bg-gray-100 px-1.5 sm:px-2 py-0.5 rounded text-gray-500 truncate max-w-[140px] sm:max-w-[200px]">
                        SHA-256: {formatHash(hash)}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Error message */}
          {error && (
            <div className="px-4 sm:px-6 pb-3 sm:pb-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 sm:p-3 text-red-700 text-xs sm:text-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-base sm:text-lg shrink-0">error</span>
                <span className="break-words">{error}</span>
              </div>
            </div>
          )}

          {/* Action Area */}
          {selectedFile && (
            <div className="px-4 sm:px-6 pb-6 sm:pb-8 pt-2 flex flex-col gap-3 sm:gap-4">
              <button
                onClick={handleGenerateCode}
                disabled={!hash || isCreatingSession}
                className="w-full relative overflow-hidden rounded-xl h-12 sm:h-14 bg-primary hover:bg-primary-hover active:scale-[0.99] transition-all text-text-main text-base sm:text-lg font-bold flex items-center justify-center gap-2 sm:gap-3 shadow-[0_4px_0_rgb(202,138,4)] hover:shadow-[0_2px_0_rgb(202,138,4)] hover:translate-y-[2px] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreatingSession ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-xl sm:text-2xl">progress_activity</span>
                    <span className="text-sm sm:text-lg">Creating...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-xl sm:text-2xl">vpn_key</span>
                    <span className="text-sm sm:text-lg">Generate Share Code</span>
                  </>
                )}
              </button>
              <p className="text-center text-[10px] sm:text-xs text-text-secondary mt-1 sm:mt-2">
                By generating a code, you agree to our <a className="underline hover:text-text-main" href="#">Terms</a>.
              </p>
            </div>
          )}

          {/* Background Decoration */}
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>
        </div>
      </div>
    </div>
  )
}
