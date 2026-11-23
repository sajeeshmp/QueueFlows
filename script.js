"use strict";

/* ================= Data ================= */
const KEY = "queueflow.v2";
const MAX_QUEUE = 10;
const BASE_SERVICES = [
  { id: "A", name: "Fee Counter",  avg: 4, open: true },
  { id: "B", name: "Library Desk", avg: 2, open: true },
  { id: "C", name: "Canteen",      avg: 3, open: true },
  { id: "D", name: "Admin Office", avg: 6, open: true },
  { id: "E", name: "Lab Issue",    avg: 3, open: false }
];
const SAMPLE_NAMES = ["Rahul S", "Meera K", "Arjun P", "Sana F", "Kiran D", "Isha M", "Dev R", "Nisha T"];

let state;            // { services, queues, counters, serving, mine }
let viewId = "A";     // counter shown on the live board
let heroId = "A";     // counter shown on the hero ticket
let simTimer = null;

/* ================= Helpers ================= */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const svc = (id) => state.services.find((s) => s.id === id);
const makeToken = (id, n) => id + "-" + String(n).padStart(3, "0");
const waitFor = (id, position) => Math.round((position + 1) * svc(id).avg);
const maskRoll = (r) => (r.length > 4 ? "•••" + r.slice(-4) : r);

/* ================= State ================= */
function createState() {
  state = { services: BASE_SERVICES.map((s) => ({ ...s })), queues: {}, counters: {}, serving: {}, mine: [] };
  state.services.forEach((s) => { state.queues[s.id] = []; state.counters[s.id] = 0; state.serving[s.id] = "-"; });
  enqueue("A", "Rahul S", "1XX25CS011", "normal");
  enqueue("A", "Meera K", "1XX25CS027", "normal");
  enqueue("B", "Arjun P", "1XX25CS034", "normal");
  enqueue("C", "Sana F", "1XX25CS041", "normal");
  callNext("A");
  return state;
}

function enqueue(id, name, roll, prio) {
  state.counters[id]++;
  const ticket = { token: makeToken(id, state.counters[id]), name, roll, prio };
  const q = state.queues[id];
  if (prio === "urgent") {
    let i = 0;
    while (i < q.length && q[i].prio === "urgent") i++;
    q.splice(i, 0, ticket);
  } else {
    q.push(ticket);
  }
  return ticket;
}

function callNext(id) {
  const ticket = state.queues[id].shift();
  state.serving[id] = ticket ? ticket.token : "-";
  return ticket || null;
}

function leaveQueue(token) {
  Object.keys(state.queues).forEach((id) => {
    state.queues[id] = state.queues[id].filter((t) => t.token !== token);
  });
  state.mine = state.mine.filter((m) => m.token !== token);
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
}
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && d.services && d.queues && d.mine) return d;
  } catch (e) { /* ignore bad data */ }
  return null;
}

/* ================= Rendering ================= */
function renderStats() {
  let waiting = 0, open = 0, issued = 0, totalWait = 0;
  state.services.forEach((s) => {
    waiting += state.queues[s.id].length;
    issued += state.counters[s.id];
    if (s.open) { open++; totalWait += waitFor(s.id, state.queues[s.id].length); }
  });
  const avg = open ? Math.round(totalWait / open) : 0;
  $("stats").innerHTML =
    `<div><b>${waiting}</b><span>People waiting</span></div>` +
    `<div><b>${open}/${state.services.length}</b><span>Counters open</span></div>` +
    `<div><b>${avg} min</b><span>Average wait</span></div>` +
    `<div><b>${issued}</b><span>Tokens issued</span></div>`;
}

function renderHero() {
  const s = svc(heroId), n = state.queues[heroId].length, cur = state.serving[heroId];
  $("heroPills").innerHTML = state.services.map((x) =>
    `<button type="button" class="pill${x.id === heroId ? " on" : ""}" data-hero="${x.id}">${esc(x.name)}</button>`).join("");
  $("heroNum").textContent = !s.open ? "Closed" : (cur === "-" ? "Free" : cur);
  $("heroWait").textContent = n;
  $("heroEta").textContent = waitFor(heroId, n) + " min";
}

function renderServices() {
  $("serviceGrid").innerHTML = state.services.map((s) => {
    const n = state.queues[s.id].length;
    const full = n >= MAX_QUEUE;
    const level = !s.open || full ? "bad" : n >= 6 ? "warn" : "ok";
    const label = !s.open ? "Closed" : full ? "Full" : n >= 6 ? "Busy" : "Open";
    return `<article class="card">
      <header><h3>${esc(s.name)}</h3><span class="tag ${level}">${label}</span></header>
      <div class="bar2 ${level}"><i style="width:${Math.min(100, n / MAX_QUEUE * 100)}%"></i></div>
      <div class="stat"><span>Waiting</span><b>${n}</b></div>
      <div class="stat"><span>Now serving</span><b>${state.serving[s.id]}</b></div>
      <div class="stat"><span>Wait for new token</span><b>${waitFor(s.id, n)} min</b></div>
      <button class="btn alt small" type="button" data-join="${s.id}" ${!s.open || full ? "disabled" : ""}>Join queue</button>
    </article>`;
  }).join("");
}

