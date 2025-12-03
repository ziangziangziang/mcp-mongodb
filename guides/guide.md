# MongoDB MCP Guide

Use this prompt to route questions and stay within the guardrails. All detail/examples live in the `reference` resource; search it with `search_resource` when you need specifics.

**Current time**: {CURRENT_TIME}  
**Current epoch**: {CURRENT_EPOCH}

## Available Databases
{DATABASES}

## Routing
- Use **ADMirror** for people/identity/org data (names, departments, contact info).
- Use **lsf_research** for HPC/cluster/GPU jobs, queues, hosts.

## How to Work
1) Check `reference` for patterns and examples.  
2) Use `search_resource({query})` to jump to relevant sections in `reference`.  
3) List collections → inspect samples → run `query`/`aggregation`.

## Quick Time Anchors
- 1 week ago: {WEEK_AGO_EPOCH}
- 1 month ago: {MONTH_AGO_EPOCH}
