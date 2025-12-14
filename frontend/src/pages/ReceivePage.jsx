import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTransfer } from '../context/TransferContext'
import { useSocket } from '../hooks/useSocket'

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
      const response = await fetch(`http://localhost:3001/api/session/${fullCode}`)
      const data = await response.json()

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
    <div className="flex-grow flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-[520px] flex flex-col gap-6">
        {/* Status Badge */}
        <div className="flex justify-center mb-2">
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
            isConnected 
              ? 'bg-green-100 text-green-700' 
              : 'bg-gray-100 text-gray-700'
          }`}>
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isConnected ? 'bg-green-400' : 'bg-gray-400'
              }`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                isConnected ? 'bg-green-500' : 'bg-gray-500'
              }`}></span>
            </span>
            {isConnected ? 'Ready to connect' : 'Connecting to server...'}
          </div>
        </div>

        {/* Central Card */}
        <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 p-8 sm:p-10 flex flex-col items-center text-center">
          {/* Icon Header */}
          <div className="mb-6 bg-yellow-50 p-4 rounded-full text-yellow-600">
            <span className="material-symbols-outlined text-[40px]">download_for_offline</span>
          </div>

          {/* Text Content */}
          <h1 className="text-text-main text-3xl font-bold tracking-tight mb-3">Receive Files</h1>
          <p className="text-gray-500 text-base leading-relaxed max-w-sm mb-8">
            Enter the unique 6-digit code provided by the sender to start the secure transfer.
          </p>

          {/* Input Field */}
          <form onSubmit={(e) => { e.preventDefault(); handleConnect(); }} className="w-full flex flex-col gap-8">
            <div className="flex justify-center w-full">
              <div className="flex gap-2 sm:gap-3">
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
                      className="flex h-14 w-12 sm:h-16 sm:w-14 text-center rounded-lg border border-gray-200 bg-gray-50 text-2xl font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all shadow-sm placeholder-gray-300"
                      placeholder="-"
                    />
                    {index === 2 && (
                      <div className="flex items-center justify-center px-1 sm:px-2">
                        <span className="w-2 h-0.5 bg-gray-300 rounded-full"></span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-lg">error</span>
                {error}
              </div>
            )}

            {/* Action Button */}
            <button
              type="submit"
              disabled={isConnecting || !isConnected}
              className="w-full flex items-center justify-center gap-2 h-12 rounded-xl bg-primary hover:bg-primary-hover active:bg-yellow-500 text-text-main text-base font-bold shadow-md hover:shadow-lg transition-all duration-200 transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isConnecting ? (
                <>
                  <span className="material-symbols-outlined animate-spin">progress_activity</span>
                  Connecting...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined">link</span>
                  Connect
                </>
              )}
            </button>
          </form>

          {/* Footer Link */}
          <div className="mt-6 text-sm">
            <span className="text-gray-500">Having trouble? </span>
            <a className="font-medium text-text-main hover:text-primary underline decoration-primary/30 hover:decoration-primary underline-offset-4 transition-all" href="#">
              Get help finding your code
            </a>
          </div>
        </div>

        {/* Additional Help/Info */}
        <div className="text-center">
          <p className="text-xs text-gray-400">
            By connecting, you agree to our <a className="hover:underline" href="#">Terms of Service</a> and <a className="hover:underline" href="#">Privacy Policy</a>.
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
