import { useEffect, useState, useCallback, useRef } from 'react'
import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001'

// Create a single socket instance to be shared across components
let socketInstance = null

function getSocket() {
    if (!socketInstance) {
        socketInstance = io(SOCKET_URL, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 20000,
        })
    }
    return socketInstance
}

export function useSocket() {
    const [isConnected, setIsConnected] = useState(false)
    const socketRef = useRef(null)

    useEffect(() => {
        const socket = getSocket()
        socketRef.current = socket

        const handleConnect = () => {
            console.log('Socket connected:', socket.id)
            setIsConnected(true)
        }

        const handleDisconnect = (reason) => {
            console.log('Socket disconnected:', reason)
            setIsConnected(false)
        }

        const handleConnectError = (error) => {
            console.error('Socket connection error:', error)
            setIsConnected(false)
        }

        const handleError = (error) => {
            console.error('Socket error:', error)
        }

        // Set initial connection state
        if (socket.connected) {
            setIsConnected(true)
        }

        socket.on('connect', handleConnect)
        socket.on('disconnect', handleDisconnect)
        socket.on('connect_error', handleConnectError)
        socket.on('error', handleError)

        // Connect if not already connected
        if (!socket.connected) {
            socket.connect()
        }

        return () => {
            socket.off('connect', handleConnect)
            socket.off('disconnect', handleDisconnect)
            socket.off('connect_error', handleConnectError)
            socket.off('error', handleError)
        }
    }, [])

    const emit = useCallback((event, data) => {
        if (socketRef.current) {
            socketRef.current.emit(event, data)
        }
    }, [])

    const on = useCallback((event, callback) => {
        if (socketRef.current) {
            socketRef.current.on(event, callback)
        }
    }, [])

    const off = useCallback((event, callback) => {
        if (socketRef.current) {
            socketRef.current.off(event, callback)
        }
    }, [])

    return {
        socket: socketRef.current,
        isConnected,
        emit,
        on,
        off,
    }
}
