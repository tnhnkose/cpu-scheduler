// ===== CPU Zamanlama Motoru (Adım 1: FCFS + metrikler) =====
// Bu dosya sadece HESAP yapar; ekranla (HTML) hiçbir ilgisi yoktur.
// Böylece aynı kodu hem web sayfasında hem de testlerde kullanabiliriz.

// Bir süreç şöyle görünür:
//   { id: "P1", arrival: 0, burst: 8, order: 0 }
// order = girdi listesindeki sırası (eşitlik bozmak için lazım).

// Gantt şemasındaki her blok şöyle görünür:
//   { pid: "P1", start: 0, end: 8 }    -> P1, 0'dan 8'e çalıştı
//   { pid: null, start: 6, end: 8 }    -> CPU boşta (idle)

// ---------- FCFS ----------
function fcfs(processes) {
  // 1) Kopya al ve sırala: önce varış zamanı, eşitse girdi sırası.
  const sorted = [...processes].sort(
    (a, b) => a.arrival - b.arrival || a.order - b.order
  );

  let time = 0;        // simülasyon saati
  const gantt = [];

  for (const p of sorted) {
    // 2) Süreç henüz gelmediyse CPU boşta bekler.
    if (time < p.arrival) {
      gantt.push({ pid: null, start: time, end: p.arrival });
      time = p.arrival;
    }
    // 3) Süreç kesintisiz sonuna kadar çalışır.
    gantt.push({ pid: p.id, start: time, end: time + p.burst });
    time += p.burst;
  }
  return gantt;
}

// ---------- SJF (kesmesiz) ----------
function sjf(processes) {
  const remaining = [...processes]; // henüz çalışmamış süreçler
  let time = 0;
  const gantt = [];

  while (remaining.length > 0) {
    // 1) Şu ana kadar gelmiş olanlar = hazır kuyruğu
    const ready = remaining.filter((p) => p.arrival <= time);

    if (ready.length === 0) {
      // 2) Kimse gelmemiş: en erken varışa kadar CPU boşta.
      const nextArrival = Math.min(...remaining.map((p) => p.arrival));
      gantt.push({ pid: null, start: time, end: nextArrival });
      time = nextArrival;
    } else {
      // 3) En kısa burst; eşitse erken varış; o da eşitse girdi sırası.
      ready.sort(
        (a, b) => a.burst - b.burst || a.arrival - b.arrival || a.order - b.order
      );
      const chosen = ready[0];

      // 4) Seçilen süreç kesintisiz sonuna kadar çalışır.
      gantt.push({ pid: chosen.id, start: time, end: time + chosen.burst });
      time += chosen.burst;

      // 5) Bekleyenlerden çıkar.
      remaining.splice(remaining.indexOf(chosen), 1);
    }
  }
  return gantt;
}

// ---------- SRTF (kesmeli) ----------
function srtf(processes) {
  // Her sürecin kalan süresi: başta burst kadar.
  const rem = new Map(processes.map((p) => [p.id, p.burst]));
  let time = 0;
  let finished = 0;
  let current = null; // şu an CPU'daki süreç
  const gantt = [];

  // Gantt'a 1 birimlik çalışma ekler; aynı süreç devam ediyorsa
  // yeni blok açmak yerine son bloğu 1 uzatır.
  function addUnit(pid) {
    const last = gantt[gantt.length - 1];
    if (last && last.pid === pid && last.end === time) {
      last.end += 1;
    } else {
      gantt.push({ pid, start: time, end: time + 1 });
    }
  }

  while (finished < processes.length) {
    // 1) Hazır kuyruğu: gelmiş ve bitmemiş süreçler
    const ready = processes.filter((p) => p.arrival <= time && rem.get(p.id) > 0);

    if (ready.length === 0) {
      // 2) Kimse yok: bir sonraki varışa kadar CPU boşta.
      const next = Math.min(
        ...processes.filter((p) => rem.get(p.id) > 0).map((p) => p.arrival)
      );
      gantt.push({ pid: null, start: time, end: next });
      time = next;
      current = null;
      continue;
    }

    // 3) Aday: en kısa kalan süre; eşitse erken varış; o da eşitse girdi sırası.
    ready.sort(
      (a, b) =>
        rem.get(a.id) - rem.get(b.id) || a.arrival - b.arrival || a.order - b.order
    );
    let chosen = ready[0];

    // 4) Kesme kuralı: çalışan süreç hâlâ bitmediyse, aday ondan
    //    KESİN OLARAK daha kısa değilse çalışan süreç devam eder.
    if (current && rem.get(current.id) > 0 && rem.get(chosen.id) >= rem.get(current.id)) {
      chosen = current;
    }
    current = chosen;

    // 5) Seçilen süreç 1 birim çalışır.
    addUnit(chosen.id);
    rem.set(chosen.id, rem.get(chosen.id) - 1);
    if (rem.get(chosen.id) === 0) finished++;
    time += 1;
  }
  return gantt;
}

