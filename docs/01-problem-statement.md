# Problem statement

Bengaluru drivers often arrive at a parking facility without knowing whether a suitable space is available. Lot amenities and location details are fragmented, and concurrent reservations can overbook a single space if applications rely only on a check followed by an insert.

ParkSmart provides a browser application to discover nearby parking, inspect amenities and availability, reserve a specific space, and simulate payment. Lot owners manage capacity and staffing; gate staff validate reservations; administrators monitor the system.

The database problem is temporal contention: two active reservations for the same slot may not overlap. PostgreSQL enforces that invariant using a GiST exclusion constraint over half-open timestamp ranges. MongoDB stores flexible lot profiles and provides distance-based discovery.
