import { Plugin } from "obsidian";
import { Neo4jConnection } from './connection/Neo4jConnection';
import { SettingsManager, Neo4jSettings } from './settings/SettingsManager';
import { Neo4jSettingTab } from './settings/SettingsTab';
import { CodeBlockProcessor } from './codeblock/CodeBlockProcessor';

/**
 * Main Neo4j Plugin class - coordinates all modules
 */
export default class Neo4jPlugin extends Plugin {
  private settings!: Neo4jSettings;
  private connectionManager!: Neo4jConnection;
  private settingsManager!: SettingsManager;
  private codeBlockProcessor!: CodeBlockProcessor;

  // Plugin initialization
  async onload(): Promise<void> {
    console.log('[Neo4j Plugin] Loading plugin...');

    // Initialize core modules
    this.connectionManager = new Neo4jConnection();
    this.settingsManager = new SettingsManager(this, this.connectionManager);
    
    // Load settings
    this.settings = await this.settingsManager.loadSettings();
    
    // Initialize code block processor
    this.codeBlockProcessor = new CodeBlockProcessor(
      this.connectionManager,
      () => this.settings // Provide settings getter
    );

    // Register settings tab
    this.addSettingTab(new Neo4jSettingTab(
      this.app,
      this.settingsManager,
      this.settings,
      (newSettings) => { this.settings = newSettings; } // Settings change callback
    ));

    // Register code block processor
    this.registerMarkdownCodeBlockProcessor(
      "neo4j-graph",
      this.codeBlockProcessor.processCodeBlock.bind(this.codeBlockProcessor)
    );

    console.log('[Neo4j Plugin] Plugin loaded successfully');
  }

  // Plugin cleanup
  async onunload(): Promise<void> {
    console.log('[Neo4j Plugin] Unloading plugin...');
    
    // Clean up resources
    if (this.codeBlockProcessor) {
      this.codeBlockProcessor.cleanup();
    }
    
    if (this.connectionManager) {
      await this.connectionManager.disconnect();
    }
    
    console.log('[Neo4j Plugin] Plugin unloaded');
  }
}