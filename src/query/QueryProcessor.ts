// src/query/QueryProcessor.ts
import { Session } from 'neo4j-driver';
import { Neo4jConnection, ConnectionError } from '../connection/Neo4jConnection';
import { QueryResult, GraphData, EnhancedQueryResult, EnhancedGraphData } from '../types'; // Add EnhancedQueryResult and EnhancedGraphData


/**
 * Custom error class for query execution issues
 */
export class QueryError extends Error {
  constructor(message: string, public readonly originalError?: Error) {
    super(message);
    this.name = 'QueryError';
  }
}

/**
 * Handles Cypher query execution and result processing
 */
export class QueryProcessor {
  constructor(private connectionManager: Neo4jConnection) {}

  /**
   * Execute a Cypher query and return processed results
   */
  async execute(query: string): Promise<EnhancedQueryResult> {
    console.log('[Neo4j Plugin] Executing query:', query);
    
    let session: Session | null = null;
    const startTime = Date.now();

    try {
      // Get session from connection manager
      session = this.connectionManager.getSession();
      
      // Execute the query
      const result = await session.run(query);
      const executionTime = Date.now() - startTime;

      // Process the results
      const graphData = this.processResults(result.records);
      
      console.log('[Neo4j Plugin] Query executed successfully:', {
        records: result.records.length,
        nodes: graphData.nodes.length,
        relationships: graphData.relationships.length,
        executionTime
      });

      return {
        data: graphData,
        records: result.records,
        summary: {
          query,
          executionTime,
          nodeCount: graphData.nodes.length,
          relationshipCount: graphData.relationships.length
        }
      };

    } catch (error) {
        console.error('[Neo4j Plugin] Query execution failed:', error);
        
        // Handle Neo4j-specific errors
        if (this.isNeo4jError(error)) {
            if (error.code?.includes('SyntaxError')) {
            throw new QueryError(`Syntax error in query: ${error.message}`);
            } else if (error.code?.includes('Unauthorized')) {
            throw new QueryError('Database connection lost. Please check settings.');
            }
            // For other Neo4j errors, just use the message
            throw new QueryError(`Neo4j error: ${error.message}`);
        }
        
        // Handle connection errors
        if (error instanceof ConnectionError) {
            throw error; // Re-throw connection errors as-is
        }
        
        // Handle standard JavaScript errors
        if (error instanceof Error) {
            throw new QueryError('Query execution failed. Check console for details.', error);
        }
        
        // Handle unknown error types
        throw new QueryError('Query execution failed. Check console for details.');
    } finally {
      // Always close the session
      if (session) {
        await session.close();
      }
    }
  }

  /**
   * Process Neo4j query results into graph data structure
   */
  private processResults(records: any[]): EnhancedGraphData {
    const nodes: Map<string, any> = new Map();
    const relationships: any[] = [];
    const scalarData: any[] = [];

    for (const record of records) {
      const recordData: any = {};
      let hasGraphData = false;

      // Process each field in the record
      record.keys.forEach((key: string) => {
        const value = record.get(key);

        if (this.isNode(value)) {
          const nodeId = value.identity.toString();
          if (!nodes.has(nodeId)) {
            nodes.set(nodeId, {
              id: nodeId,
              label: value.labels.join(':') || 'Node',
              properties: value.properties || {}
            });
          }
        } else if (this.isRelationship(value)) {
          hasGraphData = true;
          relationships.push({
            id: value.identity.toString(),
            source: value.start.toString(),
            target: value.end.toString(),
            type: value.type || 'RELATES_TO',
            properties: value.properties || {}
          });
        } else if (this.isPath(value)) {
          // Handle path results - extract nodes and relationships
          value.segments.forEach((segment: any) => {
            // Add start node
            const startId = segment.start.identity.toString();
            if (!nodes.has(startId)) {
              nodes.set(startId, {
                id: startId,
                label: segment.start.labels.join(':') || 'Node',
                properties: segment.start.properties || {}
              });
            }
            
            // Add end node
            const endId = segment.end.identity.toString();
            if (!nodes.has(endId)) {
              nodes.set(endId, {
                id: endId,
                label: segment.end.labels.join(':') || 'Node',
                properties: segment.end.properties || {}
              });
            }
            
            // Add relationship
            relationships.push({
              id: segment.relationship.identity.toString(),
              source: segment.relationship.start.toString(),
              target: segment.relationship.end.toString(),
              type: segment.relationship.type || 'RELATES_TO',
              properties: segment.relationship.properties || {}
            });
          });
        } else {
          recordData[key] = this.formatScalarValue(value);
        }
      });

      if (!hasGraphData || Object.keys(recordData).length > 0) {
        scalarData.push(recordData);
      }
    }

    return {
      nodes: Array.from(nodes.values()),
      relationships,
      scalarData: scalarData.length > 0 ? scalarData : undefined
    };
  }

  private formatScalarValue(value: any): any {
    // Handle Neo4j integers (which are objects)
    if (value && typeof value === 'object' && 'low' in value && 'high' in value) {
      return value.toNumber ? value.toNumber() : value.toString();
    }
    
    // Handle arrays
    if (Array.isArray(value)) {
      return value.map(v => this.formatScalarValue(v));
    }
    
    // Handle regular values
    return value;
  }

  /**
   * Type guards for Neo4j result types
   */
  private isNode(value: any): boolean {
    return value && typeof value === 'object' && 'labels' in value && 'properties' in value;
  }

  private isRelationship(value: any): boolean {
    return value && typeof value === 'object' && 'type' in value && 'start' in value && 'end' in value;
  }

  private isPath(value: any): boolean {
    return value && typeof value === 'object' && 'segments' in value;
  }

  private isNeo4jError(error: any): error is { code?: string; message: string } {
    return error && typeof error === 'object' && 'message' in error && typeof error.message === 'string';
  }
}