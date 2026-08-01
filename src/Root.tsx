import { useState } from 'react'

import LajuApp from './laju/LajuApp'
import ExplorerApp from './App'

/**
 * LAJU adalah produk utamanya; Eksplorasi Data (aplikasi lama, 4 dataset
 * mentah) tetap tersedia sebagai bukti pemahaman data — berguna saat
 * presentasi proposal.
 */
export default function Root() {
  const [mode, setMode] = useState<'laju' | 'explorer'>('laju')

  if (mode === 'explorer')
    return (
      <>
        <ExplorerApp />
        <button
          type="button"
          className="mode-back"
          onClick={() => setMode('laju')}
          title="Kembali ke LAJU"
        >
          ← Kembali ke LAJU
        </button>
      </>
    )

  return <LajuApp onOpenExplorer={() => setMode('explorer')} />
}
