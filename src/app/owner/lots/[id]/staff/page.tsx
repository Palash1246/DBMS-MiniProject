'use client';

import { useEffect, useState } from 'react';

type Staff = { user_id: number; name: string; email: string; phone: string };

export default function StaffPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState('');
  const [staff, setStaff] = useState<Staff[]>([]);
  const [error, setError] = useState('');

  async function load(lotId = id) {
    const result = await fetch(`/api/owner/lots/${lotId}/staff`).then(r => r.json());
    setStaff(result.staff || []);
  }

  useEffect(() => {
    let active = true;
    params.then(async p => {
      setId(p.id);
      const result = await fetch(`/api/owner/lots/${p.id}/staff`).then(r => r.json());
      if (active) setStaff(result.staff || []);
    });
    return () => { active = false; };
  }, [params]);

  async function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = Object.fromEntries(new FormData(form));
    const response = await fetch(`/api/owner/lots/${id}/staff`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) { setError(result.error); return; }
    form.reset(); setError(''); await load();
  }

  return <main className="mx-auto max-w-3xl px-5 py-10">
    <h1 className="text-3xl font-bold">Lot staff</h1>
    <form onSubmit={add} className="mt-5 grid gap-3 rounded-xl border p-4 sm:grid-cols-2">
      {([['name','Name','text'],['email','Email','email'],['phone','Phone','tel'],['password','Temporary password','password']] as const).map(([name,label,type]) => <label key={name} className="text-sm">{label}<input name={name} type={type} required className="field" /></label>)}
      <button className="button sm:col-span-2">Add staff account</button>
    </form>
    {error && <p className="mt-3 text-red-700">{error}</p>}
    <div className="mt-5 divide-y rounded-xl border">
      {staff.map(person => <div key={person.user_id} className="flex justify-between p-4"><span>{person.name} · {person.email}</span>
        <button className="text-sm text-red-700" onClick={async () => { await fetch(`/api/owner/lots/${id}/staff/${person.user_id}`, { method: 'DELETE' }); await load(); }}>Remove</button>
      </div>)}
    </div>
  </main>;
}
