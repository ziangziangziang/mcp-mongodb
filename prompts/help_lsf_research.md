# lsf_research Database - HPC Cluster Data

**Purpose**: GPU usage, job data, cluster performance metrics

## Key Collection: jobConfig
**Use for**: Job history, GPU usage analysis, user activity

**Important Fields:**
- `user`: Username (STRING)
- `gpus`: Number of GPUs used (NUMBER)
- `submitTime`: Job submit time (UNIX epoch seconds)
- `runTime`: Job duration in seconds (NUMBER)
- `queue`: Queue name (STRING)
- `status`: Job status (STRING)
- `jobId`: Job ID (NUMBER)

**Time Calculations:**
- Current epoch: {CURRENT_EPOCH}
- 1 week ago: {WEEK_AGO_EPOCH}
- 1 month ago: {MONTH_AGO_EPOCH}

## Query Examples

**Most active GPU user (last week):**
```javascript
aggregation({
  database: "lsf_research",
  collection: "jobConfig",
  pipeline: [
    {
      $match: {
        submitTime: {$gt: {WEEK_AGO_EPOCH}},
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
```

**Find GPU jobs by user:**
```javascript
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
```

**GPU usage statistics by queue:**
```javascript
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
```

## Other Collections
- `gpuConfig`: GPU inventory (gpuName, hostName, gModel, gTotalMem)
- `gpuLoad`: Time-series GPU metrics (gUsedMem, gUt, timestamp)
- `hostConfig`: Host specs (hostName, cores, maxCpus, maxMem)
- `runningJobConfig`: Currently running jobs
- `pendingJobConfig`: Queued jobs

## Tips
- Always filter GPU jobs with `{gpus: {$gt: 0}}`
- Use `submitTime` (epoch seconds) for time filters
- Use `aggregation` for analytics (grouping, counting, stats)
- Use `query` for simple lookups
