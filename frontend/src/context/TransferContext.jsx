import { createContext, useContext, useState, useCallback } from 'react'

const TransferContext = createContext(null)

export function TransferProvider({ children }) {
  const [file, setFile] = useState(null)
  const [fileHash, setFileHash] = useState(null)
  const [sessionCode, setSessionCode] = useState(null)
  const [role, setRole] = useState(null) // 'sender' or 'receiver'
  const [fileMeta, setFileMeta] = useState(null)
  const [transferStatus, setTransferStatus] = useState('idle') // idle, connecting, waiting, transferring, complete, error
  const [transferProgress, setTransferProgress] = useState(0)
  const [transferSpeed, setTransferSpeed] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState(null)
  const [error, setError] = useState(null)
  const [receivedFile, setReceivedFile] = useState(null)
  const [hashVerified, setHashVerified] = useState(null)

  const reset = useCallback(() => {
    setFile(null)
    setFileHash(null)
    setSessionCode(null)
    setRole(null)
    setFileMeta(null)
    setTransferStatus('idle')
    setTransferProgress(0)
    setTransferSpeed(0)
    setTimeRemaining(null)
    setError(null)
    setReceivedFile(null)
    setHashVerified(null)
  }, [])

  const value = {
    file,
    setFile,
    fileHash,
    setFileHash,
    sessionCode,
    setSessionCode,
    role,
    setRole,
    fileMeta,
    setFileMeta,
    transferStatus,
    setTransferStatus,
    transferProgress,
    setTransferProgress,
    transferSpeed,
    setTransferSpeed,
    timeRemaining,
    setTimeRemaining,
    error,
    setError,
    receivedFile,
    setReceivedFile,
    hashVerified,
    setHashVerified,
    reset,
  }

  return (
    <TransferContext.Provider value={value}>
      {children}
    </TransferContext.Provider>
  )
}

export function useTransfer() {
  const context = useContext(TransferContext)
  if (!context) {
    throw new Error('useTransfer must be used within a TransferProvider')
  }
  return context
}
