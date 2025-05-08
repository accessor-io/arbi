/**
 * Base interface for all services
 */
export default class IService {
  constructor() {
    if (this.constructor === IService) {
      throw new Error('Cannot instantiate abstract class');
    }
  }

  /**
   * Initialize the service
   * @returns {Promise<void>}
   */
  async initialize() {
    throw new Error('Method not implemented');
  }

  /**
   * Clean up resources used by the service
   * @returns {Promise<void>}
   */
  async cleanup() {
    throw new Error('Method not implemented');
  }

  /**
   * Get the current status of the service
   * @returns {Promise<object>} Service status
   */
  async getStatus() {
    throw new Error('Method not implemented');
  }
} 