---
name: workspace-path-links-syntax
description: Parse and author workspace-relative link syntax for JS/TS comments using @/ prefixes, including optional :line, JSON Pointer fragments, and JSONPath selectors. Use when users ask to create, validate, or transform comment links for navigation.
---

# Workspace Path Links Syntax

## Instructions

Use this skill when a task involves workspace-relative references in JS/TS comments for the Workspace Path Links extension.

### Supported forms

1. Path only:

`@/path/to/file.ext`

2. Path with line (1-based):

`@/path/to/file.ext:57`

3. JSON Pointer selector (RFC 6901 fragment):

`@/path/to/file.json#/a/b/0`

4. JSONPath selector:

`@/path/to/file.json#jsonpath=$..items[?(@.name=="X")]`

### Authoring rules

1. Assume `@/` means workspace-relative path.
2. Keep links inside JS/TS comments only.
3. For `:line`, require a positive integer.
4. Reject invalid line suffixes (`:abc`, `:0`, `:-1`).
5. Use JSON Pointer when exact structure is known.
6. Use JSONPath when matching by properties is needed.
7. Prefer URL-encoding JSONPath when it includes spaces or punctuation that may be fragile in plain text.
8. Exclude trailing punctuation from the link token where possible (such as final `.`, `,`, or unmatched `)`).

### Resolution assumptions

1. Primary base directory: workspace folder containing current document.
2. Multi-root: use the folder that owns the current document.
3. Fallback: current document directory if no workspace folder exists.

### Error handling guidance

1. Missing file: return concise not-found message.
2. Malformed selector: return concise syntax error.
3. JSONPath with multiple matches: present options and let user pick a target.
4. JSON too large for selector evaluation: fail with concise limit message.

## Examples

### Convert plain request into syntax

Input:

"Open README at line 10"

Output:

`@/README.md:10`

### JSON object by known path

Input:

"Go to borrower field in first row of FINAL.json"

Output:

`@/artifacts/output/TCPC/2024-12/FINAL.json#/table/0/row/borrower`

### JSON object by property match

Input:

"Find the row where borrower is Magenta Buyer, LLC (McAfee)"

Output:

`@/artifacts/output/TCPC/2024-12/FINAL.json#jsonpath=$..rows[?(@.borrower=="Magenta Buyer, LLC (McAfee)")]`

### With punctuation in prose

Use:

`// Next: @/docs/migration.md:42`

Avoid binding punctuation to the token:

`// Next: @/docs/migration.md:42,` -> token should be interpreted as `@/docs/migration.md:42`
