const TRIP_API =
  "http://localhost:5000/api/operator-trips";

const BUS_API =
  "http://localhost:5000/api/operator-buses";


const token =
  localStorage.getItem(
    "operatorToken"
  );


if (!token) {

  window.location.href =
    "operator-login.html";

}


const tripTableBody =
  document.getElementById(
    "tripTableBody"
  );

const tripModal =
  document.getElementById(
    "tripModal"
  );

const tripForm =
  document.getElementById(
    "tripForm"
  );

const editTripId =
  document.getElementById(
    "editTripId"
  );

const busSelect =
  document.getElementById(
    "busId"
  );

const modalTitle =
  document.getElementById(
    "modalTitle"
  );


function headers() {

  return {
    "Content-Type":
      "application/json",

    Authorization:
      `Bearer ${token}`,
  };

}


// =======================================
// LOAD OPERATOR BUSES
// =======================================

async function loadBuses() {

  try {

    const response =
      await fetch(
        BUS_API,
        {
          headers:
            headers(),
        }
      );


    const data =
      await response.json();


    if (!data.success) {
      return;
    }


    busSelect.innerHTML =
      `<option value="">
        Select a bus
      </option>`;


    data.buses.forEach(
      (bus) => {

        const option =
          document.createElement(
            "option"
          );


        option.value =
          bus._id;


        option.textContent =
          `${bus.busNo} - ${bus.regNo}`;


        option.dataset.from =
          bus.from || "";


        option.dataset.to =
          bus.to || "";


        option.dataset.depart =
          bus.depart || "";


        option.dataset.arrive =
          bus.arrive || "";


        busSelect.appendChild(
          option
        );

      }
    );

  } catch (error) {

    console.error(
      "Load buses error:",
      error
    );

  }

}


// Auto fill bus route/time

busSelect.addEventListener(
  "change",
  () => {

    const option =
      busSelect.options[
        busSelect.selectedIndex
      ];


    if (!option?.value) {
      return;
    }


    document.getElementById(
      "from"
    ).value =
      option.dataset.from || "";


    document.getElementById(
      "to"
    ).value =
      option.dataset.to || "";


    document.getElementById(
      "departureTime"
    ).value =
      option.dataset.depart || "";


    document.getElementById(
      "arrivalTime"
    ).value =
      option.dataset.arrive || "";

  }
);


// =======================================
// LOAD TRIPS
// =======================================

