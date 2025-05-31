import { Plugin } from 'obsidian';
import { Neo4jConnection, ConnectionError } from '../connection/Neo4jConnection';

export interface Neo4jSettings {
  boltUrl: string;
  username: string;
  password: string;
  encrypted: boolean;
  connectionTimeout: number;
  maxConnectionPoolSize: number;
}

export const DEFAULT_SETTINGS: Neo4jSettings = {
  boltUrl: "bolt://localhost:7687",
  username: "neo4j",
  password: "",
  encrypted: false,
  connectionTimeout: 30000,
  maxConnectionPoolSize: 50,
};

/**
 * Manages plugin settings and connection testing
 */
export class SettingsManager {
  constructor(
    private plugin: Plugin,
    private connectionManager: Neo4jConnection
  ) {}

  
  // Load settings from storage
  async loadSettings(): Promise<Neo4jSettings> {
    return Object.assign({}, DEFAULT_SETTINGS, await this.plugin.loadData());
  }

  // Save settings to storage
  async saveSettings(settings: Neo4jSettings): Promise<void> {
    await this.plugin.saveData(settings);
  }

  // Test database connection with given settings
  async testConnection(settings: Neo4jSettings): Promise<{ success: boolean; message: string }> {
    try {
      const config = {
        url: settings.boltUrl,
        username: settings.username,
        password: settings.password,
        encrypted: settings.encrypted,
        connectionTimeout: settings.connectionTimeout,
        maxConnectionPoolSize: settings.maxConnectionPoolSize,
      };
      
      await this.connectionManager.testConnection(config);
      return { success: true, message: 'Connection successful!' };
    } catch (error) {
      if (error instanceof ConnectionError) {
        return { success: false, message: `Connection failed: ${error.message}` };
      } else {
        console.error('[Neo4j Plugin] Unexpected connection error:', error);
        return { success: false, message: 'Connection test failed. Check console for details.' };
      }
    }
  }
}