# MongoDB Quick Reference

## Available Databases
{DATABASES}

## 🔑 Which Database?
- **People questions** ("who is...", "find user", "works in...") → **ADMirror**
- **Cluster questions** (GPU usage, jobs, performance) → **lsf_research**

## Getting Help
For detailed field names, query examples, and patterns:
- **For user/identity queries**: Call `help_ADMirror` prompt
- **For cluster/GPU queries**: Call `help_lsf_research` prompt

## Basic Tools
- `list_collections({database})` - See collections
- `sample_documents({database, collection})` - See data examples
- `query({database, collection, filter})` - Simple queries
- `aggregation({database, collection, pipeline})` - Complex analytics
