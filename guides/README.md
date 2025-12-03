# Guides Directory

This directory (previously `prompts/`) contains external prompt and resource files that are dynamically loaded by the MongoDB MCP server.

## Structure

- **`prompts.json`** - Configuration file defining all prompts and resources
- **`*.md`** - Markdown files containing prompt/resource content

## Configuration Format

```json
{
  "prompts": [
    {
      "name": "prompt_name",
      "title": "Display Title",
      "description": "Description shown to users",
      "file": "filename.md"
    }
  ],
  "resources": [
    {
      "name": "resource_name",
      "uri": "resource://uri",
      "title": "Display Title",
      "description": "Description shown to users",
      "mimeType": "text/markdown",
      "file": "filename.md"
    }
  ]
}
```

## Template Variables

The following placeholders are automatically replaced when prompts/resources are loaded:

- `{CURRENT_TIME}` - Current time in ISO format
- `{CURRENT_EPOCH}` - Current UNIX epoch (seconds)
- `{WEEK_AGO_EPOCH}` - Epoch timestamp for 1 week ago
- `{MONTH_AGO_EPOCH}` - Epoch timestamp for 1 month ago
- `{DATABASES}` - List of available databases (markdown format)

## Default Layout

- Prompt: **`guide`** (file: `guide.md`) — quick routing and usage.
- Resource: **`reference`** (file: `reference.md`) — full detail, fields, and examples. Search it with the `search_resource` tool.

## Adding New Prompts/Resources

1. Create a new `.md` file in this directory
2. Add an entry to `prompts.json` under `prompts` or `resources`
3. Use template variables where needed (e.g., `{CURRENT_EPOCH}`)
4. Rebuild the server: `npm run build`

## Example

**File: `help_mydb.md`**
```markdown
# MyDB Database Help

Current epoch: {CURRENT_EPOCH}

## Databases
{DATABASES}
```

**In `prompts.json`:**
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

This makes the MCP server database-agnostic and easily customizable!
