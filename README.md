# CPU Scheduling Simulator

A browser-based simulator for four CPU scheduling algorithms, written for CSE513 Assignment 1:

- **FCFS** (First-Come, First-Served)
- **SJF** (Shortest Job First, non-preemptive)
- **SRTF** (Shortest Remaining Time First, preemptive)
- **RR** (Round Robin, configurable time quantum)

For each run it draws a labeled Gantt chart (including CPU idle intervals), a results table
(arrival, burst, first start, completion, turnaround, waiting and response times plus averages),
automatic property checks, and a side-by-side comparison of all four algorithms on the same workload.

## Running locally

No installation, build step or server is needed.

1. Download or clone this repository.
2. Open `index.html` in any modern web browser (Chrome, Firefox, Edge, Safari).

## Running the tests

The tests compare the simulator against hand-calculated results for Workloads A and B, check the
edge-case rules, input validation, and verify that the property checks detect a deliberately broken schedule.

Requires [Node.js](https://nodejs.org/) (any recent version, no packages needed):

```
node test.js
```

## Dependencies

- **Website:** none. Plain HTML, CSS and JavaScript with no libraries or external requests.
- **Tests:** Node.js only.

## Files

| File | Purpose |
|---|---|
| `index.html` | Page structure |
| `style.css` | Styling (light and dark themes) |
| `scheduler.js` | Scheduling engine: the four algorithms, metric calculation, input validation and property checks. Contains no UI code. |
| `app.js` | User interface: reads the form, calls the engine and renders the results |
| `test.js` | Automated tests |

## Scheduling rules

- One CPU, one CPU burst per process, no I/O, zero-time context switches.
- Ties are broken by earlier arrival time, then by order in the input list.
- SRTF preempts only when a process with *strictly* shorter remaining time is available;
  on equal remaining time the running process continues.
- RR: processes arriving exactly at a quantum boundary join the ready queue before the preempted process.
  Consecutive slices of the same process are drawn as separate Gantt blocks.
- If the ready queue is empty, the CPU is idle until the next arrival.
- A process running from time 2 to 5 receives 3 units of CPU time.

Metrics:

```
Turnaround = Completion − Arrival
Waiting    = Turnaround − CPU burst
Response   = First start − Arrival
```

## Input validation

The simulation does not run, and a clear error message is shown, if any of the following hold:
an empty or duplicated process ID, an empty field, a non-integer value, a negative arrival time,
a CPU burst below 1, or (for Round Robin) a quantum below 1.

## Limitations

- Only integer time values are supported, as required by the assignment model.
- Single CPU only; no I/O bursts, priorities or context-switch overhead.
- SRTF is simulated in steps of one time unit, which is exact for integer inputs but would be slow
  for extremely large burst values (millions of units).
- Very long timelines make the Gantt chart wide; it scrolls horizontally.
- Nothing is saved: reloading the page resets the process table to Workload A.