function renderTracker() {
  if (state.mine.length === 0) {
    $("myTokens").innerHTML = '<p class="empty">No active tokens. Join a queue and your place will be tracked here.</p>';
    return;
  }
  $("myTokens").innerHTML = state.mine.map((m) => {
    const name = esc(svc(m.svc).name);
    const idx = state.queues[m.svc].findIndex((t) => t.token === m.token);
    if (idx >= 0) {
      const pct = Math.max(5, Math.round((1 - idx / Math.max(m.startAhead, 1)) * 100));
      return `<div class="track"><div class="row"><strong>${m.token}</strong><button class="btn alt small" type="button" data-leave="${m.token}">Leave queue</button></div>
        <p>${name}: ${idx} ahead of you, about ${waitFor(m.svc, idx)} min</p>
        <div class="bar2"><i style="width:${pct}%"></i></div></div>`;
    }
    if (state.serving[m.svc] === m.token) {
      return `<div class="track turn"><div class="row"><strong>${m.token}</strong><button class="btn alt small" type="button" data-dismiss="${m.token}">Dismiss</button></div>
        <p><b>It is your turn.</b> Go to ${name} now.</p></div>`;
    }
    return `<div class="track"><div class="row"><strong>${m.token}</strong><button class="btn alt small" type="button" data-dismiss="${m.token}">Dismiss</button></div>
      <p>${name}: completed.</p></div>`;
  }).join("");
}

function renderTable() {
  const s = svc(viewId), q = state.queues[viewId];
  const term = $("search").value.trim().toLowerCase();
  const rows = q.map((t, i) => ({ t, i })).filter(({ t }) => !term || (t.name + t.token + t.roll).toLowerCase().includes(term));
  $("tblCap").textContent = `${s.name} · now serving ${state.serving[viewId]}${s.open ? "" : " (closed)"}`;
  $("avgVal").textContent = s.avg + " min";
  $("toggleBtn").textContent = s.open ? "Close counter" : "Open counter";
  $("tblBody").innerHTML = rows.length
    ? rows.map(({ t, i }) => {
        const mine = state.mine.some((m) => m.token === t.token);
        return `<tr class="${mine ? "mine" : ""}"><td>${t.token}</td><td>${esc(t.name)}${mine ? " (you)" : ""}</td><td>${esc(maskRoll(t.roll))}</td><td>${t.prio}</td><td>${waitFor(viewId, i)} min</td></tr>`;
      }).join("")
    : '<tr><td colspan="5">Nobody waiting here.</td></tr>';
}

function checkAlerts() {
  state.mine.forEach((m) => {
    const idx = state.queues[m.svc].findIndex((t) => t.token === m.token);
    if (idx >= 0 && idx <= 1 && !m.alerted) { m.alerted = true; toast(`${m.token}: almost your turn at ${svc(m.svc).name}`); }
    if (idx < 0 && state.serving[m.svc] === m.token && !m.called) { m.called = true; toast(`${m.token}: it is your turn!`); }
  });
}

function renderAll() {
  checkAlerts();
  renderStats(); renderHero(); renderServices(); renderTracker(); renderTable();
  save();
}

/* ================= UI helpers ================= */
let toastTimer;
function toast(text) {
  const t = $("toast");
  t.textContent = text; t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 3000);
}

function showMsg(el, text, ok) { el.textContent = text; el.className = "msg " + (ok ? "good" : "err"); }

function fillSelects() {
  const opts = state.services.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join("");
  $("svcSel").innerHTML = opts;
  $("viewSel").innerHTML = opts;
}

/* ================= Live simulation ================= */
function simulateTick() {
  state.services.forEach((s) => {
    if (!s.open) return;
    if (state.queues[s.id].length && Math.random() < 0.5) callNext(s.id);
    if (state.queues[s.id].length < MAX_QUEUE && Math.random() < 0.35) {
      const name = SAMPLE_NAMES[Math.floor(Math.random() * SAMPLE_NAMES.length)];
      enqueue(s.id, name, "1XX25CS" + (100 + Math.floor(Math.random() * 900)), "normal");
    }
  });
  renderAll();
}

