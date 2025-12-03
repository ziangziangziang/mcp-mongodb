# MongoDB MCP Server (Hello World)

This repository contains a minimal Model Context Protocol (MCP) server that exposes a MongoDB database to MCP-aware agents such as GitHub Copilot Chat in Agent mode.

It is designed to be:

* Simple to read and modify.
* Safe for development (read-only access).
* A clear starting point for building more advanced MCP servers.

## What this server does

The server connects to a MongoDB database and exposes five MCP tools:

1. `list_collections`
   Lists all collections in the specified database.

2. `get_collection_schema`
   Samples documents from a collection and infers a basic schema from field names and primitive types.

3. `sample_documents`
   Returns a small set of example documents from a collection.

4. `query`
   Queries documents with optional filter, projection, sort, and limit parameters.

5. `aggregation`
   Executes MongoDB aggregation pipelines for complex data analysis and transformations.

Agents can use these tools to:

* Inspect the live database.
* Query and filter data based on specific criteria.
* Perform complex data aggregations and analytics.
* Design REST or GraphQL endpoints based on real data.
* Generate models and types that match the database.
* Ground their reasoning in actual collections and fields.

This is intentionally small and straightforward so you can understand every line.

## Prerequisites

* Node.js 18+
* MongoDB (local or hosted, e.g., Atlas)
* Visual Studio Code 1.99.0+ with the GitHub Copilot and Copilot Chat extensions installed
* GitHub Copilot with Copilot Chat enabled
* If in an organization: MCP policy enabled by your admin, if required

## Setup

Clone the repository, then configure the database connection.

Create a `.env` file in the project root:

```env
MONGODB_URI=mongodb://localhost:27017
ALLOWED_DB_NAME=["your_database_name","another_db_if_needed"]
DISALLOWED_DB_NAME=[]
```

Set `MONGODB_URI`, `ALLOWED_DB_NAME`, and `DISALLOWED_DB_NAME` to match your environment.
- `MONGODB_URI`: Connection string to your MongoDB instance (required)
- `ALLOWED_DB_NAME`: JSON array of database names that are allowed (empty array or omit to allow all)
- `DISALLOWED_DB_NAME`: JSON array of database names that are disallowed (empty array or omit to disallow none)

Ensure the database exists and has at least one collection with data.

Install dependencies and build:

```bash
npm install
npm run build
```

Optionally, make the server globally runnable:

```bash
npm link
```

If you do this, you will get a `mcp-mongodb` command on your PATH.

## Running the MCP server (default HTTP)

The default entrypoint is a stateless, streamable HTTP server that exposes `/mcp`.

```bash
npm run build
PORT=3000 npm start
```

POST requests to `/mcp` expect MCP JSON-RPC payloads. `GET` and `DELETE` respond with 405.

## Optional: stdio mode

If you need stdio (e.g., for clients that expect it), use the stdio entrypoint:

```bash
npm run build
npm run start:stdio
```

## Integrating with GitHub Copilot Chat (VS Code)

You can configure this MCP server either per-repository or globally in VS Code.

The simplest “hello world” setup is per-repository.

> Note: Copilot expects stdio transports. Use the stdio entrypoint (`npm run start:stdio` / `node dist/server.js`) for the VS Code configuration below, even though the default runtime is HTTP.

### 1. Add `.vscode/mcp.json`

Create `.vscode/mcp.json` in your project:

```json
{
  "servers": {
    "mongodb": {
      "command": "node",
      "args": ["./dist/server.js"]
    }
  }
}
```

If you used `npm link`, you can instead use:

```json
{
  "servers": {
    "mongodb": {
      "command": "mcp-mongodb"
    }
  }
}
```

Use one location per server (either workspace `.vscode/mcp.json` or global VS Code settings, not both) to avoid conflicts.

### 2. Start the server in VS Code

1. Open `.vscode/mcp.json` in VS Code.
2. Click the `Start` button at the top of the servers list.
3. The server will start, and its tools will be discovered.

You can confirm it is configured by running:

* Command Palette → `MCP: List Servers`
* You should see `mongodb` listed.

### 3. Use the tools in Copilot Chat

1. Open Copilot Chat in VS Code.
2. Select `Agent` in the chat source dropdown.
3. Click the tools icon and verify that the `mongodb` server and its tools are available.

Now you can use the tools in natural language. Example prompts:

