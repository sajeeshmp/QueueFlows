// ---------- Data (arrays + objects) ----------
var services = [
  { id: "A", name: "Fee Counter",   avg: 4, open: true },
  { id: "B", name: "Library Desk",  avg: 2, open: true },
  { id: "C", name: "Canteen",       avg: 3, open: true },
  { id: "D", name: "Admin Office",  avg: 6, open: true },
  { id: "E", name: "Lab Issue",     avg: 3, open: false }
];
var queues = {};      // id -> array of ticket objects
var counters = {};    // id -> last token number given
var serving = {};     // id -> token label being served
var MAX = 10;         // busy threshold

function seedDemo() {
  queues = {}; counters = {}; serving = {};
  for (var i = 0; i < services.length; i++) {
    queues[services[i].id] = []; counters[services[i].id] = 0; serving[services[i].id] = "-";
  }
  addTicket("A", "Rahul S", "1XX25CS011", "normal");
  addTicket("A", "Meera K", "1XX25CS027", "normal");
  addTicket("B", "Arjun P", "1XX25CS034", "normal");
  addTicket("C", "Sana F", "1XX25CS041", "normal");
  callNext("A");
}

// ---------- Core functions ----------
function label(id, n) { return id + "-" + String(n).padStart(3, "0"); }

function addTicket(id, name, roll, prio) {
  counters[id]++;
  var t = { token: label(id, counters[id]), name: name, roll: roll, prio: prio };
  if (prio === "urgent") {
    var pos = 0;
    while (pos < queues[id].length && queues[id][pos].prio === "urgent") { pos++; }
    queues[id].splice(pos, 0, t);
  } else {
    queues[id].push(t);
  }
  return t;
}

function callNext(id) {
  if (queues[id].length === 0) { serving[id] = "-"; return null; }
  var t = queues[id].shift();
  serving[id] = t.token;
  return t;
}

function getService(id) {
  for (var i = 0; i < services.length; i++) { if (services[i].id === id) return services[i]; }
  return null;
}

function waitFor(id, position) { return Math.round((position + 1) * getService(id).avg); }

function save() {
  try { localStorage.setItem("queueflow", JSON.stringify({ queues: queues, counters: counters, serving: serving })); } catch (e) {}
}
function load() {
  try {
    var raw = localStorage.getItem("queueflow");
    if (raw) { var d = JSON.parse(raw); queues = d.queues; counters = d.counters; serving = d.serving; return true; }
  } catch (e) {}
  return false;
}

// ---------- Rendering ----------
function renderServices() {
  var grid = document.getElementById("serviceGrid");
  var html = "";
  for (var i = 0; i < services.length; i++) {
    var s = services[i], n = queues[s.id].length;
    var pct = Math.min(100, Math.round(n / MAX * 100));
    var status = !s.open ? '<span class="tag bad">Closed</span>' : (n >= MAX ? '<span class="tag bad">Busy</span>' : '<span class="tag ok">Open</span>');
    html += '<article class="card"><h3>' + s.name + '</h3>' + status +
      '<div class="bar' + (n >= MAX ? ' busy' : '') + '"><i style="width:' + pct + '%"></i></div>' +
      '<div class="stat"><span>Waiting</span><b>' + n + '</b></div>' +
      '<div class="stat"><span>Now serving</span><b>' + serving[s.id] + '</b></div>' +
      '<div class="stat"><span>Est. wait for new token</span><b>' + waitFor(s.id, n) + ' min</b></div></article>';
  }
  grid.innerHTML = html;
}

function renderTable() {
  var id = document.getElementById("viewSel").value;
  var s = getService(id), q = queues[id], rows = "";
  document.getElementById("tblCap").textContent = s.name + " · now serving " + serving[id];
  if (q.length === 0) { rows = '<tr><td colspan="6">No one waiting. Join the queue to get a token.</td></tr>'; }
  for (var i = 0; i < q.length; i++) {
    rows += '<tr' + (i === 0 ? ' class="now"' : '') + '><td>' + q[i].token + '</td><td>' + q[i].name + '</td><td>' + q[i].roll + '</td><td>' + q[i].prio + '</td><td>' + waitFor(id, i) + ' min</td>' +
      '<td><button class="btn alt small" data-token="' + q[i].token + '" data-svc="' + id + '">Leave</button></td></tr>';
  }
  document.getElementById("tblBody").innerHTML = rows;
}

function renderHero() {
  var s = services[0];
  document.getElementById("heroSvc").textContent = s.name;
  document.getElementById("heroNum").textContent = serving[s.id] === "-" ? "Open" : serving[s.id];
  document.getElementById("heroWait").textContent = queues[s.id].length;
}

function renderAll() { renderServices(); renderTable(); renderHero(); save(); }

function fillSelects() {
  var join = document.getElementById("svcSel"), view = document.getElementById("viewSel"), opts = "";
  for (var i = 0; i < services.length; i++) { opts += '<option value="' + services[i].id + '">' + services[i].name + '</option>'; }
  join.innerHTML = opts; view.innerHTML = opts;
}

function showMsg(text, ok) {
  var m = document.getElementById("formMsg");
  m.textContent = text; m.className = "msg " + (ok ? "good" : "err");
}

// ---------- Events ----------
document.getElementById("joinForm").addEventListener("submit", function (e) {
  e.preventDefault();
  var name = document.getElementById("name").value.trim();
  var roll = document.getElementById("roll").value.trim().toUpperCase();
  var id = document.getElementById("svcSel").value;
  var prio = document.querySelector('input[name="prio"]:checked').value;
  var s = getService(id);
  if (name.length < 2) { showMsg("Enter your full name.", false); return; }
  if (roll.length < 5) { showMsg("Enter a valid roll number (at least 5 characters).", false); return; }
  if (!s.open) { showMsg(s.name + " is closed right now. Pick another counter.", false); return; }
  if (queues[id].length >= MAX) { showMsg(s.name + " is full. Try again in a few minutes.", false); return; }
  for (var i = 0; i < queues[id].length; i++) {
    if (queues[id][i].roll === roll) { showMsg("You already have a token here: " + queues[id][i].token, false); return; }
  }
  var t = addTicket(id, name, roll, prio);
  var pos = queues[id].indexOf(t);
  showMsg("Your token is " + t.token + ". " + pos + " ahead of you, about " + waitFor(id, pos) + " min.", true);
  document.getElementById("viewSel").value = id;
  this.reset();
  renderAll();
});

document.getElementById("viewSel").addEventListener("change", renderTable);

document.getElementById("nextBtn").addEventListener("click", function () {
  callNext(document.getElementById("viewSel").value);
  renderAll();
});

document.getElementById("clearBtn").addEventListener("click", function () {
  seedDemo(); renderAll(); showMsg("", true);
});

document.getElementById("tblBody").addEventListener("click", function (e) {
  var b = e.target.closest("button");
  if (!b) return;
  var id = b.getAttribute("data-svc"), tk = b.getAttribute("data-token");
  queues[id] = queues[id].filter(function (t) { return t.token !== tk; });
  renderAll();
});

// ---------- Start ----------
fillSelects();
if (!load()) { seedDemo(); }
renderAll();
