import "dotenv/config";
import { MongoClient } from "mongodb";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod";
import { isDatabaseAllowed, parseDbNames, withDatabaseAccess } from "./utils.js";

export function buildMongoMcpServer(
  client: MongoClient,
  allowedDbs: string[],
  disallowedDbs: string[]
) {
  const server = new McpServer({
    name: "mongodb-mcp",
    version: "1.0.0",
  });

  // ---- Resource: Quick Query Guide (SHORT) ----
  server.registerResource(
    "query_guide",
    "mongodb://guide/query",
    {
      description: "Quick reference for MongoDB databases. Use database-specific help prompts for detailed guidance.",
      mimeType: "text/markdown",
    },
    async () => {
      const adminDb = client.db().admin();
      const { databases } = await adminDb.listDatabases();
      const filteredDbs = databases.filter((db) => 
        isDatabaseAllowed(db.name, allowedDbs, disallowedDbs)
      );

      return {
        contents: [
          {
            uri: "mongodb://guide/query",
            mimeType: "text/markdown",
            text: `# MongoDB Quick Reference

## Available Databases
${filteredDbs.map(db => `- **${db.name}**${db.name === 'lsf_research' ? ' - HPC cluster data' : ''}${db.name === 'ADMirror' ? ' - User identity' : ''}`).join('\n')}

## 🔑 Which Database?
- **People questions** ("who is...", "find user", "works in...") → **ADMirror**
- **Cluster questions** (GPU usage, jobs, performance) → **lsf_research**

## Getting Help
For detailed field names, query examples, and patterns:
- **For user/identity queries**: Call \`help_ADMirror\` prompt
- **For cluster/GPU queries**: Call \`help_lsf_research\` prompt

## Basic Tools
- \`list_collections({database})\` - See collections
- \`sample_documents({database, collection})\` - See data examples
- \`query({database, collection, filter})\` - Simple queries
- \`aggregation({database, collection, pipeline})\` - Complex analytics`,
          },
        ],
      };
    }
  );

  // ---- Prompt: ADMirror Database Help ----
  server.registerPrompt(
    "help_ADMirror",
    {
      title: "ADMirror Database Help",
      description: "Detailed guidance for querying user identity data in ADMirror database (people, departments, organizational structure)",
    },
    async () => {
      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `# ADMirror Database - User Identity

**Purpose**: Find people, user accounts, organizational structure

## Key Fields
- \`cn\`: Full name "{LastName, FirstName}" - **Use for name searches**
- \`givenName\`: First name
- \`sn\`: Surname/last name
- \`uid\`: Username (Linux username)
- \`department\`: Department name
- \`title\`: Job title
- \`mail\`: Email address
- \`manager\`: Manager DN

## Query Examples

**Find person by name:**
\`\`\`javascript
query({
  database: "ADMirror",
  collection: "data",
  filter: {
    cn: {$regex: "John", $options: "i"}
  },
  projection: {cn: 1, uid: 1, mail: 1, department: 1, title: 1, _id: 0},
  limit: 20
})
\`\`\`

**Find by name AND department:**
\`\`\`javascript
query({
  database: "ADMirror",
  collection: "data",
  filter: {
    cn: {$regex: "John", $options: "i"},
    department: {$regex: "Information Service", $options: "i"}
  },
  projection: {cn: 1, uid: 1, mail: 1, department: 1, title: 1, _id: 0},
  limit: 20
})
\`\`\`

**Find all in a department:**
\`\`\`javascript
query({
  database: "ADMirror",
  collection: "data",
  filter: {
    department: {$regex: "Engineering", $options: "i"}
  },
  projection: {cn: 1, uid: 1, title: 1, _id: 0},
  limit: 50
})
\`\`\`

**Find by username:**
\`\`\`javascript
query({
  database: "ADMirror",
  collection: "data",
  filter: {uid: "jsmith"}
})
\`\`\`

## Tips
- Use \`$regex\` with \`$options: "i"\` for case-insensitive search
- \`cn\` field is most reliable for name searches
- Use \`projection\` to limit returned fields
- Set appropriate \`limit\` to avoid too many results`,
            },
          },
        ],
      };
    }
  );

  // ---- Prompt: lsf_research Database Help ----
  server.registerPrompt(
    "help_lsf_research",
    {
      title: "lsf_research Database Help",
      description: "Detailed guidance for querying HPC cluster data in lsf_research database (GPU usage, jobs, hosts, performance metrics)",
    },
    async () => {
      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `# lsf_research Database - HPC Cluster Data

**Purpose**: GPU usage, job data, cluster performance metrics

## Key Collection: jobConfig
**Use for**: Job history, GPU usage analysis, user activity

**Important Fields:**
- \`user\`: Username (STRING)
- \`gpus\`: Number of GPUs used (NUMBER)
- \`submitTime\`: Job submit time (UNIX epoch seconds)
- \`runTime\`: Job duration in seconds (NUMBER)
- \`queue\`: Queue name (STRING)
- \`status\`: Job status (STRING)
- \`jobId\`: Job ID (NUMBER)

**Time Calculations:**
- Current epoch: ${Math.floor(Date.now()/1000)}
- 1 week ago: ${Math.floor(Date.now()/1000) - 7*24*3600}
- 1 month ago: ${Math.floor(Date.now()/1000) - 30*24*3600}

## Query Examples

**Most active GPU user (last week):**
\`\`\`javascript
aggregation({
  database: "lsf_research",
  collection: "jobConfig",
  pipeline: [
    {
      $match: {
        submitTime: {$gt: ${Math.floor(Date.now()/1000) - 7*24*3600}},
        gpus: {$gt: 0}
      }
    },
    {
      $group: {
        _id: "$user",
        totalJobs: {$sum: 1},
        totalGPUs: {$sum: "$gpus"},
        totalRunTime: {$sum: "$runTime"}
      }
    },
    {$sort: {totalJobs: -1}},
    {$limit: 1}
  ]
})
\`\`\`

**Find GPU jobs by user:**
\`\`\`javascript
query({
  database: "lsf_research",
  collection: "jobConfig",
  filter: {
    user: "username",
    gpus: {$gt: 0}
  },
  sort: {submitTime: -1},
  limit: 20
})
\`\`\`

**GPU usage statistics by queue:**
\`\`\`javascript
aggregation({
  database: "lsf_research",
  collection: "jobConfig",
  pipeline: [
    {$match: {gpus: {$gt: 0}}},
    {$group: {
      _id: "$queue",
      totalJobs: {$sum: 1},
      avgGPUs: {$avg: "$gpus"},
      totalRunTime: {$sum: "$runTime"}
    }},
    {$sort: {totalJobs: -1}}
  ]
})
\`\`\`

## Other Collections
- \`gpuConfig\`: GPU inventory (gpuName, hostName, gModel, gTotalMem)
- \`gpuLoad\`: Time-series GPU metrics (gUsedMem, gUt, timestamp)
- \`hostConfig\`: Host specs (hostName, cores, maxCpus, maxMem)
- \`runningJobConfig\`: Currently running jobs
- \`pendingJobConfig\`: Queued jobs

## Tips
- Always filter GPU jobs with \`{gpus: {$gt: 0}}\`
- Use \`submitTime\` (epoch seconds) for time filters
- Use \`aggregation\` for analytics (grouping, counting, stats)
- Use \`query\` for simple lookups`,
            },
          },
        ],
      };
    }
  );

  // ---- Prompt: Quick Start Guide (Easy to discover) ----
  server.registerPrompt(
    "help",
    {
      title: "MongoDB Help - Start Here",
      description: "Get started with querying this MongoDB. Shows available databases, common patterns, and example queries for GPU usage analysis.",
    },
    async () => {
      const adminDb = client.db().admin();
      const { databases } = await adminDb.listDatabases();
      const filteredDbs = databases.filter((db) => 
        isDatabaseAllowed(db.name, allowedDbs, disallowedDbs)
      );

      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `# MongoDB Quick Start Guide

## Available Databases
${filteredDbs.map(db => `- **${db.name}**${db.name === 'lsf_research' ? ' ← Use this for HPC cluster/GPU data' : ''}${db.name === 'ADMirror' ? ' ← Use this for finding people/users' : ''}`).join('\n')}

## 🔑 Which Database?
- **Questions about PEOPLE** ("who is...", "find John", "works in IT") → **ADMirror**
- **Questions about CLUSTER** (GPU usage, jobs, hosts) → **lsf_research**

## For People/User Questions:

**Database**: ADMirror  
**Collection**: data  
**Search Fields**: cn (full name), givenName (first name), sn (last name), department, uid (username)

**Example** (find John in Information Service):
\`\`\`javascript
query({
  database: "ADMirror",
  collection: "data",
  filter: {
    cn: {$regex: "John", $options: "i"},
    department: {$regex: "Information Service", $options: "i"}
  },
  projection: {cn: 1, uid: 1, mail: 1, department: 1, title: 1, _id: 0},
  limit: 20
})
\`\`\`

## For GPU Usage Questions (like "most active GPU user"):

**Database**: lsf_research  
**Collection**: jobConfig  
**Key Fields**: user, gpus, submitTime (epoch seconds)

**Example Query** (most active GPU user last week):
\`\`\`javascript
aggregation({
  database: "lsf_research",
  collection: "jobConfig",
  pipeline: [
    {
      $match: {
        submitTime: {$gt: ${Math.floor(Date.now()/1000) - 7*24*3600}},
        gpus: {$gt: 0}
      }
    },
    {
      $group: {
        _id: "$user",
        totalJobs: {$sum: 1},
        totalGPUs: {$sum: "$gpus"}
      }
    },
    {$sort: {totalJobs: -1}},
    {$limit: 1}
  ]
})
\`\`\`

Current time info:
- Now (epoch): ${Math.floor(Date.now()/1000)}
- 1 week ago: ${Math.floor(Date.now()/1000) - 7*24*3600}
- 1 month ago: ${Math.floor(Date.now()/1000) - 30*24*3600}

## For User Identity Questions:

**Database**: ADMirror  
**Collection**: data  
**Key Fields**: uid (username), cn (full name), sn (surname), givenName (first name), department, title, mail

\`\`\`javascript
query({
  database: "ADMirror",
  collection: "data",
  filter: {uid: "username"}
})
\`\`\``,
            },
          },
        ],
      };
    }
  );

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
