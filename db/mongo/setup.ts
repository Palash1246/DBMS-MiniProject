import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import { lotProfileValidator } from './pipelines';

dotenv.config({ path: '.env.local' }); dotenv.config();

async function setup() {
  const uri = process.env.MONGODB_ADMIN_URI;
  if (!uri) throw new Error('MONGODB_ADMIN_URI is required');
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000 });
  await client.connect();
  try {
    const db = client.db(process.env.MONGODB_DB || 'parksmart');
    const users = await db.command({ usersInfo: 'ps_mongo_app' });
    const appUser = { role: 'readWrite', db: db.databaseName };
    if (!users.users?.length) await db.command({ createUser: 'ps_mongo_app', pwd: process.env.MONGO_APP_PASSWORD, roles: [appUser] });
    else await db.command({ updateUser: 'ps_mongo_app', pwd: process.env.MONGO_APP_PASSWORD, roles: [appUser] });
    const collections = await db.listCollections({ name: 'lot_profiles' }).toArray();
    if (!collections.length) await db.createCollection('lot_profiles', { validationLevel: 'strict', validationAction: 'error', validator: lotProfileValidator });
    else await db.command({ collMod: 'lot_profiles', validationLevel: 'strict', validationAction: 'error', validator: lotProfileValidator });
    const profiles = db.collection('lot_profiles');
    await profiles.createIndex({ location: '2dsphere' });
    await profiles.createIndex({ pg_lot_id: 1 }, { unique: true });
    await profiles.createIndex({ amenities: 1 });
    await profiles.createIndex({ name: 'text', description: 'text' }, { weights: { name: 5, description: 1 } });
    await profiles.createIndex({ 'address.locality': 1 });
    console.log('MongoDB lot_profiles validator and indexes are ready.');
    console.log((await profiles.indexes()).map(({ name, key }) => ({ name, key })));
  } finally { await client.close(); }
}

setup().catch((error) => { console.error('MongoDB setup failed:', error); process.exitCode = 1; });
