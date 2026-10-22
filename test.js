// Elle hesapladığımız sonuçlarla motoru karşılaştırır. Çalıştırma: node test.js
const {
  fcfs, sjf, srtf, rr, computeMetrics, validateInput, checkProperties,
} = require("./scheduler.js");

let failures = 0; // kaç test kaldı

// Kısa yol: [id, varış, burst] listesinden süreç nesneleri üret
const make = (list) =>
  list.map(([id, arrival, burst], order) => ({ id, arrival, burst, order }));

const A = make([["P1", 0, 8], ["P2", 1, 4], ["P3", 2, 2], ["P4", 4, 1]]);
const B = make([["P1", 2, 3], ["P2", 2, 1], ["P3", 8, 2], ["P4", 9, 1]]);

// Gantt'ı "P1 0-8, P2 8-12, ..." metnine çevir (karşılaştırması kolay)
const show = (g) =>
  g.map((b) => `${b.pid ?? "idle"} ${b.start}-${b.end}`).join(", ");

function report(name, ok, lines = []) {
  console.log(`${ok ? "GEÇTİ " : "KALDI "} ${name}`);
  if (!ok) { failures++; lines.forEach((l) => console.log("   ", l)); }
}

// ===== 1) Algoritma testleri: Gantt + ortalamalar + 5 özellik =====
function check(name, procs, algo, expectedGantt, expectedAvgs) {
  const gantt = algo(procs);
  const m = computeMetrics(procs, gantt);
  const got = show(gantt);
  const avgs = [m.avgTurnaround, m.avgWaiting, m.avgResponse];
  const props = checkProperties(procs, gantt, m).filter((p) => !p.ok);

  const ok =
    got === expectedGantt &&
    avgs.every((v, i) => Math.abs(v - expectedAvgs[i]) < 1e-9) &&
    props.length === 0;

  report(name, ok, [
    `beklenen: ${expectedGantt}  [${expectedAvgs}]`,
    `bulunan : ${got}  [${avgs}]`,
    ...props.map((p) => `özellik bozuk: ${p.name} -> ${p.detail}`),
  ]);
}

check("FCFS - A", A, fcfs, "P1 0-8, P2 8-12, P3 12-14, P4 14-15", [10.5, 6.75, 6.75]);
check("FCFS - B", B, fcfs, "idle 0-2, P1 2-5, P2 5-6, idle 6-8, P3 8-10, P4 10-11", [2.75, 1.0, 1.0]);
check("SJF - A", A, sjf, "P1 0-8, P4 8-9, P3 9-11, P2 11-15", [9.0, 5.25, 5.25]);
check("SJF - B", B, sjf, "idle 0-2, P2 2-3, P1 3-6, idle 6-8, P3 8-10, P4 10-11", [2.25, 0.5, 0.5]);
check("SRTF - A", A, srtf, "P1 0-1, P2 1-2, P3 2-4, P4 4-5, P2 5-8, P1 8-15", [6.25, 2.5, 0]);
check("SRTF - B", B, srtf, "idle 0-2, P2 2-3, P1 3-6, idle 6-8, P3 8-10, P4 10-11", [2.25, 0.5, 0.5]);
// Eşit kalan süre: t=1'de P1'in kalanı 3, yeni gelen P2'nin de 3 -> P1 kesilmemeli
const EQ = make([["P1", 0, 4], ["P2", 1, 3]]);
check("SRTF - eşit kalan süre", EQ, srtf, "P1 0-4, P2 4-7", [5, 1.5, 1.5]);

const rr2 = (ps) => rr(ps, 2); // quantum = 2
check("RR(q=2) - A", A, rr2, "P1 0-2, P2 2-4, P3 4-6, P1 6-8, P4 8-9, P2 9-11, P1 11-13, P1 13-15", [8.5, 4.75, 1.75]);
check("RR(q=2) - B", B, rr2, "idle 0-2, P1 2-4, P2 4-5, P1 5-6, idle 6-8, P3 8-10, P4 10-11", [2.75, 1.0, 0.75]);
// Sınırda varış: t=2'de P2 gelir, P1'in dilimi biter -> P2, P1'den ÖNCE kuyruğa girmeli
const EDGE = make([["P1", 0, 3], ["P2", 2, 1]]);
check("RR(q=2) - sınırda varış", EDGE, rr2, "P1 0-2, P2 2-3, P1 3-4", [2.5, 0.5, 0]);

