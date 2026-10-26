
/* =========================================
   RAJABUS - OPERATOR BUS MANAGEMENT
   Dynamic Seat Capacity: 52 / 54 / 56
   ========================================= */

const API_URL = "http://localhost:5000/api/operator-buses";

const token = localStorage.getItem("operatorToken");

if (!token) {
  window.location.href = "operator-login.html";
}

// =======================================
// DOM ELEMENTS
// =======================================

const busContainer = document.getElementById("busContainer");
const busCount = document.getElementById("busCount");
const busModal = document.getElementById("busModal");
const busForm = document.getElementById("busForm");
const modalTitle = document.getElementById("modalTitle");
const editBusId = document.getElementById("editBusId");
const openAddBusBtn = document.getElementById("openAddBusBtn");
const closeModalBtn = document.getElementById("closeModalBtn");
const cancelBtn = document.getElementById("cancelBtn");
const capacitySelect = document.getElementById("totalSeats");
const saveBusBtn = document.getElementById("saveBusBtn");

// =======================================
// AUTH HEADERS
// =======================================

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

function checkSession(response) {
  if (response.status === 401 || response.status === 403) {
    localStorage.removeItem("operatorToken");
    localStorage.removeItem("operatorData");
    window.location.href = "operator-login.html";
    return false;
  }

  return true;
}

// =======================================
// DYNAMIC SEAT CAPACITY HELPERS
// =======================================

// Remove temporary option for older buses.
function removeLegacyCapacityOption() {
  capacitySelect
    .querySelectorAll('option[data-legacy="true"]')
    .forEach((option) => option.remove());
}

// Display capacity correctly in Add/Edit form.
function setCapacityInForm(value) {
  removeLegacyCapacityOption();

  const seats = Number(value ?? 54);
  const selectedValue = String(seats);

  const optionExists = [...capacitySelect.options].some(
    (option) => option.value === selectedValue
  );

  // Preserve existing buses with 40 or
  // another previously saved capacity.
  if (
    !optionExists &&
    Number.isInteger(seats) &&
    seats > 0
  ) {
    const legacyOption = document.createElement("option");

    legacyOption.value = selectedValue;
    legacyOption.textContent =
      `${seats} Seats (Existing Bus)`;

    legacyOption.dataset.legacy = "true";

    capacitySelect.appendChild(legacyOption);
  }

  capacitySelect.value = selectedValue;
}

// =======================================
// OPEN ADD BUS MODAL
// =======================================

function openAddModal() {
  busForm.reset();

  editBusId.value = "";

  removeLegacyCapacityOption();

  // Default capacity for a new bus.
  // Operator may select 52 or 56.
  setCapacityInForm(54);

  modalTitle.textContent = "Add New Bus";

  busModal.classList.add("show");
}

openAddBusBtn.addEventListener(
  "click",
  openAddModal
);

// =======================================
// CLOSE MODAL
// =======================================

function closeModal() {
  busModal.classList.remove("show");

  busForm.reset();

  editBusId.value = "";

  removeLegacyCapacityOption();
}

closeModalBtn.addEventListener("click", closeModal);

cancelBtn.addEventListener("click", closeModal);

busModal.addEventListener("click", (event) => {
  if (event.target === busModal) {
    closeModal();
  }
});

// Close modal when Escape key is pressed.
document.addEventListener("keydown", (event) => {
  if (
    event.key === "Escape" &&
    busModal.classList.contains("show")
  ) {
    closeModal();
  }
});

// =======================================
// LOAD OPERATOR BUSES
// =======================================

async function loadBuses() {
  try {
    const response = await fetch(API_URL, {
      headers: authHeaders(),
    });

    if (!checkSession(response)) return;

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || "Could not load buses"
      );
    }

    renderBuses(data.buses || []);

  } catch (error) {
    console.error("Load buses error:", error);

    busContainer.innerHTML = `
      <div class="empty">
        Could not load buses.
      </div>
    `;
  }
}

// =======================================
// RENDER BUS CARDS
// =======================================

function renderBuses(buses) {
  busCount.textContent = buses.length;

  if (buses.length === 0) {
    busContainer.innerHTML = `
      <div class="empty">
        <i class="fa-solid fa-bus"></i>
        <br><br>
        No buses added yet.
        <br>
        Click <strong>Add New Bus</strong>
        to register your first bus.
      </div>
    `;

    return;
  }

  busContainer.innerHTML = buses.map((bus) => {
    const seats = Number(bus.totalSeats ?? 54);

    const capacity =
      Number.isInteger(seats) && seats > 0
        ? seats
        : "—";

    const id = escapeHtml(bus._id);

    return `
      <article class="bus-card">

        <div class="bus-card-header">

          <div class="bus-card-icon">
            <i class="fa-solid fa-bus"></i>
          </div>

          <div>
            <h3>${escapeHtml(bus.busNo)}</h3>

            <div class="reg-no">
              ${escapeHtml(bus.regNo)}
            </div>

            <span class="type-badge">
              ${escapeHtml(bus.type)}
            </span>
          </div>

        </div>

        <div class="bus-details">

          <div>
            Total Seats
            <strong>${capacity}</strong>
          </div>

          <div>
            Journey Schedule
            <strong>Manage in Trips</strong>
          </div>

        </div>

        <div class="bus-actions">

          <button
            type="button"
            class="edit-btn"
            data-action="edit"
            data-id="${id}"
          >
            <i class="fa-solid fa-pen"></i>
            Edit
          </button>

          <button
            type="button"
            class="delete-btn"
            data-action="delete"
            data-id="${id}"
          >
            <i class="fa-solid fa-trash"></i>
            Delete
          </button>

        </div>

      </article>
    `;
  }).join("");
}

