// src/codeblock/CodeBlockProcessor.ts
import { MarkdownPostProcessorContext, Notice } from 'obsidian';
import { Neo4jConnection, ConnectionError } from '../connection/Neo4jConnection';
import { QueryProcessor, QueryError } from '../query/QueryProcessor';
import { GraphRenderer } from '../visualization/GraphRenderer';
import { Neo4jSettings } from '../settings/SettingsManager';

/**
 * Handles processing of neo4j-graph code blocks
 */
export class CodeBlockProcessor {
  private queryProcessor: QueryProcessor;
  private activeRenderers: Map<string, GraphRenderer> = new Map();

  constructor(
    private connectionManager: Neo4jConnection,
    private getSettings: () => Neo4jSettings
  ) {
    this.queryProcessor = new QueryProcessor(this.connectionManager);
  }

  // Process a neo4j-graph code block
  async processCodeBlock(
    source: string,
    el: HTMLElement,
    ctx: MarkdownPostProcessorContext
  ): Promise<void> {
    // Create container for our query interface
    const container = el.createDiv({ cls: 'neo4j-graph-container' });
    
    // Extract and clean the query
    const query = this.extractQuery(source);
    
    if (!query.trim()) {
      container.createDiv({ 
        cls: 'neo4j-error-message',
        text: 'No Cypher query found. Please write a valid Cypher query.' 
      });
      return;
    }

    // Create controls section
    const controls = container.createDiv({ cls: 'neo4j-query-controls' });
    
    // Add execute button
    const executeButton = controls.createEl('button', {
      cls: 'neo4j-execute-button',
      text: 'Execute Query'
    });

    // Show the query that will be executed
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

  // Extract Cypher query from code block source
  private extractQuery(source: string): string {
    // Remove comments and trim whitespace
    const lines = source.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('//') && !line.startsWith('#'));
    
    return lines.join(' ').trim();
  }

  // Execute a Cypher query and display results
  private async executeQuery(
    query: string, 
    resultsArea: HTMLElement, 
    executeButton: HTMLButtonElement
  ): Promise<void> {
    // Update button state
    const originalText = executeButton.textContent;
    executeButton.textContent = 'Executing...';
    executeButton.disabled = true;

    // Clear previous results
    resultsArea.empty();

    try {
      // Check if we're connected
      const status = this.connectionManager.getConnectionStatus();
      if (!status.connected) {
        resultsArea.createDiv({
          text: 'Connecting to database...',
          cls: 'neo4j-loading'
        });
        
        // Try to auto-connect using current settings
        await this.connectToDatabase();
      }

      // Execute the query
      const result = await this.queryProcessor.execute(query);
      
      // Display results
      this.displayQueryResults(result, resultsArea);
      
      new Notice(`✅ Query executed: ${result.summary.nodeCount} nodes, ${result.summary.relationshipCount} relationships`);

    } catch (error) {
      // Handle execution errors
      if (error instanceof ConnectionError) {
        resultsArea.createDiv({
          cls: 'neo4j-error-message',
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
          text: 'Query execution failed. Check console for details.'
        });
        console.error('[Neo4j Plugin] Unexpected query error:', error);
        new Notice('❌ Query execution failed');
      }
    } finally {
      // Restore button state
      executeButton.textContent = originalText;
      executeButton.disabled = false;
    }
  }

  // Connect to database using current settings
  private async connectToDatabase(): Promise<void> {
    const settings = this.getSettings();
    const config = {
      url: settings.boltUrl,
      username: settings.username,
      password: settings.password,
      encrypted: settings.encrypted,
      connectionTimeout: settings.connectionTimeout,
      maxConnectionPoolSize: settings.maxConnectionPoolSize,
    };
    
    await this.connectionManager.connect(config);
    console.log('[Neo4j Plugin] Auto-connected to database');
  }

  // Display query results with graph visualization and tabular data
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

  // Display interactive graph visualization
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

  /**
   * Display tabular/scalar results
   */
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

  // Clean up all active renderers
  cleanup(): void {
    this.activeRenderers.forEach(renderer => renderer.destroy());
    this.activeRenderers.clear();
  }
}