'use client';

import { useEffect, useState } from 'react';

type Slot = { slot_id: number; slot_label: string; slot_type: string; status: string };

export default function SlotsPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState('');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [count, setCount] = useState('10');

  async function load(lotId = id) {
    const result = await fetch(`/api/owner/lots/${lotId}/slots`).then(r => r.json());
    setSlots(result.slots || []);
  }

  useEffect(() => {
    let active = true;
    params.then(async p => {
      setId(p.id);
      const result = await fetch(`/api/owner/lots/${p.id}/slots`).then(r => r.json());
      if (active) setSlots(result.slots || []);
    });
    return () => { active = false; };
  }, [params]);

  async function generate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await fetch(`/api/owner/lots/${id}/slots/bulk`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ count: Number(count), prefix: 'S' }) });
    await load();
  }

  return <main className="mx-auto max-w-4xl px-5 py-10">
    <h1 className="text-3xl font-bold">Manage spaces</h1>
    <form className="mt-5 flex gap-3" onSubmit={generate}>
      <input className="field max-w-32" type="number" min="1" max="200" value={count} onChange={event => setCount(event.target.value)} />
      <button className="button">Generate slots</button>
    </form>
    <div className="mt-5 divide-y rounded-xl border">
      {slots.map(slot => <div key={slot.slot_id} className="flex items-center justify-between p-3">
        <span><b>{slot.slot_label}</b> · {slot.slot_type}</span>
        <select className="rounded border p-2" value={slot.status} onChange={async event => {
          await fetch(`/api/owner/lots/${id}/slots/${slot.slot_id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: event.target.value }) });
          await load();
        }}><option value="active">Active</option><option value="maintenance">Maintenance</option></select>
      </div>)}
    </div>
  </main>;
}