* `Use mongodb.list_collections to show me all collections in the "mydb" database.`
* `Use mongodb.get_collection_schema for the "orders" collection in "mydb" and propose REST endpoints that match this schema.`
* `Use mongodb.sample_documents from the "users" collection in "mydb" and infer what fields should be required when creating a user.`
* `Use mongodb.query to find all users in "mydb" where age is greater than 18, sorted by name.`
* `Use mongodb.aggregation to group orders by status in "mydb" and count how many orders are in each status.`

## Running the MCP server over HTTP (stateless streamable)

The default server uses the stateless streamable HTTP transport at `/mcp`.

```bash
npm run build
PORT=3000 npm start
```

POST requests to `/mcp` expect MCP JSON-RPC payloads. `GET` and `DELETE` respond with 405.

The agent should call the MCP tools, read the results, and use them to answer your request.

## Tools (current behavior)

These descriptions are consistent with the implementation in `src/server.ts`.

### `list_collections`

* Input:
  * `database` (string, required) - The name of the database
* Behavior: calls `db.listCollections()` and returns an array of collection names from the specified database.
* Typical usage: quick inspection of which collections exist in a database.

### `get_collection_schema`

* Input:

  * `database` (string, required) - The name of the database
  * `collection` (string, required) - The name of the collection
  * `sampleSize` (number, optional, default 20) - Number of documents to sample
* Behavior:

  * Reads up to `sampleSize` documents from the given collection.
  * Inspects each document’s fields.
  * Produces a basic schema mapping each field name to a simple type:

    * `"string"`, `"number"`, `"boolean"`, `"object"`, `"array"`, `"null"`, etc.
* Typical usage:

  * Infer a minimal schema for modeling.
  * Ground agent-generated models and endpoints in real data.

### `sample_documents`

* Input:

  * `database` (string, required) - The name of the database
  * `collection` (string, required) - The name of the collection
  * `limit` (number, optional, default 5) - Maximum number of documents to return
* Behavior:

  * Reads up to `limit` documents from the given collection.
  * Returns the raw documents as JSON.
* Typical usage:

  * Provide the agent with real-world examples of records.
  * Help the agent understand shape and values beyond just types.

### `query`

* Input:

  * `database` (string, required) - The name of the database
  * `collection` (string, required) - The name of the collection
  * `filter` (object, optional, default `{}`) - MongoDB query filter (e.g., `{age: {$gt: 18}}`)
  * `projection` (object, optional) - Fields to include/exclude (e.g., `{name: 1, email: 1, _id: 0}`)
  * `sort` (object, optional) - Sort order (e.g., `{age: -1, name: 1}`)
  * `limit` (number, optional, default 10) - Maximum number of documents to return
* Behavior:

  * Executes a MongoDB query with the specified filter, projection, sort, and limit.
  * Returns matching documents and result count.
* Typical usage:

  * Find specific documents based on criteria.
  * Test query patterns for API endpoints.
  * Retrieve filtered and sorted data for analysis.

### `aggregation`

* Input:

  * `database` (string, required) - The name of the database
  * `collection` (string, required) - The name of the collection
  * `pipeline` (array, required) - MongoDB aggregation pipeline (e.g., `[{$match: {status: 'active'}}, {$group: {_id: '$category', count: {$sum: 1}}}]`)
* Behavior:

  * Executes a MongoDB aggregation pipeline on the specified collection.
  * Returns the aggregation results and result count.
* Typical usage:

  * Perform complex data transformations and analytics.
  * Group, count, and calculate statistics.
  * Test aggregation pipelines for data processing.

## Security and scope

This server is intended for development and local workflows.

* It is read-only in spirit: tools are designed for inspection, not mutation.
* Do not expose this process on a public network.
* If you add write capabilities later, update this README and be explicit about the risks.

Agents should treat this server as a source of context, not as a general-purpose database admin surface.

## Extending this server

If you modify or extend the server:

* Keep control flow simple and direct.
* Add tools only when they serve clear agent use cases.
* Update this README whenever you add or change tools or behavior in a meaningful way.

Common next steps:

* Add a read-only query tool that accepts a filter and projection object with tight validation.
* Add a tool that summarizes inferred schemas for all collections.
* Generate TypeScript types, Zod schemas, or OpenAPI fragments from `get_collection_schema`.

Keep the implementation straightforward so that both humans and agents can reason about it.