// ---------- Round Robin ----------
function rr(processes, quantum) {
  const rem = new Map(processes.map((p) => [p.id, p.burst]));

  // Süreçleri geliş sırasına diz (eşit varışta girdi sırası).
  const arrivals = [...processes].sort(
    (a, b) => a.arrival - b.arrival || a.order - b.order
  );
  let next = 0; // arrivals listesinde henüz kuyruğa girmemiş ilk süreç

  const queue = []; // FIFO hazır kuyruğu: baştan çıkar, sona eklenir
  let time = 0;
  let finished = 0;
  const gantt = [];

  // Varış zamanı <= t olan ve henüz kuyruğa girmemiş süreçleri kuyruğun sonuna ekle.
  function admitUntil(t) {
    while (next < arrivals.length && arrivals[next].arrival <= t) {
      queue.push(arrivals[next]);
      next++;
    }
  }

  admitUntil(time);

  while (finished < processes.length) {
    if (queue.length === 0) {
      // 1) Kuyruk boş: bir sonraki varışa kadar CPU boşta.
      const t = arrivals[next].arrival;
      gantt.push({ pid: null, start: time, end: t });
      time = t;
      admitUntil(time);
      continue;
    }

    // 2) Kuyruğun başındaki süreç bir dilim (en fazla quantum kadar) çalışır.
    const p = queue.shift();
    const run = Math.min(quantum, rem.get(p.id));
    // Her dilim AYRI bir blok: art arda dilimler birleştirilmez.
    gantt.push({ pid: p.id, start: time, end: time + run });
    time += run;
    rem.set(p.id, rem.get(p.id) - run);

    // 3) ÖNCE dilim sırasında ve tam sınırda gelenler kuyruğa girer...
    admitUntil(time);

    // 4) ...SONRA bitmemiş süreç kuyruğun sonuna döner. Biten süreç dönmez.
    if (rem.get(p.id) > 0) {
      queue.push(p);
    } else {
      finished++;
    }
  }
  return gantt;
}

// ---------- Metrikler (tüm algoritmalar için ortak) ----------
function computeMetrics(processes, gantt) {
  const rows = processes.map((p) => {
    const blocks = gantt.filter((g) => g.pid === p.id);
    const firstStart = Math.min(...blocks.map((g) => g.start));
    const completion = Math.max(...blocks.map((g) => g.end));
    const turnaround = completion - p.arrival;
    const waiting = turnaround - p.burst;
    const response = firstStart - p.arrival;
    return { ...p, firstStart, completion, turnaround, waiting, response };
  });

  const avg = (key) => rows.reduce((s, r) => s + r[key], 0) / rows.length;
  return {
    rows,
    avgTurnaround: avg("turnaround"),
    avgWaiting: avg("waiting"),
    avgResponse: avg("response"),
  };
}

