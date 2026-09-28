const API_URL =
  "http://localhost:5000/api/operator-buses";


const token =
  localStorage.getItem(
    "operatorToken"
  );


if (!token) {

  window.location.href =
    "operator-login.html";

}


const busContainer =
  document.getElementById(
    "busContainer"
  );

const busCount =
  document.getElementById(
    "busCount"
  );

const busModal =
  document.getElementById(
    "busModal"
  );

const busForm =
  document.getElementById(
    "busForm"
  );

const modalTitle =
  document.getElementById(
    "modalTitle"
  );

const editBusId =
  document.getElementById(
    "editBusId"
  );

const openAddBusBtn =
  document.getElementById(
    "openAddBusBtn"
  );

const closeModalBtn =
  document.getElementById(
    "closeModalBtn"
  );

const cancelBtn =
  document.getElementById(
    "cancelBtn"
  );


// =======================================
// AUTH HEADER
// =======================================

function authHeaders() {

  return {
    "Content-Type":
      "application/json",

    Authorization:
      `Bearer ${token}`,
  };
}


// =======================================
// OPEN ADD MODAL
// =======================================

openAddBusBtn.addEventListener(
  "click",
  () => {

    busForm.reset();

    editBusId.value = "";

    modalTitle.textContent =
      "Add New Bus";

    busModal.classList.add(
      "show"
    );

  }
);


// =======================================
// CLOSE MODAL
// =======================================

function closeModal() {

  busModal.classList.remove(
    "show"
  );

  busForm.reset();

  editBusId.value = "";

}


closeModalBtn.addEventListener(
  "click",
  closeModal
);


cancelBtn.addEventListener(
  "click",
  closeModal
);


busModal.addEventListener(
  "click",
  (event) => {

    if (
      event.target === busModal
    ) {
      closeModal();
    }

  }
);


// =======================================
// LOAD BUSES
// =======================================

async function loadBuses() {

  try {

    const response =
      await fetch(
        API_URL,
        {
          headers:
            authHeaders(),
        }
      );


    const data =
      await response.json();


    if (
      response.status === 401 ||
      response.status === 403
    ) {

      localStorage.removeItem(
        "operatorToken"
      );

      localStorage.removeItem(
        "operatorData"
      );

      window.location.href =
        "operator-login.html";

      return;
    }


    if (!data.success) {

      throw new Error(
        data.message ||
        "Could not load buses"
      );
    }


    renderBuses(
      data.buses || []
    );


  } catch (error) {

    console.error(
      "Load buses error:",
      error
    );


    busContainer.innerHTML = `
      <div class="empty">
        Could not load buses.
      </div>
    `;

  }
}


// =======================================
// RENDER BUSES
// =======================================

function renderBuses(buses) {

  busCount.textContent =
    buses.length;


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


  busContainer.innerHTML =
    buses
      .map(
        (bus) => {

          return `
            <article class="bus-card">

              <div class="bus-card-header">

                <div>

                  <div class="bus-card-icon">
                    <i class="fa-solid fa-bus"></i>
                  </div>

                </div>


                <div>

                  <h3>
                    ${escapeHtml(
                      bus.busNo
                    )}
                  </h3>

                  <div class="reg-no">
                    ${escapeHtml(
                      bus.regNo
                    )}
                  </div>

                  <span class="type-badge">
                    ${escapeHtml(
                      bus.type
                    )}
                  </span>

                </div>

              </div>


              <div class="route">

                ${escapeHtml(
                  bus.from
                )}

                <i class="fa-solid fa-arrow-right"></i>

                ${escapeHtml(
                  bus.to
                )}

              </div>


              <div class="bus-details">

                <div>
                  Departure
                  <strong>
                    ${escapeHtml(
                      bus.depart
                    )}
                  </strong>
                </div>


                <div>
                  Arrival
                  <strong>
                    ${escapeHtml(
                      bus.arrive
                    )}
                  </strong>
                </div>


                <div>
                  Distance
                  <strong>
                    ${Number(
                      bus.distanceKm || 0
                    )} KM
                  </strong>
                </div>


                <div>
                  Fare
                  <strong>
                    Rs.
                    ${Number(
                      bus.fareMin || 0
                    )}
                    -
                    ${Number(
                      bus.fareMax || 0
                    )}
                  </strong>
                </div>

              </div>


              <div class="bus-actions">

                <button
                  class="edit-btn"
                  onclick="editBus('${bus._id}')"
                >
                  <i class="fa-solid fa-pen"></i>
                  Edit
                </button>


                <button
                  class="delete-btn"
                  onclick="deleteBus('${bus._id}')"
                >
                  <i class="fa-solid fa-trash"></i>
                  Delete
                </button>

              </div>

            </article>
          `;

        }
      )
      .join("");
}


