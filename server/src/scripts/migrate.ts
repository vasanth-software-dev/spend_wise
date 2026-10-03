/**
 * SpendWise database migrations.
 *
 * MongoDB is schemaless, so a "migration" here means: create the collection if
 * missing, then create the indexes the application depends on. Migrations are
 * idempotent and tracked in the `migrations` collection, so re-running is safe.
 *
 * Usage:
 *   npm run migrate            # apply all pending migrations
 *   npm run migrate:status     # list applied / pending migrations
 *   npm run migrate:rollback   # revert the most recent migration
 */
import mongoose, { Schema, model, type Connection, type Model } from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { logger } from '../utils/logger.js';

const WEB_AUTHN_COLLECTION = 'webauthncredentials';

interface Migration {
  id: string;
  up(db: Connection): Promise<void>;
  down(db: Connection): Promise<void>;
}

/**
 * Creates the WebAuthn credential collection and its indexes.
 *
 * Indexes:
 *  - `credentialId` UNIQUE: the login ceremony looks a credential up by this
 *    value, and uniqueness is what prevents one authenticator from being
 *    attached to two accounts.
 *  - `userId`: listing and deleting a user's own devices.
 *  - `userId + createdAt DESC`: the "My Devices" list, newest first.
 */
const createWebAuthnCredentials: Migration = {
  id: '2026_10_02_webauthn_credentials',
  async up(db) {
    const collections = await db.db!.listCollections({ name: WEB_AUTHN_COLLECTION }).toArray();
    if (collections.length === 0) {
      await db.createCollection(WEB_AUTHN_COLLECTION);
      logger.info(`[migrate] created collection "${WEB_AUTHN_COLLECTION}"`);
    }

    const collection = db.collection(WEB_AUTHN_COLLECTION);

    // Mongoose may already have created these indexes under default names via
    // `autoIndex`, so each one is checked against the live index list and
    // skipped when an equivalent index already covers the same key pattern.
    // That keeps the migration idempotent without conflicting with the ORM.
    const existing = await collection.indexes();
    const hasIndex = (fields: Record<string, 1 | -1>) =>
      existing.some((idx) => {
        const key = idx.key as Record<string, number>;
        const keys = Object.keys(fields);
        return (
          keys.length === Object.keys(key).length && keys.every((f) => key[f] === fields[f])
        );
      });

    // `credentialId` — unique lookup key for the login ceremony.
    if (!hasIndex({ credentialId: 1 })) {
      await collection.createIndex({ credentialId: 1 }, { unique: true, name: 'credentialId_unique' });
    }
    // `userId` — scoped reads/deletes for Settings.
    if (!hasIndex({ userId: 1 })) {
      await collection.createIndex({ userId: 1 }, { name: 'userId_1' });
    }
    // `userId + createdAt` — device list ordering.
    if (!hasIndex({ userId: 1, createdAt: -1 })) {
      await collection.createIndex({ userId: 1, createdAt: -1 }, { name: 'userId_1_createdAt_-1' });
    }
  },
  async down(db) {
    // Destructive: passkey registrations are user security material, so the
    // rollback drops the collection rather than leaving orphaned credentials.
    await db.collection(WEB_AUTHN_COLLECTION).drop().catch((err) => {
      logger.warn(`[migrate] rollback skipped: ${err.message}`);
    });
  },
};

const MIGRATIONS: Migration[] = [createWebAuthnCredentials];

/** Registry of applied migrations, so `up` is only run once per environment. */
function getMigrationModel(): Model<{ _id: string; appliedAt: Date }> {
  const schema = new Schema({
    _id: { type: String, required: true },
    appliedAt: { type: Date, default: Date.now },
  });
  return model<{ _id: string; appliedAt: Date }>('Migration', schema);
}

async function applyPending(db: Connection): Promise<void> {
  const MigrationModel = getMigrationModel();
  const applied = new Set((await MigrationModel.find().lean()).map((m) => m._id));

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.id)) {
      logger.info(`[migrate] skip ${migration.id} (already applied)`);
      continue;
    }
    logger.info(`[migrate] applying ${migration.id}`);
    await migration.up(db);
    await MigrationModel.create({ _id: migration.id });
    logger.info(`[migrate] applied ${migration.id}`);
  }
}

async function rollbackLast(db: Connection): Promise<void> {
  const MigrationModel = getMigrationModel();
  const last = await MigrationModel.findOne().sort({ appliedAt: -1 }).lean();
  if (!last) {
    logger.info('[migrate] nothing to roll back');
    return;
  }
  const migration = MIGRATIONS.find((m) => m.id === last._id);
  if (!migration) {
    logger.warn(`[migrate] no handler for ${last._id}; removing record only`);
    await MigrationModel.deleteOne({ _id: last._id });
    return;
  }
  logger.info(`[migrate] rolling back ${migration.id}`);
  await migration.down(db);
  await MigrationModel.deleteOne({ _id: migration.id });
}

async function status(): Promise<void> {
  const MigrationModel = getMigrationModel();
  const applied = new Set((await MigrationModel.find().lean()).map((m) => m._id));
  for (const migration of MIGRATIONS) {
    console.log(`${applied.has(migration.id) ? '[x]' : '[ ]'} ${migration.id}`);
  }
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'up';
  await connectDatabase();
  try {
    if (command === 'up') await applyPending(mongoose.connection);
    else if (command === 'down') await rollbackLast(mongoose.connection);
    else if (command === 'status') await status();
    else {
      console.error(`Unknown migration command "${command}". Use up | down | status.`);
      process.exitCode = 1;
    }
  } finally {
    await disconnectDatabase();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
