import { logger } from './logger'

/**
 * A generic function to send a message to the background script and get a response.
 * @param message - The message object to send.
 * @returns A promise that resolves with the response from the background script.
 */
export function sendMessageToBackend(message: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!chrome.runtime?.id) {
      // This can happen in a non-extension context (e.g., unit tests)
      logger.warn(
        'Messaging',
        'Cannot send message: extension context not available.'
      )
      return reject(new Error('Extension context not available'))
    }

    chrome.runtime.sendMessage(message, response => {
      if (chrome.runtime.lastError) {
        logger.error(
          'Messaging',
          'Error sending message:',
          chrome.runtime.lastError.message
        )
        return reject(chrome.runtime.lastError)
      }
      resolve(response)
    })
  })
}
