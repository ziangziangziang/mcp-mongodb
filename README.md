# MongoDB MCP Server (Hello World)

This repository contains a minimal Model Context Protocol (MCP) server that exposes a MongoDB database to MCP-aware agents such as GitHub Copilot Chat in Agent mode.

It is designed to be:

* Simple to read and modify.
* Safe for development (read-only access).
* A clear starting point for building more advanced MCP servers.

## What this server does

The server connects to a MongoDB database and exposes seven MCP tools:

1. `list_databases`
   Lists all accessible databases.

2. `list_collections`
   Lists all collections in the specified database.

3. `get_collection_schema`
   Samples documents from a collection and infers a basic schema from field names and primitive types.

4. `sample_documents`
   Returns a small set of example documents from a collection.

5. `query`
   Queries documents with optional filter, projection, sort, and limit parameters.

6. `aggregation`
   Executes MongoDB aggregation pipelines for complex data analysis and transformations.

7. `search_resource`
   Searches configured resource markdown files for query strings to help agents find relevant documentation.

**Agent Guidance System:**

The server also provides dynamic prompts and resources to guide agents:

- **Resources** (always available): Quick reference guides with database information, query patterns, and routing logic
- **Prompts** (discoverable): Database-specific help with detailed field documentation, query examples, and best practices
- **Template variables**: Live epoch timestamps and database lists automatically injected into guidance

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
* MCP-capable client (e.g., GitHub Copilot Chat in VS Code, or codex)

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

You can configure this MCP server either per-repository or globally in VS Code. You will open up the setting by `CMD+,`, set `chat.mcp.access` to `all`.
If your VS code is configured by your organization, you may need to ask your admin to change this configuration.


> Note: Copilot supports stdio transports and streamableHTTP transports. This example uses stdio for simplicity. Use the stdio entrypoint (`npm run start:stdio` / `node dist/server.js`) for the VS Code configuration below, even though the default runtime is HTTP.

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

* `How many "john" are there in the department "Information Service"?`
* `List top 5 GPU users on the research cluster in the last month.`

## Use the tools in codex

Running the MCP server over HTTP (stateless streamable)

The default server uses the stateless streamable HTTP transport at `/mcp`.

```bash
npm run build
PORT=3000 npm start
```

Add the following to ~/.codex/config.toml:

```toml
[mcp_servers.mongodb-ro]
url = "http://localhost:3000/mcp"
```

Or interactively, in the Codex cli:

```shell
codex mcp add mongodb-ro http://localhost:3000/mcp
```

Confirm the server is added:

```shell
codex mcp list
```

### Example
It's pretty fun to chat with codex in your terminal.

```shell
zziang@L230806 Agents % codex
› how many johns are there in the Information Service?


• I’m planning to build a MongoDB aggregation pipeline that matches department and cn fields with regex filters,
  then counts the matching documents. This approach should keep the query simple and efficient.

• Called
  └ mongodb-ro.aggregation({"database":"ADMirror","collection":"data","pipeline":[{"$match":{"cn":
        {"$regex":"John","$options":"i"},"department":{"$regex":"Information Service","$options":"i"}}},
        {"$count":"count"}]})
    {"database": "ADMirror", "collection": "data", "pipeline": [{"$match": {"cn": {"$regex": "John", "$options":
        "i"}, "department": {"$regex": "Information Service", "$options": "i"}}}, {"$count": "count"}],
        "resultCount": 1, "results": [{"count": 21}]}

─ Worked for 7s ──────────────────────────────────────────────────────────────────────────────────────────────────

• There are 21 people with “John” in their name in Information Services.

```

## Tools (current behavior)

These descriptions are consistent with the implementation in `src/server.ts`.

### `search_resource`

* Input:
  * `query` (string, required) - Text to search for
  * `resources` (array of strings, optional) - Resource names to search (defaults to all)
  * `caseSensitive` (boolean, optional, default false) - Whether search is case-sensitive
  * `maxResults` (number, optional, default 50) - Maximum matches per resource
* Behavior:
  * Searches configured resource markdown files for the query string.
  * Returns matching lines with line numbers from each resource.
  * Supports template variable substitution in searched content.
* Typical usage:
  * Find relevant documentation sections quickly.
  * Locate query examples and field names.
  * Help agents discover routing logic and patterns.

### `list_databases`

* Input: None
* Behavior: Returns a list of all databases that are allowed based on the `ALLOWED_DB_NAME` and `DISALLOWED_DB_NAME` configuration.
* Typical usage: Discover which databases are available for querying.

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

## Customizing for Your Database

This server is database-agnostic and easily customizable through external prompt files:

### Adding Database-Specific Guidance

1. **Create a new help file** in `guides/` directory (e.g., `help_mydb.md`)
2. **Add your guidance** with field names, query examples, and patterns
3. **Use template variables** for dynamic content:
   - `{CURRENT_EPOCH}` - Current UNIX timestamp
   - `{WEEK_AGO_EPOCH}` - Timestamp for 1 week ago
   - `{MONTH_AGO_EPOCH}` - Timestamp for 1 month ago
   - `{DATABASES}` - List of available databases
   - `{CURRENT_TIME}` - Current time in ISO format
4. **Register in `guides/prompts.json`**:
   ```json
   {
     "prompts": [
       {
         "name": "help_mydb",
         "title": "MyDB Help",
         "description": "Guidance for querying MyDB",
         "file": "help_mydb.md"
       }
     ]
   }
   ```
5. **Rebuild**: `npm run build`

See `guides/README.md` for detailed documentation.

### Example: Customizing for E-commerce Database

Create `guides/help_ecommerce.md`:
```markdown
# E-commerce Database Help

## Collections
- orders: Customer orders (orderId, customerId, total, status)
- products: Product catalog (sku, name, price, stock)

## Query Examples
**Find pending orders from last week:**
\`\`\`javascript
query({
  database: "ecommerce",
  collection: "orders",
  filter: {
    status: "pending",
    createdAt: {$gt: {WEEK_AGO_EPOCH}}
  }
})
\`\`\`
```

Add to `guides/prompts.json` and rebuild - agents will automatically discover and use your guidance!

## Extending this server

If you modify or extend the server:

* Keep control flow simple and direct.
* Add tools only when they serve clear agent use cases.
* Update this README whenever you add or change tools or behavior in a meaningful way.
* For domain-specific guidance, use the `guides/` directory instead of modifying code.

Common next steps:

* Add custom prompts for your database schema in `guides/`
* Add validation tools for specific data patterns
* Generate TypeScript types, Zod schemas, or OpenAPI fragments from `get_collection_schema`
* Add monitoring or analytics endpoints

Keep the implementation straightforward so that both humans and agents can reason about it.