// =======================================
// ADD / UPDATE BUS
// =======================================

busForm.addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();


    const id =
      editBusId.value;


    const busData = {

      busNo:
        document
          .getElementById(
            "busNo"
          )
          .value
          .trim(),

      regNo:
        document
          .getElementById(
            "regNo"
          )
          .value
          .trim(),

      from:
        document
          .getElementById(
            "from"
          )
          .value
          .trim(),

      to:
        document
          .getElementById(
            "to"
          )
          .value
          .trim(),

      type:
        document
          .getElementById(
            "type"
          )
          .value,

      depart:
        document
          .getElementById(
            "depart"
          )
          .value,

      arrive:
        document
          .getElementById(
            "arrive"
          )
          .value,

      distanceKm:
        Number(
          document
            .getElementById(
              "distanceKm"
            )
            .value
        ),

      fareMin:
        Number(
          document
            .getElementById(
              "fareMin"
            )
            .value
        ),

      fareMax:
        Number(
          document
            .getElementById(
              "fareMax"
            )
            .value
        ),
    };


    try {

      const response =
        await fetch(
          id
            ? `${API_URL}/${id}`
            : API_URL,
          {
            method:
              id
                ? "PUT"
                : "POST",

            headers:
              authHeaders(),

            body:
              JSON.stringify(
                busData
              ),
          }
        );


      const data =
        await response.json();


      if (!data.success) {

        showToast(
          data.message ||
          "Could not save bus",
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

      console.error(
        "Save bus error:",
        error
      );


      showToast(
        "Could not connect to server",
        "error"
      );
    }

  }
);


// =======================================
// EDIT BUS
// =======================================

async function editBus(id) {

  try {

    const response =
      await fetch(
        `${API_URL}/${id}`,
        {
          headers:
            authHeaders(),
        }
      );


    const data =
      await response.json();


    if (!data.success) {

      showToast(
        data.message ||
        "Could not load bus",
        "error"
      );

      return;
    }


    const bus =
      data.bus;


    editBusId.value =
      bus._id;


    document.getElementById(
      "busNo"
    ).value =
      bus.busNo || "";


    document.getElementById(
      "regNo"
    ).value =
      bus.regNo || "";


    document.getElementById(
      "from"
    ).value =
      bus.from || "";


    document.getElementById(
      "to"
    ).value =
      bus.to || "";


    document.getElementById(
      "type"
    ).value =
      bus.type || "";


    document.getElementById(
      "depart"
    ).value =
      bus.depart || "";


    document.getElementById(
      "arrive"
    ).value =
      bus.arrive || "";


    document.getElementById(
      "distanceKm"
    ).value =
      bus.distanceKm || "";


    document.getElementById(
      "fareMin"
    ).value =
      bus.fareMin || "";


    document.getElementById(
      "fareMax"
    ).value =
      bus.fareMax || "";


    modalTitle.textContent =
      "Edit Bus";


    busModal.classList.add(
      "show"
    );


  } catch (error) {

    console.error(error);

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

  const confirmed =
    window.confirm(
      "Are you sure you want to delete this bus?"
    );


  if (!confirmed) {
    return;
  }


  try {

    const response =
      await fetch(
        `${API_URL}/${id}`,
        {
          method: "DELETE",

          headers:
            authHeaders(),
        }
      );


    const data =
      await response.json();


    if (!data.success) {

      showToast(
        data.message ||
        "Could not delete bus",
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

    console.error(error);


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

  return String(
    value ?? ""
  )
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}


// =======================================
// LOGOUT
// =======================================

document
  .getElementById(
    "logoutBtn"
  )
  .addEventListener(
    "click",
    () => {

      localStorage.removeItem(
        "operatorToken"
      );

      localStorage.removeItem(
        "operatorData"
      );

      window.location.href =
        "operator-login.html";

    }
  );


// =======================================
// START
// =======================================

loadBuses();