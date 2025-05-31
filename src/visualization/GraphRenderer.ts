// src/visualization/GraphRenderer.ts
import cytoscape, { Core } from 'cytoscape';
import coseBilkent from 'cytoscape-cose-bilkent';
import { GraphData } from '../types';

// Register the layout extension
cytoscape.use(coseBilkent);

/**
 * Configuration options for graph rendering
 */
export interface RenderConfig {
  height?: number;
  layout?: string;
  showLabels?: boolean;
  nodeSize?: number;
}

/**
 * Handles graph visualization using Cytoscape.js
 */
export class GraphRenderer {
  private cy: Core | null = null;
  private container: HTMLElement | null = null;
  private config: RenderConfig;

  constructor(config: RenderConfig = {}) {
    this.config = {
      height: 400,
      layout: 'cose-bilkent',
      showLabels: true,
      nodeSize: 30,
      ...config
    };
  }

  /**
   * Render graph data in the specified container
   */
  render(container: HTMLElement, data: GraphData): void {
    console.log('[Neo4j Plugin] Rendering graph with', data.nodes.length, 'nodes and', data.relationships.length, 'relationships');
    
    // Clear any existing content
    container.empty();
    this.destroy();

    // Create graph container
    const graphContainer = container.createDiv({ 
      cls: 'neo4j-cytoscape-container'
    });
    
    // Set container dimensions
    graphContainer.style.height = `${this.config.height}px`;
    graphContainer.style.width = '100%';
    
    this.container = graphContainer;

    // Transform data for Cytoscape
    const elements = this.transformDataForCytoscape(data);
    
    if (elements.length === 0) {
      container.createDiv({
        text: 'No graph data to visualize',
        cls: 'neo4j-no-graph-data'
      });
      return;
    }

    // Initialize Cytoscape
    this.cy = cytoscape({
      container: graphContainer,
      elements: elements,
      style: this.getDefaultStyle(),
      layout: this.getLayoutConfig(),
      wheelSensitivity: 0.2,
      minZoom: 0.1,
      maxZoom: 3
    });

    // Add interaction handlers
    this.addInteractionHandlers();
    
    console.log('[Neo4j Plugin] Graph rendered successfully');
  }

  /**
   * Transform GraphData to Cytoscape format
   */
  private transformDataForCytoscape(data: GraphData): any[] {
    const elements: any[] = [];

    // Add nodes
    data.nodes.forEach(node => {
      elements.push({
        data: {
          id: node.id,
          label: this.getNodeDisplayName(node),
          nodeType: node.label,
          properties: node.properties
        },
        classes: this.getNodeClasses(node)
      });
    });

    // Add edges (relationships)
    data.relationships.forEach(rel => {
      elements.push({
        data: {
          id: rel.id,
          source: rel.source,
          target: rel.target,
          label: rel.type,
          relationshipType: rel.type,
          properties: rel.properties
        },
        classes: this.getEdgeClasses(rel)
      });
    });

    return elements;
  }

  /**
   * Get display name for a node
   */
  private getNodeDisplayName(node: any): string {
    // Try to find a good display property
    const nameProps = ['name', 'title', 'label', 'id'];
    
    for (const prop of nameProps) {
      if (node.properties[prop]) {
        return String(node.properties[prop]);
      }
    }
    
    // Fallback to node label and ID
    return `${node.label}:${node.id}`;
  }

  /**
   * Get CSS classes for nodes based on their type
   */
  private getNodeClasses(node: any): string {
    const baseClass = 'neo4j-node';
    const typeClass = `neo4j-node-${node.label.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    return `${baseClass} ${typeClass}`;
  }

  /**
   * Get CSS classes for edges based on their type
   */
  private getEdgeClasses(rel: any): string {
    const baseClass = 'neo4j-edge';
    const typeClass = `neo4j-edge-${rel.type.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    return `${baseClass} ${typeClass}`;
  }

  /**
   * Get default Cytoscape styling
   */
  private getDefaultStyle(): any[] {
    return [
      {
        selector: 'node',
        style: {
          'background-color': '#3498db',
          'border-color': '#2980b9',
          'border-width': 2,
          'label': 'data(label)',
          'text-valign': 'center',
          'text-halign': 'center',
          'color': '#ffffff',
          'font-size': '12px',
          'font-weight': 'bold',
          'text-outline-width': 2,
          'text-outline-color': '#000000',
          'width': this.config.nodeSize,
          'height': this.config.nodeSize
        }
      },
      {
        selector: 'node.neo4j-node-person',
        style: {
          'background-color': '#e74c3c',
          'border-color': '#c0392b'
        }
      },
      {
        selector: 'node.neo4j-node-company',
        style: {
          'background-color': '#f39c12',
          'border-color': '#e67e22'
        }
      },
      {
        selector: 'node.neo4j-node-technology',
        style: {
          'background-color': '#9b59b6',
          'border-color': '#8e44ad'
        }
      },
      {
        selector: 'node.neo4j-node-project',
        style: {
          'background-color': '#27ae60',
          'border-color': '#229954'
        }
      },
      {
        selector: 'edge',
        style: {
          'width': 2,
          'line-color': '#95a5a6',
          'target-arrow-color': '#95a5a6',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
          'label': 'data(label)',
          'font-size': '10px',
          'text-rotation': 'autorotate',
          'text-margin-y': -10,
          'color': '#2c3e50'
        }
      },
      {
        selector: 'node:selected',
        style: {
          'border-width': 4,
          'border-color': '#f1c40f'
        }
      },
      {
        selector: 'edge:selected',
        style: {
          'width': 4,
          'line-color': '#f1c40f',
          'target-arrow-color': '#f1c40f'
        }
      }
    ];
  }

  /**
   * Get layout configuration
   */
  private getLayoutConfig(): any {
    if (this.config.layout === 'cose-bilkent') {
      return {
        name: 'cose-bilkent',
        animate: true,
        animationDuration: 1000,
        nodeDimensionsIncludeLabels: true,
        idealEdgeLength: 100,
        nodeRepulsion: 4500,
        nestingFactor: 0.1,
        gravity: 0.25,
        numIter: 2500,
        tile: true
      };
    }
    
    // Fallback to grid layout
    return {
      name: 'grid',
      rows: Math.ceil(Math.sqrt(10)),
      animate: true
    };
  }

  /**
   * Add interaction handlers
   */
  private addInteractionHandlers(): void {
    if (!this.cy) return;

    // Node click handler
    this.cy.on('tap', 'node', (event) => {
      const node = event.target;
      const data = node.data();
      console.log('[Neo4j Plugin] Node clicked:', data);
      
      // You can add custom behavior here, like showing a tooltip
    });

    // Edge click handler
    this.cy.on('tap', 'edge', (event) => {
      const edge = event.target;
      const data = edge.data();
      console.log('[Neo4j Plugin] Edge clicked:', data);
    });
  }

  /**
   * Update the graph with new data
   */
  update(data: GraphData): void {
    if (!this.cy) return;
    
    const elements = this.transformDataForCytoscape(data);
    this.cy.elements().remove();
    this.cy.add(elements);
    this.cy.layout(this.getLayoutConfig()).run();
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.cy) {
      this.cy.destroy();
      this.cy = null;
    }
    this.container = null;
  }

  /**
   * Fit the graph to the container
   */
  fit(): void {
    if (this.cy) {
      this.cy.fit();
    }
  }

  /**
   * Reset zoom to default
   */
  resetZoom(): void {
    if (this.cy) {
      this.cy.zoom(1);
      this.cy.center();
    }
  }
}