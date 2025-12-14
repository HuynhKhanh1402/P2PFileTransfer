import { useRef, useCallback, useState } from 'react'

const RTC_CONFIG = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
    ]
}

const CHUNK_SIZE = 64 * 1024 // 64KB

export function useWebRTC({ onMessage, onStateChange, onProgress }) {
    const peerConnectionRef = useRef(null)
    const dataChannelRef = useRef(null)
    const [connectionState, setConnectionState] = useState('new')

    const updateState = useCallback((state) => {
        setConnectionState(state)
        onStateChange?.(state)
    }, [onStateChange])

    const createPeerConnection = useCallback(() => {
        const pc = new RTCPeerConnection(RTC_CONFIG)

        pc.oniceconnectionstatechange = () => {
            console.log('ICE connection state:', pc.iceConnectionState)
            updateState(pc.iceConnectionState)
        }

        pc.onconnectionstatechange = () => {
            console.log('Connection state:', pc.connectionState)
        }

        peerConnectionRef.current = pc
        return pc
    }, [updateState])

    const createDataChannel = useCallback((pc) => {
        const channel = pc.createDataChannel('fileTransfer', {
            ordered: true,
        })

        channel.binaryType = 'arraybuffer'

        channel.onopen = () => {
            console.log('Data channel opened')
            updateState('connected')
        }

        channel.onclose = () => {
            console.log('Data channel closed')
            updateState('disconnected')
        }

        channel.onerror = (error) => {
            console.error('Data channel error:', error)
            updateState('failed')
        }

        channel.onmessage = (event) => {
            onMessage?.(event.data)
        }

        dataChannelRef.current = channel
        return channel
    }, [onMessage, updateState])

    const handleDataChannel = useCallback((channel) => {
        channel.binaryType = 'arraybuffer'

        channel.onopen = () => {
            console.log('Data channel opened (receiver)')
            updateState('connected')
        }

        channel.onclose = () => {
            console.log('Data channel closed (receiver)')
            updateState('disconnected')
        }

        channel.onerror = (error) => {
            console.error('Data channel error (receiver):', error)
            updateState('failed')
        }

        channel.onmessage = (event) => {
            onMessage?.(event.data)
        }

        dataChannelRef.current = channel
    }, [onMessage, updateState])

    const createOffer = useCallback(async () => {
        const pc = createPeerConnection()
        createDataChannel(pc)

        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)

        return new Promise((resolve) => {
            pc.onicecandidate = (event) => {
                if (event.candidate === null) {
                    resolve(pc.localDescription)
                }
            }
        })
    }, [createPeerConnection, createDataChannel])

    const createAnswer = useCallback(async (offer) => {
        const pc = createPeerConnection()

        pc.ondatachannel = (event) => {
            handleDataChannel(event.channel)
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
    }, [createPeerConnection, handleDataChannel])

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

    return {
        connectionState,
        createOffer,
        createAnswer,
        setRemoteDescription,
        addIceCandidate,
        sendData,
        sendFile,
        close,
    }
}
