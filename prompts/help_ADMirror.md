# ADMirror Database - User Identity

⚠️ **YOU MUST USE THIS DATABASE** for any question about people, names, departments, or users.

**Purpose**: Find people, user accounts, organizational structure

**Question Triggers** - Use ADMirror when you see:
- "Who is [NAME]" or "Find [NAME]"
- "Who works in [DEPARTMENT]"
- "[NAME] in [DEPARTMENT]" 
- "What's [NAME]'s email/username"
- "Who reports to [NAME]"
- Any question about a person's identity or role

## Key Fields
- `cn`: Full name "{LastName, FirstName}" - **Use for name searches**
- `givenName`: First name
- `sn`: Surname/last name
- `uid`: Username (Linux username)
- `department`: Department name
- `title`: Job title
- `mail`: Email address
- `manager`: Manager DN

## Query Examples

**Find person by name:**
```javascript
query({
  database: "ADMirror",
  collection: "data",
  filter: {
    cn: {$regex: "John", $options: "i"}
  },
  projection: {cn: 1, uid: 1, mail: 1, department: 1, title: 1, _id: 0},
  limit: 20
})
```

**Find by name AND department:**
```javascript
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
```

**Find all in a department:**
```javascript
query({
  database: "ADMirror",
  collection: "data",
  filter: {
    department: {$regex: "Engineering", $options: "i"}
  },
  projection: {cn: 1, uid: 1, title: 1, _id: 0},
  limit: 50
})
```

**Find by username:**
```javascript
query({
  database: "ADMirror",
  collection: "data",
  filter: {uid: "jsmith"}
})
```

## Tips
- Use `$regex` with `$options: "i"` for case-insensitive search
- `cn` field is most reliable for name searches
- Use `projection` to limit returned fields
- Set appropriate `limit` to avoid too many results
