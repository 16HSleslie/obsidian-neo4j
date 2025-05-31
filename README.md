# Obsidian Neo4j Plugin

Query Neo4j databases and visualize graphs directly in Obsidian notes.

## Status
**Basic Functionality** - Connect to Neo4j databases, execute Cypher queries, and visualize interactive graphs.

## Features

- Database Connection Management - Connect to local or remote Neo4j instances
- Cypher Query Execution - Write queries in code blocks and execute them with a button
- Interactive Graph Visualization - Interactive graphs with Cytoscape.js
- Dual Result Display - Both visual graphs and detailed tabular results
- Connection Testing - Verify your database settings before querying
- Smart Query Processing - Handles graph queries, aggregations, and scalar results
- Node Type Styling - Different colors for different node types
- Graph Controls - Zoom, fit, reset, and click interactions

## Setup

```bash
npm install
npm run build
```

## Configuration

1. Open Obsidian Settings → Neo4j Graph

2. Configure your Neo4j connection:
- Bolt URL: bolt://localhost:7687 (or your Neo4j instance)
- Username: neo4j (default)
- Password: Your Neo4j password
- Encryption: Enable if using encrypted connections

3. Click "Test Connection" to verify settings

## Usage
Create a note with a neo4j-graph code block:

## Basic Node Query
```neo4j-graph
MATCH (n) RETURN n LIMIT 10
```

## Relationship Query
```neo4j-graph
MATCH (a)-[r]->(b) RETURN a, r, b LIMIT 10
```

## Aggregation Query
```neo4j-graph
MATCH (n) 
WITH labels(n) as nodeType, count(n) as count
RETURN nodeType, count 
ORDER BY count DESC
```

## Path Query
```neo4j-graph
MATCH path = (a)-[*1..2]-(b)
RETURN path LIMIT 5
```

Click the "Execute Query" button to run the query and see results!

## What works

- Plugin loads and initializes
- Settings page with connection configuration
- Connection testing and validation
- Code block detection for neo4j-graph
- Cypher query execution
- Basic interactive graph visualization
- Tabular results for aggregations
- Error handling and user feedback
- Graph controls (zoom, fit, reset)
- Node/edge click interactions

## What's Next
Potential enhancements:
- Custom styling options
- Query templates and snippets
- Query history
- Export graphs as images
- Keyboard shortcuts
- Live query refresh
- Advanced graph layouts
- Performance optimizations

## Requirements

Neo4j database (local or remote)
Obsidian 1.8.10+

## Example Queries to Try
```cypher
# Count all nodes
MATCH (n) RETURN count(n) as total_nodes

# Show node types and counts
MATCH (n) 
WITH labels(n) as nodeType, count(n) as count 
RETURN nodeType, count 
ORDER BY count DESC

# Show relationship types
MATCH ()-[r]->() 
WITH type(r) as relType, count(r) as count
RETURN relType, count 
ORDER BY count DESC

# Find connected nodes
MATCH (a)-[r]-(b) 
RETURN a, r, b LIMIT 20

# Simple path finding
MATCH path = (start)-[*1..3]-(end)
WHERE id(start) <> id(end)
RETURN path LIMIT 10
```

Built with TypeScript, Cytoscape.js, and the Neo4j Driver.