(() => {
  'use strict';

  const DB_DIR = 'database/';
  const DEFAULT_PER_PAGE = 10;
  const MAX_PER_PAGE = 500;
  const BATCH_SIZE = 25;

  const $ = (id) => document.getElementById(id);
  const folderInput = $('folderInput');
  const manualSection = $('manualSection');
  const statusEl = $('status');
  const reloadBtn = $('reloadBtn');
  const searchForm = $('searchForm');
  const searchInput = $('searchInput');
  const sortSelect = $('sortSelect');
  const fatwaOnly = $('fatwaOnly');
  const chips = $('chips');
  const resultsEl = $('results');
  const resultInfo = $('resultInfo');
  const pager = $('pager');
  const perPageBox = $('perPageBox');
  const perPageSelect = $('perPage');
  const perPageCustom = $('perPageCustom');
  const statBadge = $('statBadge');
  const statVideos = $('statVideos');
  const shareSearchBtn = $('shareSearchBtn');
  const modal = $('modal');
  const modalFrame = $('modalFrame');
  const modalTitle = $('modalTitle');
  const modalOpen = $('modalOpen');
  const modalClose = $('modalClose');

  /**
   * entry: { seconds, time, text, norm, map }
   * norm = teks ternormalisasi (tanpa harakat/apostrof, huruf kecil)
   * map  = pemetaan index norm -> index teks asli (untuk highlight)
   */
  let videos = [];
  let currentHits = [];
  let currentTerms = [];
  let currentPage = 1;
  let perPage = DEFAULT_PER_PAGE;
  let txtCount = 0; // jumlah file .txt di folder database = jumlah video tertranskrip
  let lastQuery = '';

  // ---------- Utilitas ----------
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function buildLink(link, seconds) {
    try {
      const url = new URL(link);
      url.searchParams.set('t', seconds + 's');
      return url.toString();
    } catch (e) {
      return link + (link.includes('?') ? '&' : '?') + 't=' + seconds + 's';
    }
  }

  function extractVideoId(link) {
    try {
      const url = new URL(link);
      const host = url.hostname.replace(/^www\./, '');
      if (host === 'youtu.be') return url.pathname.slice(1).split('/')[0];
      const v = url.searchParams.get('v');
      if (v) return v;
      const m = url.pathname.match(/\/(?:embed|shorts|live)\/([\w-]{6,})/);
      if (m) return m[1];
    } catch (e) { /* abaikan */ }
    const m = String(link).match(/(?:v=|youtu\.be\/)([\w-]{6,})/);
    return m ? m[1] : '';
  }

  function setStatus(msg, type) {
    const colors = { info: 'text-neutral-400 animate-pulse', ok: 'text-emerald-400', error: 'text-red-400' };
    statusEl.className = 'text-sm text-center min-h-[1.5rem] ' + (colors[type] || colors.info);
    statusEl.textContent = msg;
  }

  function enableSearch(on) {
    searchForm.querySelectorAll('input, select, button').forEach((el) => { el.disabled = !on; });
    searchForm.classList.toggle('opacity-50', !on);
    searchForm.classList.toggle('pointer-events-none', !on);
    if (on) searchInput.focus();
  }

  function resetView() {
    videos = [];
    currentHits = [];
    currentPage = 1;
    txtCount = 0;
    resultsEl.innerHTML = '';
    resultInfo.textContent = '';
    pager.innerHTML = '';
    showPerPageBox(false);
    statBadge.classList.add('hidden');
    statBadge.classList.remove('flex');
    enableSearch(false);
  }

  // ---------- Normalisasi teks (untuk pencarian) ----------
  const IGNORED = /[\u0300-\u036f\u064B-\u065F\u0670\u0640'’‘ʿʾʼ`´ʻ]/;

  function normalize(text) {
    let norm = '';
    const map = [];
    for (let i = 0; i < text.length; i++) {
      const decomposed = text[i].normalize('NFD');
      for (const ch of decomposed) {
        if (IGNORED.test(ch)) continue;
        let c = ch.toLowerCase();
        if ('أإآٱ'.includes(c)) c = 'ا';
        else if (c === 'ى') c = 'ي';
        else if (c === 'ة') c = 'ه';
        for (const cc of c) { norm += cc; map.push(i); }
      }
    }
    return { norm, map };
  }

  function normQuery(s) {
    return normalize(s).norm.replace(/\s+/g, ' ').trim();
  }

  // "frasa persis" dalam tanda kutip + kata biasa
  function parseQuery(raw) {
    const terms = [];
    const seen = new Set();
    const re = /"([^"]+)"|“([^”]+)”|(\S+)/g;
    let m;
    while ((m = re.exec(raw)) !== null) {
      const phrase = m[1] !== undefined || m[2] !== undefined;
      const t = normQuery(m[1] || m[2] || m[3] || '');
      if (!t || seen.has(t)) continue;
      seen.add(t);
      terms.push({ t, phrase });
    }
    return terms;
  }

  // ---------- Deteksi jenis hukum / fatwa ----------
  const LABEL_STYLE = {
    'Wajib': 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    'Sunnah': 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    'Haram': 'bg-red-500/15 text-red-300 border-red-500/30',
    'Tidak boleh': 'bg-red-500/15 text-red-300 border-red-500/30',
    'Makruh': 'bg-orange-500/15 text-orange-300 border-orange-500/30',
    'Mubah': 'bg-violet-500/15 text-violet-300 border-violet-500/30',
    'Boleh': 'bg-violet-500/15 text-violet-300 border-violet-500/30',
    "Bid'ah": 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    'Fatwa': 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    'Khilaf': 'bg-teal-500/15 text-teal-300 border-teal-500/30'
  };

  function detectLabels(norm) {
    const labels = [];
    let s = norm;
    if (/(tidak|tak|nggak|gak|ga) boleh/.test(s)) {
      labels.push('Tidak boleh');
      s = s.replace(/(tidak|tak|nggak|gak|ga) boleh/g, ' ');
    }
    if (/wajib|fardhu|fardu|fardlu/.test(s)) labels.push('Wajib');
    if (/sunn?ah|mustahab|dianjurkan/.test(s)) labels.push('Sunnah');
    if (/haram|dilarang|terlarang/.test(s)) labels.push('Haram');
    if (/makruh/.test(s)) labels.push('Makruh');
    if (/mubah|halal/.test(s)) labels.push('Mubah');
    if (/boleh/.test(s)) labels.push('Boleh');
    if (/bidah/.test(s)) labels.push("Bid'ah");
    if (/fatwa|berfatwa/.test(s)) labels.push('Fatwa');
    if (/khilaf|berbeda pendapat|perbedaan pendapat|ikhtilaf/.test(s)) labels.push('Khilaf');
    return labels;
  }

  // ---------- Highlight (aman, tanpa regex dari input user) ----------
  function highlight(entry, terms) {
    const ranges = [];
    for (const term of terms) {
      let pos = 0;
      while ((pos = entry.norm.indexOf(term.t, pos)) !== -1) {
        ranges.push([entry.map[pos], entry.map[pos + term.t.length - 1] + 1]);
        pos += term.t.length;
      }
    }
    if (!ranges.length) return escapeHtml(entry.text);

    ranges.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
    const merged = [ranges[0].slice()];
    for (let i = 1; i < ranges.length; i++) {
      const last = merged[merged.length - 1];
      if (ranges[i][0] <= last[1]) last[1] = Math.max(last[1], ranges[i][1]);
      else merged.push(ranges[i].slice());
    }

    let out = '';
    let cursor = 0;
    for (const [s, e] of merged) {
      out += escapeHtml(entry.text.slice(cursor, s));
      out += '<mark>' + escapeHtml(entry.text.slice(s, e)) + '</mark>';
      cursor = e;
    }
    return out + escapeHtml(entry.text.slice(cursor));
  }

  // ---------- Parsing file transcript ----------
  const TS_RE = /^(\d{1,3}):(\d{2})(?::(\d{2}))?\s+(.*)$/;

  // Tanggal video, contoh: "Jan 13, 2022" (juga menerima "13 Jan 2022"; bulan Inggris/Indonesia)
  const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, mei: 4, jun: 5, jul: 6, aug: 7, agu: 7, ags: 7, sep: 8, oct: 9, okt: 9, nov: 10, dec: 11, des: 11 };

  function parseDate(text) {
    const t = text.trim();
    let m = t.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})$/);
    let mon, day, year;
    if (m) { mon = m[1]; day = m[2]; year = m[3]; }
    else {
      m = t.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})$/);
      if (!m) return null;
      day = m[1]; mon = m[2]; year = m[3];
    }
    const mi = MONTHS[mon.slice(0, 3).toLowerCase()];
    if (mi === undefined) return null;
    return Date.UTC(Number(year), mi, Number(day));
  }

  function parseTranscript(content) {
    const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/);
    const video = { link: '', videoId: '', title: '', ustadz: '', date: '', dateVal: null, entries: [] };
    let inTranscript = false;

    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;

      if (!inTranscript) {
        if (/^\[VIDEO\]$/i.test(line)) continue;
        let m;
        if ((m = line.match(/^Link\s*:\s*(.+)$/i))) video.link = m[1].trim();
        else if ((m = line.match(/^Judul\s*:\s*(.+)$/i))) video.title = m[1].trim();
        else if ((m = line.match(/^Ustadz\s*:\s*(.*)$/i))) video.ustadz = m[1].trim();
        else if ((m = line.match(/^Tanggal\s*:\s*(.*)$/i))) {
          video.date = m[1].trim();
          video.dateVal = parseDate(video.date);
        }
        else if (/^Transcript\s*:/i.test(line)) {
          inTranscript = true;
          const rest = line.replace(/^Transcript\s*:/i, '').trim();
          if (rest) pushEntry(video, rest);
        }
        continue;
      }
      pushEntry(video, line);
    }

    if (!video.link || !video.entries.length) return null;
    video.videoId = extractVideoId(video.link);
    video.entries.forEach((en) => {
      en.text = en.text.replace(/\s+/g, ' ').trim();
      const n = normalize(en.text);
      en.norm = n.norm;
      en.map = n.map;
    });
    return video;
  }

  function pushEntry(video, line) {
    const m = line.match(TS_RE);
    if (m) {
      const a = parseInt(m[1], 10);
      const b = parseInt(m[2], 10);
      const c = m[3] !== undefined ? parseInt(m[3], 10) : null;
      const seconds = c === null ? a * 60 + b : a * 3600 + b * 60 + c;
      const time = c === null ? m[1] + ':' + m[2] : m[1] + ':' + m[2] + ':' + m[3];
      video.entries.push({ seconds, time, text: m[4].trim() });
    } else if (video.entries.length) {
      video.entries[video.entries.length - 1].text += ' ' + line;
    }
  }

  // ---------- Muat data ----------
  function ingest(contents) {
    let failed = 0;
    contents.forEach((c) => {
      const parsed = c === null ? null : parseTranscript(c);
      if (parsed) videos.push(parsed);
      else failed++;
    });
    return failed;
  }

  function finishLoad(failed) {
    if (!videos.length) {
      setStatus('Gagal: tidak ada file dengan format transcript yang valid.', 'error');
      return false;
    }
    // urut berdasarkan tanggal (terlama dulu); yang tanpa tanggal valid di belakang, lalu urut judul
    videos.sort((a, b) => {
      const da = a.dateVal === null ? Infinity : a.dateVal;
      const db = b.dateVal === null ? Infinity : b.dateVal;
      if (da !== db) return da < db ? -1 : 1;
      return a.title.localeCompare(b.title, 'id', { numeric: true });
    });

    const lineCount = videos.reduce((n, v) => n + v.entries.length, 0);
    let msg = videos.length + ' file berhasil dimuat · ' + lineCount.toLocaleString('id-ID') + ' baris transkrip';
    if (failed) msg += ' (' + failed + ' file dilewati: gagal dibaca / format tidak sesuai)';
    setStatus(msg, 'ok');
    statVideos.textContent = txtCount.toLocaleString('id-ID');
    statBadge.classList.remove('hidden');
    statBadge.classList.add('flex');
    enableSearch(true);
    applyUrlQuery();
    return true;
  }

  async function listDatabaseFiles() {
    try {
      const r = await fetch(DB_DIR + 'manifest.json', { cache: 'no-store' });
      if (r.ok) {
        const list = await r.json();
        if (Array.isArray(list)) {
          return list
            .filter((n) => typeof n === 'string' && n.toLowerCase().endsWith('.txt'))
            .map((n) => DB_DIR + encodeURI(n));
        }
      }
    } catch (e) { /* lanjut ke directory listing */ }

    const r = await fetch(DB_DIR, { cache: 'no-store' });
    if (!r.ok) throw new Error('Folder "database" tidak dapat diakses (HTTP ' + r.status + ').');
    const doc = new DOMParser().parseFromString(await r.text(), 'text/html');
    const base = new URL(DB_DIR, location.href);
    const urls = Array.from(doc.querySelectorAll('a[href]'))
      .map((a) => a.getAttribute('href'))
      .filter((h) => h && decodeURIComponent(h.split('?')[0]).toLowerCase().endsWith('.txt'))
      .map((h) => new URL(h, base).href);
    return Array.from(new Set(urls));
  }

  async function fetchText(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.text();
  }

  async function autoLoad() {
    resetView();
    manualSection.classList.add('hidden');
    reloadBtn.classList.add('hidden');

    if (location.protocol === 'file:') {
      setStatus('Dibuka via file:// — browser memblokir pembacaan otomatis. Jalankan lewat web server lokal, atau pilih folder manual.', 'error');
      manualSection.classList.remove('hidden');
      reloadBtn.classList.remove('hidden');
      return;
    }

    setStatus('Loading... membaca folder database', 'info');
    try {
      const urls = await listDatabaseFiles();
      if (!urls.length) throw new Error('Tidak ada file .txt di folder database.');
      txtCount = urls.length;

      const contents = [];
      for (let i = 0; i < urls.length; i += BATCH_SIZE) {
        const batch = urls.slice(i, i + BATCH_SIZE);
        setStatus('Loading... ' + Math.min(i + BATCH_SIZE, urls.length) + ' / ' + urls.length + ' file', 'info');
        const settled = await Promise.allSettled(batch.map(fetchText));
        settled.forEach((s) => contents.push(s.status === 'fulfilled' ? s.value : null));
      }
      finishLoad(ingest(contents));
    } catch (err) {
      setStatus('Gagal membaca folder database: ' + (err && err.message ? err.message : err), 'error');
      manualSection.classList.remove('hidden');
    }
    reloadBtn.classList.remove('hidden');
  }

  reloadBtn.addEventListener('click', autoLoad);

  // ---------- Fallback: pilih folder manual ----------
  function readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error('Gagal membaca ' + file.name));
      reader.readAsText(file);
    });
  }

  folderInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []).filter((f) => f.name.toLowerCase().endsWith('.txt'));
    resetView();
    if (!files.length) {
      setStatus('Tidak ada file .txt di folder yang dipilih.', 'error');
      return;
    }
    txtCount = files.length;
    setStatus('Loading... membaca ' + files.length + ' file', 'info');
    try {
      const settled = await Promise.allSettled(files.map(readFile));
      const contents = settled.map((s) => (s.status === 'fulfilled' ? s.value : null));
      finishLoad(ingest(contents));
    } catch (err) {
      setStatus('Terjadi kesalahan: ' + (err && err.message ? err.message : err), 'error');
    }
  });

  // ---------- Pencarian ----------
  function runSearch() {
    const raw = searchInput.value.trim();
    if (!raw || !videos.length) return;

    const terms = parseQuery(raw);
    if (!terms.length) return;
    lastQuery = raw;
    syncUrl();

    const only = fatwaOnly.checked;
    const hits = [];

    videos.forEach((v, vi) => {
      const list = v.entries;

      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        const inE = terms.filter((t) => e.norm.includes(t.t));
        if (!inE.length) continue;

        const n = list[i + 1];
        let needNext = false;
        if (inE.length < terms.length) {
          // kata kunci terbagi antara baris ini dan baris berikutnya
          if (!n) continue;
          const combined = e.norm + ' ' + n.norm;
          if (!terms.every((t) => combined.includes(t.t))) continue;
          needNext = true;
        }

        const windowNorm = needNext ? e.norm + ' ' + n.norm : n ? e.norm + ' ' + n.norm : e.norm;
        const labels = detectLabels(windowNorm);
        if (only && !labels.length) continue;

        let score = inE.length * 2 + (needNext ? 0 : 3);
        inE.forEach((t) => { if (t.phrase) score += 3; });
        if (labels.length) score += 2;

        hits.push({ vi, i, needNext, score, labels });
      }
    });

    if (sortSelect.value === 'urut') {
      hits.sort((a, b) => a.vi - b.vi || videos[a.vi].entries[a.i].seconds - videos[b.vi].entries[b.i].seconds);
    } else {
      hits.sort((a, b) => b.score - a.score || a.vi - b.vi || a.i - b.i);
    }

    currentHits = hits;
    currentTerms = terms;
    currentPage = 1;
    resultsEl.innerHTML = '';

    if (!hits.length) {
      resultInfo.textContent = '';
      pager.innerHTML = '';
      showPerPageBox(false);
      resultsEl.innerHTML =
        '<div class="text-center text-sm text-neutral-500 py-10 border border-neutral-800 rounded-2xl bg-neutral-900/60 px-4">' +
        'Tidak ditemukan hasil untuk <span class="text-neutral-300">' + escapeHtml(raw) + '</span>.' +
        '<div class="text-xs text-neutral-600 mt-2">Coba kata yang lebih umum, kurangi jumlah kata, hilangkan tanda kutip, atau matikan filter.</div></div>';
      return;
    }

    showPerPageBox(true);
    renderPage(false);
  }

  // ---------- Paginasi ----------
  function totalPages() {
    return Math.max(1, Math.ceil(currentHits.length / perPage));
  }

  function renderPage(scrollToTop) {
    const pages = totalPages();
    currentPage = Math.min(Math.max(1, currentPage), pages);

    const start = (currentPage - 1) * perPage;
    const slice = currentHits.slice(start, start + perPage);
    resultsEl.innerHTML = slice.map((h, k) => cardHtml(h, start + k)).join('');

    const vids = new Set(currentHits.map((h) => h.vi)).size;
    resultInfo.textContent =
      currentHits.length.toLocaleString('id-ID') + ' hasil dari ' + vids + ' video · menampilkan ' +
      (start + 1).toLocaleString('id-ID') + '–' + (start + slice.length).toLocaleString('id-ID');

    pager.innerHTML = pagerHtml(pages);
    if (scrollToTop) resultInfo.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function pagerHtml(pages) {
    if (pages <= 1) return '';

    const base = 'min-w-[2.25rem] h-9 px-3 text-sm rounded-lg border transition ';
    const normal = base + 'border-neutral-700 text-neutral-300 hover:border-amber-400/60 hover:text-amber-300';
    const active = base + 'bg-amber-400 border-amber-400 text-neutral-900 font-semibold';
    const disabled = base + 'border-neutral-800 text-neutral-600 opacity-50 pointer-events-none';

    const btn = (label, page, cls) =>
      '<button type="button" data-page="' + page + '" class="' + cls + '">' + label + '</button>';

    const keep = new Set([1, pages]);
    for (let p = currentPage - 2; p <= currentPage + 2; p++) keep.add(p);
    const list = Array.from(keep).filter((p) => p >= 1 && p <= pages).sort((a, b) => a - b);

    let out = btn('‹ Sebelumnya', currentPage - 1, currentPage === 1 ? disabled : normal);
    let prev = 0;
    for (const p of list) {
      if (p - prev > 1) out += '<span class="px-1 text-neutral-600">…</span>';
      out += btn(String(p), p, p === currentPage ? active : normal);
      prev = p;
    }
    out += btn('Berikutnya ›', currentPage + 1, currentPage === pages ? disabled : normal);
    return out;
  }

  function showPerPageBox(show) {
    perPageBox.classList.toggle('hidden', !show);
    perPageBox.classList.toggle('flex', show);
    shareSearchBtn.classList.toggle('hidden', !show);
  }

  function syncPerPageUI() {
    if (['10', '20', '50', '100'].includes(String(perPage))) {
      perPageSelect.value = String(perPage);
      perPageCustom.classList.add('hidden');
    } else {
      perPageSelect.value = 'custom';
      perPageCustom.classList.remove('hidden');
      perPageCustom.value = perPage;
    }
  }

  function setPerPage(value) {
    let n = Math.floor(Number(value));
    if (!Number.isFinite(n) || n < 1) { syncPerPageUI(); return; }
    n = Math.min(n, MAX_PER_PAGE);
    perPage = n;
    try { localStorage.setItem('tf_perPage', String(n)); } catch (e) { /* abaikan */ }
    currentPage = 1;
    syncPerPageUI();
    if (currentHits.length) renderPage(false);
  }

  function initPerPage() {
    try {
      const saved = parseInt(localStorage.getItem('tf_perPage'), 10);
      if (saved >= 1 && saved <= MAX_PER_PAGE) perPage = saved;
    } catch (e) { /* abaikan */ }
    syncPerPageUI();
  }

  function cardHtml(h, idx) {
    const v = videos[h.vi];
    const e = v.entries[h.i];
    const n = v.entries[h.i + 1];
    const href = buildLink(v.link, e.seconds);
    const title = v.title || 'Tanpa judul';

    const thumb = v.videoId
      ? '<div class="relative shrink-0 w-full sm:w-48 aspect-video rounded-xl overflow-hidden bg-neutral-800">' +
      '<img src="https://i.ytimg.com/vi/' + encodeURIComponent(v.videoId) + '/mqdefault.jpg" alt="" loading="lazy" ' +
      'class="w-full h-full object-cover" onerror="this.style.display=\'none\'" />' +
      '<span class="absolute bottom-1.5 right-1.5 text-[11px] font-medium bg-black/80 text-amber-300 rounded px-1.5 py-0.5">' +
      escapeHtml(e.time) + '</span></div>'
      : '';

    const badges = h.labels
      .map((l) => '<span class="text-[10px] font-medium border rounded-full px-2 py-0.5 ' + (LABEL_STYLE[l] || '') + '">' + escapeHtml(l) + '</span>')
      .join('');

    const previewBtn = v.videoId
      ? '<button type="button" data-preview data-vid="' + escapeHtml(v.videoId) + '" data-t="' + e.seconds + '" ' +
      'data-title="' + escapeHtml(title) + '" data-href="' + escapeHtml(href) + '" ' +
      'class="text-xs rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white px-3 py-1.5 transition">Preview</button>'
      : '';

    const dateHtml = v.date
      ? '<span class="inline-flex items-center gap-1">' +
      '<svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"/></svg>' +
      escapeHtml(v.date) + '</span>'
      : '';

    const body =
      highlight(e, currentTerms) +
      (h.needNext && n
        ? ' <span class="text-neutral-500 text-[11px]">[' + escapeHtml(n.time) + ']</span> ' + highlight(n, currentTerms)
        : '');

    return (
      '<article class="card-in rounded-2xl border border-neutral-800 bg-neutral-900/70 hover:border-neutral-700 transition p-3 sm:p-4">' +
      '<div class="flex flex-col sm:flex-row gap-4">' +
      thumb +
      '<div class="min-w-0 flex-1 flex flex-col">' +
      '<div class="flex flex-wrap items-center gap-x-2 gap-y-1">' +
      '<h3 class="text-sm font-medium text-amber-200">' + escapeHtml(title) + '</h3>' +
      (v.videoId ? '' : '<span class="text-xs text-amber-300">' + escapeHtml(e.time) + '</span>') +
      '</div>' +
      '<p class="text-xs text-neutral-500 mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5"><span>' + escapeHtml(v.ustadz || '-') + '</span>' + dateHtml + '</p>' +
      (badges ? '<div class="flex flex-wrap gap-1.5 mt-2">' + badges + '</div>' : '') +
      '<p class="text-[15px] text-neutral-100 mt-2.5 leading-relaxed flex-1">' + body + '</p>' +
      '<div class="flex flex-wrap gap-2 mt-3">' +
      '<a href="' + escapeHtml(href) + '" target="_blank" rel="noopener noreferrer" ' +
      'class="text-xs rounded-lg bg-amber-400 hover:bg-amber-300 text-neutral-900 font-semibold px-3 py-1.5 transition">Buka YouTube</a>' +
      previewBtn +
      '<button type="button" data-ctx="' + idx + '" class="text-xs rounded-lg border border-neutral-700 hover:border-neutral-500 text-neutral-300 px-3 py-1.5 transition">Lihat konteks</button>' +
      '<button type="button" data-copy="' + idx + '" class="text-xs rounded-lg border border-neutral-700 hover:border-amber-400/60 text-neutral-300 px-3 py-1.5 transition">Salin</button>' +
      '<button type="button" data-wa="' + idx + '" class="text-xs rounded-lg border border-emerald-700/60 hover:border-emerald-400 text-emerald-300 px-3 py-1.5 transition">WhatsApp</button>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '<div id="ctx-' + idx + '" class="hidden mt-3 pt-3 border-t border-neutral-800 space-y-1.5"></div>' +
      '</article>'
    );
  }

  function contextHtml(h) {
    const v = videos[h.vi];
    const from = Math.max(0, h.i - 3);
    const to = Math.min(v.entries.length - 1, h.i + (h.needNext ? 5 : 4));
    let out = '';
    for (let k = from; k <= to; k++) {
      const en = v.entries[k];
      const main = k === h.i || (h.needNext && k === h.i + 1);
      out +=
        '<div class="flex gap-3 items-baseline">' +
        '<a href="' + escapeHtml(buildLink(v.link, en.seconds)) + '" target="_blank" rel="noopener noreferrer" ' +
        'class="shrink-0 text-[11px] tabular-nums text-amber-400/80 hover:text-amber-300">' + escapeHtml(en.time) + '</a>' +
        '<p class="text-sm leading-relaxed ' + (main ? 'text-neutral-100' : 'text-neutral-500') + '">' + highlight(en, currentTerms) + '</p>' +
        '</div>';
    }
    return out;
  }

  // ---------- Salin & bagikan ----------
  // Teks kutipan siap tempel (WhatsApp, catatan, dll.)
  function shareText(h) {
    const v = videos[h.vi];
    const e = v.entries[h.i];
    const n = v.entries[h.i + 1];
    const body = e.text + (h.needNext && n ? ' ' + n.text : '');
    const meta = [v.ustadz, v.date].filter(Boolean).join(' · ');
    return [
      '"' + body + '"',
      '',
      v.title || 'Tanpa judul',
      meta,
      'Menit ' + e.time,
      buildLink(v.link, e.seconds)
    ].filter((line, i) => i === 1 || line !== '').join('\n');
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) { /* lanjut ke cara cadangan */ }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch (e) {
      return false;
    }
  }

  function flash(btn, msg) {
    if (!btn.dataset.label) btn.dataset.label = btn.textContent;
    btn.textContent = msg;
    clearTimeout(btn._flashTimer);
    btn._flashTimer = setTimeout(() => { btn.textContent = btn.dataset.label; }, 1600);
  }

  // Link pencarian yang bisa dibagikan: ...?q=kata+kunci
  function searchLink() {
    const u = new URL(location.href);
    u.hash = '';
    u.search = '';
    u.searchParams.set('q', lastQuery);
    return u.toString();
  }

  function syncUrl() {
    try { history.replaceState(null, '', searchLink()); } catch (e) { /* abaikan */ }
  }

  function applyUrlQuery() {
    try {
      const q = new URLSearchParams(location.search).get('q');
      if (q && q.trim()) {
        searchInput.value = q;
        runSearch();
      }
    } catch (e) { /* abaikan */ }
  }

  shareSearchBtn.addEventListener('click', () => {
    if (!lastQuery) return;
    copyText(searchLink()).then((ok) => flash(shareSearchBtn, ok ? 'Link tersalin ✓' : 'Gagal menyalin'));
  });

  // ---------- Event ----------
  searchForm.addEventListener('submit', (e) => { e.preventDefault(); runSearch(); });
  [sortSelect, fatwaOnly].forEach((el) => el.addEventListener('change', runSearch));

  pager.addEventListener('click', (e) => {
    const b = e.target.closest('[data-page]');
    if (!b) return;
    currentPage = Number(b.dataset.page);
    renderPage(true);
  });

  perPageSelect.addEventListener('change', () => {
    if (perPageSelect.value === 'custom') {
      perPageCustom.classList.remove('hidden');
      perPageCustom.value = perPage;
      perPageCustom.focus();
      perPageCustom.select();
    } else {
      setPerPage(perPageSelect.value);
    }
  });
  perPageCustom.addEventListener('change', () => setPerPage(perPageCustom.value));
  perPageCustom.addEventListener('keydown', (e) => { if (e.key === 'Enter') perPageCustom.blur(); });

  chips.addEventListener('click', (e) => {
    const b = e.target.closest('[data-q]');
    if (!b) return;
    searchInput.value = b.dataset.q;
    runSearch();
  });

  resultsEl.addEventListener('click', (e) => {
    const prev = e.target.closest('[data-preview]');
    if (prev) {
      openModal(prev.dataset.vid, prev.dataset.t, prev.dataset.title, prev.dataset.href);
      return;
    }
    const copyBtn = e.target.closest('[data-copy]');
    if (copyBtn) {
      const h = currentHits[Number(copyBtn.dataset.copy)];
      if (h) copyText(shareText(h)).then((ok) => flash(copyBtn, ok ? 'Tersalin ✓' : 'Gagal menyalin'));
      return;
    }
    const waBtn = e.target.closest('[data-wa]');
    if (waBtn) {
      const h = currentHits[Number(waBtn.dataset.wa)];
      if (h) window.open('https://wa.me/?text=' + encodeURIComponent(shareText(h)), '_blank', 'noopener');
      return;
    }
    const ctxBtn = e.target.closest('[data-ctx]');
    if (ctxBtn) {
      const idx = Number(ctxBtn.dataset.ctx);
      const box = $('ctx-' + idx);
      if (!box) return;
      if (!box.innerHTML) box.innerHTML = contextHtml(currentHits[idx]);
      const hidden = box.classList.toggle('hidden');
      ctxBtn.textContent = hidden ? 'Lihat konteks' : 'Sembunyikan konteks';
    }
  });

  // ---------- Modal preview ----------
  function openModal(videoId, seconds, title, href) {
    modalTitle.textContent = title;
    modalOpen.href = href;
    modalFrame.src =
      'https://www.youtube.com/embed/' + encodeURIComponent(videoId) +
      '?start=' + encodeURIComponent(seconds) + '&autoplay=1&rel=0';
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }

  function closeModal() {
    modalFrame.src = '';
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }

  modalClose.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal();
  });

  // ---------- Mulai ----------
  initPerPage();
  autoLoad();
})();