async function loadTrips() {

  try {

    const response =
      await fetch(
        TRIP_API,
        {
          headers:
            headers(),
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

      window.location.href =
        "operator-login.html";

      return;
    }


    if (!data.success) {

      throw new Error(
        data.message
      );
    }


    renderTrips(
      data.trips || []
    );


  } catch (error) {

    console.error(
      "Load trips error:",
      error
    );


    tripTableBody.innerHTML = `
      <tr>
        <td
          colspan="8"
          class="empty-row"
        >
          Could not load trips.
        </td>
      </tr>
    `;

  }

}


// =======================================
// RENDER
// =======================================

function renderTrips(trips) {

  document.getElementById(
    "totalTrips"
  ).textContent =
    trips.length;


  const activeCount =
    trips.filter(
      (trip) =>
        trip.status === "Active"
    ).length;


  document.getElementById(
    "activeTrips"
  ).textContent =
    activeCount;


  if (
    trips.length === 0
  ) {

    tripTableBody.innerHTML = `
      <tr>

        <td
          colspan="8"
          class="empty-row"
        >
          No trips created yet.
        </td>

      </tr>
    `;

    return;
  }


  tripTableBody.innerHTML =
    trips
      .map(
        (trip) => {

          const bus =
            trip.busId || {};


          return `
            <tr>

              <td>
                ${escapeHtml(
                  trip.journeyDate
                )}
              </td>

              <td>
                <strong>
                  ${escapeHtml(
                    bus.busNo || "-"
                  )}
                </strong>

                <br>

                ${escapeHtml(
                  bus.regNo || ""
                )}
              </td>

              <td>
                ${escapeHtml(
                  trip.from
                )}

                →

                ${escapeHtml(
                  trip.to
                )}
              </td>

              <td>
                ${escapeHtml(
                  trip.departureTime
                )}
              </td>

              <td>
                ${escapeHtml(
                  trip.arrivalTime
                )}
              </td>

              <td>
                Rs.
                ${Number(
                  trip.fare || 0
                ).toLocaleString()}
              </td>

              <td>

                <span class="status ${
                  String(
                    trip.status
                  ).toLowerCase()
                }">

                  ${escapeHtml(
                    trip.status
                  )}

                </span>

              </td>

              <td>

                <button
                  class="action-btn edit-btn"
                  onclick="editTrip('${trip._id}')"
                >

                  <i class="fa-solid fa-pen"></i>

                </button>


                <button
                  class="action-btn delete-btn"
                  onclick="deleteTrip('${trip._id}')"
                >

                  <i class="fa-solid fa-trash"></i>

                </button>

              </td>

            </tr>
          `;

        }
      )
      .join("");

}


// =======================================
// OPEN CREATE
// =======================================

document
  .getElementById(
    "openTripBtn"
  )
  .addEventListener(
    "click",
    () => {

      tripForm.reset();

      editTripId.value = "";

      modalTitle.textContent =
        "Create Trip";


      document.getElementById(
        "statusGroup"
      ).style.display =
        "none";


      const today =
        new Date()
          .toISOString()
          .split("T")[0];


      document.getElementById(
        "journeyDate"
      ).min =
        today;


      tripModal.classList.add(
        "show"
      );

    }
  );


// =======================================
// CLOSE
// =======================================

function closeModal() {

  tripModal.classList.remove(
    "show"
  );

  tripForm.reset();

  editTripId.value = "";

}


document
  .getElementById(
    "closeModalBtn"
  )
  .addEventListener(
    "click",
    closeModal
  );


document
  .getElementById(
    "cancelBtn"
  )
  .addEventListener(
    "click",
    closeModal
  );


// =======================================
// SAVE TRIP
// =======================================

tripForm.addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();


    const id =
      editTripId.value;


    const tripData = {

      busId:
        busSelect.value,

      journeyDate:
        document
          .getElementById(
            "journeyDate"
          )
          .value,

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

      departureTime:
        document
          .getElementById(
            "departureTime"
          )
          .value,

      arrivalTime:
        document
          .getElementById(
            "arrivalTime"
          )
          .value,

      fare:
        Number(
          document
            .getElementById(
              "fare"
            )
            .value
        ),
    };


    if (id) {

      tripData.status =
        document
          .getElementById(
            "status"
          )
          .value;

    }


    try {

      const response =
        await fetch(
          id
            ? `${TRIP_API}/${id}`
            : TRIP_API,
          {
            method:
              id
                ? "PUT"
                : "POST",

            headers:
              headers(),

            body:
              JSON.stringify(
                tripData
              ),
          }
        );


      const data =
        await response.json();


      if (!data.success) {

        showToast(
          data.error ||
          data.message ||
          "Failed to save trip",
          "error"
        );

        return;
      }


      showToast(
        id
          ? "Trip updated successfully"
          : "Trip created successfully",
        "success"
      );


      closeModal();

      await loadTrips();


    } catch (error) {

      console.error(
        "Save trip error:",
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
// EDIT TRIP
// =======================================

async function editTrip(id) {

  try {

    const response =
      await fetch(
        `${TRIP_API}/${id}`,
        {
          headers:
            headers(),
        }
      );


    const data =
      await response.json();


    if (!data.success) {

      showToast(
        data.message,
        "error"
      );

      return;
    }


    const trip =
      data.trip;


    editTripId.value =
      trip._id;


    busSelect.value =
      trip.busId?._id ||
      trip.busId;


    document.getElementById(
      "journeyDate"
    ).value =
      trip.journeyDate;


    document.getElementById(
      "from"
    ).value =
      trip.from;


    document.getElementById(
      "to"
    ).value =
      trip.to;


    document.getElementById(
      "departureTime"
    ).value =
      trip.departureTime;


    document.getElementById(
      "arrivalTime"
    ).value =
      trip.arrivalTime;


    document.getElementById(
      "fare"
    ).value =
      trip.fare;


    document.getElementById(
      "status"
    ).value =
      trip.status;


    document.getElementById(
      "statusGroup"
    ).style.display =
      "block";


    modalTitle.textContent =
      "Edit Trip";


    tripModal.classList.add(
      "show"
    );


  } catch (error) {

    console.error(error);


    showToast(
      "Failed to load trip",
      "error"
    );

  }

}


// =======================================
// DELETE
// =======================================

async function deleteTrip(id) {

  const confirmed =
    confirm(
      "Are you sure you want to delete this trip?"
    );


  if (!confirmed) {
    return;
  }


  try {

    const response =
      await fetch(
        `${TRIP_API}/${id}`,
        {
          method:
            "DELETE",

          headers:
            headers(),
        }
      );


    const data =
      await response.json();


    if (!data.success) {

      showToast(
        data.message,
        "error"
      );

      return;
    }


    showToast(
      "Trip deleted successfully",
      "success"
    );


    await loadTrips();


  } catch (error) {

    console.error(error);


    showToast(
      "Could not delete trip",
      "error"
    );

  }

}


// =======================================
// SAFE HTML
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

async function start() {

  await loadBuses();

  await loadTrips();

}


start();