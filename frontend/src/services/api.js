/**
 * API Service Module
 * Centralized API calls for backend communication
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

/**
 * Create a new transfer session
 * @returns {Promise<{code: string}>} Session code
 */
export async function createSession() {
  try {
    const response = await fetch(`${API_URL}/api/create-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Failed to create session`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error creating session:', error)
    throw error
  }
}

/**
 * Check if a session exists
 * @param {string} code - Session code
 * @returns {Promise<{exists: boolean}>} Session existence status
 */
export async function checkSession(code) {
  try {
    const response = await fetch(`${API_URL}/api/session/${code}`)
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Failed to check session`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error checking session:', error)
    throw error
  }
}

/**
 * Get API URL for configuration
 * @returns {string} API URL
 */
export function getApiUrl() {
  return API_URL
}
