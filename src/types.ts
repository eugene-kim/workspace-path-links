export interface ParsedReference {
  raw: string;
  prefix: string;
  path: string;
  line?: number;
  start: number;
  end: number;
}

export interface CommentRange {
  start: number;
  end: number;
}

export interface OpenCommandArgs {
  target: string;
  line?: number;
}

export interface WorkspacePathLinksConfig {
  enabled: boolean;
  prefixes: string[];
}
