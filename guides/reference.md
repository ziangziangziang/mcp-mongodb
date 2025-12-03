# MongoDB Reference

Single source of truth for routing, fields, and query examples. Search this file with `search_resource({query: "term"})`.

**Current time**: {CURRENT_TIME}  
**Current epoch**: {CURRENT_EPOCH}  
**1 week ago**: {WEEK_AGO_EPOCH}  
**1 month ago**: {MONTH_AGO_EPOCH}

## Databases
{DATABASES}

### Routing
- Use **ADMirror** for people/identity/org data (names, departments, contact info, reporting).
- Use **lsf_research** for HPC/cluster/GPU jobs, queues, hosts, GPU inventory.

## Core Tools
- `list_collections({database})` - list collections.
- `sample_documents({database, collection, limit})` - see structure.
- `get_collection_schema({database, collection, sampleSize})` - infer fields.
- `query({database, collection, filter, projection, sort, limit})` - fetch docs.
- `aggregation({database, collection, pipeline})` - analytics/grouping.

---

## ADMirror (people/identity)
**Purpose**: Find people, usernames, emails, departments, org structure.  
**Use when you see**: "who is...", "find NAME", "who works in DEPT", "email/username/title".

**Key fields**
- `cn`: Full name "{LastName, FirstName}" (best for name search)
- `givenName`: First name
- `sn`: Surname/last name
- `uid`: Username (Linux)
- `department`: Department name
- `title`: Job title
- `mail`: Email
- `manager`: Manager DN

**Examples**
```javascript
// Find person by name
query({
  database: "ADMirror",
  collection: "data",
  filter: { cn: {$regex: "John", $options: "i"} },
  projection: {cn: 1, uid: 1, mail: 1, department: 1, title: 1, _id: 0},
  limit: 20
});

// By name + department
query({
  database: "ADMirror",
  collection: "data",
  filter: {
    cn: {$regex: "John", $options: "i"},
    department: {$regex: "Information Service", $options: "i"}
  },
  projection: {cn: 1, uid: 1, mail: 1, department: 1, title: 1, _id: 0},
  limit: 20
});

// All in a department
query({
  database: "ADMirror",
  collection: "data",
  filter: { department: {$regex: "Engineering", $options: "i"} },
  projection: {cn: 1, uid: 1, title: 1, _id: 0},
  limit: 50
});

// By username
query({
  database: "ADMirror",
  collection: "data",
  filter: { uid: "jsmith" }
});
```

**Tips**
- Use `$regex` with `$options: "i"` for case-insensitive search.
- `cn` is most reliable for name searches.
- Use `projection` to limit fields; set `limit` to avoid huge result sets.

---

## lsf_research (HPC/GPU)
**Purpose**: GPU usage, job history, queue stats, host/GPU inventory.  
**Primary collection**: `jobConfig` (job history + GPU usage).

**Time anchors**
- Current epoch: {CURRENT_EPOCH}
- 1 week ago: {WEEK_AGO_EPOCH}
- 1 month ago: {MONTH_AGO_EPOCH}

**jobConfig fields**
- `user`: Username
- `gpus`: Number of GPUs used
- `submitTime`: Job submit time (epoch seconds)
- `runTime`: Job duration (seconds)
- `queue`: Queue name
- `status`: Job status
- `jobId`: Job ID

**Examples**
```javascript
// Most active GPU user (last week)
aggregation({
  database: "lsf_research",
  collection: "jobConfig",
  pipeline: [
    {$match: {submitTime: {$gt: {WEEK_AGO_EPOCH}}, gpus: {$gt: 0}}},
    {$group: {
      _id: "$user",
      totalJobs: {$sum: 1},
      totalGPUs: {$sum: "$gpus"},
      totalRunTime: {$sum: "$runTime"}
    }},
    {$sort: {totalJobs: -1}},
    {$limit: 1}
  ]
});

// GPU jobs by user (recent first)
query({
  database: "lsf_research",
  collection: "jobConfig",
  filter: { user: "username", gpus: {$gt: 0} },
  sort: {submitTime: -1},
  limit: 20
});

// GPU usage stats by queue
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
});
```

**Other collections**
- `gpuConfig`: GPU inventory (gpuName, hostName, gModel, gTotalMem)
- `gpuLoad`: Time-series GPU metrics (gUsedMem, gUt, timestamp)
- `hostConfig`: Host specs (hostName, cores, maxCpus, maxMem)
- `runningJobConfig`: Currently running jobs
- `pendingJobConfig`: Queued jobs

**Tips**
- Filter GPU jobs with `{gpus: {$gt: 0}}`.
- Use `submitTime` for time windows with epoch anchors above.
- Prefer `aggregation` for analytics; `query` for direct lookups.
