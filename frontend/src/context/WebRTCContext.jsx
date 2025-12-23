import { createContext, useContext, useRef, useState, useCallback } from 'react'

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ]
}

const CHUNK_SIZE = 64 * 1024 // 64KB

const WebRTCContext = createContext(null)

export function WebRTCProvider({ children }) {
  const peerConnectionRef = useRef(null)
  const dataChannelRef = useRef(null)
  const messageHandlerRef = useRef(null)
  const stateChangeHandlerRef = useRef(null)
  const [connectionState, setConnectionState] = useState('new')
  const messageSeqRef = useRef(0)
  const processedMessagesRef = useRef(new Set())
  const messageQueueRef = useRef([]) // Queue for messages received before handler is set

  const updateState = useCallback((state) => {
    setConnectionState(state)
    stateChangeHandlerRef.current?.(state)
  }, [])

  const setMessageHandler = useCallback((handler) => {
    console.log(`[WebRTC] setMessageHandler called, handler=${handler ? 'function' : 'null'}, queueLength=${messageQueueRef.current.length}`)
    messageHandlerRef.current = handler
    
    // Process any queued messages when handler is set
    if (handler && messageQueueRef.current.length > 0) {
      console.log(`[WebRTC] Processing ${messageQueueRef.current.length} queued messages`)
      const queuedMessages = [...messageQueueRef.current]
      messageQueueRef.current = []
      queuedMessages.forEach((data, index) => {
        console.log(`[WebRTC] Processing queued message ${index + 1}/${queuedMessages.length}`)
        handler(data)
      })
    }
  }, [])

  const setStateChangeHandler = useCallback((handler) => {
    stateChangeHandlerRef.current = handler
  }, [])

  const createPeerConnection = useCallback(() => {
    if (peerConnectionRef.current && 
        peerConnectionRef.current.connectionState !== 'closed' &&
        peerConnectionRef.current.connectionState !== 'failed') {
      return peerConnectionRef.current
    }

    const pc = new RTCPeerConnection(RTC_CONFIG)

    pc.oniceconnectionstatechange = () => {
      updateState(pc.iceConnectionState)
    }

    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState)
    }

    peerConnectionRef.current = pc
    return pc
  }, [updateState])

  const setupDataChannel = useCallback((channel) => {
    if (channel._setupComplete) {
      return channel
    }
    channel._setupComplete = true
    
    channel.binaryType = 'arraybuffer'

    channel.onopen = () => {
      updateState('connected')
    }

    channel.onclose = () => {
      updateState('disconnected')
    }

    channel.onerror = (error) => {
      console.error('Data channel error:', error)
      updateState('failed')
    }

    channel.onmessage = (event) => {
      const seq = messageSeqRef.current++
      
      if (processedMessagesRef.current.has(seq)) {
        console.log(`[WebRTC] Duplicate message seq=${seq}, skipping`)
        return
      }
      processedMessagesRef.current.add(seq)
      
      if (processedMessagesRef.current.size > 1000) {
        const toDelete = Array.from(processedMessagesRef.current).slice(0, 500)
        toDelete.forEach(s => processedMessagesRef.current.delete(s))
      }
      
      // Log message type for debugging
      const isArrayBuffer = event.data instanceof ArrayBuffer
      console.log(`[WebRTC] onmessage seq=${seq}, isArrayBuffer=${isArrayBuffer}, handlerSet=${!!messageHandlerRef.current}, queueLength=${messageQueueRef.current.length}`)
      
      // If handler is not set yet, queue the message
      if (!messageHandlerRef.current) {
        console.log(`[WebRTC] Handler not set, queuing message seq=${seq}`)
        messageQueueRef.current.push(event.data)
        return
      }
      
      messageHandlerRef.current(event.data)
    }

    dataChannelRef.current = channel
    return channel
  }, [updateState])

  const createOffer = useCallback(async () => {
    const pc = createPeerConnection()
    
    const channel = pc.createDataChannel('fileTransfer', {
      ordered: true,
    })
    setupDataChannel(channel)

    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)

    return new Promise((resolve) => {
      pc.onicecandidate = (event) => {
        if (event.candidate === null) {
          resolve(pc.localDescription)
        }
      }
    })
  }, [createPeerConnection, setupDataChannel])

  const createAnswer = useCallback(async (offer) => {
    const pc = createPeerConnection()

    pc.ondatachannel = (event) => {
      if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
        return
      }
      setupDataChannel(event.channel)
    }

    await pc.setRemoteDescription(new RTCSessionDescription(offer))
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    return new Promise((resolve) => {
      pc.onicecandidate = (event) => {
        if (event.candidate === null) {
          resolve(pc.localDescription)
        }
      }
    })
  }, [createPeerConnection, setupDataChannel])

  const setRemoteDescription = useCallback(async (description) => {
    if (peerConnectionRef.current) {
      await peerConnectionRef.current.setRemoteDescription(
        new RTCSessionDescription(description)
      )
    }
  }, [])

  const addIceCandidate = useCallback(async (candidate) => {
    if (peerConnectionRef.current) {
      await peerConnectionRef.current.addIceCandidate(
        new RTCIceCandidate(candidate)
      )
    }
  }, [])

  const sendData = useCallback((data) => {
    if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      dataChannelRef.current.send(data)
      return true
    }
    return false
  }, [])

  const sendFile = useCallback(async (file, onChunkSent) => {
    if (!dataChannelRef.current || dataChannelRef.current.readyState !== 'open') {
      throw new Error('Data channel not open')
    }

    const channel = dataChannelRef.current
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE)
    let sentChunks = 0

    // Send file metadata first
    const meta = {
      type: 'meta',
      name: file.name,
      size: file.size,
      mimeType: file.type,
      totalChunks,
    }
    channel.send(JSON.stringify(meta))

    // Read and send chunks
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE
      const end = Math.min(start + CHUNK_SIZE, file.size)
      const chunk = file.slice(start, end)
      const arrayBuffer = await chunk.arrayBuffer()

      // Wait if buffer is full
      while (channel.bufferedAmount > CHUNK_SIZE * 10) {
        await new Promise(resolve => setTimeout(resolve, 10))
      }

      // Send chunk header
      const header = {
        type: 'chunk',
        index: i,
        size: end - start,
      }
      channel.send(JSON.stringify(header))

      // Send chunk data
      channel.send(arrayBuffer)

      sentChunks++
      onChunkSent?.(sentChunks, totalChunks)
    }

    // Send completion signal
    channel.send(JSON.stringify({ type: 'complete' }))
  }, [])

  const close = useCallback(() => {
    if (dataChannelRef.current) {
      dataChannelRef.current.close()
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
    }
    peerConnectionRef.current = null
    dataChannelRef.current = null
    updateState('closed')
  }, [updateState])

  const reset = useCallback(() => {
    close()
    setConnectionState('new')
    messageQueueRef.current = [] // Clear message queue on reset
  }, [close])

  // Check if data channel is ready
  const isDataChannelReady = useCallback(() => {
    return dataChannelRef.current?.readyState === 'open'
  }, [])

  const value = {
    connectionState,
    createOffer,
    createAnswer,
    setRemoteDescription,
    addIceCandidate,
    sendData,
    sendFile,
    close,
    reset,
    setMessageHandler,
    setStateChangeHandler,
    isDataChannelReady,
  }

  return (
    <WebRTCContext.Provider value={value}>
      {children}
    </WebRTCContext.Provider>
  )
}

export function useWebRTCContext() {
  const context = useContext(WebRTCContext)
  if (!context) {
    throw new Error('useWebRTCContext must be used within a WebRTCProvider')
  }
  return context
}
