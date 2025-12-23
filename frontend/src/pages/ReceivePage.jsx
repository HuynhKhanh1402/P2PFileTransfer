import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTransfer } from '../context/TransferContext'
import { useSocket } from '../hooks/useSocket'
import { checkSession } from '../services/api'

export default function ReceivePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { setRole, setSessionCode, setFileMeta } = useTransfer()
  const { isConnected, emit, on, off } = useSocket()
  
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const inputRefs = useRef([])

  // Check for code in URL params
  useEffect(() => {
    const urlCode = searchParams.get('code')
    if (urlCode && urlCode.length === 6) {
      setCode(urlCode.split(''))
    }
  }, [searchParams])

  const handleInputChange = useCallback((index, value) => {
    if (!/^\d*$/.test(value)) return

    const newCode = [...code]
    
    if (value.length > 1) {
      // Handle paste
      const digits = value.slice(0, 6 - index).split('')
      digits.forEach((digit, i) => {
        if (index + i < 6) {
          newCode[index + i] = digit
        }
      })
      setCode(newCode)
      
      const nextIndex = Math.min(index + digits.length, 5)
      inputRefs.current[nextIndex]?.focus()
    } else {
      newCode[index] = value
      setCode(newCode)
      
      if (value && index < 5) {
        inputRefs.current[index + 1]?.focus()
      }
    }
    
    setError(null)
  }, [code])

  const handleKeyDown = useCallback((index, e) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus()
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }, [code])

  const handleConnect = async () => {
    const fullCode = code.join('')
    
    if (fullCode.length !== 6) {
      setError('Please enter a complete 6-digit code')
      return
    }

    setIsConnecting(true)
    setError(null)

    try {
      // Check if session exists
      const data = await checkSession(fullCode)

      if (!data.exists) {
        setError('Session not found. Please check your code.')
        setIsConnecting(false)
        return
      }

      // Set global state
      setRole('receiver')
      setSessionCode(fullCode)

      // Join session via socket
      emit('receiver-join', fullCode)
    } catch (err) {
      console.error('Error connecting:', err)
      setError('Failed to connect. Make sure the server is running.')
      setIsConnecting(false)
    }
  }

  // Handle socket events
  useEffect(() => {
    const handleSessionJoined = (data) => {
      console.log('Joined session as receiver:', data)
      // Navigate to confirm page
      navigate('/confirm')
    }

    const handleFileMeta = (data) => {
      console.log('Received file meta in ReceivePage:', data)
      setFileMeta(data)
    }

    const handleError = (data) => {
      setError(data.message)
      setIsConnecting(false)
    }

    on('session-joined', handleSessionJoined)
    on('file-meta', handleFileMeta)
    on('error', handleError)

    return () => {
      off('session-joined', handleSessionJoined)
      off('file-meta', handleFileMeta)
      off('error', handleError)
    }
  }, [on, off, navigate, setFileMeta])

  return (
    <div className="flex-grow flex items-center justify-center p-3 sm:p-6 lg:p-8">
      <div className="w-full max-w-[520px] flex flex-col gap-4 sm:gap-6">
        {/* Status Badge */}
        <div className="flex justify-center mb-1 sm:mb-2">
          <div className={`inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-medium ${
            isConnected 
              ? 'bg-green-100 text-green-700' 
              : 'bg-gray-100 text-gray-700'
          }`}>
            <span className="relative flex h-1.5 w-1.5 sm:h-2 sm:w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isConnected ? 'bg-green-400' : 'bg-gray-400'
              }`}></span>
              <span className={`relative inline-flex rounded-full h-1.5 w-1.5 sm:h-2 sm:w-2 ${
                isConnected ? 'bg-green-500' : 'bg-gray-500'
              }`}></span>
            </span>
            {isConnected ? 'Ready to connect' : 'Connecting...'}
          </div>
        </div>

        {/* Central Card */}
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 p-5 sm:p-8 lg:p-10 flex flex-col items-center text-center">
          {/* Icon Header */}
          <div className="mb-4 sm:mb-6 bg-yellow-50 p-3 sm:p-4 rounded-full text-yellow-600">
            <span className="material-symbols-outlined text-[32px] sm:text-[40px]">download_for_offline</span>
          </div>

          {/* Text Content */}
          <h1 className="text-text-main text-2xl sm:text-3xl font-bold tracking-tight mb-2 sm:mb-3">Receive Files</h1>
          <p className="text-gray-500 text-sm sm:text-base leading-relaxed max-w-sm mb-5 sm:mb-8 px-2">
            Enter the 6-digit code from the sender to start secure transfer.
          </p>

          {/* Input Field */}
          <form onSubmit={(e) => { e.preventDefault(); handleConnect(); }} className="w-full flex flex-col gap-5 sm:gap-8">
            <div className="flex justify-center w-full">
              <div className="flex gap-1.5 sm:gap-2 md:gap-3">
                {code.map((digit, index) => (
                  <div key={index} className="flex items-center">
                    <input
                      ref={(el) => (inputRefs.current[index] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={digit}
                      onChange={(e) => handleInputChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      autoFocus={index === 0}
                      className="flex h-12 w-10 sm:h-14 sm:w-12 md:h-16 md:w-14 text-center rounded-lg border border-gray-200 bg-gray-50 text-xl sm:text-2xl font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all shadow-sm placeholder-gray-300"
                      placeholder="-"
                    />
                    {index === 2 && (
                      <div className="flex items-center justify-center px-0.5 sm:px-1 md:px-2">
                        <span className="w-1.5 sm:w-2 h-0.5 bg-gray-300 rounded-full"></span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 sm:p-3 text-red-700 text-xs sm:text-sm flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-base sm:text-lg shrink-0">error</span>
                <span className="break-words text-left">{error}</span>
              </div>
            )}

            {/* Action Button */}
            <button
              type="submit"
              disabled={isConnecting || !isConnected}
              className="w-full flex items-center justify-center gap-2 h-11 sm:h-12 rounded-xl bg-primary hover:bg-primary-hover active:bg-yellow-500 text-text-main text-sm sm:text-base font-bold shadow-md hover:shadow-lg transition-all duration-200 transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isConnecting ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-lg sm:text-xl">progress_activity</span>
                  Connecting...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg sm:text-xl">link</span>
                  Connect
                </>
              )}
            </button>
          </form>

          {/* Footer Link */}
          <div className="mt-4 sm:mt-6 text-xs sm:text-sm">
            <span className="text-gray-500">Having trouble? </span>
            <a className="font-medium text-text-main hover:text-primary underline decoration-primary/30 hover:decoration-primary underline-offset-4 transition-all" href="#">
              Get help
            </a>
          </div>
        </div>

        {/* Additional Help/Info */}
        <div className="text-center px-4">
          <p className="text-[10px] sm:text-xs text-gray-400">
            By connecting, you agree to our <a className="hover:underline" href="#">Terms</a> and <a className="hover:underline" href="#">Privacy Policy</a>.
          </p>
        </div>
      </div>

      {/* Decorative Background Elements */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute -top-[10%] -left-[5%] w-[40%] h-[40%] rounded-full bg-yellow-400/5 blur-3xl"></div>
        <div className="absolute top-[20%] -right-[10%] w-[30%] h-[30%] rounded-full bg-blue-400/5 blur-3xl"></div>
      </div>
    </div>
  )
}
