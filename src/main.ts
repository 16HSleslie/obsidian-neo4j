import {
  App,
  Plugin,
  PluginSettingTab,
  Setting,
  MarkdownPostProcessorContext,
  Notice, // Add this import
} from "obsidian";
import { Neo4jConnection, ConnectionError } from './connection/Neo4jConnection';
import { QueryProcessor, QueryError } from "./query/QueryProcessor";
import { GraphRenderer } from './visualization/GraphRenderer';

interface Neo4jSettings {
  boltUrl: string;
  username: string;
  password: string;
  encrypted: boolean;
  connectionTimeout: number;
  maxConnectionPoolSize: number;
}

const DEFAULT_SETTINGS: Neo4jSettings = {
  boltUrl: "bolt://localhost:7687",
  username: "neo4j",
  password: "",
  encrypted: false,
  connectionTimeout: 30000,
  maxConnectionPoolSize: 50,
};

export default class Neo4jPlugin extends Plugin {
  settings!: Neo4jSettings;
  private connectionManager!: Neo4jConnection;
  private queryProcessor!: QueryProcessor;
  private activeRenderers: Map<string, GraphRenderer> = new Map();

  async onload() {
    await this.loadSettings();

	// Initialize connection manager and query processor
	this.connectionManager = new Neo4jConnection();
	this.queryProcessor = new QueryProcessor(this.connectionManager);

    // Add settings tab
    this.addSettingTab(new Neo4jSettingTab(this.app, this));

    // Register code block processor
    this.registerMarkdownCodeBlockProcessor(
      "neo4j-graph",
      this.processNeo4jCodeBlock.bind(this)
    );

    console.log("Neo4j plugin loaded");
  }

