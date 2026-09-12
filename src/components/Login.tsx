import { ArrowRight } from 'lucide-react'

import logoImg from '../assets/logo.jpeg'
import { ROLES, type Role } from '../lib/roles'
import RoleIcon from './RoleIcon'

/** Layar masuk: pilih peran, langsung masuk. Tanpa nama, tanpa kata sandi. */
export default function Login({ onEnter }: { onEnter: (role: Role) => void }) {
  return (
    <div className="login">
      <div className="lg-card" role="dialog" aria-labelledby="login-title">
        <div className="lg-brand">
          <img src={logoImg} alt="" className="brand-mark simpul-mark" />
          <div>
            <h1 id="login-title">SIMPUL</h1>
            <p>Peta kawasan ramai dan layanan transit Jabodetabek</p>
          </div>
        </div>
        <p className="lg-ask">Masuk sebagai siapa?</p>
        <div className="lg-grid">
          {ROLES.map((r) => (
            <button key={r.id} type="button" className="lg-role" onClick={() => onEnter(r)}>
              <span className={`lg-icon lg-icon-${r.id}`} aria-hidden="true">
                <RoleIcon id={r.id} size={22} />
              </span>
              <span className="lg-main">
                <b>{r.label}</b>
                <small>{r.org}</small>
                <span className="lg-focus">{r.focus}</span>
              </span>
              <span className="lg-go" aria-hidden="true">
                Masuk <ArrowRight size={14} />
              </span>
            </button>
          ))}
        </div>
        <p className="lg-note">Peran hanya mengatur kandidat mana yang tampil lebih dulu. Datanya sama untuk semua.</p>
      </div>
    </div>
  )
}
