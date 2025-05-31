import { Record as Neo4jRecord } from "neo4j-driver";

export interface GraphNode {
  id: string;
  label: string;
  properties: Record<string, any>;
}

export interface GraphRelationship {
  id: string;
  source: string;
  target: string;
  type: string;
  properties: Record<string, any>;
}

export interface GraphData {
  nodes: GraphNode[];
  relationships: GraphRelationship[];
}

export interface QueryResult {
  data: GraphData;
  records: Neo4jRecord[];
  summary: {
    query: string;
    executionTime: number;
    nodeCount: number;
    relationshipCount: number;
  };
}

export interface ConnectionConfig {
  url: string;
  username: string;
  password: string;
  encrypted?: boolean;
  trust?: "TRUST_ALL_CERTIFICATES" | "TRUST_CUSTOM_CA_SIGNED_CERTIFICATES" | "TRUST_SYSTEM_CA_SIGNED_CERTIFICATES";
  maxConnectionPoolSize?: number;
  connectionTimeout?: number;
}

export interface EnhancedGraphData extends GraphData {
  scalarData?: any[];
}

export interface EnhancedQueryResult extends QueryResult {
  data: EnhancedGraphData;
}