// ---------- Girdi doğrulama ----------
// rows: formdan gelen ham değerler (metin olabilir), örn. [{id:"P1", arrival:"0", burst:"8"}]
// Geri dönüş: { errors: [...], processes: [...], quantum }
// errors boş değilse simülasyon ÇALIŞTIRILMAZ.
function validateInput(rows, quantumText) {
  const errors = [];
  const processes = [];
  const seen = new Set(); // daha önce görülen ID'ler

  // Metin, tam sayı mı? ("3" evet; "3.5", "abc", "" hayır)
  const isInt = (s) => /^-?\d+$/.test(String(s).trim());

  if (rows.length === 0) errors.push("At least one process is required.");

  rows.forEach((r, i) => {
    const line = `Row ${i + 1}`;
    const id = String(r.id ?? "").trim();

    if (id === "") errors.push(`${line}: Process ID cannot be empty.`);
    else if (seen.has(id)) errors.push(`${line}: Process ID "${id}" is duplicated. IDs must be unique.`);
    seen.add(id);

    if (!isInt(r.arrival)) errors.push(`${line}: Arrival time must be an integer ("${r.arrival}" is not valid).`);
    else if (Number(r.arrival) < 0) errors.push(`${line}: Arrival time cannot be negative.`);

    if (!isInt(r.burst)) errors.push(`${line}: CPU burst must be an integer ("${r.burst}" is not valid).`);
    else if (Number(r.burst) <= 0) errors.push(`${line}: CPU burst must be positive (at least 1).`);

    processes.push({ id, arrival: Number(r.arrival), burst: Number(r.burst), order: i });
  });

  let quantum = null;
  if (quantumText !== undefined) {
    if (!isInt(quantumText)) errors.push(`Quantum must be an integer ("${quantumText}" is not valid).`);
    else if (Number(quantumText) <= 0) errors.push("Quantum must be positive (at least 1).");
    else quantum = Number(quantumText);
  }

  return { errors, processes, quantum };
}

// ---------- Özellik kontrolleri ----------
// Ödevin 5. bölümündeki 5 özelliği her simülasyondan sonra otomatik denetler.
// Geri dönüş: [{ name, ok, detail }]
function checkProperties(processes, gantt, metrics) {
  const results = [];
  const add = (name, problems) =>
    results.push({ name, ok: problems.length === 0, detail: problems.join(" ") });

  // 1) Her süreç tam olarak burst'ü kadar CPU alıyor mu?
  add("Every process receives exactly its CPU burst",
    processes
      .map((p) => {
        const got = gantt.filter((g) => g.pid === p.id).reduce((s, g) => s + (g.end - g.start), 0);
        return got === p.burst ? null : `${p.id} received ${got} units, expected ${p.burst}.`;
      })
      .filter(Boolean));

  // 2) Hiçbir süreç varışından önce çalışmıyor mu?
  add("No process runs before its arrival",
    gantt
      .filter((g) => g.pid !== null)
      .map((g) => {
        const p = processes.find((x) => x.id === g.pid);
        return g.start < p.arrival ? `${g.pid} started at t=${g.start} but arrives at t=${p.arrival}.` : null;
      })
      .filter(Boolean));

  // 3) Bloklar çakışmıyor mu? (Zamana göre sıralayıp ardışık bloklara bak.)
  const sorted = [...gantt].sort((a, b) => a.start - b.start);
  const overlaps = [];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].start < sorted[i - 1].end) {
      overlaps.push(`${sorted[i - 1].pid ?? "idle"} (${sorted[i - 1].start}-${sorted[i - 1].end}) and ` +
                    `${sorted[i].pid ?? "idle"} (${sorted[i].start}-${sorted[i].end}) overlap.`);
    }
  }
  add("Processes do not overlap on the CPU", overlaps);

  // 4) Bekleme ve yanıt süreleri negatif değil mi?
  add("Waiting and response times are nonnegative",
    metrics.rows
      .filter((r) => r.waiting < 0 || r.response < 0)
      .map((r) => `${r.id}: waiting=${r.waiting}, response=${r.response}.`));

  // 5) Hazır süreç varken CPU boşta kalıyor mu?
  //    Boşta aralığı [s, e) içinde gelmiş (arrival < e) ve s'de henüz bitmemiş
  //    (completion > s) bir süreç varsa, CPU onu çalıştırmalıydı.
  const idleProblems = [];
  for (const g of gantt.filter((x) => x.pid === null)) {
    for (const r of metrics.rows) {
      if (r.arrival < g.end && r.completion > g.start) {
        idleProblems.push(`CPU is idle during ${g.start}-${g.end} while ${r.id} is ready.`);
      }
    }
  }
  add("CPU is never idle while a process is ready", idleProblems);

  return results;
}

// Node.js'te test edebilmek için dışa aktar (tarayıcıda bu satır görmezden gelinir)
if (typeof module !== "undefined") module.exports = { fcfs, sjf, srtf, rr, computeMetrics, validateInput, checkProperties };
