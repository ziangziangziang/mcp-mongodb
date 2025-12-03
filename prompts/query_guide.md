# MongoDB Quick Reference

⚠️ **IMPORTANT**: ALL data about people, users, and organizational information is stored in MongoDB databases. You MUST use database queries to answer these questions.

## Available Databases
{DATABASES}

## 🔑 Which Database to Query?

### Use ADMirror Database for:
- **ANY question about people** ("who is X", "find person", "who works in Y")
- User identity lookups (name, email, username, department)
- Organizational queries (who's in a team, who reports to whom)
- Contact information

**Examples that REQUIRE ADMirror queries:**
- "Who is Ziang in Information Service?" → Query ADMirror
- "Find John Smith" → Query ADMirror  
- "Who works in the IT department?" → Query ADMirror
- "What's Sarah's email?" → Query ADMirror

### Use lsf_research Database for:
- Cluster usage, GPU jobs, HPC performance
- Job history and queue information
- Hardware inventory (hosts, GPUs)

## Getting Help
For detailed field names, query examples, and patterns:
- **For user/identity queries**: Call `help_ADMirror` prompt
- **For cluster/GPU queries**: Call `help_lsf_research` prompt

## Basic Tools
- `list_collections({database})` - See collections
- `sample_documents({database, collection})` - See data examples
- `query({database, collection, filter})` - Simple queries
- `aggregation({database, collection, pipeline})` - Complex analytics