// ===== Raporun 3. bölümündeki öğrenci test senaryoları =====
// T1: CPU boşta kalıyor (0-1 ve 3-6)
const T1 = make([["P1", 1, 2], ["P2", 6, 3], ["P3", 7, 1]]);
check("T1 idle - FCFS", T1, fcfs, "idle 0-1, P1 1-3, idle 3-6, P2 6-9, P3 9-10", [8 / 3, 2 / 3, 2 / 3]);
check("T1 idle - RR(q=2)", T1, rr2, "idle 0-1, P1 1-3, idle 3-6, P2 6-8, P3 8-9, P2 9-10", [8 / 3, 2 / 3, 1 / 3]);
// T2: üç süreç aynı anda geliyor; P1 ve P2'nin burst'ü de eşit -> girdi sırası belirler
const T2 = make([["P1", 0, 3], ["P2", 0, 3], ["P3", 0, 1]]);
check("T2 tie - FCFS", T2, fcfs, "P1 0-3, P2 3-6, P3 6-7", [16 / 3, 3, 3]);
check("T2 tie - SJF", T2, sjf, "P3 0-1, P1 1-4, P2 4-7", [4, 5 / 3, 5 / 3]);
check("T2 tie - RR(q=2)", T2, rr2, "P1 0-2, P2 2-4, P3 4-5, P1 5-6, P2 6-7", [6, 11 / 3, 2]);
// T3: SRTF çalışan süreci kesiyor (t=2'de P2, P1'i keser); t=3'te P3 kesmez
const T3 = make([["P1", 0, 6], ["P2", 2, 2], ["P3", 3, 3]]);
check("T3 preempt - SJF", T3, sjf, "P1 0-6, P2 6-8, P3 8-11", [20 / 3, 3, 3]);
check("T3 preempt - SRTF", T3, srtf, "P1 0-2, P2 2-4, P3 4-7, P1 7-11", [17 / 3, 2, 1 / 3]);

// ===== 2) Girdi doğrulama testleri =====
// Her satır: [test adı, süreç satırları, quantum, hata bekleniyor mu?]
const P = (id, arrival, burst) => ({ id, arrival, burst });
const validationCases = [
  ["geçerli girdi kabul edilir",   [P("P1", "0", "3"), P("P2", "1", "2")], "2",   false],
  ["tekrarlanan ID reddedilir",    [P("P1", "0", "3"), P("P1", "1", "2")], "2",   true],
  ["negatif varış reddedilir",     [P("P1", "-1", "3")],                   "2",   true],
  ["sıfır burst reddedilir",       [P("P1", "0", "0")],                    "2",   true],
  ["negatif burst reddedilir",     [P("P1", "0", "-4")],                   "2",   true],
  ["ondalıklı burst reddedilir",   [P("P1", "0", "2.5")],                  "2",   true],
  ["harf içeren varış reddedilir", [P("P1", "abc", "3")],                  "2",   true],
  ["boş alan reddedilir",          [P("P1", "", "3")],                     "2",   true],
  ["boş ID reddedilir",            [P("", "0", "3")],                      "2",   true],
  ["sıfır quantum reddedilir",     [P("P1", "0", "3")],                    "0",   true],
  ["ondalıklı quantum reddedilir", [P("P1", "0", "3")],                    "1.5", true],
  ["boş süreç listesi reddedilir", [],                                     "2",   true],
];
for (const [name, rows, q, expectError] of validationCases) {
  const { errors } = validateInput(rows, q);
  report(`Doğrulama - ${name}`, (errors.length > 0) === expectError, errors);
}

// ===== 3) Özellik kontrolleri gerçekten hata yakalıyor mu? =====
// Kasıtlı olarak BOZUK bir Gantt veriyoruz; kontrollerin bunu fark etmesi gerekiyor.
{
  const procs = make([["P1", 0, 3], ["P2", 2, 2]]);
  const broken = [
    { pid: null, start: 0, end: 1 },  // P1 hazırken CPU boşta  -> özellik 5
    { pid: "P1", start: 1, end: 3 },  // P1 sadece 2 birim alıyor -> özellik 1
    { pid: "P2", start: 1, end: 3 },  // P2 varıştan önce ve P1 ile çakışık -> 2 ve 3
  ];
  const m = computeMetrics(procs, broken);
  const failed = checkProperties(procs, broken, m).filter((p) => !p.ok).map((p) => p.name);
  report("Özellik kontrolleri bozuk çizelgeyi yakalar", failed.length >= 4, failed);
}

console.log(failures === 0 ? "\nTüm testler geçti." : `\n${failures} test kaldı.`);
process.exitCode = failures === 0 ? 0 : 1;
