import "dotenv/config";
import express from "express";
import type { Request, Response } from "express";
import { MongoClient } from "mongodb";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { buildMongoMcpServer } from "./server.js";
import { parseDbNames } from "./utils.js";

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;

// Validate MongoDB configuration on startup
const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI is not set. Add it to your environment or .env file.");
  process.exit(1);
}

const allowedDbs = parseDbNames(process.env.ALLOWED_DB_NAME);
const disallowedDbs = parseDbNames(process.env.DISALLOWED_DB_NAME);

// Health check endpoint
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "mongodb-mcp" });
});

// MCP endpoint using StreamableHTTPServerTransport
app.post("/mcp", async (req: Request, res: Response) => {
  let client: MongoClient | null = null;
  try {
    client = new MongoClient(uri);
    await client.connect();

    const server = buildMongoMcpServer(client, allowedDbs, disallowedDbs);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    
    res.on("close", () => {
      // Only log in debug mode
      if (process.env.DEBUG) {
        console.log("MCP request completed");
      }
      transport.close();
      server.close();
      if (client) {
        client.close().catch(console.error);
      }
    });
  } catch (error) {
    console.error("Error handling MCP request:", error);
    if (client) {
      client.close().catch(console.error);
    }
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error"
        },
        id: null
      });
    }
  }
});

// Reject GET requests
app.get("/mcp", async (_req: Request, res: Response) => {
  if (process.env.DEBUG) {
    console.log("Rejected GET request to /mcp");
  }
  res.writeHead(405).end(
    JSON.stringify({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Method not allowed."
      },
      id: null
    })
  );
});

// Reject DELETE requests
app.delete("/mcp", async (_req: Request, res: Response) => {
  if (process.env.DEBUG) {
    console.log("Rejected DELETE request to /mcp");
  }
  res.writeHead(405).end(
    JSON.stringify({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Method not allowed."
      },
      id: null
    })
  );
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`MongoDB MCP HTTP server listening on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
});

// Handle port conflicts and other listen errors
server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error(`❌ Error: Port ${PORT} is already in use.`);
    console.error(`Please stop the other server or set a different PORT environment variable.`);
    console.error(`Example: PORT=3001 npm run start:http`);
  } else {
    console.error(`❌ Server error:`, error);
  }
  process.exit(1);
});

// Handle server shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down server...");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});
