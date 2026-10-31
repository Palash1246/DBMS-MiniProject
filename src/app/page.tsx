import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-slate-50 to-slate-200">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-slate-100">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 text-white rounded-full mb-6 shadow-md text-2xl font-bold">
          P
        </div>
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-3">
          ParkSmart
        </h1>
        <p className="text-lg text-slate-600 mb-8">
          Bengaluru Smart Urban Parking System (DBMS Level 3 Experiential Learning)
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <Link
            href="/search"
            className="p-5 rounded-xl border-2 border-blue-600 bg-blue-50 hover:bg-blue-100 text-blue-900 transition font-semibold text-left shadow-sm"
          >
            <div className="text-blue-600 font-bold mb-1">🔍 Search Parking Lots</div>
            <div className="text-xs text-slate-600">Find real-time slots by locality, amenities, and EV readiness.</div>
          </Link>
          <Link
            href="/login"
            className="p-5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 transition font-semibold text-left shadow-sm"
          >
            <div className="text-slate-900 font-bold mb-1">🔐 Sign In / Portal</div>
            <div className="text-xs text-slate-500">Access customer, lot owner, staff, or admin dashboards.</div>
          </Link>
        </div>

        <div className="text-xs text-slate-400 border-t pt-4">
          PostgreSQL 16 (Relational & Spatial Exclusion Constraints) + MongoDB 7 (GeoJSON Geospatial Profiles)
        </div>
      </div>
    </main>
  );
}

