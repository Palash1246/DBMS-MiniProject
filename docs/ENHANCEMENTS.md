# Enhancements over the first-pass design

The updated model adds a self-referencing city/zone/locality hierarchy; stores a MongoDB id on each PostgreSQL lot; adds booking code, timestamps, and a composite own-vehicle foreign key; adds payment creation time and nullable method; and makes the booking audit log immutable and deletion-restricting.

It also adds advisory MongoDB pricing bands, PostgreSQL roles with RLS, and scheduler plus on-demand hold expiry. The ER and relational schema figures are the regenerated schema descriptions in `04-er-diagram.md` and `05-relational-schema.md`; the PNG deliverables must remain synchronized with those sources.
