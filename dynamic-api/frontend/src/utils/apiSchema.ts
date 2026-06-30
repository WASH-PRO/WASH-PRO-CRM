import type { Endpoint, EndpointGroup, SchemaField } from '../types';
import { getEndpointDisplayPath } from './apiPath';

export interface SchemaMethod {
  method: string;
  endpointId: string;
  enabled: boolean;
  isSystem: boolean;
}

export interface SchemaNode {
  id: string;
  path: string;
  title: string;
  description?: string;
  methods: SchemaMethod[];
  fields: SchemaField[];
  displayFields: SchemaField[];
  groupId: string | null;
  groupName: string;
  groupColor: string;
  isSystem: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SchemaEdge {
  id: string;
  fromNodeId: string;
  fromField: string;
  fromFieldIndex: number;
  toNodeId: string;
  toPath: string;
  toTitle: string;
  label: string;
}

export interface SchemaLane {
  id: string;
  name: string;
  color: string;
  description?: string;
  y: number;
  height: number;
}

export interface ApiSchemaGraph {
  nodes: SchemaNode[];
  edges: SchemaEdge[];
  lanes: SchemaLane[];
  width: number;
  height: number;
}

/** Shared metrics — must match table markup in ApiSchemaDiagram */
export const SCHEMA_LAYOUT = {
  TABLE_WIDTH: 300,
  TITLE_BLOCK: 58,
  METHODS_BLOCK: 32,
  COL_HEADER: 30,
  FIELD_ROW: 28,
  TABLE_PAD: 6,
  MAX_FIELDS: 14,
  NODE_GAP_X: 56,
  NODE_GAP_Y: 40,
  LANE_PAD_X: 32,
  LANE_PAD_Y: 56,
  LANE_HEADER: 40,
  LANE_GAP: 28,
  COLUMNS: 3,
} as const;

const DEFAULT_GROUP_COLOR = '#64748b';

const VIRTUAL_ID_FIELD: SchemaField = {
  name: '_id',
  type: 'string',
  required: true,
  description: 'MongoDB document ID (primary key)',
  order: -1,
};

function pickSchemaFields(endpoints: Endpoint[]): SchemaField[] {
  const withFields = endpoints
    .filter((ep) => ep.fields?.length)
    .sort((a, b) => {
      const weight = (m: string) => (m === 'POST' ? 0 : m === 'PUT' ? 1 : m === 'PATCH' ? 2 : 3);
      return weight(a.method) - weight(b.method);
    });
  return withFields[0]?.fields ?? [];
}

function buildDisplayFields(fields: SchemaField[]): SchemaField[] {
  const hasId = fields.some((f) => f.name === '_id' || f.name === 'id');
  const list = hasId ? [...fields] : [VIRTUAL_ID_FIELD, ...fields];
  return list;
}

export function getTableHeight(fieldCount: number): number {
  const visible = Math.min(fieldCount, SCHEMA_LAYOUT.MAX_FIELDS);
  const hidden = fieldCount > SCHEMA_LAYOUT.MAX_FIELDS ? SCHEMA_LAYOUT.FIELD_ROW : 0;
  const body = fieldCount === 0
    ? SCHEMA_LAYOUT.FIELD_ROW
    : visible * SCHEMA_LAYOUT.FIELD_ROW + hidden;
  return (
    SCHEMA_LAYOUT.TITLE_BLOCK
    + SCHEMA_LAYOUT.METHODS_BLOCK
    + SCHEMA_LAYOUT.COL_HEADER
    + body
    + SCHEMA_LAYOUT.TABLE_PAD
  );
}

/** Vertical center of a field row for SVG connectors */
export function getFieldRowCenterY(node: SchemaNode, fieldIndex: number): number {
  return (
    node.y
    + SCHEMA_LAYOUT.TITLE_BLOCK
    + SCHEMA_LAYOUT.METHODS_BLOCK
    + SCHEMA_LAYOUT.COL_HEADER
    + fieldIndex * SCHEMA_LAYOUT.FIELD_ROW
    + SCHEMA_LAYOUT.FIELD_ROW / 2
  );
}

export function buildApiSchemaGraph(
  endpoints: Endpoint[],
  groups: EndpointGroup[]
): ApiSchemaGraph {
  const endpointById = new Map(endpoints.map((ep) => [ep._id, ep]));

  const endpointGroupKey = (ep: Endpoint) => `${ep.path}::${ep.apiVersion ?? ''}`;

  const byPath = new Map<string, Endpoint[]>();
  for (const ep of endpoints) {
    const key = endpointGroupKey(ep);
    const list = byPath.get(key) ?? [];
    list.push(ep);
    byPath.set(key, list);
  }

  const pathToNodeId = (ep: Endpoint) => `node:${endpointGroupKey(ep)}`;

  const laneOrder: { id: string; name: string; color: string; description?: string }[] = [
    ...groups
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((g) => ({ id: g._id, name: g.name, color: g.color || DEFAULT_GROUP_COLOR, description: g.description })),
    { id: '__ungrouped__', name: 'Ungrouped', color: DEFAULT_GROUP_COLOR },
    { id: '__system__', name: 'System APIs', color: '#94a3b8' },
  ];

  const nodesByLane = new Map<string, Omit<SchemaNode, 'x' | 'y' | 'width' | 'height'>[]>();

  for (const [, eps] of byPath.entries()) {
    const primary = eps.find((ep) => !ep.isSystem) ?? eps[0];
    const group = primary.groupId;
    const groupId = typeof group === 'object' && group?._id ? group._id : (group as string | undefined);
    const allSystem = eps.every((ep) => ep.isSystem);

    const laneId = allSystem ? '__system__' : groupId ?? '__ungrouped__';
    const laneMeta = laneOrder.find((l) => l.id === laneId)!;
    const fields = pickSchemaFields(eps);
    const displayFields = buildDisplayFields(fields);

    const node = {
      id: pathToNodeId(primary),
      path: getEndpointDisplayPath(primary.path, primary.apiVersion),
      title: primary.name,
      description: primary.description,
      methods: eps.map((ep) => ({
        method: ep.method,
        endpointId: ep._id,
        enabled: ep.enabled,
        isSystem: ep.isSystem,
      })),
      fields,
      displayFields,
      groupId: allSystem ? null : groupId ?? null,
      groupName: laneMeta.name,
      groupColor: laneMeta.color,
      isSystem: allSystem,
    };

    const list = nodesByLane.get(laneId) ?? [];
    list.push(node);
    nodesByLane.set(laneId, list);
  }

  const edges: SchemaEdge[] = [];
  const nodes: SchemaNode[] = [];
  const lanes: SchemaLane[] = [];
  let cursorY = SCHEMA_LAYOUT.LANE_PAD_Y;

  for (const lane of laneOrder) {
    const laneNodes = nodesByLane.get(lane.id);
    if (!laneNodes?.length) continue;

    laneNodes.sort((a, b) => a.path.localeCompare(b.path));

    const { COLUMNS, NODE_GAP_X, NODE_GAP_Y, LANE_PAD_X, LANE_HEADER, LANE_PAD_Y, TABLE_WIDTH } = SCHEMA_LAYOUT;
    const rows = Math.ceil(laneNodes.length / COLUMNS);
    const rowHeights: number[] = [];

    const sized = laneNodes.map((n) => ({
      ...n,
      width: TABLE_WIDTH,
      height: getTableHeight(n.displayFields.length),
    }));

    for (let row = 0; row < rows; row++) {
      const rowNodes = sized.slice(row * COLUMNS, row * COLUMNS + COLUMNS);
      rowHeights.push(Math.max(...rowNodes.map((n) => n.height), 0));
    }

    const maxRowHeight = rowHeights.reduce((s, h, i) => s + h + (i > 0 ? NODE_GAP_Y : 0), 0);
    const laneHeight = LANE_HEADER + maxRowHeight + LANE_PAD_Y;

    lanes.push({
      id: lane.id,
      name: lane.name,
      color: lane.color,
      description: lane.description,
      y: cursorY,
      height: laneHeight,
    });

    sized.forEach((n, index) => {
      const col = index % COLUMNS;
      const row = Math.floor(index / COLUMNS);
      const rowOffset = rowHeights.slice(0, row).reduce((s, h, i) => s + h + (i > 0 ? NODE_GAP_Y : 0), 0);

      const placed = {
        ...n,
        x: LANE_PAD_X + col * (TABLE_WIDTH + NODE_GAP_X),
        y: cursorY + LANE_HEADER + rowOffset,
      };
      nodes.push(placed);

      n.displayFields.forEach((field, fieldIndex) => {
        if (field.type !== 'reference') return;
        const refId = field.refEndpointId;
        if (!refId) return;
        const target = endpointById.get(refId);
        if (!target) return;
        const toNodeId = pathToNodeId(target);
        if (toNodeId === n.id) return;
        const targetNode = sized.find((tn) => tn.id === toNodeId);
        edges.push({
          id: `${n.id}:${field.name}->${toNodeId}`,
          fromNodeId: n.id,
          fromField: field.name,
          fromFieldIndex: fieldIndex,
          toNodeId,
          toPath: getEndpointDisplayPath(target.path, target.apiVersion),
          toTitle: targetNode?.title ?? target.name,
          label: field.name,
        });
      });
    });

    cursorY += laneHeight + SCHEMA_LAYOUT.LANE_GAP;
  }

  const width = SCHEMA_LAYOUT.LANE_PAD_X * 2 + SCHEMA_LAYOUT.COLUMNS * SCHEMA_LAYOUT.TABLE_WIDTH
    + (SCHEMA_LAYOUT.COLUMNS - 1) * SCHEMA_LAYOUT.NODE_GAP_X;
  const height = cursorY + SCHEMA_LAYOUT.LANE_PAD_Y;

  return { nodes, edges, lanes, width, height };
}

export function getPrimaryEndpointId(node: SchemaNode): string {
  const preferred = node.methods.find((m) => m.method === 'POST' && !m.isSystem)
    ?? node.methods.find((m) => !m.isSystem)
    ?? node.methods[0];
  return preferred.endpointId;
}

export function fieldKeyLabel(field: SchemaField, targetTitle?: string): string {
  if (field.name === '_id' || field.name === 'id') return 'PK';
  if (field.type === 'reference') return targetTitle ? `FK→${targetTitle}` : 'FK';
  if (field.required) return 'REQ';
  return '';
}

export function fieldTooltip(field: SchemaField, targetPath?: string): string {
  const parts = [`${field.name}: ${field.type}`];
  if (field.required) parts.push('required');
  if (field.description) parts.push(field.description);
  if (field.type === 'reference' && field.refEndpointId) {
    parts.push(targetPath ? `references ${targetPath}` : `ref id ${field.refEndpointId}`);
  }
  return parts.join(' · ');
}

export interface EdgeGeometry {
  path: string;
  labelX: number;
  labelY: number;
}

/** Orthogonal connector (Workbench-style) between table sides */
export function buildEdgeGeometry(
  from: SchemaNode,
  to: SchemaNode,
  fieldIndex: number
): EdgeGeometry {
  const y1 = getFieldRowCenterY(from, fieldIndex);
  const y2 = getFieldRowCenterY(to, 0);

  const fromCenter = from.x + from.width / 2;
  const toCenter = to.x + to.width / 2;

  let x1: number;
  let x2: number;

  if (toCenter >= fromCenter) {
    x1 = from.x + from.width;
    x2 = to.x;
  } else {
    x1 = from.x;
    x2 = to.x + to.width;
  }

  const gap = 20;
  const bend1 = x1 + (x2 > x1 ? gap : -gap);
  const bend2 = x2 + (x2 > x1 ? -gap : gap);
  const midX = (bend1 + bend2) / 2;

  const path = `M ${x1} ${y1} L ${bend1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${bend2} ${y2} L ${x2} ${y2}`;

  return { path, labelX: midX, labelY: (y1 + y2) / 2 };
}
