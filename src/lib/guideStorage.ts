/** Penanda "panduan sudah pernah dilihat" — per browser, aman bila localStorage diblokir. */
const STORAGE_KEY = 'simpul-guide-seen-v1'

export function guideSeen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function markGuideSeen() {
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    /* penyimpanan diblokir — panduan akan muncul lagi lain kali, tidak apa-apa */
  }
}
