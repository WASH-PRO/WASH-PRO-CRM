import mongoose, { Types } from 'mongoose';
import { logRepository } from '../repositories';

const COLLECTION_META: Record<string, { label: string; sensitiveFields?: string[]; clearable?: boolean }> = {
  users: { label: 'Users', sensitiveFields: ['password', 'refreshToken'], clearable: false },
  groups: { label: 'Groups', clearable: false },
  endpoints: { label: 'Endpoints', clearable: false },
  endpointgroups: { label: 'Endpoint Groups', clearable: false },
  endpointdatas: { label: 'Endpoint Data', clearable: true },
  logs: { label: 'Audit Logs', clearable: true },
  systemsettings: { label: 'System Settings', clearable: false },
};

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

function assertAllowedCollection(name: string): string {
  const key = name.toLowerCase();
  if (!COLLECTION_META[key]) {
    throw new Error('Collection not allowed');
  }
  return key;
}

function serialize(value: unknown): unknown {
  if (value instanceof Types.ObjectId) return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, serialize(entry)])
    );
  }
  return value;
}

function redactDocument(collection: string, doc: Record<string, unknown>): Record<string, unknown> {
  const plain = serialize(doc) as Record<string, unknown>;
  const sensitive = COLLECTION_META[collection]?.sensitiveFields || [];
  for (const field of sensitive) {
    if (field in plain) plain[field] = '[REDACTED]';
  }
  return plain;
}

function hydrateValue(key: string, value: unknown): unknown {
  if (key.endsWith('Ids') && Array.isArray(value)) {
    return value.map((item) =>
      typeof item === 'string' && OBJECT_ID_PATTERN.test(item) ? new Types.ObjectId(item) : hydrateDocument(item)
    );
  }
  if ((key === '_id' || key.endsWith('Id')) && typeof value === 'string' && OBJECT_ID_PATTERN.test(value)) {
    return new Types.ObjectId(value);
  }
  return hydrateDocument(value);
}

function hydrateDocument(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => hydrateDocument(item));
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, hydrateValue(key, entry)])
    );
  }
  return value;
}

function stripProtectedFields(collection: string, data: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...data };
  delete copy._id;
  const sensitive = COLLECTION_META[collection]?.sensitiveFields || [];
  for (const field of sensitive) {
    if (copy[field] === '[REDACTED]' || copy[field] === undefined) {
      delete copy[field];
    }
  }
  return copy;
}

export class DatabaseService {
  private collection(name: string) {
    const key = assertAllowedCollection(name);
    const db = mongoose.connection.db;
    if (!db) throw new Error('Database not connected');
    return { key, col: db.collection(key) };
  }

  async listCollections() {
    const db = mongoose.connection.db;
    if (!db) throw new Error('Database not connected');

    const entries = await Promise.all(
      Object.entries(COLLECTION_META).map(async ([name, meta]) => ({
        name,
        label: meta.label,
        count: await db.collection(name).countDocuments(),
        clearable: meta.clearable !== false,
      }))
    );

    return entries.sort((a, b) => a.label.localeCompare(b.label));
  }

  async listDocuments(collection: string, page = 1, limit = 20, search?: string) {
    const { key, col } = this.collection(collection);
    const skip = (page - 1) * limit;
    const filter: Record<string, unknown> = {};

    const q = search?.trim();
    if (q) {
      if (OBJECT_ID_PATTERN.test(q)) {
        filter._id = new Types.ObjectId(q);
      } else {
        filter.$or = [
          { name: { $regex: q, $options: 'i' } },
          { login: { $regex: q, $options: 'i' } },
          { email: { $regex: q, $options: 'i' } },
          { path: { $regex: q, $options: 'i' } },
          { message: { $regex: q, $options: 'i' } },
          { key: { $regex: q, $options: 'i' } },
          { slug: { $regex: q, $options: 'i' } },
        ];
      }
    }

    const [docs, total] = await Promise.all([
      col.find(filter).sort({ _id: -1 }).skip(skip).limit(limit).toArray(),
      col.countDocuments(filter),
    ]);

    return {
      data: docs.map((doc) => redactDocument(key, doc as Record<string, unknown>)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getDocument(collection: string, id: string) {
    if (!OBJECT_ID_PATTERN.test(id)) throw new Error('Invalid document ID');
    const { key, col } = this.collection(collection);
    const doc = await col.findOne({ _id: new Types.ObjectId(id) });
    if (!doc) throw new Error('Document not found');
    return redactDocument(key, doc as Record<string, unknown>);
  }

  async createDocument(collection: string, data: Record<string, unknown>, userId?: string) {
    const { key, col } = this.collection(collection);
    const payload = stripProtectedFields(key, data);
    const hydrated = hydrateDocument(payload) as Record<string, unknown>;
    delete hydrated._id;

    const result = await col.insertOne(hydrated);
    await this.logEdit(userId, key, result.insertedId.toString(), 'create');

    const doc = await col.findOne({ _id: result.insertedId });
    return redactDocument(key, doc as Record<string, unknown>);
  }

  async updateDocument(collection: string, id: string, data: Record<string, unknown>, userId?: string) {
    if (!OBJECT_ID_PATTERN.test(id)) throw new Error('Invalid document ID');
    const { key, col } = this.collection(collection);
    const payload = stripProtectedFields(key, data);
    const hydrated = hydrateDocument(payload) as Record<string, unknown>;
    delete hydrated._id;

    const result = await col.findOneAndUpdate(
      { _id: new Types.ObjectId(id) },
      { $set: hydrated },
      { returnDocument: 'after' }
    );

    if (!result) throw new Error('Document not found');
    await this.logEdit(userId, key, id, 'update');
    return redactDocument(key, result as Record<string, unknown>);
  }

  async deleteDocument(collection: string, id: string, userId?: string) {
    if (!OBJECT_ID_PATTERN.test(id)) throw new Error('Invalid document ID');
    const { key, col } = this.collection(collection);
    const result = await col.deleteOne({ _id: new Types.ObjectId(id) });
    if (result.deletedCount === 0) throw new Error('Document not found');
    await this.logEdit(userId, key, id, 'delete');
  }

  async clearCollection(collection: string, userId?: string) {
    const { key, col } = this.collection(collection);
    if (COLLECTION_META[key]?.clearable === false) {
      throw new Error('This collection cannot be cleared');
    }

    const result = await col.deleteMany({});
    await logRepository.create({
      action: 'api_call',
      userId: userId as unknown as Types.ObjectId,
      message: `Raw DB clear collection: ${key} (${result.deletedCount} documents)`,
      details: { collection: key, operation: 'clear', deletedCount: result.deletedCount },
    });

    return { deletedCount: result.deletedCount };
  }

  private async logEdit(userId: string | undefined, collection: string, id: string, operation: string) {
    await logRepository.create({
      action: 'api_call',
      userId: userId as unknown as Types.ObjectId,
      message: `Raw DB ${operation}: ${collection}/${id}`,
      details: { collection, documentId: id, operation },
    });
  }
}

export const databaseService = new DatabaseService();
