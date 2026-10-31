
/* ============================================
   RAJABUS OPERATOR PORTAL
   DAILY BUS-WISE BOOKINGS + PASSENGER PDF
============================================ */

document.addEventListener("DOMContentLoaded", () => {

  const API =
    "http://localhost:5000/api/operators/daily-bookings";

  const $ = (id) => document.getElementById(id);

  const ui = {
    date: $("bookingDateFilter"),
    search: $("bookingSearch"),
    status: $("bookingStatusFilter"),
    reset: $("resetBookingFiltersBtn"),
    refresh: $("refreshBookingsBtn"),
    logout: $("logoutBtn"),

    groups: $("busGroups"),
    message: $("bookingsMessage"),
    dateLabel: $("selectedDateLabel"),
    footer: $("bookingPageInfo"),

    modal: $("bookingDetailsModal"),
    details: $("bookingDetailsContent"),
    close: $("closeBookingDetailsBtn"),
    closeFooter: $("closeBookingDetailsFooterBtn")
  };

  if (!ui.date || !ui.groups || !ui.modal) {
    console.error(
      "Daily bookings page: required HTML elements are missing."
    );
    return;
  }

  let dailyData = null;
  let controller = null;
  let lastFocus = null;

  // =========================================
  // AUTHENTICATION
  // =========================================

  function getToken() {
    return localStorage.getItem("operatorToken");
  }

  function logout() {
    if (controller) {
      controller.abort();
    }

    localStorage.removeItem("operatorToken");
    localStorage.removeItem("operatorData");

    window.location.replace("operator-login.html");
  }

  if (!getToken()) {
    logout();
    return;
  }

  // =========================================
  // TODAY'S DATE IN SRI LANKA
  // =========================================

  function localToday() {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Colombo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date());

    const part = (kind) =>
      parts.find(
        (item) => item.type === kind
      )?.value || "";

    return (
      `${part("year")}-` +
      `${part("month")}-` +
      `${part("day")}`
    );
  }

  // =========================================
  // SAFE TEXT HELPERS
  // =========================================

  function fmt(value, fallback = "—") {
    const result = String(value ?? "").trim();
    return result || fallback;
  }

  function make(tag, className = "", content) {
    const el = document.createElement(tag);

    if (className) {
      el.className = className;
    }

    if (content !== undefined) {
      el.textContent = String(content);
    }

    return el;
  }

  function message(text, error = false) {
    ui.message.textContent = text || "";
    ui.message.hidden = !text;

    ui.message.classList.toggle(
      "error",
      error
    );
  }

  function empty(text) {
    ui.groups.replaceChildren(
      make("div", "ob-empty", text)
    );
  }

  function count(id, value) {
    const el = $(id);

    if (el) {
      el.textContent = String(value);
    }
  }

  function bookings(trip) {
    return Array.isArray(trip.bookings)
      ? trip.bookings
      : [];
  }

  function seats(booking) {
    return Array.isArray(booking.seats)
      ? booking.seats.map(String)
      : [];
  }

  function lower(value) {
    return String(value ?? "").toLowerCase();
  }

  // =========================================
  // JOURNEY DATE FORMATTING
  // =========================================

  function dateLabel(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return fmt(value);
    }

    const [year, month, day] =
      value.split("-").map(Number);

    return new Intl.DateTimeFormat("en-LK", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC"
    }).format(
      new Date(Date.UTC(year, month - 1, day))
    );
  }

  // =========================================
  // DAILY STATISTICS
  // =========================================

  function updateStats(data) {
    const buses = data?.buses || [];

    const allBookings = buses.flatMap(
      (bus) =>
        (bus.trips || []).flatMap(
          (trip) => bookings(trip)
        )
    );

    count(
      "assignedBusCount",
      buses.length
    );

    count(
      "dailyTripCount",
      buses.reduce(
        (sum, bus) =>
          sum + (bus.trips || []).length,
        0
      )
    );

    count(
      "totalBookings",
      allBookings.length
    );

    count(
      "paidBookings",
      allBookings.filter(
        (b) => b.status === "Paid"
      ).length
    );

    count(
      "pendingBookings",
      allBookings.filter(
        (b) => b.status === "Pending"
      ).length
    );

    count(
      "confirmedSeats",
      allBookings
        .filter(
          (b) => b.status === "Paid"
        )
        .reduce(
          (sum, b) =>
            sum + seats(b).length,
          0
        )
    );
  }

  // =========================================
  // AUTHENTICATED API REQUEST
  // =========================================

  async function authorizedFetch(url, signal) {
    const token = getToken();

    if (!token) {
      logout();
      throw new Error(
        "Operator login required"
      );
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`
      },
      cache: "no-store",
      signal
    });

    if (
      response.status === 401 ||
      response.status === 403
    ) {
      logout();

      throw new Error(
        "Operator session expired. Please log in again."
      );
    }

    return response;
  }

  // =========================================
  // PASSENGER FILTER HELPERS
  // =========================================

  function matchesSearch(value, query) {
    return lower(value).includes(query);
  }

  function matchingBookings(
    bus,
    trip,
    query,
    status
  ) {
    const busMatch = [
      bus.busNo,
      bus.regNo,
      bus.type
    ].some(
      (v) => matchesSearch(v, query)
    );

    const tripMatch = [
      trip.from,
      trip.to,
      trip.departureTime,
      trip.arrivalTime
    ].some(
      (v) => matchesSearch(v, query)
    );

    return bookings(trip).filter((b) => {
      if (
        status !== "All" &&
        b.status !== status
      ) {
        return false;
      }

      return (
        !query ||
        busMatch ||
        tripMatch ||
        [
          b.ticketId,
          b.passengerName,
          b.email,
          b.phoneNumber,
          ...seats(b)
        ].some(
          (v) => matchesSearch(v, query)
        )
      );
    });
  }

  // =========================================
  // TABLE CELL
  // =========================================

  function cell(row, value) {
    row.appendChild(
      make("td", "", fmt(value))
    );
  }

  // =========================================
  // PASSENGER TABLE ROW
  // =========================================

  function renderBookingRow(booking, bus, trip) {
    const row = make("tr");

    cell(row, booking.ticketId);
    cell(row, booking.passengerName);
    cell(row, booking.email);
    cell(row, booking.phoneNumber);

    cell(
      row,
      seats(booking).join(", ")
    );

    const statusCell = make("td");

    const badge = make(
      "span",
      `ob-badge ${lower(booking.status)}`,
      fmt(booking.status)
    );

    statusCell.appendChild(badge);
    row.appendChild(statusCell);

    const actionCell = make("td");

    const detailsBtn = make(
      "button",
      "ob-details-btn",
      "View Details"
    );

    detailsBtn.type = "button";

    detailsBtn.addEventListener(
      "click",
      () => showDetails(booking, bus, trip)
    );

    actionCell.appendChild(detailsBtn);
    row.appendChild(actionCell);

    return row;
  }

  // =========================================
  // TRIP-WISE PASSENGER TABLE
  // =========================================

  
function renderTrip(trip, bus, visible) {

  const section = make("section", "ob-trip");

  // Count confirmed bookings only.
  const paidBookings = bookings(trip).filter(
    (booking) => booking.status === "Paid"
  );

  // Count seats, not booking records.
  const bookedSeats = new Set(
    paidBookings.flatMap(
      (booking) => seats(booking).map(String)
    )
  );

  const bookedCount = bookedSeats.size;
  const capacity = Number(bus.totalSeats) || 0;

  // Route and time.
  const heading = make("div", "ob-trip-title");
  const details = make("div");

  details.appendChild(
    make(
      "strong",
      "",
      `${fmt(trip.from)} → ${fmt(trip.to)}`
    )
  );

  details.appendChild(
    make(
      "small",
      "",
      `Departure: ${fmt(trip.departureTime)} | ` +
      `Arrival: ${fmt(trip.arrivalTime)}`
    )
  );

  heading.appendChild(details);

  heading.appendChild(
    make(
      "span",
      "ob-trip-count",
      fmt(trip.status)
    )
  );

  section.appendChild(heading);

  // Seat booking summary.
  const summary = make(
    "div",
    "ob-seat-summary"
  );

  const label = make(
    "strong",
    "",
    "Confirmed Booked Seats"
  );

  const count = make(
    "h3",
    "",
    capacity
      ? `${bookedCount} / ${capacity}`
      : String(bookedCount)
  );

  summary.appendChild(label);
  summary.appendChild(count);

  // Capacity progress bar.
  if (capacity > 0) {

    const progress = make(
      "div",
      "ob-seat-progress"
    );

    const fill = make(
      "div",
      "ob-seat-progress-fill"
    );

    fill.style.width =
      `${Math.min(
        100,
        bookedCount / capacity * 100
      )}%`;

    progress.appendChild(fill);
    summary.appendChild(progress);
  }

  summary.appendChild(
    make(
      "small",
      "",
      `${paidBookings.length} Paid bookings · ` +
      `${bookedCount} confirmed seats`
    )
  );

  section.appendChild(summary);

  return section;
}


  // =========================================
  // BUS CARD
  // =========================================

  function renderBus(bus, query, status) {
    const trips = Array.isArray(bus.trips)
      ? bus.trips
      : [];

    const busMatch = [
      bus.busNo,
      bus.regNo,
      bus.type
    ].some(
      (v) => matchesSearch(v, query)
    );

    const visibleTrips = trips.map(
      (trip) => ({
        trip,

        visible: matchingBookings(
          bus,
          trip,
          query,
          status
        ),

        tripMatch: [
          trip.from,
          trip.to,
          trip.departureTime
        ].some(
          (v) => matchesSearch(v, query)
        )
      })
    );

    if (
      query &&
      !busMatch &&
      !visibleTrips.some(
        (item) =>
          item.tripMatch ||
          item.visible.length
      )
    ) {
      return null;
    }

    const card = make(
      "article",
      "ob-bus-card"
    );

    const header = make(
      "div",
      "ob-bus-header"
    );

    const heading = make(
      "div",
      "ob-bus-heading"
    );

    heading.appendChild(
      make(
        "span",
        "ob-bus-icon"
      )
    );

    heading.firstChild.appendChild(
      make(
        "i",
        "fa-solid fa-bus"
      )
    );

    const info = make("div");

    info.appendChild(
      make(
        "h3",
        "",
        fmt(bus.busNo)
      )
    );

    info.appendChild(
      make(
        "p",
        "",
        `Reg: ${fmt(bus.regNo)}` +
        ` · ${fmt(bus.type)}` +
        ` · ${fmt(bus.totalSeats)} seats`
      )
    );

    heading.appendChild(info);

    const actions = make(
      "div",
      "ob-bus-actions"
    );

    actions.appendChild(
      make(
        "span",
        "ob-count-pill",
        `${trips.length} Trips`
      )
    );

    actions.appendChild(
      make(
        "span",
        "ob-count-pill",
        `${Number(bus.totalBookings) || 0} Bookings`
      )
    );

    // =====================================
    // PDF DOWNLOAD BUTTON
    // =====================================

    const download = make(
      "button",
      "ob-pdf-btn",
      "Download Passenger PDF"
    );

    download.type = "button";

    download.prepend(
      make(
        "i",
        "fa-solid fa-file-pdf"
      )
    );

    download.disabled =
      (Number(bus.paidBookings) || 0) === 0;

    download.title = download.disabled
      ? "No Paid bookings for this bus and date"
      : "Download all Paid passengers for this bus on the selected date";

    download.addEventListener(
      "click",
      () => downloadPDF(bus, download)
    );

    actions.appendChild(download);

    header.append(
      heading,
      actions
    );

    card.appendChild(header);

    visibleTrips.forEach(
      ({ trip, visible }) => {
        card.appendChild(
          renderTrip(
            trip,
            bus,
            visible
          )
        );
      }
    );

    return card;
  }

  // =========================================
  // RENDER ALL ASSIGNED BUSES
  // =========================================

  function render() {
    if (!dailyData) {
      return;
    }

    const query = ui.search.value
      .trim()
      .toLowerCase();

    const status = ui.status.value;

    const buses = Array.isArray(dailyData.buses)
      ? dailyData.buses
      : [];

    ui.groups.replaceChildren();

    if (!buses.length) {
      empty(
        "No buses assigned for this journey date. Try another date."
      );

      ui.footer.textContent =
        "0 buses assigned";

      return;
    }

    let displayed = 0;

    const fragment =
      document.createDocumentFragment();

    buses.forEach((bus) => {
      const card = renderBus(
        bus,
        query,
        status
      );

      if (card) {
        fragment.appendChild(card);
        displayed++;
      }
    });

    if (!displayed) {
      empty(
        "No buses or passengers match your search."
      );
    } else {
      ui.groups.appendChild(fragment);
    }

    ui.footer.textContent =
      `${displayed} of ${buses.length} assigned buses shown` +
      " · PDF includes Paid bookings only";
  }

  // =========================================
  // BOOKING DETAILS MODAL
  // =========================================

  function addDetail(label, value) {
    const item = make(
      "div",
      "ob-detail"
    );

    item.append(
      make("span", "", label),
      make("strong", "", fmt(value))
    );

    ui.details.appendChild(item);
  }

  function showDetails(booking, bus, trip) {
    lastFocus = document.activeElement;

    ui.details.replaceChildren();

    addDetail(
      "Ticket ID",
      booking.ticketId
    );

    addDetail(
      "Passenger Name",
      booking.passengerName
    );

    addDetail(
      "Email Address",
      booking.email
    );

    addDetail(
      "Phone Number",
      booking.phoneNumber
    );

    addDetail(
      "Seat Number(s)",
      seats(booking).join(", ")
    );

    addDetail(
      "Booking Status",
      booking.status
    );

    addDetail(
      "Bus",
      `${fmt(bus.busNo)} (${fmt(bus.regNo)})`
    );

    addDetail(
      "Route",
      `${fmt(trip.from)} → ${fmt(trip.to)}`
    );

    addDetail(
      "Journey Date",
      dateLabel(ui.date.value)
    );

    addDetail(
      "Departure / Arrival",
      `${fmt(trip.departureTime)} / ` +
      `${fmt(trip.arrivalTime)}`
    );

    ui.modal.hidden = false;

    document.body.style.overflow =
      "hidden";

    ui.close?.focus();
  }

  function closeDetails() {
    ui.modal.hidden = true;

    document.body.style.overflow = "";

    if (lastFocus?.isConnected) {
      lastFocus.focus();
    }

    lastFocus = null;
  }

  // =========================================
  // AUTHENTICATED PASSENGER PDF DOWNLOAD
  // =========================================

  async function downloadPDF(bus, button) {
    if (
      !dailyData ||
      !ui.date.value ||
      button.disabled
    ) {
      return;
    }

    const date = ui.date.value;
    const label = button.textContent;

    button.disabled = true;
    button.textContent = "Generating PDF...";

    message("");

    try {
      const url =
        `${API}/${encodeURIComponent(bus.busId)}/pdf` +
        `?date=${encodeURIComponent(date)}`;

      const response =
        await authorizedFetch(url);

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({}));

        throw new Error(
          error.message ||
          `PDF request failed (${response.status})`
        );
      }

      const pdf = await response.blob();

      if (
        !pdf.size ||
        !pdf.type.includes("pdf")
      ) {
        throw new Error(
          "Invalid PDF response"
        );
      }

      const objectUrl =
        URL.createObjectURL(pdf);

      const anchor = make("a");

      const safeBus = fmt(
        bus.busNo,
        "bus"
      ).replace(
        /[^a-z0-9_-]/gi,
        "-"
      );

      anchor.href = objectUrl;

      anchor.download =
        `RAJABUS-${date}-${safeBus}-passengers.pdf`;

      document.body.appendChild(anchor);

      anchor.click();
      anchor.remove();

      window.setTimeout(
        () => URL.revokeObjectURL(objectUrl),
        30000
      );

      message(
        `Passenger PDF downloaded for ${fmt(bus.busNo)}. ` +
        "Store it securely."
      );

    } catch (error) {
      console.error(
        "Passenger PDF download failed:",
        error.message
      );

      message(
        error.message ||
        "Could not download PDF",
        true
      );

    } finally {
      button.textContent = label;

      button.disabled =
        (Number(bus.paidBookings) || 0) === 0;
    }
  }

  // =========================================
  // LOAD DAILY BOOKINGS FROM MONGODB
  // =========================================

  async function loadDaily() {
    if (controller) {
      controller.abort();
    }

    const date = ui.date.value;

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date)
    ) {
      message(
        "Select a valid journey date.",
        true
      );

      empty(
        "Choose a journey date to view assigned buses."
      );

      return;
    }

    const thisRequest =
      new AbortController();

    controller = thisRequest;

    ui.refresh.disabled = true;

    ui.dateLabel.textContent =
      dateLabel(date);

    message("");

    empty(
      "Loading assigned buses and passenger bookings..."
    );

    ui.footer.textContent = "Loading...";

    try {
      const response = await authorizedFetch(
        `${API}?date=${encodeURIComponent(date)}`,
        thisRequest.signal
      );

      const result = await response
        .json()
        .catch(() => ({}));

      if (
        !response.ok ||
        result.success !== true ||
        !Array.isArray(result.buses)
      ) {
        throw new Error(
          result.message ||
          `Failed to load daily bookings (${response.status})`
        );
      }

      if (
        controller !== thisRequest ||
        thisRequest.signal.aborted
      ) {
        return;
      }

      dailyData = result;

      updateStats(result);
      render();

    } catch (error) {
      if (
        error.name === "AbortError" ||
        controller !== thisRequest
      ) {
        return;
      }

      dailyData = null;

      updateStats(null);

      empty(
        "Could not load assigned buses. Click Refresh to retry."
      );

      ui.footer.textContent =
        "Booking data unavailable";

      message(
        error.message ||
        "Unable to load bookings",
        true
      );

    } finally {
      if (controller === thisRequest) {
        controller = null;
        ui.refresh.disabled = false;
      }
    }
  }

  // =========================================
  // EVENT LISTENERS
  // =========================================

  ui.date.value = localToday();

  ui.date.addEventListener(
    "change",
    loadDaily
  );

  ui.search.addEventListener(
    "input",
    render
  );

  ui.status.addEventListener(
    "change",
    render
  );

  ui.reset.addEventListener(
    "click",
    () => {
      ui.search.value = "";
      ui.status.value = "All";
      render();
    }
  );

  ui.refresh.addEventListener(
    "click",
    loadDaily
  );

  ui.logout?.addEventListener(
    "click",
    logout
  );

  ui.close?.addEventListener(
    "click",
    closeDetails
  );

  ui.closeFooter?.addEventListener(
    "click",
    closeDetails
  );

  ui.modal.addEventListener(
    "click",
    (event) => {
      if (event.target === ui.modal) {
        closeDetails();
      }
    }
  );

  document.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key === "Escape" &&
        !ui.modal.hidden
      ) {
        closeDetails();
      }
    }
  );

  window.addEventListener(
    "beforeunload",
    () => {
      if (controller) {
        controller.abort();
      }
    }
  );

  // =========================================
  // INITIAL LOAD
  // =========================================

  loadDaily();
});
