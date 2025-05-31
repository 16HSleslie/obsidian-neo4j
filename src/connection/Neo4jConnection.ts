import neo4j, { Driver, Session } from 'neo4j-driver';
import { ConnectionConfig } from '../types';

// Type guard to check if error is an Error instance
function isError(error: unknown): error is Error {
  return error instanceof Error;
}

// Type guard to check if error has a code property (Neo4j errors)
function hasErrorCode(error: unknown): error is Error & { code: string } {
  return isError(error) && 'code' in error && typeof (error as any).code === 'string';
}

/**
 * Custom error class for Neo4j connection issues
 */
export class ConnectionError extends Error {
  constructor(message: string, public readonly originalError?: Error) {
    super(message);
    this.name = 'ConnectionError';
  }
}

/**
 * Manages Neo4j database connections
 */
export class Neo4jConnection {
  private driver: Driver | null = null;
  private config: ConnectionConfig | null = null;
  private isConnected: boolean = false;

  // Test if we can connect to the database (temporary connection)
  async testConnection(config: ConnectionConfig): Promise<boolean> {
    console.log('[Neo4j Plugin] Testing connection to:', config.url);
    
    try {
      const testDriver = neo4j.driver(
        config.url,
        neo4j.auth.basic(config.username, config.password),
        {
          encrypted: config.encrypted ? 'ENCRYPTION_ON' : 'ENCRYPTION_OFF',
          connectionTimeout: config.connectionTimeout || 30000,
          maxConnectionPoolSize: config.maxConnectionPoolSize || 50
        }
      );

      await testDriver.verifyConnectivity();
      await testDriver.close();
      
      console.log('[Neo4j Plugin] Connection test successful');
      return true;
    } catch (error) {
      console.error('[Neo4j Plugin] Connection test failed:', error);
      
      if (hasErrorCode(error)) {
        if (error.code === 'ServiceUnavailable') {
          throw new ConnectionError('Cannot reach database server. Check URL and ensure Neo4j is running.', error);
        } else if (error.code === 'Neo.ClientError.Security.Unauthorized') {
          throw new ConnectionError('Invalid username or password.', error);
        }
      }
      
      const errorToPass = isError(error) ? error : undefined;
      throw new ConnectionError('Connection test failed. Check console for details.', errorToPass);
    }
  }

  // Establish a persistent connection to the database
  async connect(config: ConnectionConfig): Promise<void> {
    if (this.isConnected && this.driver) {
      console.log('[Neo4j Plugin] Already connected');
      return;
    }

    console.log('[Neo4j Plugin] Establishing persistent connection to:', config.url);

    try {
      this.driver = neo4j.driver(
        config.url,
        neo4j.auth.basic(config.username, config.password),
        {
          encrypted: config.encrypted ? 'ENCRYPTION_ON' : 'ENCRYPTION_OFF',
          connectionTimeout: config.connectionTimeout || 30000,
          maxConnectionPoolSize: config.maxConnectionPoolSize || 50
        }
      );

      // Verify the connection works
      await this.driver.verifyConnectivity();
      
      this.config = config;
      this.isConnected = true;
      console.log('[Neo4j Plugin] Persistent connection established');
    } catch (error) {
      await this.disconnect(); // Clean up on failure
      
      if (hasErrorCode(error)) {
        if (error.code === 'ServiceUnavailable') {
          throw new ConnectionError('Cannot reach database server. Check URL and ensure Neo4j is running.', error);
        } else if (error.code === 'Neo.ClientError.Security.Unauthorized') {
          throw new ConnectionError('Invalid username or password.', error);
        }
      }
      
      const errorToPass = isError(error) ? error : undefined;
      throw new ConnectionError('Failed to establish connection. Check console for details.', errorToPass);
    }
  }

  // Close the persistent connection
  async disconnect(): Promise<void> {
    if (this.driver) {
      console.log('[Neo4j Plugin] Closing connection');
      try {
        await this.driver.close();
      } catch (error) {
        console.error('[Neo4j Plugin] Error closing connection:', error);
      }
    }
    
    this.driver = null;
    this.config = null;
    this.isConnected = false;
  }

  // Get the current connection status
  getConnectionStatus(): { connected: boolean; url?: string } {
    return {
      connected: this.isConnected,
      url: this.config?.url
    };
  }

  // Get a session for query execution throws ConnectionError if not connected
  getSession(): Session {
    if (!this.driver || !this.isConnected) {
      throw new ConnectionError('Not connected to database. Call connect() first.');
    }
    
    return this.driver.session();
  }
}