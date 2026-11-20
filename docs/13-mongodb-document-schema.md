# MongoDB document schema

MongoDB stores lot-specific flexible profile data in the `lot_profiles` collection. This is a **document schema**, not a relational schema: nested values and arrays are embedded in one BSON document.

## `lot_profiles` document

```javascript
{
  _id: ObjectId,                         // same value as PostgreSQL parking_lots.mongo_lot_id
  pg_lot_id: Number,                     // unique index; links back to parking_lots.lot_id
  name: String,
  description: String,
  location: {
    type: "Point",
    coordinates: [longitude, latitude]   // GeoJSON order
  },
  address: {
    line1: String,
    locality: String,
    pincode: String
  },
  amenities: [String],                   // set-like array of validated tags
  vehicle_types_allowed: [String],
  height_limit_m: Number,                // optional
  operating_hours: {
    open_24x7: Boolean,
    open: String,                        // HH:mm when not 24x7
    close: String
  },
  photos: [{ url: String, caption: String }],
  pricing_rules: [{
    day_type: String,
    from_hour: Number,
    to_hour: Number,
    rate_multiplier: Number
  }],
  updated_at: Date
}
```

The collection validator is defined in [`db/mongo/pipelines.ts`](../db/mongo/pipelines.ts), and setup applies it and the indexes from [`db/mongo/setup.ts`](../db/mongo/setup.ts). The `location` field has a `2dsphere` index; `pg_lot_id` has a unique index; amenity, text-search, and locality indexes support the app's search operations.

## PostgreSQL link

```text
PostgreSQL PARKING_LOTS.mongo_lot_id  = MongoDB lot_profiles._id
MongoDB lot_profiles.pg_lot_id        -> PostgreSQL PARKING_LOTS.lot_id
```

This is a logical one-to-one association maintained by application code. The unique MongoDB index prevents duplicate `pg_lot_id` values, but neither database can enforce cross-database referential integrity. The application uses compensating writes for lot creation/deletion, and the admin reconciliation action reports mismatched IDs.
