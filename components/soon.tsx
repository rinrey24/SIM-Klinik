import { Clock } from 'lucide-react';

export function Soon({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="fade-in flex flex-col gap-4">
      <div>
        <h1 className="h1">{title}</h1>
        <div className="muted text-[13.5px] mt-1">{desc}</div>
      </div>
      <div className="card card-pad flex items-center gap-4">
        <div
          className="w-14 h-14 rounded-2xl grid place-items-center flex-none"
          style={{ background: 'var(--teal-tint)', color: 'var(--teal-600)' }}
        >
          <Clock size={26} />
        </div>
        <div>
          <div className="h3">Segera hadir</div>
          <div className="muted text-[13px]">
            Modul ini sedang dibangun. Skema database, RBAC, dan layout sudah disiapkan — implementasi UI menyusul di fase berikutnya.
          </div>
        </div>
      </div>
    </div>
  );
}
