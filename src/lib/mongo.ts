import { MongoClient, Db } from 'mongodb';
import { env } from './env';

declare global { var __parksmartMongo: Promise<MongoClient> | undefined }

let clientPromise: Promise<MongoClient> | undefined;
function getClient() {
  clientPromise ??= globalThis.__parksmartMongo ?? new MongoClient(env.MONGODB_URI, { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000 }).connect();
  if (process.env.NODE_ENV !== 'production') globalThis.__parksmartMongo = clientPromise;
  return clientPromise;
}

export async function getMongoDb(): Promise<Db> {
  return (await getClient()).db(env.MONGODB_DB);
}
