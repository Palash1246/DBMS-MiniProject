import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MongoClient, ObjectId, type Collection, type Document } from 'mongodb';
import dotenv from 'dotenv';
import { amenityCoveragePipeline, lotProfileValidator, nearbyPipeline } from '../db/mongo/pipelines';

dotenv.config({ path: '.env.local' });
dotenv.config();

describe('MongoDB lot profiles', () => {
  let client: MongoClient;
  let profiles: Collection<Document>;
  const id = new ObjectId();
  const pgLotId = 2_000_000_000;
  const fixture = {
    _id: id,
    pg_lot_id: pgLotId,
    name: 'Mongo Integration Fixture',
    description: 'Temporary automated test fixture',
    location: { type: 'Point', coordinates: [77.6068, 12.9756] },
    address: { line1: 'Test Road', locality: 'MongoTestLocality', pincode: '560001' },
    amenities: ['covered', 'ev_charging'],
    vehicle_types_allowed: ['car', 'ev'],
    operating_hours: { open_24x7: true, open: '00:00', close: '23:59' },
    photos: [],
    pricing_rules: [],
    updated_at: new Date(),
  };

  beforeAll(async () => {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI is required for MongoDB integration tests');
    client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
    await client.connect();
    profiles = client.db(process.env.MONGODB_DB || 'parksmart').collection('lot_profiles');
  });

  afterAll(async () => {
    if (profiles) await profiles.deleteOne({ _id: id });
    if (client) await client.close();
  });

  it('has the required spatial, lookup, amenity, text, and locality indexes', async () => {
    const indexes = await profiles.indexes();
    expect(indexes.find((index) => index.key.location === '2dsphere')).toBeDefined();
    expect(indexes.find((index) => index.key.pg_lot_id === 1)?.unique).toBe(true);
    expect(indexes.find((index) => index.key.amenities === 1)).toBeDefined();
    expect(indexes.find((index) => index.key._fts === 'text')).toBeDefined();
    expect(indexes.find((index) => index.key['address.locality'] === 1)).toBeDefined();
  });

  it('accepts a valid Bengaluru GeoJSON profile and rejects an unknown amenity', async () => {
    await profiles.insertOne(fixture);
    await expect(profiles.insertOne({ ...fixture, _id: new ObjectId(), pg_lot_id: pgLotId + 1, amenities: ['hovercraft'] })).rejects.toMatchObject({ code: 121 });
  });

  it('runs the nearby and amenity coverage aggregation pipelines', async () => {
    const nearby = await profiles.aggregate(nearbyPipeline(77.6068, 12.9756, 500)).toArray();
    expect(nearby).toHaveLength(1);
    expect(nearby[0].results.some((profile: Document) => profile._id.equals(id))).toBe(true);
    expect(nearby[0].total[0].n).toBeGreaterThan(0);

    const coverage = await profiles.aggregate(amenityCoveragePipeline).toArray();
    const fixtureCoverage = coverage.find((row) => row._id === 'MongoTestLocality');
    expect(fixtureCoverage).toMatchObject({ lots: 1, ev_lots: 1, covered_lots: 1 });
  });

  it('keeps the source validator definition aligned with the collection behavior', () => {
    expect(lotProfileValidator.$jsonSchema.required).toContain('location');
    expect(lotProfileValidator.$jsonSchema.properties.amenities.items.enum).toContain('ev_charging');
  });
});
