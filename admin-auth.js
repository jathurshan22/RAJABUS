// Shared admin session guard + authenticated fetch helper.
// Include this <script> BEFORE any other admin-*.js file (except admin-login.js).

const ADMIN_AUTH_API_BASE = "http://localhost:5000/api";

// Redirects to the login page if there's no admin token stored.
function requireAdminAuth() {
    const token = localStorage.getItem("adminToken");
    if (!token) {
        window.location.href = "admin-login.html";
    }
}

// Wrapper around fetch() that automatically attaches the admin's JWT.
// If the token is missing/expired/rejected by the server, it clears the
// session and bounces back to the login page instead of silently failing.
async function adminFetch(url, options = {}) {
    const token = localStorage.getItem("adminToken");

    const headers = {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
    };

    const res = await fetch(url, { ...options, headers });

    if (res.status === 401 || res.status === 403) {
        localStorage.removeItem("adminToken");
        localStorage.removeItem("adminEmail");
        window.location.href = "admin-login.html";
        throw new Error("Admin session expired, please log in again");
    }

    return res;
}

// Run the guard as soon as this script loads, before the page's own JS runs.
requireAdminAuth();

// ─── Shared Detail Modal ─────────────────────────────────────────────
// Any admin page can call showDetailModal(title, rows) instead of alert().
// rows = [{ label: "Ticket ID", value: "RB1234" }, ...]
// Pass { label, value, badge: "paid" | "pending" | "cancelled" } for a
// status pill instead of plain text.

function ensureDetailModal() {
    if (document.getElementById("detailModalBackdrop")) return;

    const backdrop = document.createElement("div");
    backdrop.id = "detailModalBackdrop";
    backdrop.className = "booking-modal-backdrop";
    backdrop.hidden = true;
    backdrop.innerHTML = `
        <div class="booking-modal">
            <div class="booking-modal-header">
                <h3 id="detailModalTitle">Details</h3>
                <button type="button" class="booking-modal-close" onclick="closeDetailModal()">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            <div class="booking-modal-body" id="detailModalBody"></div>
            <div class="booking-modal-footer">
                <button type="button" class="booking-modal-ok" onclick="closeDetailModal()">Close</button>
            </div>
        </div>
    `;
    document.body.appendChild(backdrop);

    backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) closeDetailModal();
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeDetailModal();
    });
}

function showDetailModal(title, rows) {
    ensureDetailModal();

    document.getElementById("detailModalTitle").textContent = title;

    const body = document.getElementById("detailModalBody");
    body.innerHTML = rows.map((row) => {
        if (row.block) {
            return `
                <div class="booking-modal-block">
                    <span>${row.label}</span>
                    <p>${row.value}</p>
                </div>
            `;
        }

        const valueHtml = row.badge
            ? `<span class="modal-status-badge status-${row.badge}">${row.value}</span>`
            : `<b>${row.value}</b>`;

        return `
            <div class="booking-modal-row">
                <span>${row.label}</span>
                ${valueHtml}
            </div>
        `;
    }).join("");

    document.getElementById("detailModalBackdrop").hidden = false;
}

function closeDetailModal() {
    const backdrop = document.getElementById("detailModalBackdrop");
    if (backdrop) backdrop.hidden = true;
}
