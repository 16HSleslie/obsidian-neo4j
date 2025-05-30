# Obsidian Neo4j Plugin

Query Neo4j from Obsidian notes.

## Status
🚧 Early development - doesn't do anything yet

## Setup
bashnpm install
npm run dev
./scripts/dev-setup.sh

## Development

Make changes
Files auto-build
Copy to vault: ./scripts/dev-setup.sh
Reload Obsidian

## What Works

Plugin loads
Settings page exists
Code blocks with neo4j-graph are detected

## What Doesn't Work

Everything else

## Test

Create a note with:
```neo4j-graph
MATCH (n) RETURN n
```