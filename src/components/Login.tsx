import { useState } from 'react'

import logoImg from '../assets/logo.jpeg'
import { ROLES, type Role, type RoleId } from '../lib/roles'

/**
 * Layar masuk berbasis peran (dummy — tanpa kata sandi). Tujuannya bukan
 * keamanan, melainkan menyesuaikan sudut pandang tampilan: perencana KAI,
 * analis TransJakarta, regulator Dishub, atau tamu.
 */
export default function Login({ onEnter }: { onEnter: (role: Role) => void }) {
  const [picked, setPicked] = useState<RoleId>('dishub')
  const role = ROLES.find((r) => r.id === picked)!
  const [name, setName] = useState(role.persona)

  const pick = (r: Role) => {
    setPicked(r.id)
    setName(r.persona)
  }

  return (
    <div className="login">
      <div className="login-card" role="dialog" aria-labelledby="login-title">
        <div className="login-brand">
          <img src={logoImg} alt="" className="brand-mark simpul-mark" />
          <div>
            <h1 id="login-title">SIMPUL</h1>
            <p>Sistem Inteligensi Mobilitas, Pemetaan, dan Usulan Layanan · Jabodetabek</p>
          </div>
        </div>

        <p className="login-lead">
          Pilih peran Anda. Data dan hitungannya sama untuk semua peran — yang berbeda hanya kandidat
          mana yang ditampilkan lebih dulu dan sudut pandang asistennya.
        </p>

        <div className="role-grid" role="radiogroup" aria-label="Pilih peran">
          {ROLES.map((r) => (
            <button
              key={r.id}
              type="button"
              role="radio"
              aria-checked={picked === r.id}
              className={`role-card${picked === r.id ? ' on' : ''}`}
              onClick={() => pick(r)}
            >
              <span className="role-icon" aria-hidden="true">
                {r.icon}
              </span>
              <span className="role-main">
                <b>{r.label}</b>
                <small>{r.org}</small>
                <span className="role-focus">{r.focus}</span>
              </span>
            </button>
          ))}
        </div>

        <form
          className="login-form"
          onSubmit={(e) => {
            e.preventDefault()
            onEnter(role)
          }}
        >
          <label>
            <span>Nama (contoh dari PRD, boleh diganti)</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama Anda" />
          </label>
          <button type="submit" className="btn primary login-submit">
            Masuk sebagai {role.label}
          </button>
        </form>

        <p className="login-note">
          Prototipe MAPID WebGIS Competition 2026 · tim COOK, BINUS University. Login ini hanya untuk
          memilih tampilan — tidak ada kata sandi dan tidak ada data yang disimpan di server.
        </p>
      </div>
    </div>
  )
}
