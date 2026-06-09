'use client';
import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Heart, Shield, CreditCard, MessageCircle, User, UserPlus, Stethoscope, Activity, Building, Lock, ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { Modal, Toast } from '@/components/ui/primitives';
import { formatRp } from '@/lib/utils';

type Role = 'admin' | 'pendaftaran' | 'dokter' | 'perawat' | 'apoteker' | 'kasir';
type Branch = { id: string; name: string; address: string | null; phone: string | null; accentColor: string };
type UserRow = { id: string; name: string; email: string; role: Role; sip: string | null; active: boolean };
type Tariff = { id: string; label: string; price: string; type: 'jasa' | 'tindakan' };

const COLORS = ['#0d9488', '#0891b2', '#10b981', '#7c3aed', '#e11d48'];

const ROLE_LABEL: Record<Role, string> = {
  admin: 'Admin / Manajemen', pendaftaran: 'Petugas Pendaftaran', dokter: 'Dokter Umum',
  perawat: 'Perawat', apoteker: 'Apoteker', kasir: 'Kasir',
};

export function PengaturanClient() {
  const qc = useQueryClient();
  const [openUser, setOpenUser] = React.useState(false);
  const [openProfile, setOpenProfile] = React.useState(false);
  const [toast, setToast] = React.useState<{ kind: 'info' | 'success'; msg: string } | null>(null);
  const pushToast = (k: 'info' | 'success', m: string) => { setToast({ kind: k, msg: m }); setTimeout(() => setToast(null), 3200); };

  const branch = useQuery({
    queryKey: ['settings-clinic'],
    queryFn: async () => (await (await fetch('/api/settings/clinic')).json()) as { data: Branch },
  });
  const usersQ = useQuery({
    queryKey: ['users'],
    queryFn: async () => (await (await fetch('/api/users')).json()) as { data: UserRow[] },
  });
  const tariffsQ = useQuery({
    queryKey: ['tariffs', 'all'],
    queryFn: async () => (await (await fetch('/api/tariffs')).json()) as { data: Tariff[] },
  });
  const integ = useQuery({
    queryKey: ['integration-status'],
    queryFn: async () => (await (await fetch('/api/integrations/status')).json()) as {
      data: { satusehat: boolean; bpjs: boolean; whatsapp: boolean };
    },
  });

  const patchClinic = useMutation({
    mutationFn: async (v: Partial<Branch>) => {
      const r = await fetch('/api/settings/clinic', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(v) });
      if (!r.ok) throw new Error((await r.json())?.error?.message ?? 'Gagal menyimpan');
      return r.json();
    },
    onSuccess: () => { pushToast('success', 'Profil klinik tersimpan'); qc.invalidateQueries({ queryKey: ['settings-clinic'] }); },
    onError: (e: Error) => pushToast('info', e.message),
  });

  const b = branch.data?.data;
  const users = usersQ.data?.data ?? [];
  const tariffs = tariffsQ.data?.data ?? [];
  const ist = integ.data?.data;
  const integBadge = (on?: boolean) =>
    on ? <span className="badge b-green">Aktif</span> : <span className="badge b-amber">Belum diatur</span>;
  const tindakanCount = tariffs.filter((t) => t.type === 'tindakan').length;
  const konsultasi = tariffs.find((t) => t.type === 'jasa' && t.label.toLowerCase().includes('konsultasi'));

  return (
    <div className="fade-in flex flex-col gap-3.5">
      <h1 className="h1">Pengaturan</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 items-start">
        <div className="flex flex-col gap-3.5">
          <SettingCard title="Profil Klinik">
            <div className="card-pad flex items-center gap-3">
              <div
                className="w-[52px] h-[52px] rounded-2xl grid place-items-center flex-none text-white"
                style={{ background: b?.accentColor ?? 'var(--teal-600)' }}
              >
                <Heart size={26} />
              </div>
              <div className="flex-1 min-w-0">
                <strong>{b?.name ?? '—'}</strong>
                <div className="muted text-[12.5px] truncate">{b?.address ?? '—'}</div>
              </div>
              <button className="btn btn-sm btn-ghost" onClick={() => setOpenProfile(true)}>Ubah</button>
            </div>
            <div className="card-pad" style={{ borderTop: '1px solid var(--line-2)' }}>
              <div className="label mb-2">Warna brand</div>
              <div className="flex items-center gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => patchClinic.mutate({ accentColor: c })}
                    className="w-[30px] h-[30px] rounded-lg cursor-pointer"
                    style={{
                      background: c,
                      border: c === b?.accentColor ? '2px solid var(--ink)' : '2px solid transparent',
                    }}
                    title={c}
                  />
                ))}
              </div>
            </div>
          </SettingCard>

          <SettingCard title="Integrasi">
            <Row Icon={Shield} title="SATUSEHAT" sub="OAuth Client Credentials · submit FHIR R4 (Encounter/Condition/Observation/MedicationRequest)" right={integBadge(ist?.satusehat)} />
            <Row Icon={CreditCard} title="BPJS Kesehatan" sub="PCare bridging · cek kepesertaan" right={integBadge(ist?.bpjs)} />
            <Row Icon={MessageCircle} title="WhatsApp Notifikasi" sub="Pengingat janji & nota digital" right={integBadge(ist?.whatsapp)} />
            <div className="card-pad muted text-[12px]" style={{ borderTop: '1px solid var(--line-2)' }}>
              Kredensial diatur lewat environment variables (<code>.env</code>). Submisi berjalan asinkron via outbox + worker;
              kegagalan integrasi tidak memblokir pelayanan. Untuk produksi, simpan kredensial terenkripsi di tabel <code>integration_credentials</code>.
            </div>
          </SettingCard>
        </div>

        <div className="flex flex-col gap-3.5">
          <SettingCard title="Pengguna & Peran">
            {users.map((u) => (
              <Row
                key={u.id}
                Icon={User}
                title={u.name}
                sub={ROLE_LABEL[u.role]}
                right={
                  <span className="badge b-gray" style={{ textTransform: 'capitalize' }}>
                    {u.role}
                  </span>
                }
              />
            ))}
            <div className="p-3">
              <button className="btn btn-soft btn-block btn-sm" onClick={() => setOpenUser(true)}>
                <UserPlus size={15} /> Tambah pengguna
              </button>
            </div>
          </SettingCard>

          <SettingCard title="Dokter & Tarif">
            <Row
              Icon={Stethoscope}
              title="Konsultasi Dokter Umum"
              sub={`${users.filter((u) => u.role === 'dokter').length} dokter aktif`}
              right={<span className="mono font-bold">{formatRp(konsultasi?.price ?? 0)}</span>}
            />
            <Row
              Icon={Activity}
              title="Daftar tindakan & tarif"
              sub={`${tindakanCount} tindakan`}
              right={<ChevronRight size={18} className="muted" />}
            />
          </SettingCard>

          <SettingCard title="Pengembangan">
            <Row
              Icon={Building}
              title="Manajemen Cabang"
              sub="Kelola banyak lokasi klinik"
              locked
              right={<span className="badge b-gray"><Lock size={12} /> Segera</span>}
            />
          </SettingCard>
        </div>
      </div>

      {openProfile && b && (
        <ProfileEdit
          initial={b}
          onClose={() => setOpenProfile(false)}
          onSave={(v) => { patchClinic.mutate(v); setOpenProfile(false); }}
          busy={patchClinic.isPending}
        />
      )}

      {openUser && (
        <UserCreate
          onClose={() => setOpenUser(false)}
          onCreated={() => {
            pushToast('success', 'Pengguna baru ditambahkan');
            qc.invalidateQueries({ queryKey: ['users'] });
            setOpenUser(false);
          }}
          onError={(m) => pushToast('info', m)}
        />
      )}

      {toast && (
        <div className="fixed bottom-24 md:bottom-6 left-0 right-0 flex justify-center z-50 pointer-events-none px-4">
          <Toast kind={toast.kind}>{toast.msg}</Toast>
        </div>
      )}
    </div>
  );
}

function SettingCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card overflow-hidden" style={{ padding: 0 }}>
      <div className="eyebrow px-4 pt-3.5 pb-1.5">{title}</div>
      {children}
    </div>
  );
}

function Row({
  Icon, title, sub, right, locked,
}: {
  Icon: LucideIcon;
  title: string; sub?: string; right?: React.ReactNode; locked?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3.5 border-b last:border-b-0"
      style={{ borderColor: 'var(--line-2)', opacity: locked ? 0.6 : 1 }}
    >
      <div
        className="w-[38px] h-[38px] rounded-[10px] grid place-items-center flex-none"
        style={{ background: 'var(--surface-2)', color: 'var(--ink-2)' }}
      >
        <Icon size={19} />
      </div>
      <div className="flex-1 min-w-0">
        <strong className="text-[14px]">{title}</strong>
        {sub && <div className="muted text-[12.5px]">{sub}</div>}
      </div>
      {right}
    </div>
  );
}

function ProfileEdit({
  initial, onClose, onSave, busy,
}: { initial: Branch; onClose: () => void; onSave: (v: Partial<Branch>) => void; busy: boolean }) {
  const [f, setF] = React.useState({
    name: initial.name, address: initial.address ?? '', phone: initial.phone ?? '',
  });
  return (
    <Modal
      title="Ubah Profil Klinik"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Batal</button>
          <button className="btn btn-primary" disabled={busy} onClick={() => onSave(f)}>Simpan</button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="field"><label className="label">Nama klinik</label><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div className="field"><label className="label">Alamat</label><input className="input" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></div>
        <div className="field"><label className="label">Telepon</label><input className="input mono" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
      </div>
    </Modal>
  );
}

function UserCreate({
  onClose, onCreated, onError,
}: { onClose: () => void; onCreated: () => void; onError: (m: string) => void }) {
  const [f, setF] = React.useState({ name: '', email: '', password: '', role: 'pendaftaran' as Role, sip: '' });
  const [busy, setBusy] = React.useState(false);
  const valid = f.name.trim().length > 2 && /.+@.+\..+/.test(f.email) && f.password.length >= 6;
  const submit = async () => {
    setBusy(true);
    try {
      const r = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) });
      if (!r.ok) throw new Error((await r.json())?.error?.message ?? 'Gagal');
      onCreated();
    } catch (e) { onError((e as Error).message); setBusy(false); }
  };
  return (
    <Modal
      title="Tambah Pengguna"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Batal</button>
          <button className="btn btn-primary" disabled={!valid || busy} onClick={submit}>
            <UserPlus size={16} /> Simpan
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="field"><label className="label">Nama lengkap</label><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div className="field"><label className="label">Email</label><input className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        <div className="field"><label className="label">Kata sandi (minimal 6 karakter)</label><input className="input" type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
        <div className="field">
          <label className="label">Peran</label>
          <select className="select" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
            {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
        </div>
        {f.role === 'dokter' && (
          <div className="field"><label className="label">No. SIP</label><input className="input mono" value={f.sip} onChange={(e) => setF({ ...f, sip: e.target.value })} placeholder="SIP.446/..." /></div>
        )}
      </div>
    </Modal>
  );
}
