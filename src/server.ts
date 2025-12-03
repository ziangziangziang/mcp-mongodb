import "dotenv/config";
import { MongoClient } from "mongodb";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod";
import { isDatabaseAllowed, parseDbNames, withDatabaseAccess } from "./utils.js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to load prompts/resources from external files
function loadPromptsConfig() {
  const promptsDir = path.join(__dirname, "..", "prompts");
  const configPath = path.join(promptsDir, "prompts.json");
  
  if (!fs.existsSync(configPath)) {
    return { prompts: [], resources: [] };
  }
  
  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  return config;
}

function replacePlaceholders(text: string, replacements: Record<string, string>): string {
  let result = text;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replaceAll(`{${key}}`, value);
  }
  return result;
}

async function getDatabaseList(client: MongoClient, allowedDbs: string[], disallowedDbs: string[]) {
  const adminDb = client.db().admin();
  const { databases } = await adminDb.listDatabases();
  const filteredDbs = databases.filter((db) => 
    isDatabaseAllowed(db.name, allowedDbs, disallowedDbs)
  );
  return filteredDbs.map(db => `- **${db.name}**`).join('\n');
}

export function buildMongoMcpServer(
  client: MongoClient,
  allowedDbs: string[],
  disallowedDbs: string[]
) {
  const server = new McpServer({
    name: "mongodb-mcp",
    version: "1.0.0",
  });

  // Load prompts/resources configuration
  const config = loadPromptsConfig();
  const promptsDir = path.join(__dirname, "..", "prompts");

  // Dynamic placeholders generator
  const getPlaceholders = async () => {
    const now = Date.now();
    const currentEpoch = Math.floor(now / 1000);
    const weekAgoEpoch = currentEpoch - 7 * 24 * 3600;
    const monthAgoEpoch = currentEpoch - 30 * 24 * 3600;
    const currentTime = new Date(now).toISOString();
    const databases = await getDatabaseList(client, allowedDbs, disallowedDbs);

    return {
      CURRENT_TIME: currentTime,
      CURRENT_EPOCH: String(currentEpoch),
      WEEK_AGO_EPOCH: String(weekAgoEpoch),
      MONTH_AGO_EPOCH: String(monthAgoEpoch),
      DATABASES: databases,
    };
  };

  // Register resources dynamically
  for (const resource of config.resources || []) {
    server.registerResource(
      resource.name,
      resource.uri,
      {
        description: resource.description,
        mimeType: resource.mimeType || "text/markdown",
      },
      async () => {
        const filePath = path.join(promptsDir, resource.file);
        if (!fs.existsSync(filePath)) {
          return {
            contents: [{
              uri: resource.uri,
              mimeType: resource.mimeType || "text/markdown",
              text: `Resource file not found: ${resource.file}`,
            }],
          };
        }

        const content = fs.readFileSync(filePath, "utf-8");
        const placeholders = await getPlaceholders();
        const processedContent = replacePlaceholders(content, placeholders);

        return {
          contents: [{
            uri: resource.uri,
            mimeType: resource.mimeType || "text/markdown",
            text: processedContent,
          }],
        };
      }
    );
  }

  // Register prompts dynamically
  for (const prompt of config.prompts || []) {
    server.registerPrompt(
      prompt.name,
      {
        title: prompt.title,
        description: prompt.description,
      },
      async () => {
        const filePath = path.join(promptsDir, prompt.file);
        if (!fs.existsSync(filePath)) {
          return {
            messages: [{
              role: "user" as const,
              content: {
                type: "text" as const,
                text: `Prompt file not found: ${prompt.file}`,
              },
            }],
          };
        }

        const content = fs.readFileSync(filePath, "utf-8");
        const placeholders = await getPlaceholders();
        const processedContent = replacePlaceholders(content, placeholders);

        return {
          messages: [{
            role: "user" as const,
            content: {
              type: "text" as const,
              text: processedContent,
            },
          }],
        };
      }
    );
  }

  // ---- Tool 0: list databases ----
  server.registerTool(
    "list_databases",
    {
      title: "List Databases",
      description: "List all MongoDB databases. IMPORTANT: Before using any tools, read the 'query_guide' resource for critical information about database structure and query patterns.",
      inputSchema: z.object({}),
    },
    async () => {
      try {
        const adminDb = client.db().admin();
        const { databases } = await adminDb.listDatabases();
        
        const filteredDbs = databases.filter((db) => 
          isDatabaseAllowed(db.name, allowedDbs, disallowedDbs)
        );
        
        const result = {
          databases: filteredDbs.map((db) => ({
            name: db.name,
            sizeOnDisk: db.sizeOnDisk,
            empty: db.empty,
          })),
          totalCount: filteredDbs.length,
        };
        
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ 
                error: error instanceof Error ? error.message : String(error) 
              }, null, 2),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // ---- Tool 1: list collections ----
  server.registerTool(
    "list_collections",
    {
      title: "List Collections",
      description: "List all MongoDB collections in the specified database. After seeing available databases, use this to discover what collections (tables) exist in a database. Then use get_collection_schema or sample_documents to understand the data structure.",
      inputSchema: z.object({
        database: z.string().describe("The name of the database"),
      }),
    },
    async ({ database }) => {
      return withDatabaseAccess(database, allowedDbs, disallowedDbs, client, async (db) => {
        const cols = await db.listCollections().toArray();
        return cols.map((c) => c.name);
      });
    }
  );

  // ---- Tool 2: infer schema by sampling ----
  server.registerTool(
    "get_collection_schema",
    {
      title: "Get Collection Schema",
      description: "Infer the schema of a MongoDB collection by sampling documents. This examines multiple documents to determine field names and their types (string, number, array, object, etc.). Use this to understand what fields are available before writing queries. Increase sampleSize for more accurate schema inference on varied data.",
      inputSchema: z.object({
        database: z.string().describe("The name of the database"),
        collection: z.string().describe("The name of the collection"),
        sampleSize: z.number().optional().default(20).describe("Number of documents to sample (default: 20, increase for more accuracy)"),
      }),
    },
    async ({ database, collection, sampleSize = 20 }) => {
      return withDatabaseAccess(database, allowedDbs, disallowedDbs, client, async (db) => {
        const docs = await db
          .collection(collection)
          .find({})
          .limit(sampleSize)
          .toArray();

        const schema: Record<string, string> = {};
        for (const doc of docs) {
          for (const [key, val] of Object.entries(doc)) {
            const type =
              val === null
                ? "null"
                : Array.isArray(val)
                ? "array"
                : typeof val;
            if (!schema[key]) schema[key] = type;
          }
        }
        
        return { database, collection, inferredSchema: schema };
      });
    }
  );

  // ---- Tool 3: sample documents ----
  server.registerTool(
    "sample_documents",
    {
      title: "Sample Documents",
      description: "Get sample documents from a MongoDB collection to see actual data examples. This returns real documents with their complete structure, which is helpful for understanding the data format, seeing nested objects, array contents, and actual values. Use this before writing complex queries to understand the data.",
      inputSchema: z.object({
        database: z.string().describe("The name of the database"),
        collection: z.string().describe("The name of the collection"),
        limit: z.number().optional().default(5).describe("Maximum number of documents to return (default: 5)"),
      }),
    },
    async ({ database, collection, limit = 5 }) => {
      return withDatabaseAccess(database, allowedDbs, disallowedDbs, client, async (db) => {
        return await db.collection(collection).find({}).limit(limit).toArray();
      });
    }
  );

  // ---- Tool 4: query documents ----
  server.registerTool(
    "query",
    {
      title: "Query Documents",
      description: "Query documents from a MongoDB collection. For GPU/cluster queries, use lsf_research database with jobConfig collection (see query_guide resource for field details and examples).",
      inputSchema: z.object({
        database: z.string().describe("The name of the database"),
        collection: z.string().describe("The name of the collection"),
        filter: z.record(z.string(), z.any()).optional().default({}).describe("MongoDB query filter object. Examples: {status: 'active'}, {age: {$gt: 18, $lt: 65}}, {tags: {$in: ['featured']}}, {email: {$exists: true}}, {'profile.verified': true}"),
        projection: z.record(z.string(), z.any()).optional().describe("Fields to include/exclude. Use 1 to include, 0 to exclude. Example: {name: 1, email: 1, _id: 0} returns only name and email fields"),
        sort: z.record(z.string(), z.number()).optional().describe("Sort order. Use 1 for ascending, -1 for descending. Example: {createdAt: -1, name: 1} sorts by date descending, then name ascending"),
        limit: z.number().optional().default(10).describe("Maximum number of documents to return (default: 10)"),
      }),
    },
    async ({ database, collection, filter = {}, projection, sort, limit = 10 }) => {
      return withDatabaseAccess(database, allowedDbs, disallowedDbs, client, async (db) => {
        let cursor = db.collection(collection).find(filter);
        
        if (projection) {
          cursor = cursor.project(projection);
        }
        
        if (sort) {
          cursor = cursor.sort(sort as any);
        }
        
        const docs = await cursor.limit(limit).toArray();
        
        return {
          database,
          collection,
          filter,
          projection,
          sort,
          limit,
          resultCount: docs.length,
          results: docs,
        };
      });
    }
  );

  // ---- Tool 5: aggregation pipeline ----
  server.registerTool(
    "aggregation",
    {
      title: "Aggregation Pipeline",
      description: "Run MongoDB aggregation for analytics and grouping. For 'most active GPU user' queries: use lsf_research.jobConfig with $match (filter GPU jobs), $group (by user), $sort, $limit. See query_guide resource for complete examples with current epoch timestamps.",
      inputSchema: z.object({
        database: z.string().describe("The name of the database"),
        collection: z.string().describe("The name of the collection"),
        pipeline: z.array(z.record(z.string(), z.any())).describe("MongoDB aggregation pipeline array. Common stages: $match (filter), $group (aggregate), $sort, $limit, $project (reshape), $unwind (flatten arrays), $lookup (join). Example: [{$match: {status: 'active'}}, {$group: {_id: '$category', count: {$sum: 1}, avgPrice: {$avg: '$price'}}}, {$sort: {count: -1}}]"),
      }),
    },
    async ({ database, collection, pipeline }) => {
      return withDatabaseAccess(database, allowedDbs, disallowedDbs, client, async (db) => {
        const results = await db.collection(collection).aggregate(pipeline).toArray();
        
        return {
          database,
          collection,
          pipeline,
          resultCount: results.length,
          results,
        };
      });
    }
  );

  return server;
}

export async function createMongoServer() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set. Add it to your environment or .env file before starting the server.");
  }
  
  const allowedDbs = parseDbNames(process.env.ALLOWED_DB_NAME);
  const disallowedDbs = parseDbNames(process.env.DISALLOWED_DB_NAME);

  const client = new MongoClient(uri);
  await client.connect();

  const server = buildMongoMcpServer(client, allowedDbs, disallowedDbs);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Run server
if (process.env.NODE_ENV !== "test") {
  createMongoServer().catch((err) => {
    console.error("Failed to start MongoDB MCP server:", err);
    process.exit(1);
  });
}
