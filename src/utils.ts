import type { Db, MongoClient } from "mongodb";

export type ToolResponse = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

// Parse allowed and disallowed database names from environment
export function parseDbNames(envValue: string | undefined): string[] {
  if (!envValue) return [];

  const trimmed = envValue.trim();
  if (trimmed === "" || trimmed === "[]") return [];

  const parseJsonArray = (value: string): string[] | null => {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed)
        ? parsed.map((item) => String(item).trim()).filter(Boolean)
        : null;
    } catch {
      return null;
    }
  };

  // First attempt: direct JSON (e.g., '["db1","db2"]')
  const direct = parseJsonArray(trimmed);
  if (direct) return direct;

  // Second attempt: JSON with single quotes (e.g., "['db1', 'db2']")
  const singleQuoted = parseJsonArray(trimmed.replace(/'/g, '"'));
  if (singleQuoted) return singleQuoted;

  // Fallback: comma-separated or bracketed values (e.g., db1,db2 or [db1, db2])
  const looksListLike = /^\[.*\]$/.test(trimmed) || trimmed.includes(",");
  if (!looksListLike) return [];

  return trimmed
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .split(",")
    .map((name) => name.trim().replace(/^['"]|['"]$/g, ""))
    .filter(Boolean);
}

export function isDatabaseAllowed(dbName: string, allowedDbs: string[], disallowedDbs: string[]): boolean {
  // If database is in disallowed list, reject it
  if (disallowedDbs.length > 0 && disallowedDbs.includes(dbName)) {
    return false;
  }
  // If allowed list is empty, allow all (except disallowed)
  if (allowedDbs.length === 0) {
    return true;
  }
  // Otherwise, database must be in allowed list
  return allowedDbs.includes(dbName);
}

// Helper functions for response formatting
function createTextResponse(data: unknown): ToolResponse {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

function createErrorResponse(message: string): ToolResponse {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ error: message }, null, 2),
      },
    ],
    isError: true,
  };
}

function createDatabaseNotAllowedError(database: string): ToolResponse {
  return createErrorResponse(
    `Database "${database}" is not allowed. Check ALLOWED_DB_NAME and DISALLOWED_DB_NAME settings.`
  );
}

// Wrapper to validate database access and handle errors
export async function withDatabaseAccess<T>(
  database: string,
  allowedDbs: string[],
  disallowedDbs: string[],
  client: MongoClient,
  operation: (db: Db) => Promise<T>
): Promise<ToolResponse> {
  if (!isDatabaseAllowed(database, allowedDbs, disallowedDbs)) {
    return createDatabaseNotAllowedError(database);
  }

  try {
    const db = client.db(database);
    const result = await operation(db);
    return createTextResponse(result);
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error.message : String(error)
    );
  }
}
