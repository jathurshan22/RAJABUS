// API_BASE is already declared in seat.js,
// which loads before this file on result.html


// ==================================================
// SEARCH PARAMETERS
// ==================================================

const params =
  new URLSearchParams(
    window.location.search
  );


// User currently selects destination only.
// Starting point is fixed as Mihintale.
const fromLocation =
  "Mihintale";

const district =
  params.get("district") || "";

const travelDate =
  params.get("date") || "";

const busType =
  params.get("bus") || "";


// ==================================================
// SEARCH SUMMARY
// ==================================================

document.getElementById(
  "districtName"
).textContent =
  district || "-";


document.getElementById(
  "travelDate"
).textContent =
  travelDate || "-";


document.getElementById(
  "busType"
).textContent =
  busType || "Any";


const resultsSection =
  document.getElementById(
    "resultsSection"
  );


// ==================================================
// ESCAPE HTML
// ==================================================

function escapeHtml(value) {

  return String(
    value ?? ""
  ).replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      }[character])
  );
}


// ==================================================
// FORMAT DATE
// ==================================================

function formatDate(dateString) {

  if (!dateString) {
    return "-";
  }

  const date =
    new Date(
      `${dateString}T00:00:00`
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return dateString;
  }


  return date.toLocaleDateString(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}


// ==================================================
// FORMAT FARE
// ==================================================

function formatFare(value) {

  const fare =
    Number(value);


  if (
    Number.isNaN(fare)
  ) {
    return "0";
  }


  return fare.toLocaleString(
    "en-LK"
  );
}


// ==================================================
// BUILD TRIP CARD
// ==================================================

function busCardHtml(bus) {

  // Public Trip API currently may not return
  // availableSeats.
  // Keep compatibility if added later.
  const seatCount =
    bus.availableSeats ??
    40;


  const low =
    seatCount <= 10
      ? " low"
      : "";


  return `
    <div class="bus-card">

      <div class="card-top">

        <div>

          <h2>

            ${escapeHtml(
              bus.from
            )}

            <i class="fa-solid fa-arrow-right-long"></i>

            ${escapeHtml(
              bus.to
            )}

          </h2>


          <p>

            Bus No:

            <b>
              ${escapeHtml(
                bus.busNo
              )}
            </b>

            &middot;

            ${escapeHtml(
              bus.type
            )}

            ${
              bus.regNo
                ? `
                  &middot;
                  ${escapeHtml(
                    bus.regNo
                  )}
                `
                : ""
            }

          </p>

        </div>


        <span class="seat-badge${low}">

          ${
            seatCount <= 0
              ? "Fully Booked"
              : `${seatCount} Seats`
          }

        </span>

      </div>



      <div class="bus-info">


        <div>

          <i class="fa-regular fa-clock"></i>

          <span>
            Departure
          </span>

          <b>
            ${escapeHtml(
              bus.depart
            )}
          </b>

        </div>


        <div>

          <i class="fa-solid fa-clock"></i>

          <span>
            Arrival
          </span>

          <b>
            ${escapeHtml(
              bus.arrive
            )}
          </b>

        </div>


        <div>

          <i class="fa-regular fa-calendar"></i>

          <span>
            Journey Date
          </span>

          <b>
            ${escapeHtml(
              formatDate(
                bus.journeyDate
              )
            )}
          </b>

        </div>


        <div>

          <i class="fa-solid fa-ticket"></i>

          <span>
            Fare
          </span>

          <b>
            Rs.
            ${formatFare(
              bus.fare
            )}
          </b>

        </div>

      </div>



      <button
        class="book-btn"

        data-trip-id="${escapeHtml(
          bus.tripId
        )}"

        data-bus-id="${escapeHtml(
          bus.id ||
          bus.busId ||
          bus._id
        )}"

        data-bus-no="${escapeHtml(
          bus.busNo
        )}"

        data-reg-no="${escapeHtml(
          bus.regNo
        )}"

        data-type="${escapeHtml(
          bus.type
        )}"

        data-from="${escapeHtml(
          bus.from
        )}"

        data-to="${escapeHtml(
          bus.to
        )}"

        data-depart="${escapeHtml(
          bus.depart
        )}"

        data-arrive="${escapeHtml(
          bus.arrive
        )}"

        data-fare="${Number(
          bus.fare || 0
        )}"

        data-date="${escapeHtml(
          bus.journeyDate ||
          travelDate
        )}"

        ${
          seatCount <= 0
            ? "disabled"
            : ""
        }
      >

        ${
          seatCount <= 0
            ? "Fully Booked"
            : "Book Now"
        }

      </button>

    </div>
  `;
}


// ==================================================
// BUS TYPE FILTER
// ==================================================

function filterTripsByType(
  trips
) {

  if (
    !busType ||
    String(
      busType
    ).toLowerCase() ===
      "any"
  ) {

    return trips;
  }


  return trips.filter(
    (trip) =>

      String(
        trip.type || ""
      )
        .trim()
        .toLowerCase() ===

      String(
        busType
      )
        .trim()
        .toLowerCase()
  );
}


// ==================================================
// LOAD TRIPS
// ==================================================

async function loadBuses() {


  // ----------------------------------------------
  // DESTINATION VALIDATION
  // ----------------------------------------------

  if (!district) {

    resultsSection.innerHTML = `
      <p>
        Please go back and choose a destination district.
      </p>
    `;

    return;
  }


  // ----------------------------------------------
  // DATE VALIDATION
  // ----------------------------------------------

  if (!travelDate) {

    resultsSection.innerHTML = `
      <p>
        Please go back and choose a travel date.
      </p>
    `;

    return;
  }


  try {

    resultsSection.innerHTML = `
      <p>
        Searching available trips...
      </p>
    `;


    // ==================================================
    // BUILD TRIP SEARCH QUERY
    // ==================================================

    const qs =
      new URLSearchParams({

        from:
          fromLocation,

        to:
          district,

        date:
          travelDate,
      });


    const url =
      `${API_BASE}/trips/search?${qs.toString()}`;


    console.log(
      "Trip Search URL:",
      url
    );


    // ==================================================
    // FETCH TRIPS
    // ==================================================

    const res =
      await fetch(
        url
      );


    const data =
      await res.json();


    console.log(
      "Trip Search Data:",
      data
    );


    // ==================================================
    // BACKEND ERROR
    // ==================================================

    if (
      !res.ok ||
      !data.success
    ) {

      resultsSection.innerHTML = `
        <p>
          ${
            escapeHtml(
              data.message
            ) ||
            "Could not search trips."
          }
        </p>
      `;

      return;
    }


    // ==================================================
    // GET TRIPS
    // ==================================================

    let trips =
      Array.isArray(
        data.trips
      )
        ? data.trips
        : [];


    // ==================================================
    // OPTIONAL BUS TYPE FILTER
    // ==================================================

    trips =
      filterTripsByType(
        trips
      );


    // ==================================================
    // NO TRIPS
    // ==================================================

    if (
      trips.length === 0
    ) {

      resultsSection.innerHTML = `
        <p>
          No scheduled buses found for
          ${escapeHtml(
            fromLocation
          )}
          →
          ${escapeHtml(
            district
          )}
          on
          ${escapeHtml(
            travelDate
          )}.
        </p>
      `;

      return;
    }


    // ==================================================
    // SHOW TRIP CARDS
    // ==================================================

    resultsSection.innerHTML =
      trips
        .map(
          busCardHtml
        )
        .join("");


    // ==================================================
    // BOOK NOW BUTTONS
    // ==================================================

    document
      .querySelectorAll(
        ".book-btn"
      )
      .forEach(
        (btn) => {

          btn.addEventListener(
            "click",
            () => {


              // ========================================
              // BUILD SELECTED TRIP/BUS OBJECT
              // ========================================

              const bus = {

                tripId:
                  btn.dataset.tripId,

                id:
                  btn.dataset.busId,

                busId:
                  btn.dataset.busId,

                busNo:
                  btn.dataset.busNo,

                regNo:
                  btn.dataset.regNo,

                type:
                  btn.dataset.type,

                from:
                  btn.dataset.from,

                to:
                  btn.dataset.to,

                depart:
                  btn.dataset.depart,

                arrive:
                  btn.dataset.arrive,

                fare:
                  Number(
                    btn.dataset.fare
                  ),

                journeyDate:
                  btn.dataset.date,
              };


              console.log(
                "Selected Trip:",
                bus
              );


              console.log(
                "Trip ID:",
                bus.tripId
              );


              console.log(
                "Bus ID:",
                bus.id
              );


              console.log(
                "Travel Date:",
                bus.journeyDate
              );


              // ========================================
              // SAVE SELECTED TRIP
              // ========================================

              localStorage.setItem(
                "selectedBus",
                JSON.stringify(
                  bus
                )
              );


              // Save trip separately too
              localStorage.setItem(
                "selectedTrip",
                JSON.stringify(
                  bus
                )
              );


              // ========================================
              // SAVE DATE
              // ========================================

              localStorage.setItem(
                "travelDate",
                bus.journeyDate
              );


              // ========================================
              // OPEN EXISTING SEAT MODAL
              // ========================================

              if (
                typeof
                  window
                    .openSeatModal ===
                "function"
              ) {

                window.openSeatModal(
                  bus,
                  bus.journeyDate
                );

              } else {

                if (
                  typeof showToast ===
                  "function"
                ) {

                  showToast(
                    "Seat selection file not loaded",
                    "error"
                  );

                } else {

                  alert(
                    "Seat selection file not loaded"
                  );

                }

              }

            }
          );

        }
      );


  } catch (error) {

    console.error(
      "Trip search error:",
      error
    );


    resultsSection.innerHTML = `
      <p>
        Could not reach the booking server.
        Please make sure backend is running.
      </p>
    `;

  }

}


// ==================================================
// START
// ==================================================

loadBuses();