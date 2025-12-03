import { describe, it, expect } from "@jest/globals";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to simulate search_resource logic
function searchResource(
  resourceFiles: Array<{ name: string; filePath: string }>,
  query: string,
  options: {
    caseSensitive?: boolean;
    maxResults?: number;
    resources?: string[];
  } = {}
) {
  const {
    caseSensitive = false,
    maxResults = 50,
    resources = [],
  } = options;

  const resourceList = resourceFiles.filter((res) =>
    !resources || resources.length === 0 ? true : resources.includes(res.name)
  );

  if (resourceList.length === 0) {
    return {
      error: "No matching resources to search.",
      isError: true,
    };
  }

  const needle = caseSensitive ? query : query.toLowerCase();
  const maxHits = Math.max(1, Math.min(maxResults, 200));
  const results = [];

  for (const res of resourceList) {
    if (!fs.existsSync(res.filePath)) {
      results.push({
        resource: res.name,
        error: `Resource file not found: ${res.filePath}`,
      });
      continue;
    }

    const content = fs.readFileSync(res.filePath, "utf-8");
    const lines = content.split(/\r?\n/);
    const matches: Array<{ line: number; text: string }> = [];

    for (let i = 0; i < lines.length && matches.length < maxHits; i++) {
      const line = lines[i];
      if (!line) continue;
      const haystack = caseSensitive ? line : line.toLowerCase();
      if (haystack.includes(needle)) {
        matches.push({ line: i + 1, text: line.trimEnd() });
      }
    }

    results.push({
      resource: res.name,
      matchCount: matches.length,
      matches,
    });
  }

  return { query, results };
}

describe("search_resource tool logic", () => {
  const guidesDir = path.join(__dirname, "..", "guides");
  const resourceFiles = [
    { name: "reference", filePath: path.join(guidesDir, "reference.md") },
    { name: "guide", filePath: path.join(guidesDir, "guide.md") },
  ];

  it("should find matches when searching for 'ADMirror'", () => {
    const result = searchResource(resourceFiles, "ADMirror", {
      caseSensitive: false,
      maxResults: 50,
    });

    expect(result.query).toBe("ADMirror");
    expect(result.results).toBeDefined();
    expect(result.results!.length).toBeGreaterThan(0);

    // Should find matches in reference resource
    const referenceResult = result.results!.find((r: any) => r.resource === "reference");
    expect(referenceResult).toBeDefined();
    expect(referenceResult!.matchCount).toBeGreaterThan(0);
    expect(referenceResult!.matches).toBeDefined();
    expect(referenceResult!.matches!.length).toBeGreaterThan(0);
  });

  it("should be case-sensitive when caseSensitive is true", () => {
    const caseSensitiveResult = searchResource(resourceFiles, "admirror", {
      caseSensitive: true,
      maxResults: 50,
    });

    const caseInsensitiveResult = searchResource(resourceFiles, "admirror", {
      caseSensitive: false,
      maxResults: 50,
    });

    // Case-sensitive should find fewer or no matches (since 'admirror' doesn't exist)
    const sensitiveMatches = caseSensitiveResult.results!.reduce(
      (sum: number, r: any) => sum + r.matchCount, 0
    );
    const insensitiveMatches = caseInsensitiveResult.results!.reduce(
      (sum: number, r: any) => sum + r.matchCount, 0
    );

    expect(insensitiveMatches).toBeGreaterThanOrEqual(sensitiveMatches);
    expect(insensitiveMatches).toBeGreaterThan(0); // Should find 'ADMirror'
  });

  it("should respect maxResults parameter", () => {
    const result = searchResource(resourceFiles, "database", {
      caseSensitive: false,
      maxResults: 3,
    });

    // Each resource should have at most 3 matches
    for (const resourceResult of result.results!) {
      expect(resourceResult.matches!.length).toBeLessThanOrEqual(3);
    }
  });

  it("should search only specified resources when resources parameter is provided", () => {
    const result = searchResource(resourceFiles, "database", {
      resources: ["reference"],
      caseSensitive: false,
      maxResults: 50,
    });

    // Should only have results for reference resource
    expect(result.results!.length).toBe(1);
    expect(result.results![0].resource).toBe("reference");
  });

  it("should return error when no matching resources exist", () => {
    const result = searchResource(resourceFiles, "test", {
      resources: ["nonexistent_resource"],
      caseSensitive: false,
      maxResults: 50,
    });

    expect(result.isError).toBe(true);
    expect(result.error).toContain("No matching resources");
  });

  it("should include line numbers in matches", () => {
    const result = searchResource(resourceFiles, "Routing", {
      caseSensitive: false,
      maxResults: 50,
    });

    const referenceResult = result.results!.find((r: any) => r.resource === "reference");

    if (referenceResult && referenceResult.matches!.length > 0) {
      const firstMatch = referenceResult.matches![0];
      expect(firstMatch.line).toBeGreaterThan(0);
      expect(firstMatch.text).toBeDefined();
      expect(typeof firstMatch.text).toBe("string");
    }
  });

  it("should handle searches with no matches", () => {
    const result = searchResource(resourceFiles, "xyzabc123nonexistentterm", {
      caseSensitive: false,
      maxResults: 50,
    });

    // Should return results but with zero matches
    expect(result.results).toBeDefined();
    for (const resourceResult of result.results!) {
      expect(resourceResult.matchCount).toBe(0);
      expect(resourceResult.matches!.length).toBe(0);
    }
  });

  it("should find 'query' across multiple resources", () => {
    const result = searchResource(resourceFiles, "query", {
      caseSensitive: false,
      maxResults: 100,
    });

    const totalMatches = result.results!.reduce(
      (sum: number, r: any) => sum + r.matchCount, 0
    );

    expect(totalMatches).toBeGreaterThan(0);
  });

  it("should handle case-sensitive search for exact match", () => {
    const result = searchResource(resourceFiles, "MongoDB", {
      caseSensitive: true,
      maxResults: 50,
    });

    const totalMatches = result.results!.reduce(
      (sum: number, r: any) => sum + r.matchCount, 0
    );

    expect(totalMatches).toBeGreaterThan(0);
  });
});
