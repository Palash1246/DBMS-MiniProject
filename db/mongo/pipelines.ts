import type { Document } from 'mongodb';

export function nearbyPipeline(lng: number, lat: number, radiusMeters: number, filters: Document = {}): Document[] {
  return [
    { $geoNear: { near: { type: 'Point', coordinates: [lng, lat] }, distanceField: 'distance_m', maxDistance: radiusMeters, spherical: true, query: filters } },
    { $limit: 50 },
    { $facet: {
      results: [{ $project: { _id: 1, pg_lot_id: 1, name: 1, address: 1, amenities: 1, photos: { $slice: ['$photos', 1] }, distance_m: { $round: ['$distance_m', 0] } } }],
      amenity_counts: [{ $unwind: '$amenities' }, { $group: { _id: '$amenities', count: { $sum: 1 } } }, { $sort: { count: -1 } }],
      total: [{ $count: 'n' }],
    } },
  ];
}

export const amenityCoveragePipeline: Document[] = [
  { $group: { _id: '$address.locality', lots: { $sum: 1 }, ev_lots: { $sum: { $cond: [{ $in: ['ev_charging', '$amenities'] }, 1, 0] } }, covered_lots: { $sum: { $cond: [{ $in: ['covered', '$amenities'] }, 1, 0] } }, avg_height_limit_m: { $avg: '$height_limit_m' } } },
  { $sort: { lots: -1 } },
];

export const lotProfileValidator = {
  $jsonSchema: {
    bsonType: 'object', required: ['pg_lot_id', 'name', 'location', 'address', 'amenities', 'vehicle_types_allowed', 'updated_at'],
    properties: {
      pg_lot_id: { bsonType: ['int', 'long', 'double'], minimum: 1 },
      name: { bsonType: 'string', minLength: 2, maxLength: 120 }, description: { bsonType: 'string', maxLength: 2000 },
      location: { bsonType: 'object', required: ['type', 'coordinates'], properties: { type: { enum: ['Point'] }, coordinates: { bsonType: 'array', minItems: 2, maxItems: 2, items: [{ bsonType: 'number', minimum: 77.3, maximum: 77.9 }, { bsonType: 'number', minimum: 12.7, maximum: 13.3 }] } } },
      address: { bsonType: 'object', required: ['locality'], properties: { line1: { bsonType: 'string' }, locality: { bsonType: 'string' }, pincode: { bsonType: 'string', pattern: '^560[0-9]{3}$' } } },
      amenities: { bsonType: 'array', uniqueItems: true, items: { enum: ['covered', 'ev_charging', 'cctv', 'valet', 'washroom', 'security_guard', 'lift_access'] } },
      vehicle_types_allowed: { bsonType: 'array', minItems: 1, items: { enum: ['car', 'bike', 'ev'] } }, height_limit_m: { bsonType: 'number', minimum: 1.5, maximum: 5 },
      operating_hours: { bsonType: 'object', required: ['open_24x7'], properties: { open_24x7: { bsonType: 'bool' }, open: { bsonType: 'string', pattern: '^([01][0-9]|2[0-3]):[0-5][0-9]$' }, close: { bsonType: 'string', pattern: '^([01][0-9]|2[0-3]):[0-5][0-9]$' } } },
      photos: { bsonType: 'array', items: { bsonType: 'object', required: ['url', 'caption'], properties: { url: { bsonType: 'string', minLength: 1 }, caption: { bsonType: 'string', maxLength: 200 } } } },
      pricing_rules: { bsonType: 'array', items: { bsonType: 'object', required: ['day_type', 'from_hour', 'to_hour', 'rate_multiplier'], properties: { day_type: { enum: ['weekday', 'weekend'] }, from_hour: { bsonType: ['int', 'long', 'double'], minimum: 0, maximum: 23 }, to_hour: { bsonType: ['int', 'long', 'double'], minimum: 0, maximum: 23 }, rate_multiplier: { bsonType: ['int', 'long', 'double'], minimum: 0.5, maximum: 3 } } } },
      updated_at: { bsonType: 'date' },
    },
  },
};
