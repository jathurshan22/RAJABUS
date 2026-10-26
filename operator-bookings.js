
/* ==============================================
   RAJABUS - OPERATOR BOOKINGS
   STEP 06D

   Real MongoDB Data
   Search / Filters / Pagination
   Booking Details / Refresh / Logout
   ============================================== */

document.addEventListener("DOMContentLoaded", () => {

  const API_URL =
    "http://localhost:5000/api/operators/bookings";

  const PAGE_SIZE = 10;
  const API_PAGE_SIZE = 100;

  // ============================================
  // AUTHENTICATION
  // ============================================

  const token =
    localStorage.getItem("operatorToken");

  if (!token) {
    window.location.replace("operator-login.html");
    return;
  }

  // ============================================
  // DOM ELEMENTS
  // ============================================

  const $ = (id) => document.getElementById(id);

  const tableBody = $("bookingTableBody");
  const pageInfo = $("bookingPageInfo");

  const searchInput = $("bookingSearch");
  const statusFilter = $("bookingStatusFilter");
  const dateFilter = $("bookingDateFilter");

  const resetBtn = $("resetBookingFiltersBtn");
  const refreshBtn = $("refreshBookingsBtn");

  const previousBtn = $("previousBookingsBtn");
  const nextBtn = $("nextBookingsBtn");

  const logoutBtn = $("logoutBtn");

  const detailsModal = $("bookingDetailsModal");
  const detailsContent = $("bookingDetailsContent");

  const detailsCloseBtn = $("closeBookingDetailsBtn");

  const detailsFooterCloseBtn =
    $("closeBookingDetailsFooterBtn");

  if (!tableBody || !pageInfo) {
    console.error(
      "Bookings page HTML is missing required IDs."
    );
    return;
  }

  // ============================================
  // STATE
  // ============================================

  let allBookings = [];
  let filteredBookings = [];

  let currentPage = 1;
  let isLoading = false;

  let requestController = null;
  let lastFocusedElement = null;

  // ============================================
  // NOTIFICATION
  // ============================================

  function notify(message, type = "error") {

    if (typeof window.showToast === "function") {
      window.showToast(message, type);
    } else {
      console[
        type === "error" ? "error" : "log"
      ](message);
    }
  }

  // ============================================
  // TEXT HELPER
  // ============================================

  function setText(id, value) {

    const element =
      document.getElementById(id);

    if (element) {
      element.textContent = String(value);
    }
  }

  function safeText(value, fallback = "—") {

    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return fallback;
    }

    return String(value);
  }

  // ============================================
  // FORMAT CURRENCY
  // ============================================

  function formatCurrency(amount) {

    const value = Number(amount);

    const validAmount =
      Number.isFinite(value) ? value : 0;

    return `Rs. ${validAmount.toLocaleString(
      "en-LK",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }
    )}`;
  }

  // ============================================
  // FORMAT JOURNEY DATE
  // ============================================

  function formatJourneyDate(dateString) {

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(
        String(dateString || "")
      )
    ) {
      return safeText(dateString);
    }

    const [year, month, day] =
      dateString.split("-").map(Number);

    const date =
      new Date(Date.UTC(year, month - 1, day));

    if (Number.isNaN(date.getTime())) {
      return safeText(dateString);
    }

    return new Intl.DateTimeFormat("en-LK", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC"
    }).format(date);
  }

  // ============================================
  // FORMAT BOOKING DATE / TIME
  // ============================================

  function formatDateTime(value) {

    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return new Intl.DateTimeFormat("en-LK", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Colombo"
    }).format(date);
  }

  // ============================================
  // BOOKING HELPERS
  // ============================================

  function tripInfo(booking) {

    return (
      booking.tripId &&
      typeof booking.tripId === "object"
    )
      ? booking.tripId
      : {};
  }

  function bookedSeats(booking) {

    return Array.isArray(booking.seats)
      ? booking.seats.map(String)
      : [];
  }

  function bookingRoute(booking) {

    const trip = tripInfo(booking);

    const from =
      booking.from || trip.from;

    const to =
      booking.to || trip.to;

    return (
      `${safeText(from)} → ${safeText(to)}`
    );
  }

  function journeyDate(booking) {

    return (
      booking.journeyDate ||
      tripInfo(booking).journeyDate ||
      ""
    );
  }

  // ============================================
  // LOGOUT
  // ============================================

  function logout() {

    if (requestController) {
      requestController.abort();
    }

    localStorage.removeItem("operatorToken");
    localStorage.removeItem("operatorData");

    window.location.replace(
      "operator-login.html"
    );
  }

  // ============================================
  // CREATE DOM ELEMENT SAFELY
  // ============================================

  function element(tag, className, textValue) {

    const node =
      document.createElement(tag);

    if (className) {
      node.className = className;
    }

    if (textValue !== undefined) {
      node.textContent =
        String(textValue);
    }

    return node;
  }

  // ============================================
  // TABLE MESSAGE
  // ============================================

  function showTableMessage(
    message,
    iconName = "fa-circle-info"
  ) {

    tableBody.replaceChildren();

    const row =
      document.createElement("tr");

    const cell =
      element("td", "empty-row");

    cell.colSpan = 9;

    const icon = element(
      "i",
      `fa-solid ${iconName}`
    );

    icon.setAttribute(
      "aria-hidden",
      "true"
    );

    cell.append(
      icon,
      document.createTextNode(` ${message}`)
    );

    row.appendChild(cell);

    tableBody.appendChild(row);
  }

  // ============================================
  // BOOKING STATISTICS
  // ============================================

  function setStats(stats = {}) {

    setText(
      "totalBookings",
      Number(stats.totalBookings) || 0
    );

    setText(
      "paidBookings",
      Number(stats.paidBookings) || 0
    );

    setText(
      "pendingBookings",
      Number(stats.pendingBookings) || 0
    );

    setText(
      "cancelledBookings",
      Number(stats.cancelledBookings) || 0
    );

    setText(
      "expiredBookings",
      Number(stats.expiredBookings) || 0
    );

    setText(
      "totalRevenue",
      formatCurrency(stats.totalRevenue)
    );
  }

  // ============================================
  // LOADING STATE
  // ============================================

  function setLoading(loading) {

    isLoading = loading;

    if (refreshBtn) {
      refreshBtn.disabled = loading;
    }

    if (previousBtn) {
      previousBtn.disabled = loading;
    }

    if (nextBtn) {
      nextBtn.disabled = loading;
    }

    if (loading) {

      showTableMessage(
        "Loading passenger bookings...",
        "fa-spinner fa-spin"
      );

      pageInfo.textContent =
        "Loading booking records...";
    }
  }

  // ============================================
  // FETCH OPERATOR BOOKINGS
  // ============================================

  async function fetchPage(page, signal) {

    const params = new URLSearchParams({
      status: "All",
      page: String(page),
      limit: String(API_PAGE_SIZE)
    });

    const response = await fetch(
      `${API_URL}?${params}`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        },

        cache: "no-store",
        signal
      }
    );

    // Session expired / unauthorized.

    if (
      response.status === 401 ||
      response.status === 403
    ) {
      logout();

      throw new Error(
        "Operator session expired"
      );
    }

    const data = await response.json();

    if (
      !response.ok ||
      !data.success ||
      !Array.isArray(data.bookings)
    ) {
      throw new Error(
        data.message ||
        "Failed to load operator bookings"
      );
    }

    return data;
  }

  // ============================================
  // LOAD ALL OPERATOR BOOKINGS
  //
  // Backend API is paginated.
  // Load remaining pages in small batches
  // so search/date filters cover all bookings.
  // ============================================

  async function loadBookings() {

    if (requestController) {
      requestController.abort();
    }

    const controller =
      new AbortController();

    requestController = controller;

    setLoading(true);

    let loadedSuccessfully = false;

    try {

      // First API page.

      const firstPage =
        await fetchPage(1, controller.signal);

      const pages = Math.max(
        1,
        Number(
          firstPage.pagination?.totalPages
        ) || 1
      );

      const records = [
        ...firstPage.bookings
      ];

      // Load remaining pages.
      // Maximum 3 simultaneous requests.

      for (
        let start = 2;
        start <= pages;
        start += 3
      ) {

        const requests = [];

        for (
          let page = start;
          page < Math.min(start + 3, pages + 1);
          page++
        ) {

          requests.push(
            fetchPage(
              page,
              controller.signal
            )
          );
        }

        const responses =
          await Promise.all(requests);

        if (controller.signal.aborted) {
          return;
        }

        for (const response of responses) {
          records.push(...response.bookings);
        }
      }

      if (controller.signal.aborted) {
        return;
      }

      // Save data in memory only.
      // Do not store passenger records in localStorage.

      allBookings = records;

      // Backend statistics across all statuses.

      setStats(firstPage.stats);

      currentPage = 1;

      applyFilters();

      loadedSuccessfully = true;

      console.log(
        "Operator bookings loaded:",
        allBookings.length
      );

    } catch (error) {

      if (error.name === "AbortError") {
        return;
      }

      console.error(
        "Operator bookings loading error:",
        error
      );

      allBookings = [];
      filteredBookings = [];

      setStats();

      showTableMessage(
        "Could not load bookings. Click Refresh to retry.",
        "fa-triangle-exclamation"
      );

      pageInfo.textContent =
        "Booking data unavailable";

      notify(
        error.message ||
        "Could not load bookings"
      );

    } finally {

      if (requestController === controller) {

        requestController = null;

        isLoading = false;

        if (refreshBtn) {
          refreshBtn.disabled = false;
        }

        if (loadedSuccessfully) {

          updatePagination();

        } else {

          if (previousBtn) {
            previousBtn.disabled = true;
          }

          if (nextBtn) {
            nextBtn.disabled = true;
          }
        }
      }
    }
  }

  // ============================================
  // SEARCH / STATUS / DATE FILTER
  // ============================================

  function applyFilters() {

    const query = (
      searchInput?.value || ""
    ).trim().toLowerCase();

    const status =
      statusFilter?.value || "All";

    const date =
      dateFilter?.value || "";

    filteredBookings = allBookings.filter(
      (booking) => {

        // Payment status filter.

        if (
          status !== "All" &&
          booking.status !== status
        ) {
          return false;
        }

        // Journey date filter.

        if (
          date &&
          journeyDate(booking) !== date
        ) {
          return false;
        }

        if (!query) {
          return true;
        }

        const searchable = [

          booking.ticketId,

          booking.passengerName,

          booking.mobileNo,

          booking.email,

          booking.busNo,

          booking.from ||
            tripInfo(booking).from,

          booking.to ||
            tripInfo(booking).to,

          journeyDate(booking),

          ...bookedSeats(booking)

        ]
          .map(
            (part) => String(part || "")
          )
          .join(" ")
          .toLowerCase();

        return searchable.includes(query);
      }
    );

    const totalPages = Math.max(
      1,
      Math.ceil(
        filteredBookings.length / PAGE_SIZE
      )
    );

    currentPage = Math.max(
      1,
      Math.min(currentPage, totalPages)
    );

    renderTable();
  }

  // ============================================
  // PAGINATION INFORMATION
  // ============================================

  function updatePagination() {

    if (isLoading) {
      return;
    }

    const total =
      filteredBookings.length;

    const pages = Math.max(
      1,
      Math.ceil(total / PAGE_SIZE)
    );

    const start = total
      ? (currentPage - 1) * PAGE_SIZE + 1
      : 0;

    const end = Math.min(
      currentPage * PAGE_SIZE,
      total
    );

    pageInfo.textContent = total
      ? `Showing ${start}–${end} of ${total} bookings • Page ${currentPage} of ${pages}`
      : "Showing 0 bookings";

    if (previousBtn) {

      previousBtn.disabled =
        currentPage <= 1;
    }

    if (nextBtn) {

      nextBtn.disabled =
        currentPage >= pages;
    }
  }

  // ============================================
  // ADD TABLE CELL
  // ============================================

  function addCell(
    row,
    mainText,
    secondaryText = ""
  ) {

    const cell = element("td");

    cell.appendChild(
      element(
        "strong",
        "",
        safeText(mainText)
      )
    );

    if (secondaryText) {

      cell.appendChild(
        element(
          "small",
          "",
          secondaryText
        )
      );
    }

    row.appendChild(cell);

    return cell;
  }

  // ============================================
  // RENDER BOOKINGS TABLE
  // ============================================

  function renderTable() {

    tableBody.replaceChildren();

    if (filteredBookings.length === 0) {

      showTableMessage(
        allBookings.length === 0
          ? "No passenger bookings found for your trips."
          : "No bookings match the selected filters.",
        "fa-ticket"
      );

      updatePagination();

      return;
    }

    const start =
      (currentPage - 1) * PAGE_SIZE;

    const rows =
      filteredBookings.slice(
        start,
        start + PAGE_SIZE
      );

    const fragment =
      document.createDocumentFragment();

    for (const booking of rows) {

      const trip = tripInfo(booking);

      const row = element("tr");

      // 1. Ticket ID.

      addCell(
        row,
        booking.ticketId
      );

      // 2. Passenger.

      addCell(
        row,
        booking.passengerName,
        booking.mobileNo || ""
      );

      // 3. Journey.

      addCell(
        row,
        bookingRoute(booking),
        `${formatJourneyDate(
          journeyDate(booking)
        )} • ${safeText(
          booking.departTime ||
          trip.departureTime
        )}`
      );

      // 4. Bus.

      addCell(
        row,
        booking.busNo
      );

      // 5. Seats.

      addCell(
        row,
        bookedSeats(booking).join(", ") || "—"
      );

      // 6. Booking date.

      addCell(
        row,
        formatDateTime(booking.createdAt)
      );

      // 7. Fare.

      addCell(
        row,
        formatCurrency(booking.totalFare)
      );

      // 8. Booking status.

      const statusCell = element("td");

      const status =
        safeText(
          booking.status,
          "Unknown"
        );

      const badge = element(
        "span",
        "booking-status",
        status
      );

      if (
        [
          "Paid",
          "Pending",
          "Cancelled",
          "Expired"
        ].includes(status)
      ) {
        badge.classList.add(
          status.toLowerCase()
        );
      }

      statusCell.appendChild(badge);

      row.appendChild(statusCell);

      // 9. View Details button.

      const actionCell = element("td");

      const button = element(
        "button",
        "view-booking-btn",
        "View Details"
      );

      button.type = "button";

      button.dataset.bookingId =
        String(booking._id || "");

      const icon = element(
        "i",
        "fa-solid fa-eye"
      );

      icon.setAttribute(
        "aria-hidden",
        "true"
      );

      button.prepend(icon);

      actionCell.appendChild(button);

      row.appendChild(actionCell);

      fragment.appendChild(row);
    }

    tableBody.appendChild(fragment);

    updatePagination();
  }

  // ============================================
  // BOOKING DETAILS
  // ============================================

  function addDetail(
    grid,
    labelText,
    valueText
  ) {

    const item = element(
      "div",
      "booking-detail-item"
    );

    const label = element(
      "label",
      "",
      labelText
    );

    const value = element(
      "strong",
      "",
      safeText(valueText)
    );

    item.append(label, value);

    grid.appendChild(item);
  }

  // ============================================
  // OPEN DETAILS MODAL
  // ============================================

  function openDetails(booking) {

    if (
      !detailsModal ||
      !detailsContent
    ) {
      return;
    }

    const trip = tripInfo(booking);

    const seats = bookedSeats(booking);

    const grid = element(
      "div",
      "booking-details-grid"
    );

    addDetail(
      grid,
      "Ticket ID",
      booking.ticketId
    );

    addDetail(
      grid,
      "Payment Status",
      booking.status
    );

    addDetail(
      grid,
      "Passenger Name",
      booking.passengerName
    );

    addDetail(
      grid,
      "Mobile Number",
      booking.mobileNo
    );

    addDetail(
      grid,
      "Email Address",
      booking.email
    );

    addDetail(
      grid,
      "Bus Number",
      booking.busNo
    );

    addDetail(
      grid,
      "Route",
      bookingRoute(booking)
    );

    addDetail(
      grid,
      "Journey Date",
      formatJourneyDate(
        journeyDate(booking)
      )
    );

    addDetail(
      grid,
      "Departure",
      booking.departTime ||
      trip.departureTime
    );

    addDetail(
      grid,
      "Arrival",
      booking.arriveTime ||
      trip.arrivalTime
    );

    addDetail(
      grid,
      "Booked Seats",
      seats.join(", ") || "—"
    );

    addDetail(
      grid,
      "Total Fare",
      formatCurrency(booking.totalFare)
    );

    addDetail(
      grid,
      "Boarding Point",
      booking.boardingPoint
    );

    addDetail(
      grid,
      "Dropping Point",
      booking.droppingPoint
    );

    addDetail(
      grid,
      "Booked On",
      formatDateTime(booking.createdAt)
    );

    if (booking.status === "Paid") {

      addDetail(
        grid,
        "Paid On",
        formatDateTime(booking.paidAt)
      );
    }

    // Safe rendering using textContent.

    detailsContent.replaceChildren(grid);

    lastFocusedElement =
      document.activeElement;

    detailsModal.classList.add("show");

    detailsCloseBtn?.focus();
  }

  // ============================================
  // CLOSE DETAILS MODAL
  // ============================================

  function closeDetails() {

    if (!detailsModal) {
      return;
    }

    detailsModal.classList.remove("show");

    if (
      lastFocusedElement?.isConnected
    ) {
      lastFocusedElement.focus();
    }

    lastFocusedElement = null;
  }

  // ============================================
  // SEARCH EVENT
  // ============================================

  searchInput?.addEventListener(
    "input",
    () => {

      currentPage = 1;

      applyFilters();
    }
  );

  // ============================================
  // STATUS FILTER
  // ============================================

  statusFilter?.addEventListener(
    "change",
    () => {

      currentPage = 1;

      applyFilters();
    }
  );

  // ============================================
  // JOURNEY DATE FILTER
  // ============================================

  dateFilter?.addEventListener(
    "change",
    () => {

      currentPage = 1;

      applyFilters();
    }
  );

  // ============================================
  // RESET FILTERS
  // ============================================

  resetBtn?.addEventListener(
    "click",
    () => {

      if (searchInput) {
        searchInput.value = "";
      }

      if (statusFilter) {
        statusFilter.value = "All";
      }

      if (dateFilter) {
        dateFilter.value = "";
      }

      currentPage = 1;

      applyFilters();
    }
  );

  // ============================================
  // REFRESH BOOKINGS
  // ============================================

  refreshBtn?.addEventListener(
    "click",
    loadBookings
  );

  // ============================================
  // PREVIOUS PAGE
  // ============================================

  previousBtn?.addEventListener(
    "click",
    () => {

      if (currentPage > 1) {

        currentPage -= 1;

        renderTable();
      }
    }
  );

  // ============================================
  // NEXT PAGE
  // ============================================

  nextBtn?.addEventListener(
    "click",
    () => {

      if (
        currentPage * PAGE_SIZE <
        filteredBookings.length
      ) {

        currentPage += 1;

        renderTable();
      }
    }
  );

  // ============================================
  // VIEW BOOKING DETAILS
  // ============================================

  tableBody.addEventListener(
    "click",
    (event) => {

      const button =
        event.target.closest(
          ".view-booking-btn"
        );

      if (!button) {
        return;
      }

      const booking = allBookings.find(
        (item) =>
          String(item._id) ===
          button.dataset.bookingId
      );

      if (booking) {
        openDetails(booking);
      }
    }
  );

  // ============================================
  // CLOSE MODAL BUTTONS
  // ============================================

  detailsCloseBtn?.addEventListener(
    "click",
    closeDetails
  );

  detailsFooterCloseBtn?.addEventListener(
    "click",
    closeDetails
  );

  // Click outside modal.

  detailsModal?.addEventListener(
    "click",
    (event) => {

      if (event.target === detailsModal) {
        closeDetails();
      }
    }
  );

  // Escape key.

  document.addEventListener(
    "keydown",
    (event) => {

      if (
        event.key === "Escape" &&
        detailsModal?.classList.contains("show")
      ) {
        closeDetails();
      }
    }
  );

  // ============================================
  // LOGOUT BUTTON
  // ============================================

  logoutBtn?.addEventListener(
    "click",
    logout
  );

  // ============================================
  // CLEANUP
  // ============================================

  window.addEventListener(
    "beforeunload",
    () => {

      if (requestController) {
        requestController.abort();
      }
    }
  );

  // ============================================
  // INITIAL DATA LOAD
  // ============================================

  loadBookings();

});