/* ================= Events ================= */
$("joinForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("name").value.trim();
  const roll = $("roll").value.trim().toUpperCase();
  const id = $("svcSel").value;
  const prio = document.querySelector('input[name="prio"]:checked').value;
  const s = svc(id), msg = $("formMsg");

  if (name.length < 2) return showMsg(msg, "Enter your full name.", false);
  if (!/^[A-Z0-9]{5,15}$/.test(roll)) return showMsg(msg, "Roll number must be 5 to 15 letters or digits.", false);
  if (!s.open) return showMsg(msg, `${s.name} is closed right now. Pick another counter.`, false);
  if (state.queues[id].length >= MAX_QUEUE) return showMsg(msg, `${s.name} is full. Try again in a few minutes.`, false);
  const dup = state.queues[id].find((t) => t.roll === roll);
  if (dup) return showMsg(msg, `You already have a token here: ${dup.token}`, false);

  const t = enqueue(id, name, roll, prio);
  const ahead = state.queues[id].indexOf(t);
  state.mine.push({ token: t.token, svc: id, startAhead: ahead, alerted: false, called: false });
  showMsg(msg, `Your token is ${t.token}. ${ahead} ahead of you, about ${waitFor(id, ahead)} min.`, true);
  toast(`Token ${t.token} issued for ${s.name}`);
  viewId = id; $("viewSel").value = id;
  e.target.reset(); $("svcSel").value = id;
  renderAll();
});

document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-hero],[data-join],[data-leave],[data-dismiss]");
  if (!b) return;
  if (b.dataset.hero) { heroId = b.dataset.hero; renderHero(); }
  else if (b.dataset.join) { $("svcSel").value = b.dataset.join; $("join").scrollIntoView({ behavior: "smooth" }); $("name").focus({ preventScroll: true }); }
  else if (b.dataset.leave) { leaveQueue(b.dataset.leave); toast("You left the queue."); renderAll(); }
  else if (b.dataset.dismiss) { state.mine = state.mine.filter((m) => m.token !== b.dataset.dismiss); renderAll(); }
});

$("viewSel").addEventListener("change", (e) => { viewId = e.target.value; renderTable(); });
$("search").addEventListener("input", renderTable);

$("nextBtn").addEventListener("click", () => {
  const t = callNext(viewId);
  toast(t ? `Now serving ${t.token}` : "Queue is empty.");
  renderAll();
});
$("toggleBtn").addEventListener("click", () => { const s = svc(viewId); s.open = !s.open; renderAll(); });
$("avgMinus").addEventListener("click", () => { const s = svc(viewId); s.avg = Math.max(1, s.avg - 1); renderAll(); });
$("avgPlus").addEventListener("click", () => { const s = svc(viewId); s.avg = Math.min(15, s.avg + 1); renderAll(); });
$("resetBtn").addEventListener("click", () => { createState(); viewId = heroId = "A"; $("viewSel").value = "A"; renderAll(); toast("Demo data reset."); });

$("simChk").addEventListener("change", (e) => {
  clearInterval(simTimer);
  if (e.target.checked) simTimer = setInterval(simulateTick, 5000);
});

$("contactForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("cName").value.trim(), mail = $("cMail").value.trim(), text = $("cText").value.trim();
  const okMail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail);
  if (!name || !okMail || text.length < 10) {
    return showMsg($("cMsg"), "Enter your name, a valid email and a message of at least 10 characters.", false);
  }
  $("cMsg").textContent = ""; e.target.reset();
  toast(`Thanks ${name.split(" ")[0]}, your feedback was sent.`);
});

/* Menu, theme and active link */
$("menuBtn").addEventListener("click", (e) => {
  const open = $("nav").classList.toggle("open");
  e.currentTarget.setAttribute("aria-expanded", open);
});
$("nav").addEventListener("click", (e) => { if (e.target.tagName === "A") $("nav").classList.remove("open"); });

$("themeBtn").addEventListener("click", () => {
  const root = document.documentElement, cur = root.getAttribute("data-theme");
  const dark = cur ? cur === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  const next = dark ? "light" : "dark";
  root.setAttribute("data-theme", next);
  try { localStorage.setItem("qf-theme", next); } catch (e) { /* ignore */ }
});
try { const t = localStorage.getItem("qf-theme"); if (t) document.documentElement.setAttribute("data-theme", t); } catch (e) { /* ignore */ }

const sections = document.querySelectorAll("main section");
window.addEventListener("scroll", () => {
  let cur = "";
  sections.forEach((s) => { if (s.getBoundingClientRect().top < 120) cur = s.id; });
  document.querySelectorAll("nav a").forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + cur));
}, { passive: true });

/* ================= Start ================= */
state = load() || createState();
fillSelects();
renderAll();
