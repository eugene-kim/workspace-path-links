# Workspace Path Links

Clickable workspace-relative file references in JavaScript and TypeScript comments.

## Feature Overview

This extension turns `@/`-style file references into clickable links, but only when they appear inside JS/TS comments.

Supported languages:

- `javascript`
- `javascriptreact`
- `typescript`
- `typescriptreact`

Supported comment scopes:

- `// ...`
- `/* ... */` (including multi-line block comments)

Text outside comments is ignored.

## Supported Syntaxes

1. `@/path/to/file.ext`
2. `@/path/to/file.ext:57` (line is 1-based)

Examples:

```ts
// See @/README.md
/*
  Migration details: @/docs/migration.md:42
*/
```

## Settings

### `workspacePathLinks.enabled`

- Type: `boolean`
- Default: `true`
- Enables/disables this extension's link provider.

### `workspacePathLinks.prefixes`

- Type: `string[]`
- Default: `["@/"]`
- Prefixes recognized as workspace-relative references.

## Resolution Rules

1. Primary: current document's workspace folder.
2. Multi-root: workspace folder that owns the current document.
3. Fallback: current document directory when no workspace folder exists.

## Limitations

- JS/TS only (the four language IDs listed above).
- Comment-only link detection.
- No `file://` syntax support.
- Invalid suffixes like `:abc`, `:0`, `:-1` are ignored.

## Troubleshooting

### No link appears

- Confirm the text is inside a JS/TS comment.
- Confirm syntax is one of the two supported forms.
- Confirm `workspacePathLinks.enabled` is `true`.
- Confirm your prefix is listed in `workspacePathLinks.prefixes`.

### Link click shows file-not-found

- Verify the file exists in your workspace (or document-relative fallback location).
- Check for malformed path text or extra punctuation.

### Malformed line suffix

- `:line` must be a positive integer (1-based).
- Invalid suffixes are intentionally not linked.

## Development

From `workspace-path-links/`:

1. Install dependencies:

```bash
npm install
```

2. Compile:

```bash
npm run compile
```

3. Run tests:

```bash
npm test
```

4. Run in Extension Development Host:

- Open this folder in VS Code.
- Press `F5`.

5. Package VSIX:

```bash
npm run package
```

## Notes

If packaging fails, ensure `vsce` is installed globally or run via `npx vsce package`.
