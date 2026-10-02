/* =========================================================
   RACI Matrix Generator — logique
   Aucune dépendance. Tout tourne dans le navigateur.
   ========================================================= */

const SUPABASE_URL = "https://erykxjttzyfeqqcqcjoq.supabase.co";
const SUPABASE_KEY = "sb_publishable_XCgaiSStNyDvccCdkOqocw_qIaPvlsQ";

const ROLES = [
  { key: "R", label: "Responsible", hint: "Fait le travail" },
  { key: "A", label: "Accountable", hint: "Approuve, un seul" },
  { key: "C", label: "Consulted", hint: "Donne son avis" },
  { key: "I", label: "Informed", hint: "Mis au courant" }
];

let taskCount = 3;
let members = [];

/* ---------------- Initialisation ---------------- */
function init() {
  buildMembers(5);
  buildTasks(taskCount);
  bindEvents();
  console.log("RACI Generator ready");
}

function bindEvents() {
  document.getElementById("addTask").addEventListener("click", () => {
    taskCount++;
    buildTasks(taskCount);
  });

  document.getElementById("saveBtn").addEventListener("click", saveProject);
  document.getElementById("csvBtn").addEventListener("click", exportCsv);
  document.getElementById("printBtn").addEventListener("click", () => window.print());

  document.getElementById("templateSelect").addEventListener("change", e => {
    loadTemplate(e.target.value);
  });

  document.getElementById("projectName").addEventListener("input", generate);
  document.getElementById("projectDesc").addEventListener("input", generate);

  loadTemplate("raci-matrix-generator");
}

/* ---------------- Équipe ---------------- */
function buildMembers(n) {
  members = Array.from({ length: n }, (_, i) => "");
  renderMemberInputs();
}

function renderMemberInputs() {
  const box = document.getElementById("members");
  box.innerHTML = members
    .map(
      (m, i) => `
    <input
      type="text"
      class="member-input"
      placeholder="Member ${i + 1}"
      value="${escapeAttr(m)}"
      data-i="${i}"
      aria-label="Team member ${i + 1}" />`
    )
    .join("");

  box.querySelectorAll(".member-input").forEach(el => {
    el.addEventListener("input", e => {
      members[Number(e.target.dataset.i)] = e.target.value;
      generate();
    });
  });
}

/* ---------------- Tâches ---------------- */
function buildTasks(n) {
  const box = document.getElementById("tasks");
  let html = "";
  for (let i = 0; i < n; i++) {
    html += `
    <div class="row-task" data-row="${i}">
      <div class="head">
        <span>Task ${i + 1}</span>
        <button type="button" class="btn ghost sm removeTask" data-row="${i}">Remove</button>
      </div>
      <input type="text" class="task-name" placeholder="Task description"
             data-row="${i}" aria-label="Task ${i + 1} name" />
      <div class="raci">
        ${ROLES.map(
          r => `
          <select class="raci-sel" data-row="${i}" data-role="${r.key}"
                  aria-label="${r.label} for task ${i + 1}">
            <option value="">—</option>
            ${members
              .map((m, mi) => `<option value="${mi}">${escapeHtml(m || "Member " + (mi + 1))}</option>`)
              .join("")}
          </select>`
        ).join("")}
      </div>
    </div>`;
  }
  box.innerHTML = html;

  box.querySelectorAll(".task-name").forEach(el =>
    el.addEventListener("input", generate)
  );
  box.querySelectorAll(".raci-sel").forEach(el =>
    el.addEventListener("change", generate)
  );
  box.querySelectorAll(".removeTask").forEach(el =>
    el.addEventListener("click", e => {
      taskCount = Math.max(1, taskCount - 1);
      buildTasks(taskCount);
      generate();
    })
  );

  generate();
}

/* ---------------- Génération du tableau ---------------- */
function generate() {
  const names = Array.from(document.querySelectorAll(".task-name")).map(el => el.value.trim());
  const sels = Array.from(document.querySelectorAll(".raci-sel"));

  const rows = names.map((name, i) => {
    const row = { name: name, cells: {} };
    sels
      .filter(s => Number(s.dataset.row) === i)
      .forEach(s => {
        if (s.value !== "") row.cells[s.dataset.role] = Number(s.value);
      });
    return row;
  });

  const usedMembers = new Set();
  rows.forEach(r => Object.values(r.cells).forEach(v => usedMembers.add(v)));
  const memberList = Array.from(usedMembers).sort((a, b) => a - b);

  let html = `
  <h2 class="sec" style="margin-top:0">Your RACI matrix</h2>
  <div class="legend">
    <span><b class="r-R">R</b> Responsible</span>
    <span><b class="r-A">A</b> Accountable</span>
    <span><b class="r-C">C</b> Consulted</span>
    <span><b class="r-I">I</b> Informed</span>
  </div>
  <table class="matrix">
    <thead>
      <tr>
        <th>Task</th>
        ${memberList
          .map(i => `<th>${escapeHtml(members[i] || "Member " + (i + 1))}</th>`)
          .join("")}
      </tr>
    </thead>
    <tbody>
      ${rows
        .map(
          r => `
      <tr>
        <td>${escapeHtml(r.name || "Untitled task")}</td>
        ${memberList
          .map(mi => {
            const role = ROLES.find(x => r.cells[x.key] === mi);
            return `<td class="role ${role ? "r-" + role.key : ""}">${role ? role.key : ""}</td>`;
          })
          .join("")}
      </tr>`
        )
        .join("")}
    </tbody>
  </table>`;

  const warnings = validate(rows);
  if (warnings.length) {
    html += `<div class="notice" style="margin-top:18px">
      <strong>Check these:</strong><br />${warnings.map(w => "• " + w).join("<br />")}
    </div>`;
  }

  document.getElementById("output").innerHTML = html;
}

