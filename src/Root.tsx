import { useState } from 'react'

import SimpulApp from './simpul/SimpulApp'
import ExplorerApp from './App'

/**
 * SIMPUL adalah produk utamanya; Eksplorasi Data (aplikasi lama, 4 dataset
 * mentah) tetap tersedia sebagai bukti pemahaman data — berguna saat
 * presentasi proposal.
 */
export default function Root() {
  const [mode, setMode] = useState<'simpul' | 'explorer'>('simpul')

  if (mode === 'explorer')
    return (
      <>
        <ExplorerApp />
        <button
          type="button"
          className="mode-back"
          onClick={() => setMode('simpul')}
          title="Kembali ke SIMPUL"
        >
          ← Kembali ke SIMPUL
        </button>
      </>
    )

  return <SimpulApp onOpenExplorer={() => setMode('explorer')} />
}