// =======================================
// BUS CARD BUTTON HANDLING
// =======================================

busContainer.addEventListener("click", (event) => {
  const button = event.target.closest(
    "button[data-action][data-id]"
  );

  if (!button || !busContainer.contains(button)) {
    return;
  }

  const id = button.dataset.id;

  if (button.dataset.action === "edit") {
    editBus(id);
  }

  if (button.dataset.action === "delete") {
    deleteBus(id);
  }
});

// =======================================
// ADD / UPDATE BUS
// =======================================

busForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const id = editBusId.value;

  const busData = {
    busNo: document.getElementById("busNo").value.trim(),

    regNo: document.getElementById("regNo").value.trim(),

    type: document.getElementById("type").value,

    totalSeats: Number(capacitySelect.value),
  };

  // Validate selected capacity.
  if (
    !Number.isInteger(busData.totalSeats) ||
    busData.totalSeats <= 0
  ) {
    showToast("Select a valid bus capacity", "error");
    return;
  }

  // Prevent duplicate form submissions.
  saveBusBtn.disabled = true;

  const originalButtonContent = saveBusBtn.innerHTML;

  saveBusBtn.textContent = "Saving...";

  try {
    const response = await fetch(
      id ? `${API_URL}/${id}` : API_URL,
      {
        method: id ? "PUT" : "POST",

        headers: authHeaders(),

        body: JSON.stringify(busData),
      }
    );

    if (!checkSession(response)) return;

    const data = await response.json();

    if (!response.ok || !data.success) {
      showToast(
        data.message || "Could not save bus",
        "error"
      );
      return;
    }

    showToast(
      id
        ? "Bus updated successfully"
        : "Bus added successfully",
      "success"
    );

    closeModal();

    await loadBuses();

  } catch (error) {
    console.error("Save bus error:", error);

    showToast(
      "Could not connect to server",
      "error"
    );

  } finally {
    saveBusBtn.disabled = false;
    saveBusBtn.innerHTML = originalButtonContent;
  }
});

// =======================================
// EDIT BUS
// =======================================

async function editBus(id) {
  try {
    const response = await fetch(`${API_URL}/${id}`, {
      headers: authHeaders(),
    });

    if (!checkSession(response)) return;

    const data = await response.json();

    if (!response.ok || !data.success || !data.bus) {
      showToast(
        data.message || "Could not load bus",
        "error"
      );
      return;
    }

    const bus = data.bus;

    busForm.reset();

    editBusId.value = bus._id;

    // Bus number
    document.getElementById("busNo").value =
      bus.busNo || "";

    // Registration number
    document.getElementById("regNo").value =
      bus.regNo || "";

    // Bus type
    document.getElementById("type").value =
      bus.type || "";

    // Dynamic capacity with legacy support
    setCapacityInForm(bus.totalSeats ?? 54);

    // Set correct modal title and open it.
    modalTitle.textContent = "Edit Bus";

    busModal.classList.add("show");

  } catch (error) {
    console.error("Edit bus error:", error);

    showToast(
      "Failed to load bus",
      "error"
    );
  }
}

// =======================================
// DELETE BUS
// =======================================

async function deleteBus(id) {
  const confirmed = window.confirm(
    "Are you sure you want to delete this bus?"
  );

  if (!confirmed) {
    return;
  }

  try {
    const response = await fetch(
      `${API_URL}/${id}`,
      {
        method: "DELETE",
        headers: authHeaders(),
      }
    );

    if (!checkSession(response)) return;

    const data = await response.json();

    if (!response.ok || !data.success) {
      showToast(
        data.message || "Could not delete bus",
        "error"
      );
      return;
    }

    showToast(
      "Bus deleted successfully",
      "success"
    );

    await loadBuses();

  } catch (error) {
    console.error("Delete bus error:", error);

    showToast(
      "Could not connect to server",
      "error"
    );
  }
}

// =======================================
// XSS SAFE DISPLAY
// =======================================

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// =======================================
// LOGOUT
// =======================================

document
  .getElementById("logoutBtn")
  .addEventListener("click", () => {
    localStorage.removeItem("operatorToken");
    localStorage.removeItem("operatorData");

    window.location.href = "operator-login.html";
  });

// =======================================
// INITIAL LOAD
// =======================================

loadBuses();