/* Contrôles qualité : la valeur d'un RACI */
function validate(rows) {
  const out = [];
  rows.forEach((r, i) => {
    const label = r.name || `Task ${i + 1}`;
    if (!r.cells.R) out.push(`${label}: no Responsible (R) assigned.`);
    if (!r.cells.A) out.push(`${label}: no Accountable (A) assigned.`);
    if (r.cells.A !== undefined) {
      const count = rows.filter(x => x.cells.A === r.cells.A).length;
      if (count > 1 && rows.filter(x => x.cells.A !== undefined).length > 1) {
        out.push(`${label}: "${members[r.cells.A] || "Member " + (r.cells.A + 1)}" is Accountable for ${count} tasks. Consider spreading accountability.`);
      }
    }
  });
  return out.slice(0, 6);
}

/* ---------------- Export ---------------- */
function exportCsv() {
  const names = Array.from(document.querySelectorAll(".task-name")).map(el => el.value.trim());
  const sels = Array.from(document.querySelectorAll(".raci-sel"));
  const project = document.getElementById("projectName").value || "RACI Matrix";

  const used = new Set();
  names.forEach((_, i) =>
    sels.filter(s => Number(s.dataset.row) === i && s.value !== "")
       .forEach(s => used.add(Number(s.value)))
  );
  const ml = Array.from(used).sort((a, b) => a - b);

  const lines = [];
  lines.push([escapeCsv(project)].join(","));
  lines.push(["Task", ...ml.map(i => members[i] || "Member " + (i + 1))].join(","));
  names.forEach((name, i) => {
    const cells = ml.map(mi => {
      const s = sels.find(x => Number(x.dataset.row) === i && Number(x.value) === mi && x.value !== "");
      return s ? s.dataset.role : "";
    });
    lines.push([escapeCsv(name || "Untitled"), ...cells].join(","));
  });

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = slugify(project) + "-raci.csv";
  a.click();
  URL.revokeObjectURL(url);
}

/* ---------------- Sauvegarde (Supabase) ---------------- */
async function saveProject() {
  const btn = document.getElementById("saveBtn");
  const status = document.getElementById("saveStatus");
  btn.disabled = true;
  status.textContent = "Saving…";

  try {
    const project = document.getElementById("projectName").value || "Untitled project";
    const desc = document.getElementById("projectDesc").value || "";
    const names = Array.from(document.querySelectorAll(".task-name")).map(el => el.value.trim());
    const sels = Array.from(document.querySelectorAll(".raci-sel"));

    const tasks = names.map((name, i) => {
      const cells = {};
      sels.filter(s => Number(s.dataset.row) === i && s.value !== "")
          .forEach(s => { cells[s.dataset.role] = Number(s.value); });
      return { name, cells };
    });

    const res = await fetch(`${SUPABASE_URL}/rest/v1/generated_projects`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": "Bearer " + SUPABASE_KEY,
        "Content-Type": "application/json",
        "Prefer": "return=representation"
      },
      body: JSON.stringify({
        template_id: 1,
        data: { project, description: desc, members, tasks }
      })
    });

    if (!res.ok) throw new Error("HTTP " + res.status);
    status.textContent = "Saved. Reference #" + (Date.now() % 10000);
  } catch (err) {
    status.textContent = "Save failed (" + err.message + "). Your work is still in the form.";
  } finally {
    btn.disabled = false;
  }
}

/* ---------------- Templates ---------------- */
const TEMPLATES = {
  "raci-matrix-generator": {
    tasks: [
      "Define project scope",
      "Draft project plan",
      "Review and approve plan",
      "Allocate budget",
      "Communicate kickoff"
    ],
    members: ["Sponsor", "Project lead", "Team member", "Reviewer"]
  },
  "software-team": {
    tasks: [
      "Write user stories",
      "Estimate effort",
      "Code review",
      "Deploy to staging",
      "Release approval"
    ],
    members: ["Product owner", "Tech lead", "Developer", "QA"]
  },
  "construction": {
    tasks: [
      "Site preparation",
      "Foundation work",
      "Structural framing",
      "Mechanical rough-in",
      "Final handover"
    ],
    members: ["Client", "Site manager", "Contractor", "Inspector"]
  }
};

function loadTemplate(slug) {
  const t = TEMPLATES[slug];
  if (!t) return;
  members = t.members.slice();
  renderMemberInputs();
  taskCount = t.tasks.length;
  buildTasks(taskCount);

  document.getElementById("projectName").value =
    slug === "raci-matrix-generator" ? "My Project" : "Untitled Project";
  generate();
}

/* ---------------- Utils ---------------- */
function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function escapeAttr(s) { return escapeHtml(s); }
function escapeCsv(s) { return '"' + String(s || "").replace(/"/g, '""') + '"'; }
function slugify(s) {
  return String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

document.addEventListener("DOMContentLoaded", init);