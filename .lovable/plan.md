

# Fix: Invalid Key Error on KB Document Upload

## Problem
The file name is used directly as the storage object key. Characters like `→`, spaces, and parentheses are invalid in storage keys, causing a 400 "InvalidKey" error.

## Solution
Sanitize the file name before uploading by replacing all non-alphanumeric characters (except dots and hyphens) with underscores.

## Change
**`src/components/learn/DocumentsList.tsx`** — line 41:

Replace:
```typescript
const fileName = `${Date.now()}-${file.name}`;
```

With:
```typescript
const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
const fileName = `${Date.now()}-${sanitized}`;
```

This converts `SALES PLAYBOOK - SDR → AE (4).pdf` into `SALES_PLAYBOOK_-_SDR___AE__4_.pdf`, which is a valid storage key. The original file name is still preserved and passed to the edge function via `file_name`.

One file, one line change.

