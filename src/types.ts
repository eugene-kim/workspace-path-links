export interface ParsedReference {
  raw: string;
  prefix: string;
  path: string;
  selector: ReferenceSelector;
  start: number;
  end: number;
}

export type ReferenceSelector =
  | { kind: 'none' }
  | { kind: 'line'; line: number }
  | { kind: 'jsonPointer'; pointer: string }
  | { kind: 'jsonPath'; expression: string };

export interface CommentRange {
  start: number;
  end: number;
}

export interface OpenCommandArgs {
  target: string;
  selector?: ReferenceSelector;
}

export interface WorkspacePathLinksConfig {
  enabled: boolean;
  prefixes: string[];
  jsonSelectorEnabled: boolean;
  maxQuickPickItems: number;
  maxFileSizeBytes: number;
}
