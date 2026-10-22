// ===== Arayüz kodu =====
// Bu dosya sadece ekranla ilgilenir: formu okur, scheduler.js'teki
// fonksiyonları çağırır ve sonuçları sayfaya çizer. Hiç hesap yapmaz.

// ---------- Hazır iş yükleri (ödevdeki tablolar) ----------
const WORKLOADS = {
  A: [["P1", 0, 8], ["P2", 1, 4], ["P3", 2, 2], ["P4", 4, 1]],
  B: [["P1", 2, 3], ["P2", 2, 1], ["P3", 8, 2], ["P4", 9, 1]],
};

const ALGO_NAMES = {
  fcfs: "FCFS",
  sjf: "SJF (non-preemptive)",
  srtf: "SRTF (preemptive)",
  rr: "Round Robin",
};

// Süreç renkleri (sırayla dağıtılır)
const COLORS = ["#8fb3ff", "#ffc078", "#8ce99a", "#ff9aa2", "#d0a8ff",
                "#74e0e0", "#ffe066", "#c3c9d4", "#f7a8d8", "#a9e34b"];

// Kısa yol: id ile eleman bul
const $ = (id) => document.getElementById(id);
const tbody = $("procTable").querySelector("tbody");

// ---------- Süreç tablosu: satır ekle / sil / oku ----------
function addRow(id = "", arrival = "", burst = "") {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td class="num"></td>
    <td><input class="f-id" type="text" aria-label="Process ID"></td>
    <td><input class="f-arr" type="text" inputmode="numeric" aria-label="Arrival time"></td>
    <td><input class="f-burst" type="text" inputmode="numeric" aria-label="CPU burst"></td>
    <td><button type="button" class="remove" title="Remove process">✕</button></td>`;
  // Değerleri .value ile koyuyoruz (innerHTML'e gömmek yerine) — daha güvenli.
  tr.querySelector(".f-id").value = id;
  tr.querySelector(".f-arr").value = arrival;
  tr.querySelector(".f-burst").value = burst;
  tr.querySelector(".remove").addEventListener("click", () => {
    tr.remove();
    renumber();
  });
  tbody.appendChild(tr);
  renumber();
}

// Satır numaralarını (1, 2, 3...) güncelle
function renumber() {
  [...tbody.rows].forEach((tr, i) => (tr.querySelector(".num").textContent = i + 1));
}

// Tablodaki her satırı {id, arrival, burst} nesnesine çevir (ham metin olarak)
function readRows() {
  return [...tbody.rows].map((tr) => ({
    id: tr.querySelector(".f-id").value,
    arrival: tr.querySelector(".f-arr").value,
    burst: tr.querySelector(".f-burst").value,
  }));
}

function loadWorkload(name) {
  tbody.innerHTML = "";
  WORKLOADS[name].forEach(([id, a, b]) => addRow(id, a, b));
  $("quantum").value = "2"; // ödev: RR için quantum = 2
  hideOutput();
}

// ---------- Simülasyonu çalıştır ----------
function run() {
  const algo = $("algo").value;
  const rows = readRows();

  // Quantum sadece RR'de zorunlu; diğerlerinde de karşılaştırma tablosu için okunur.
  const { errors, processes, quantum } = validateInput(rows, $("quantum").value);

  // RR dışındaki algoritmalarda quantum hatası çalıştırmayı engellemesin.
  const blocking = algo === "rr" ? errors : errors.filter((e) => !e.startsWith("Quantum"));
  markInvalidInputs(rows);
  if (blocking.length > 0) {
    hideOutput();          // önce eski sonuçları gizle (bu, hata kutusunu da temizler)
    showErrors(blocking);  // sonra hataları göster — sıra önemli!
    return;
  }
  showErrors([]);

  const gantt = schedule(algo, processes, quantum);
  const metrics = computeMetrics(processes, gantt);
  const checks = checkProperties(processes, gantt, metrics);

  // Her sürece bir renk ata (girdi sırasına göre)
  const colorOf = {};
  processes.forEach((p, i) => (colorOf[p.id] = COLORS[i % COLORS.length]));

  $("algoName").textContent = ALGO_NAMES[algo] + (algo === "rr" ? ` (q = ${quantum})` : "");
  drawGantt(gantt, colorOf);
  $("ganttHint").textContent = algo === "rr"
    ? "Each block is one time slice. Consecutive slices of the same process are drawn as separate blocks, so quantum boundaries stay visible."
    : "Hatched blocks are CPU idle intervals.";
  drawResults(metrics);
  drawChecks(checks);
  $("output").hidden = false;

  drawComparison(processes, errors.length === 0 ? quantum : null);
}

// Algoritma adına göre doğru fonksiyonu çağır
function schedule(algo, processes, quantum) {
  if (algo === "fcfs") return fcfs(processes);
  if (algo === "sjf") return sjf(processes);
  if (algo === "srtf") return srtf(processes);
  return rr(processes, quantum);
}

// ---------- Çizim fonksiyonları ----------
const UNIT = 38; // 1 zaman birimi = 38 piksel genişlik

function drawGantt(gantt, colorOf) {
  const box = $("gantt");
  box.innerHTML = "";
  gantt.forEach((g, i) => {
    const div = document.createElement("div");
    div.className = "block" + (g.pid === null ? " idle" : "");
    div.style.width = (g.end - g.start) * UNIT + "px";
    if (g.pid !== null) div.style.background = colorOf[g.pid];
    div.textContent = g.pid ?? "idle";
    div.title = `${g.pid ?? "idle"}: ${g.start} → ${g.end} (${g.end - g.start} units)`;

    // Zaman etiketleri: her bloğun başı, son bloğun da sonu
    const t = document.createElement("span");
    t.className = "t";
    t.textContent = g.start;
    div.appendChild(t);
    if (i === gantt.length - 1) {
      const e = document.createElement("span");
      e.className = "t end";
      e.textContent = g.end;
      div.appendChild(e);
    }
    box.appendChild(div);
  });
}

// Ortalama değerleri en fazla 2 ondalıkla göster (6.75, 2.5, 9)
const fmt = (x) => String(Math.round(x * 100) / 100);

function drawResults(m) {
  const body = $("results").querySelector("tbody");
  body.innerHTML = "";
  for (const r of m.rows) {
    const tr = document.createElement("tr");
    [r.id, r.arrival, r.burst, r.firstStart, r.completion, r.turnaround, r.waiting, r.response]
      .forEach((v) => {
        const td = document.createElement("td");
        td.textContent = v;
        tr.appendChild(td);
      });
    body.appendChild(tr);
  }
  $("results").querySelector("tfoot").innerHTML = `
    <tr><td colspan="5">Average</td>
      <td>${fmt(m.avgTurnaround)}</td><td>${fmt(m.avgWaiting)}</td><td>${fmt(m.avgResponse)}</td></tr>`;
}

function drawChecks(checks) {
  const ul = $("checks");
  ul.innerHTML = "";
  for (const c of checks) {
    const li = document.createElement("li");
    li.className = c.ok ? "ok" : "bad";
    li.textContent = c.name;
    if (!c.ok) {
      const d = document.createElement("span");
      d.className = "detail";
      d.textContent = c.detail;
      li.appendChild(d);
    }
    ul.appendChild(li);
  }
}

// Aynı iş yükünü dört algoritmayla çalıştırıp yan yana göster
function drawComparison(processes, quantum) {
  const body = $("compareTable").querySelector("tbody");
  body.innerHTML = "";
  const algos = quantum ? ["fcfs", "sjf", "srtf", "rr"] : ["fcfs", "sjf", "srtf"];
  const results = algos.map((a) => {
    const g = schedule(a, processes, quantum);
    return { a, g, m: computeMetrics(processes, g) };
  });
  const bestWait = Math.min(...results.map((r) => r.m.avgWaiting));

  for (const { a, g, m } of results) {
    const tr = document.createElement("tr");
    if (Math.abs(m.avgWaiting - bestWait) < 1e-9) tr.className = "best";
    const timeline = g.map((b) => `${b.pid ?? "idle"} ${b.start}–${b.end}`).join(", ");
    const cells = [
      ALGO_NAMES[a] + (a === "rr" ? ` (q=${quantum})` : ""),
      fmt(m.avgTurnaround), fmt(m.avgWaiting), fmt(m.avgResponse), timeline,
    ];
    cells.forEach((v) => {
      const td = document.createElement("td");
      td.textContent = v;
      tr.appendChild(td);
    });
    body.appendChild(tr);
  }
  $("compare").hidden = false;
}

// ---------- Hata gösterimi ----------
function showErrors(errors) {
  const box = $("errors");
  if (errors.length === 0) { box.hidden = true; box.innerHTML = ""; return; }
  box.innerHTML = "<strong>Please fix the following:</strong>";
  const ul = document.createElement("ul");
  errors.forEach((e) => {
    const li = document.createElement("li");
    li.textContent = e;
    ul.appendChild(li);
  });
  box.appendChild(ul);
  box.hidden = false;
}

// Hatalı kutuları kırmızı çerçeveyle işaretle (validateInput'u satır satır tekrar çağırarak)
function markInvalidInputs(rows) {
  const isInt = (s) => /^-?\d+$/.test(String(s).trim());
  const counts = {};
  rows.forEach((r) => { const k = r.id.trim(); counts[k] = (counts[k] || 0) + 1; });
  [...tbody.rows].forEach((tr, i) => {
    const r = rows[i];
    const idBad = r.id.trim() === "" || counts[r.id.trim()] > 1;
    const arrBad = !isInt(r.arrival) || Number(r.arrival) < 0;
    const burstBad = !isInt(r.burst) || Number(r.burst) <= 0;
    tr.querySelector(".f-id").classList.toggle("invalid", idBad);
    tr.querySelector(".f-arr").classList.toggle("invalid", arrBad);
    tr.querySelector(".f-burst").classList.toggle("invalid", burstBad);
  });
  const q = $("quantum").value;
  $("quantum").classList.toggle("invalid", $("algo").value === "rr" && (!isInt(q) || Number(q) <= 0));
}

function hideOutput() {
  $("output").hidden = true;
  $("compare").hidden = true;
  showErrors([]);
}

// Quantum kutusu sadece RR seçiliyken aktif
function updateQuantumState() {
  const isRR = $("algo").value === "rr";
  $("quantum").disabled = !isRR;
  $("quantumLabel").classList.toggle("disabled", !isRR);
}

// ---------- Olay bağlantıları ----------
$("addRow").addEventListener("click", () => addRow(`P${tbody.rows.length + 1}`, "", ""));
$("loadA").addEventListener("click", () => loadWorkload("A"));
$("loadB").addEventListener("click", () => loadWorkload("B"));
$("clearAll").addEventListener("click", () => { tbody.innerHTML = ""; hideOutput(); });
$("algo").addEventListener("change", updateQuantumState);
$("run").addEventListener("click", run);
// Herhangi bir kutuda Enter'a basınca da çalıştır
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.tagName === "INPUT") run();
});

// Sayfa açılınca Workload A yüklü gelsin
loadWorkload("A");
updateQuantumState();