  onunload() {
    console.log("Neo4j plugin unloaded");
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async processNeo4jCodeBlock(
    source: string,
    el: HTMLElement,
    ctx: MarkdownPostProcessorContext
  ) {
    // Create container for our query interface
	const container = el.createDiv({ cls: 'neo4j-graph-container'});

	// Extract and clean the query
	const query = this.extractQuery(source);

	if (!query.trim()) {
		container.createDiv({
			cls: 'neo4j-error-message',
			text: 'No Cypher query found. Please write a valid Cypher query.'
		});
		return;
	}

	// Create control section
	const controls = container.createDiv({ cls: 'neo4j-query-container'});

	// Add execute button
	const executeButton = controls.createEl('button', {
		cls: 'neo4j-execute-button',
		text: 'Execute Query'
	});

	// Show the query that will be displayed
	const queryDisplay = container.createEl('pre', {
		text: `Query: ${query}`,
		cls: 'neo4j-query-display'
	});

	// Add results area
	const resultsArea = container.createDiv({ cls: 'neo4j-results-area' });

	// Wire up the execute button
	executeButton.addEventListener('click', async () => {
		await this.executeQuery(query, resultsArea, executeButton);
	});

	console.log('[Neo4j Plugin] Code block processed, query extracted:', query);
  }

  private extractQuery(source: string): string {
	const lines = source.split('\n')
		.map(line => line.trim())
		.filter(line => line.length > 0 && !line.startsWith('//') && !line.startsWith('#'))

	return lines.join(' ').trim();
  }

  /**
   *  Execute a Cypher query and display results
   */
  private async executeQuery(
	query: string,
	resultsArea: HTMLElement,
	executeButton: HTMLButtonElement
  ): Promise<void> {
	const orginalText = executeButton.textContent;
	executeButton.textContent = 'Executing...';
	executeButton.disabled = true;

	resultsArea.empty();

	try {
		const status = this.connectionManager.getConnectionStatus();
		if (!status.connected) {
			resultsArea.createDiv({
				text: 'Connecting to database...',
				cls: 'neo4j-loading'
			});

			// Try auto-connect using current settings
			await this.connectToDatabase();
		}

		const result = await this.queryProcessor.execute(query);

		this.displayQueryResults(result, resultsArea);

	} catch (error) {
		// Handle execution errors
		if (error instanceof ConnectionError) {
			resultsArea.createDiv({
				cls: 'neo4j-connection-error',
				text: `Connection error: ${error.message}. Please check your settings.`
			});
			new Notice(`❌ Connection failed: ${error.message}`);
		} else if (error instanceof QueryError) {
			resultsArea.createDiv({
				cls: 'neo4j-error-message',
				text: `Query error: ${error.message}`
			});
			new Notice(`❌ Query failed: ${error.message}`);
		} else {
			resultsArea.createDiv({
				cls: 'neo4j-error-message',
				text: 'Query execution failed. Check console for details'
			});
			console.error('[Neo4j Plugin] Query execution error', error);
		}
	} finally {
		// Restore button state
		executeButton.textContent = orginalText;
		executeButton.disabled = false;
	}
  }

  /**
   * Display query results
   */
  private displayQueryResults(result: any, container: HTMLElement): void {
    // Create summary section
    const summaryDiv = container.createDiv({ cls: 'neo4j-results-summary' });
    summaryDiv.createEl('h4', { text: 'Query Results' });
    
    const statsDiv = summaryDiv.createDiv({ cls: 'neo4j-stats' });
    statsDiv.createDiv({ text: `📊 ${result.summary.nodeCount} nodes, ${result.summary.relationshipCount} relationships` });
    statsDiv.createDiv({ text: `⏱️ Executed in ${result.summary.executionTime}ms` });
    
    // Show tabular/scalar data if present
    if (result.data.scalarData && result.data.scalarData.length > 0) {
      this.displayTabularResults(result.data.scalarData, container);
    }

    // Show interactive graph if we have graph data
    if (result.data.nodes.length > 0 || result.data.relationships.length > 0) {
      this.displayGraphVisualization(result.data, container);
    }

    // Show detailed text results as backup/additional info
    if (result.data.nodes.length > 0) {
      const nodesSection = container.createDiv({ cls: 'neo4j-nodes-section' });
      const nodesHeader = nodesSection.createDiv({ cls: 'neo4j-section-header' });
      nodesHeader.createEl('h5', { text: 'Nodes (Details):' });
      
      // Add toggle button for collapsing/expanding
      const toggleButton = nodesHeader.createEl('button', {
        text: 'Hide',
        cls: 'neo4j-toggle-button'
      });
      
      const nodesContent = nodesSection.createDiv({ cls: 'neo4j-section-content' });
      
      result.data.nodes.slice(0, 10).forEach((node: any, index: number) => {
        const nodeDiv = nodesContent.createDiv({ cls: 'neo4j-node-item' });
        nodeDiv.createSpan({ 
          text: `${index + 1}. ${node.label} (ID: ${node.id})`,
          cls: 'neo4j-node-label'
        });
        
        if (Object.keys(node.properties).length > 0) {
          const propsDiv = nodeDiv.createDiv({ cls: 'neo4j-properties' });
          propsDiv.createSpan({ text: `Properties: ${JSON.stringify(node.properties)}` });
        }
      });
      
      if (result.data.nodes.length > 10) {
        nodesContent.createDiv({ 
          text: `... and ${result.data.nodes.length - 10} more nodes`,
          cls: 'neo4j-more-items'
        });
      }

      // Toggle functionality
      let isVisible = true;
      toggleButton.addEventListener('click', () => {
        isVisible = !isVisible;
        nodesContent.style.display = isVisible ? 'block' : 'none';
        toggleButton.textContent = isVisible ? 'Hide' : 'Show';
      });
    }

    // Show message if no data at all
    if (result.data.nodes.length === 0 && 
        result.data.relationships.length === 0 && 
        (!result.data.scalarData || result.data.scalarData.length === 0)) {
      container.createDiv({
        text: 'Query executed successfully but returned no data.',
        cls: 'neo4j-no-results'
      });
    }
  }

  private displayGraphVisualization(data: any, container: HTMLElement): void {
    const graphSection = container.createDiv({ cls: 'neo4j-graph-section' });
    
    // Create header with controls
    const graphHeader = graphSection.createDiv({ cls: 'neo4j-graph-header' });
    graphHeader.createEl('h5', { text: 'Interactive Graph:' });
    
    const controlsDiv = graphHeader.createDiv({ cls: 'neo4j-graph-controls' });
    
    // Add control buttons
    const fitButton = controlsDiv.createEl('button', {
      text: '🔍 Fit',
      cls: 'neo4j-control-button'
    });
    
    const resetButton = controlsDiv.createEl('button', {
      text: '↻ Reset',
      cls: 'neo4j-control-button'
    });
    
    // Create graph container
    const graphContainer = graphSection.createDiv({ cls: 'neo4j-graph-visualization' });
    
    // Generate unique ID for this renderer
    const rendererId = `renderer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Create and render graph
      const renderer = new GraphRenderer({
        height: 400,
        layout: 'cose',
        showLabels: true,
        nodeSize: 30
      });
      
      renderer.render(graphContainer, data);
      
      // Store renderer for cleanup
      this.activeRenderers.set(rendererId, renderer);
      
      // Wire up control buttons
      fitButton.addEventListener('click', () => renderer.fit());
      resetButton.addEventListener('click', () => renderer.resetZoom());
      
      console.log('[Neo4j Plugin] Graph visualization created with ID:', rendererId);
      
    } catch (error) {
      console.error('[Neo4j Plugin] Graph visualization error:', error);
      graphContainer.createDiv({
        text: 'Error creating graph visualization. Falling back to text display.',
        cls: 'neo4j-error-message'
      });
    }
  }

  private displayTabularResults(scalarData: any[], container: HTMLElement): void {
    const tableSection = container.createDiv({ cls: 'neo4j-table-section' });
    tableSection.createEl('h5', { text: 'Results:' });
    
    if (scalarData.length === 0) return;
    
    // Create table
    const table = tableSection.createEl('table', { cls: 'neo4j-results-table' });
    
    // Create header
    const headers = Object.keys(scalarData[0]);
    const headerRow = table.createEl('thead').createEl('tr');
    headers.forEach(header => {
      headerRow.createEl('th', { text: header });
    });
    
    // Create body
    const tbody = table.createEl('tbody');
    scalarData.forEach(row => {
      const tableRow = tbody.createEl('tr');
      headers.forEach(header => {
        const value = row[header];
        const displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
        tableRow.createEl('td', { text: displayValue });
      });
    });
  }

  private async connectToDatabase(): Promise<void> {
	const config = {
		url: this.settings.boltUrl,
		username: this.settings.username,
		password: this.settings.password,
		encrypted: this.settings.encrypted,
		connectionTimeout: this.settings.connectionTimeout,
		maxConnectionPoolSize: this.settings.maxConnectionPoolSize,
	};
	
	await this.connectionManager.connect(config);
	console.log('[Neo4j Plugin] Auto-connected to database');
  }

  // Test database connection with current settings
  async testConnection(): Promise<void> {
    try {
      const config = {
        url: this.settings.boltUrl,
        username: this.settings.username,
        password: this.settings.password,
        encrypted: this.settings.encrypted,
        connectionTimeout: this.settings.connectionTimeout,
        maxConnectionPoolSize: this.settings.maxConnectionPoolSize,
      };
      
      await this.connectionManager.testConnection(config);
      new Notice('✅ Neo4j connection successful!');
    } catch (error) {
      if (error instanceof ConnectionError) {
        new Notice(`❌ Connection failed: ${error.message}`);
      } else {
        new Notice('❌ Connection test failed. Check console for details.');
        console.error('[Neo4j Plugin] Unexpected error:', error);
      }
    }
  }
}

class Neo4jSettingTab extends PluginSettingTab {
  plugin: Neo4jPlugin;

  constructor(app: App, plugin: Neo4jPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    containerEl.createEl("h2", { text: "Neo4j Connection Settings" });

    new Setting(containerEl)
      .setName("Bolt URL")
      .setDesc("Neo4j database Bolt protocol URL")
      .addText((text) =>
        text
          .setPlaceholder("bolt://localhost:7687")
          .setValue(this.plugin.settings.boltUrl)
          .onChange(async (value) => {
            this.plugin.settings.boltUrl = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Username")
      .setDesc("Neo4j database username")
      .addText((text) =>
        text
          .setPlaceholder("neo4j")
          .setValue(this.plugin.settings.username)
          .onChange(async (value) => {
            this.plugin.settings.username = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Password")
      .setDesc("Neo4j database password")
      .addText((text) =>
        text
          .setPlaceholder("Enter password")
          .setValue(this.plugin.settings.password)
          .onChange(async (value) => {
            this.plugin.settings.password = value;
            await this.plugin.saveSettings();
          })
          .inputEl.type = "password"
      );

    new Setting(containerEl)
      .setName("Use encryption")
      .setDesc("Enable encrypted connection")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.encrypted)
          .onChange(async (value) => {
            this.plugin.settings.encrypted = value;
            await this.plugin.saveSettings();
          })
      );
	
	new Setting(containerEl)
      .setName("Test Connection")
      .setDesc("Verify that the connection settings work")
      .addButton((button) =>
        button
          .setButtonText("Test Connection")
          .setCta()
          .onClick(async () => {
            button.setButtonText("Testing...");
            button.setDisabled(true);
            
            try {
              await this.plugin.testConnection();
            } finally {
              button.setButtonText("Test Connection");
              button.setDisabled(false);
            }
          })
      );
  }
}