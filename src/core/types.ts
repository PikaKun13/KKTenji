// *.tenji.json v1 の型定義（設計書 §4）
export type LinkType = 'support' | 'echo' | 'contrast' | 'cause';

export interface TenjiNode {
  id: string;
  title: string;
  parent: string | null;
  page: number | null;
  summary?: string;
  notes?: string;
  anchor?: string | null;
  contentHash?: string;
}

export interface TenjiLink {
  from: string;
  to: string;
  type: LinkType;
  direction: '->' | '<->';
  label?: string;
}

export interface TenjiSource {
  type: 'pptx' | 'md';
  path: string;
  pageBy?: 'h2' | 'hr';
}

export interface TenjiDoc {
  version: number;
  deckId?: string;
  title: string;
  source: TenjiSource;
  nodes: TenjiNode[];
  links: TenjiLink[];
  flow?: string[];
  // 前方互換: 未知フィールドは温存する（設計書 §4.6）
  [k: string]: unknown;
}

export interface Diagnostic {
  level: 'error' | 'warn';
  code: string;
  message: string;
  nodeId?: string;
}

export interface ParsedDeck {
  doc: TenjiDoc;
  nodes: Map<string, TenjiNode>;
  children: Map<string, TenjiNode[]>;
  roots: TenjiNode[];
  links: TenjiLink[];
  diagnostics: Diagnostic[];
}
