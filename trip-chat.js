(() => {
  "use strict";

  // Backend address.
  const API = "http://localhost:5000/api";

  function start() {
    if (document.getElementById("rajaLiveChat")) return;

    // ==================================================
    // CHAT STYLES
    // ==================================================

    const style = document.createElement("style");

    style.textContent = `
#rajaLiveChat {
  --brand: #f26522;
  --ink: #292929;
  --muted: #91887f;
  --paper: #fff;
  --soft: #fff5ec;
  --line: #f0e7df;

  position: fixed;
  right: 24px;
  bottom: max(22px, env(safe-area-inset-bottom));
  z-index: 10000;
  font: 12px/1.6 "Poppins", sans-serif;
  color: var(--ink);
  color-scheme: light;
  text-align: left;
}

#rajaLiveChat * {
  box-sizing: border-box;
}

#rajaLiveChat [hidden] {
  display: none !important;
}

#rajaLiveChat button,
#rajaLiveChat textarea {
  font: inherit;
  letter-spacing: normal;
  text-transform: none;
  appearance: none;
  margin: 0;
}

#rajaLiveChat button {
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

#rajaLiveChat button:disabled {
  cursor: default;
  opacity: .5;
}

#rajaLiveChat button:focus-visible,
#rajaLiveChat a:focus-visible,
#rajaLiveChat textarea:focus-visible {
  outline: 3px solid var(--brand);
  outline-offset: 3px;
}

#rajaLiveChat svg {
  width: 20px;
  height: 20px;
  display: block;
  flex-shrink: 0;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}

#rajaLiveChat .rlc-panel {
  width: 400px;
  height: min(640px, calc(100dvh - 110px));
  display: flex;
  flex-direction: column;
  margin-bottom: 14px;
  border: 1px solid var(--line);
  border-radius: 24px;
  overflow: hidden;
  background: var(--paper);
  box-shadow: 0 20px 70px #70360020;
  animation: rlcIn .2s ease-out;
}

#rajaLiveChat .rlc-head {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-shrink: 0;
  padding: 20px 17px;
  background: linear-gradient(120deg, #ff8749, #f26522);
  color: #fff;
}

#rajaLiveChat .rlc-logo {
  width: 43px;
  height: 43px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 14px;
  background: #fff;
  color: var(--brand);
}

#rajaLiveChat .rlc-heading {
  flex: 1;
  min-width: 0;
}

#rajaLiveChat .rlc-eyebrow {
  font-size: 8px;
  letter-spacing: 1.8px;
  color: #ffeadb;
}

#rajaLiveChat h2 {
  font-size: 20px;
  line-height: 1.3;
  margin: 3px 0;
  color: #fff;
  font-weight: 600;
  letter-spacing: -.5px;
}

#rajaLiveChat .rlc-subtitle {
  font-size: 10px;
  color: #fff0e6;
  margin: 0;
  overflow-wrap: anywhere;
}

#rajaLiveChat .rlc-icon-button {
  width: 31px;
  height: 31px;
  padding: 0;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border: 1px solid #ffffff35;
  border-radius: 10px;
  background: #ffffff15;
  color: #fff;
}

#rajaLiveChat .rlc-icon-button svg {
  width: 17px;
  height: 17px;
}

#rajaLiveChat .rlc-trips-view {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 18px 16px;
  background: linear-gradient(var(--paper), var(--soft));
}

#rajaLiveChat .rlc-list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

#rajaLiveChat h3 {
  font-size: 15px;
  margin: 0;
  color: var(--ink);
  font-weight: 600;
}

#rajaLiveChat .rlc-refresh {
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--paper);
  color: var(--brand);
  padding: 5px 9px;
  font-size: 10px;
}

#rajaLiveChat .rlc-date {
  margin: 5px 0 13px;
  font-size: 10px;
  color: var(--muted);
}

#rajaLiveChat .rlc-trip-list {
  display: grid;
  gap: 12px;
}

#rajaLiveChat .rlc-trip {
  display: block;
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: var(--paper);
  padding: 14px;
  text-align: left;
  color: var(--ink);
  transition:
    transform .2s,
    border-color .2s,
    box-shadow .2s;
}

#rajaLiveChat .rlc-trip:hover {
  transform: translateY(-2px);
  border-color: #f7b085;
  box-shadow: 0 8px 20px #f2652210;
}

#rajaLiveChat .rlc-trip-top {
  display: flex;
  align-items: center;
  gap: 9px;
}

#rajaLiveChat .rlc-bus-icon {
  width: 31px;
  height: 31px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  border-radius: 10px;
  background: var(--soft);
  color: var(--brand);
}

#rajaLiveChat .rlc-bus-icon svg {
  width: 17px;
  height: 17px;
}

#rajaLiveChat .rlc-bus-name {
  flex: 1;
  font-size: 11px;
  font-weight: 600;
}

#rajaLiveChat .rlc-reg {
  display: block;
  font-size: 9px;
  color: var(--muted);
  font-weight: 400;
}

#rajaLiveChat .rlc-tag {
  padding: 3px 7px;
  background: #eaf8ed;
  color: #298444;
  border-radius: 6px;
  font-size: 8px;
}

#rajaLiveChat .rlc-route {
  display: block;
  margin: 12px 0;
  font-size: 14px;
  font-weight: 600;
  overflow-wrap: anywhere;
}

#rajaLiveChat .rlc-times {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid var(--line);
}

#rajaLiveChat .rlc-time-label {
  display: block;
  color: var(--muted);
  font-size: 9px;
}

#rajaLiveChat .rlc-time-value {
  display: block;
  font-size: 11px;
  font-weight: 500;
  margin-top: 2px;
}

#rajaLiveChat .rlc-card-action {
  display: block;
  margin-top: 11px;
  color: var(--brand);
  font-size: 10px;
  font-weight: 600;
  text-align: right;
}

#rajaLiveChat .rlc-empty {
  padding: 30px 18px;
  text-align: center;
  background: var(--paper);
  border: 1px dashed var(--line);
  border-radius: 16px;
  color: var(--muted);
}

#rajaLiveChat .rlc-list-status {
  margin: 12px 0 0;
  color: var(--muted);
  font-size: 9px;
  overflow-wrap: anywhere;
}

#rajaLiveChat .rlc-room {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

#rajaLiveChat .rlc-room-info {
  flex-shrink: 0;
  padding: 10px 15px;
  border-bottom: 1px solid var(--line);
  background: var(--paper);
  font-size: 9px;
  color: var(--muted);
}

#rajaLiveChat .rlc-room-times {
  display: block;
  margin-top: 3px;
  color: var(--ink);
  font-size: 10px;
}

#rajaLiveChat .rlc-room-notice,
#rajaLiveChat .rlc-send-notice {
  flex-shrink: 0;
  padding: 8px 14px;
  margin: 0;
  background: var(--soft);
  color: #af5a25;
  font-size: 10px;
}

#rajaLiveChat .rlc-message-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 15px 13px;
  background: var(--soft);
  scrollbar-width: thin;
}

#rajaLiveChat .rlc-older {
  display: block;
  margin: 0 auto 14px;
  border: 1px solid var(--line);
  border-radius: 15px;
  background: var(--paper);
  color: var(--brand);
  font-size: 10px;
  padding: 5px 12px;
}

#rajaLiveChat .rlc-message-empty {
  text-align: center;
  color: var(--muted);
  font-size: 11px;
  margin: 30px 10px;
}

#rajaLiveChat .rlc-row {
  display: flex;
  margin-bottom: 14px;
}

#rajaLiveChat .rlc-row.own {
  justify-content: flex-end;
}

#rajaLiveChat .rlc-bubble {
  width: fit-content;
  max-width: 86%;
  padding: 10px 12px 7px;
  border: 1px solid var(--line);
  border-radius: 14px 14px 14px 4px;
  background: var(--paper);
}

#rajaLiveChat .own .rlc-bubble {
  border-color: #f4c4a6;
  border-radius: 14px 14px 4px 14px;
  background: linear-gradient(135deg, #ffebdc, #ffdabf);
  color: #49372c;
}

#rajaLiveChat .rlc-name {
  display: block;
  font-size: 9px;
  font-weight: 600;
  color: var(--brand);
  margin-bottom: 4px;
}

#rajaLiveChat .rlc-message-text {
  margin: 0;
  font-size: 11px;
  line-height: 1.8;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

#rajaLiveChat .rlc-message-time {
  display: block;
  margin-top: 5px;
  text-align: right;
  color: var(--muted);
  font-size: 8px;
}

#rajaLiveChat .own .rlc-message-time {
  color: #a57e64;
}

#rajaLiveChat .rlc-compose {
  flex-shrink: 0;
  padding: 11px 12px;
  background: var(--paper);
  border-top: 1px solid var(--line);
}

#rajaLiveChat .rlc-auth {
  margin: 0 0 8px;
  color: var(--muted);
  font-size: 10px;
}

#rajaLiveChat .rlc-auth a {
  color: var(--brand);
  font-weight: 600;
}

#rajaLiveChat .rlc-form {
  display: flex;
  align-items: flex-end;
  gap: 7px;
  margin: 0;
  padding: 5px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--soft);
}

#rajaLiveChat .rlc-form:focus-within {
  border-color: #f4ac82;
  box-shadow: 0 0 0 3px #f2652209;
}

#rajaLiveChat .rlc-input {
  flex: 1;
  min-width: 0;
  height: 38px;
  max-height: 100px;
  padding: 8px 6px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--ink);
  resize: none;
  font-size: 12px;
  line-height: 22px;
}

#rajaLiveChat .rlc-send {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 38px;
  height: 38px;
  padding: 0;
  border: 0;
  border-radius: 10px;
  background: var(--brand);
  color: #fff;
}

#rajaLiveChat .rlc-hint {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  font-size: 8px;
  color: var(--muted);
  margin-top: 7px;
}

#rajaLiveChat .rlc-footer {
  flex-shrink: 0;
  padding: 8px 12px;
  border-top: 1px solid var(--line);
  background: var(--paper);
  text-align: center;
  font-size: 8px;
  color: var(--muted);
}

#rajaLiveChat .rlc-footer strong {
  color: var(--brand);
  font-weight: 600;
}

#rajaLiveChat .rlc-launcher {
  display: flex;
  align-items: center;
  gap: 11px;
  margin-left: auto;
  height: 61px;
  padding: 7px 19px 7px 7px;
  border: 1px solid #ff9a65;
  border-radius: 21px;
  background: linear-gradient(135deg, #ff8749, #f26522);
  color: #fff;
  box-shadow: 0 10px 30px #f2652235;
  transition: transform .2s;
}

#rajaLiveChat .rlc-launcher:hover {
  transform: translateY(-2px);
}

#rajaLiveChat .rlc-launch-icon {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border-radius: 15px;
  background: #fff;
  color: var(--brand);
}

#rajaLiveChat .rlc-launch-copy {
  display: flex;
  flex-direction: column;
  text-align: left;
}

#rajaLiveChat .rlc-launch-copy strong {
  font-size: 12px;
  color: #fff;
  font-weight: 600;
}

#rajaLiveChat .rlc-launch-copy small {
  font-size: 9px;
  color: #fff0e5;
  margin-top: 2px;
}

#rajaLiveChat .rlc-launcher[aria-expanded="true"] {
  width: 58px;
  height: 58px;
  padding: 6px;
  justify-content: center;
}

#rajaLiveChat .rlc-launcher[aria-expanded="true"] .rlc-launch-copy {
  display: none;
}

html[data-theme="dark"] #rajaLiveChat {
  --paper: #222326;
  --soft: #2b2724;
  --ink: #f3ede7;
  --muted: #b5a69b;
  --line: #403831;
  color-scheme: dark;
}

@keyframes rlcIn {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 480px) {
  #rajaLiveChat {
    right: 12px;
    bottom: max(12px, env(safe-area-inset-bottom));
  }

  #rajaLiveChat .rlc-panel {
    width: min(400px, calc(100vw - 24px));
    height: min(640px, calc(100dvh - 100px));
    border-radius: 21px;
    margin-bottom: 10px;
  }

  #rajaLiveChat .rlc-launcher {
    height: 55px;
    padding: 6px 16px 6px 6px;
    border-radius: 18px;
  }

  #rajaLiveChat .rlc-launch-icon {
    width: 41px;
    height: 41px;
    border-radius: 13px;
  }

  #rajaLiveChat .rlc-launcher[aria-expanded="true"] {
    width: 53px;
    height: 53px;
  }

  #rajaLiveChat .rlc-input {
    font-size: 16px;
  }
}

@media (prefers-reduced-motion: reduce) {
  #rajaLiveChat * {
    animation: none !important;
    transition: none !important;
  }
}
`;

    document.head.append(style);

    // ==================================================
    // ICONS
    // ==================================================

    const icons = {
      chat:
        '<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-3.5-.7L3 21l1.7-5.5A9 9 0 0 1 4 12 8.5 8.5 0 1 1 21 11.5Z"/>' +
        '<path d="M8 11h8M8 14h5"/>',

      bus:
        '<rect x="5" y="3" width="14" height="16" rx="3"/>' +
        '<path d="M5 11h14M12 3v8M8 19v2M16 19v2M8 15h1M15 15h1"/>',

      close: '<path d="m6 6 12 12M18 6 6 18"/>',

      back: '<path d="m14 6-6 6 6 6"/>',

      send: '<path d="m21 3-7 18-4-7-7-4L21 3ZM10 14l5-5"/>',
    };

    const icon = (name) =>
      '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      icons[name] +
      "</svg>";

    // ==================================================
    // CHAT HTML
    // ==================================================

    const root = document.createElement("div");
    root.id = "rajaLiveChat";

    root.innerHTML = `
<section
  id="rlcPanel"
  class="rlc-panel"
  role="region"
  aria-labelledby="rlcTitle"
  hidden
>
  <header class="rlc-head">
    <button
      id="rlcBack"
      class="rlc-icon-button"
      type="button"
      aria-label="Back to trips"
      hidden
    >
      ${icon("back")}
    </button>

    <div id="rlcLogo" class="rlc-logo">
      ${icon("bus")}
    </div>

    <div class="rlc-heading">
      <span class="rlc-eyebrow">RAJA BUS · COMMUNITY</span>
      <h2 id="rlcTitle">Trip Lounge</h2>
      <p id="rlcSubtitle" class="rlc-subtitle">
        Your journey, connected.
      </p>
    </div>

    <button
      id="rlcClose"
      class="rlc-icon-button"
      type="button"
      aria-label="Close chat"
    >
      ${icon("close")}
    </button>
  </header>

  <div id="rlcTripsView" class="rlc-trips-view">
    <div class="rlc-list-head">
      <h3>Today's journeys</h3>
      <button
        id="rlcRefresh"
        class="rlc-refresh"
        type="button"
      >Refresh</button>
    </div>

    <p id="rlcDate" class="rlc-date">
      Sri Lanka time · Loading trips…
    </p>

    <div id="rlcTripList" class="rlc-trip-list"></div>

    <p
      id="rlcListStatus"
      class="rlc-list-status"
      role="status"
    ></p>
  </div>

  <div id="rlcRoom" class="rlc-room" hidden>
    <div class="rlc-room-info">
      <span id="rlcCount">Loading messages…</span>
      <span
        id="rlcRoomTimes"
        class="rlc-room-times"
      ></span>
    </div>

    <p
      id="rlcRoomNotice"
      class="rlc-room-notice"
      role="status"
      hidden
    ></p>

    <div id="rlcScroll" class="rlc-message-scroll">
      <button
        id="rlcOlder"
        class="rlc-older"
        type="button"
        hidden
      >Load older messages</button>

      <p id="rlcEmpty" class="rlc-message-empty">
        Loading messages…
      </p>

      <div
        id="rlcMessages"
        role="log"
        aria-label="Trip messages"
        aria-live="polite"
        aria-relevant="additions"
      ></div>
    </div>

    <p
      id="rlcSendNotice"
      class="rlc-send-notice"
      role="status"
      hidden
    ></p>

    <div class="rlc-compose">
      <p id="rlcAuth" class="rlc-auth" hidden>
        <a href="login.html">Log in</a> to send messages.
      </p>

      <form id="rlcForm" class="rlc-form">
        <textarea
          id="rlcInput"
          class="rlc-input"
          rows="1"
          maxlength="1000"
          placeholder="Write a message…"
          aria-label="Your message"
          disabled
        ></textarea>

        <button
          id="rlcSend"
          class="rlc-send"
          type="submit"
          aria-label="Send message"
          disabled
        >
          ${icon("send")}
        </button>
      </form>

      <div class="rlc-hint">
        <span>Enter to send · Shift + Enter for a new line</span>
        <span id="rlcChars">0 / 1000</span>
      </div>
    </div>
  </div>

  <div class="rlc-footer">
    <strong>RAJA BUS</strong>
    · Messages update every 3 seconds while open
  </div>
</section>

<button
  id="rlcLauncher"
  class="rlc-launcher"
  type="button"
  aria-controls="rlcPanel"
  aria-expanded="false"
  aria-label="Open Live chat"
>
  <span id="rlcLauncherIcon" class="rlc-launch-icon">
    ${icon("chat")}
  </span>

  <span class="rlc-launch-copy">
    <strong>Live chat</strong>
    <small>Today's journeys</small>
  </span>
</button>
`;

    document.body.append(root);

    const $ = (id) => root.querySelector("#" + id);

    const state = {
      open: false,
      trips: [],
      date: "",
      room: null,
      tripBusy: false,
      tripAttempt: 0,
      signature: "",
    };

    const timeFormat = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Colombo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    const fullDateFormat = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Colombo",
      dateStyle: "medium",
      timeStyle: "short",
    });

    // ==================================================
    // HELPERS
    // ==================================================

    function element(tag, className, text) {
      const node = document.createElement(tag);

      if (className) {
        node.className = className;
      }

      if (text !== undefined) {
        node.textContent = text;
      }

      return node;
    }

    function auth() {
      try {
        const user = JSON.parse(
          localStorage.getItem("user") || "null"
        );

        return {
          token: localStorage.getItem("userToken") || "",
          id: String(user?.id || user?._id || ""),
        };

      } catch {
        return {
          token: "",
          id: "",
        };
      }
    }

    async function api(path, options = {}) {
      const controller = new AbortController();

      const timeout = setTimeout(
        () => controller.abort(),
        10000
      );

      try {
        const headers = {};

        if (options.token) {
          headers.Authorization =
            "Bearer " + options.token;
        }

        if (options.body !== undefined) {
          headers["Content-Type"] = "application/json";
        }

        const response = await fetch(API + path, {
          method: options.method || "GET",
          headers,

          body:
            options.body === undefined
              ? undefined
              : JSON.stringify(options.body),

          signal: controller.signal,
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          const error = new Error(
            typeof data.message === "string"
              ? data.message
              : "Request failed"
          );

          error.status = response.status;
          throw error;
        }

        return data;

      } catch (error) {
        if (error.status) {
          throw error;
        }

        throw new Error(
          "Cannot reach the backend. Check that npm start is running."
        );

      } finally {
        clearTimeout(timeout);
      }
    }

    function clock(value) {
      const match = /^(\d{2}):(\d{2})/.exec(
        String(value)
      );

      if (!match) {
        return String(value || "—");
      }

      const hour = Number(match[1]);

      return (
        (hour % 12 || 12) +
        ":" +
        match[2] +
        (hour < 12 ? " AM" : " PM")
      );
    }

    function tripTimes(trip) {
      return {
        departure: clock(trip.departureTime),
        arrival: clock(trip.arrivalTime),
      };
    }

    function notice(id, text) {
      $(id).textContent = text;
      $(id).hidden = !text;
    }

    // ==================================================
    // LOGIN / COMPOSER STATE
    // ==================================================

    function syncComposer() {
      const room = state.room;

      if (!room) return;

      const account = auth();

      const loggedIn =
        !!account.token &&
        account.token !== room.blockedToken;

      if (room.viewerId !== account.id) {
        room.viewerId = account.id;

        if (room.loaded) {
          room.nodes.clear();
          $("rlcMessages").replaceChildren();
          mergeMessages(room, []);
        }
      }

      $("rlcAuth").hidden = loggedIn;

      const enabled =
        room.available &&
        room.loaded &&
        loggedIn &&
        !room.sending;

      $("rlcInput").disabled = !enabled;

      $("rlcSend").disabled =
        !enabled ||
        !$("rlcInput").value.trim();

      $("rlcChars").textContent =
        $("rlcInput").value.length + " / 1000";
    }

    function roomHeading() {
      const room = state.room;

      if (!room) return;

      const trip = room.trip;
      const times = tripTimes(trip);

      $("rlcTitle").textContent =
        trip.busNo || "Live chat";

      $("rlcSubtitle").textContent =
        trip.from + " → " + trip.to;

      $("rlcRoomTimes").textContent =
        "Departure " +
        times.departure +
        " · Arrival " +
        times.arrival;
    }

    // ==================================================
    // TRIP CARDS
    // ==================================================

    function renderTrips() {
      const signature = JSON.stringify([
        state.date,
        state.trips,
      ]);

      if (signature === state.signature) return;

      state.signature = signature;

      const list = $("rlcTripList");

      const focusedId =
        document.activeElement?.dataset?.tripId;

      list.replaceChildren();

      $("rlcDate").textContent =
        state.date +
        " · Sri Lanka · " +
        state.trips.length +
        " available trips";

      if (!state.trips.length) {
        list.append(
          element(
            "div",
            "rlc-empty",
            "No active trips available for today. Trips appear here until their arrival time."
          )
        );
      }

      state.trips.forEach((trip) => {
        const card = element(
          "button",
          "rlc-trip"
        );

        card.type = "button";
        card.dataset.tripId = trip.tripId;

        const top = element(
          "span",
          "rlc-trip-top"
        );

        const busIcon = element(
          "span",
          "rlc-bus-icon"
        );

        busIcon.innerHTML = icon("bus");

        const name = element(
          "span",
          "rlc-bus-name",
          trip.busNo || "Bus"
        );

        name.append(
          element(
            "span",
            "rlc-reg",
            trip.regNo || ""
          )
        );

        top.append(
          busIcon,
          name,
          element("span", "rlc-tag", "Active")
        );

        const times = tripTimes(trip);

        const timeRow = element(
          "span",
          "rlc-times"
        );

        [
          ["Departure", times.departure],
          ["Arrival", times.arrival],
        ].forEach(([label, value]) => {
          const block = element("span");

          block.append(
            element(
              "span",
              "rlc-time-label",
              label
            ),
            element(
              "span",
              "rlc-time-value",
              value
            )
          );

          timeRow.append(block);
        });

        card.append(
          top,
          element(
            "span",
            "rlc-route",
            trip.from + " → " + trip.to
          ),
          timeRow,
          element(
            "span",
            "rlc-card-action",
            "Open group chat →"
          )
        );

        card.addEventListener("click", () => {
          openTrip(trip);
        });

        list.append(card);

        if (
          focusedId === trip.tripId &&
          !state.room
        ) {
          card.focus();
        }
      });
    }

    function lockRoom(room) {
      if (state.room !== room) return;

      room.available = false;

      notice(
        "rlcRoomNotice",
        "This trip is no longer available for chat. It may have ended, changed date, or been cancelled/completed."
      );

      syncComposer();
    }

    async function refreshTrips() {
      if (state.tripBusy) return;

      state.tripBusy = true;
      state.tripAttempt = Date.now();

      $("rlcRefresh").disabled = true;

      try {
        const data = await api("/trips/today");

        if (!Array.isArray(data.trips)) {
          throw new Error("Invalid trips response");
        }

        state.trips = data.trips;
        state.date = data.date;

        renderTrips();

        $("rlcListStatus").textContent =
          "Trips refresh automatically while this chat is open.";

        const room = state.room;

        if (room) {
          const current = state.trips.find(
            (trip) =>
              trip.tripId === room.trip.tripId
          );

          if (!current) {
            lockRoom(room);

          } else {
            room.trip = current;

            if (!room.available) {
              room.available = true;
              notice("rlcRoomNotice", "");
            }

            roomHeading();
            syncComposer();
          }
        }

      } catch (error) {
        $("rlcListStatus").textContent =
          error.message +
          " Retrying automatically.";

      } finally {
        state.tripBusy = false;
        $("rlcRefresh").disabled = false;
      }
    }

    // ==================================================
    // MESSAGE RENDERING
    // ==================================================

    function mergeMessages(
      room,
      messages,
      mode = "normal"
    ) {
      if (state.room !== room) return;

      const scroll = $("rlcScroll");

      const oldHeight = scroll.scrollHeight;
      const oldTop = scroll.scrollTop;

      const atBottom =
        oldHeight -
        oldTop -
        scroll.clientHeight < 90;

      const accountId = auth().id;

      messages.forEach((message) => {
        room.messages.set(
          String(message._id),
          message
        );
      });

      const sorted = [
        ...room.messages.values(),
      ].sort((a, b) => {
        return (
          new Date(a.createdAt) -
            new Date(b.createdAt) ||
          String(a._id).localeCompare(
            String(b._id)
          )
        );
      });

      sorted.forEach((message, index) => {
        const id = String(message._id);

        if (room.nodes.has(id)) return;

        const own =
          String(message.userId) === accountId &&
          !!accountId;

        const row = element(
          "div",
          own ? "rlc-row own" : "rlc-row"
        );

        const bubble = element(
          "article",
          "rlc-bubble"
        );

        bubble.append(
          element(
            "span",
            "rlc-name",
            message.senderName +
              (own ? " · You" : "")
          ),
          element(
            "p",
            "rlc-message-text",
            message.message
          )
        );

        const sentAt = new Date(
          message.createdAt
        );

        const time = element(
          "time",
          "rlc-message-time",
          timeFormat.format(sentAt)
        );

        time.dateTime = sentAt.toISOString();

        time.title =
          fullDateFormat.format(sentAt) +
          " · Sri Lanka";

        bubble.append(time);
        row.append(bubble);

        const next = sorted
          .slice(index + 1)
          .find((item) =>
            room.nodes.has(String(item._id))
          );

        $("rlcMessages").insertBefore(
          row,
          next
            ? room.nodes.get(String(next._id))
            : null
        );

        room.nodes.set(id, row);
      });

      $("rlcEmpty").hidden =
        room.messages.size > 0;

      $("rlcEmpty").textContent =
        "No messages yet. Start the conversation.";

      $("rlcCount").textContent =
        room.messages.size +
        " messages loaded";

      $("rlcOlder").hidden = !room.before;

      if (mode === "older") {
        scroll.scrollTop =
          oldTop +
          scroll.scrollHeight -
          oldHeight;

      } else if (
        mode === "force" ||
        atBottom
      ) {
        scroll.scrollTop =
          scroll.scrollHeight;
      }
    }

    // ==================================================
    // LOAD NEW MESSAGES
    // ==================================================

    async function refreshMessages(room) {
      if (
        state.room !== room ||
        !room.available ||
        room.latestBusy
      ) {
        return;
      }

      room.latestBusy = true;

      try {
        // Catch up in pages after reconnecting.
        for (let page = 0; page < 5; page++) {
          const wasInitial = !room.loaded;
          const snapshot = !room.cursor;

          const suffix = room.cursor
            ? "?after=" +
              encodeURIComponent(room.cursor)
            : "";

          const data = await api(
            "/trip-chat/" +
            encodeURIComponent(
              room.trip.tripId
            ) +
            "/messages" +
            suffix
          );

          if (
            state.room !== room ||
            !room.available
          ) {
            return;
          }

          if (
            !Array.isArray(data.messages)
          ) {
            throw new Error(
              "Invalid messages response"
            );
          }

          if (snapshot) {
            room.before = data.hasMore
              ? data.nextCursor
              : null;

            room.loaded = true;
          }

          mergeMessages(
            room,
            data.messages,
            wasInitial ? "force" : "normal"
          );

          if (data.messages.length) {
            room.cursor = String(
              data.messages[
                data.messages.length - 1
              ]._id
            );
          }

          notice("rlcRoomNotice", "");
          syncComposer();

          if (
            snapshot ||
            !data.hasMore ||
            !data.messages.length
          ) {
            break;
          }
        }

      } catch (error) {
        if (state.room !== room) return;

        if (
          error.status === 404 ||
          error.status === 409
        ) {
          lockRoom(room);
          void refreshTrips();

        } else {
          notice(
            "rlcRoomNotice",
            error.message +
              " Retrying automatically."
          );
        }

      } finally {
        room.latestBusy = false;
      }
    }

    // ==================================================
    // OPEN A Live CHAT
    // ==================================================

    function openTrip(trip) {
      const room = {
        trip,
        available: true,
        loaded: false,
        sending: false,
        latestBusy: false,
        olderBusy: false,
        blockedToken: "",
        cursor: null,
        before: null,
        viewerId: auth().id,
        messages: new Map(),
        nodes: new Map(),
      };

      state.room = room;

      $("rlcTripsView").hidden = true;
      $("rlcRoom").hidden = false;
      $("rlcBack").hidden = false;
      $("rlcLogo").hidden = true;

      $("rlcMessages").replaceChildren();

      $("rlcOlder").hidden = true;
      $("rlcOlder").disabled = false;

      $("rlcEmpty").hidden = false;
      $("rlcEmpty").textContent =
        "Loading messages…";

      $("rlcCount").textContent =
        "Loading messages…";

      $("rlcInput").value = "";

      notice("rlcRoomNotice", "");
      notice("rlcSendNotice", "");

      roomHeading();
      syncComposer();

      $("rlcBack").focus();

      void refreshMessages(room);
    }

    function showTrips() {
      const previousId =
        state.room?.trip.tripId;

      state.room = null;

      $("rlcTripsView").hidden = false;
      $("rlcRoom").hidden = true;
      $("rlcBack").hidden = true;
      $("rlcLogo").hidden = false;

      $("rlcTitle").textContent =
        "Trip Lounge";

      $("rlcSubtitle").textContent =
        "Your journey, connected.";

      const card = [
        ...$("rlcTripList").children,
      ].find(
        (node) =>
          node.dataset.tripId === previousId
      );

      (card || $("rlcRefresh")).focus();

      void refreshTrips();
    }

    // ==================================================
    // AUTOMATIC REFRESH
    // ==================================================

    function tick(force = false) {
      if (
        !state.open ||
        document.hidden
      ) {
        return;
      }

      if (
        force ||
        Date.now() - state.tripAttempt >= 3000
      ) {
        void refreshTrips();
      }

      if (state.room) {
        syncComposer();
        void refreshMessages(state.room);
      }
    }

    function setOpen(open) {
      state.open = open;

      $("rlcPanel").hidden = !open;

      $("rlcLauncher").setAttribute(
        "aria-expanded",
        String(open)
      );

      $("rlcLauncher").setAttribute(
        "aria-label",
        open
          ? "Close Live chat"
          : "Open Live chat"
      );

      $("rlcLauncherIcon").innerHTML =
        icon(open ? "close" : "chat");

      if (open) {
        $("rlcClose").focus();
        tick(true);

      } else {
        $("rlcLauncher").focus();
      }
    }

    // ==================================================
    // LOAD OLDER MESSAGES
    // ==================================================

    $("rlcOlder").addEventListener(
      "click",
      async () => {
        const room = state.room;

        if (
          !room?.before ||
          room.olderBusy ||
          !room.available
        ) {
          return;
        }

        room.olderBusy = true;
        $("rlcOlder").disabled = true;

        try {
          const data = await api(
            "/trip-chat/" +
            encodeURIComponent(
              room.trip.tripId
            ) +
            "/messages?before=" +
            encodeURIComponent(room.before)
          );

          if (
            state.room !== room ||
            !room.available
          ) {
            return;
          }

          room.before = data.hasMore
            ? data.nextCursor
            : null;

          mergeMessages(
            room,
            data.messages,
            "older"
          );

        } catch (error) {
          if (state.room !== room) return;

          if (
            error.status === 404 ||
            error.status === 409
          ) {
            lockRoom(room);

          } else {
            notice(
              "rlcRoomNotice",
              error.message
            );
          }

        } finally {
          room.olderBusy = false;

          if (state.room === room) {
            $("rlcOlder").disabled = false;
          }
        }
      }
    );

    // ==================================================
    // SEND MESSAGE
    // ==================================================

    $("rlcForm").addEventListener(
      "submit",
      async (event) => {
        event.preventDefault();

        const room = state.room;
        const account = auth();

        const text =
          $("rlcInput").value.trim();

        if (
          !room?.available ||
          !room.loaded ||
          room.sending ||
          !account.token ||
          account.token === room.blockedToken ||
          !text ||
          text.length > 1000
        ) {
          return;
        }

        room.sending = true;

        notice("rlcSendNotice", "");
        syncComposer();

        try {
          const data = await api(
            "/trip-chat/" +
            encodeURIComponent(
              room.trip.tripId
            ) +
            "/messages",
            {
              method: "POST",
              token: account.token,
              body: {
                message: text,
              },
            }
          );

          if (state.room !== room) return;

          // Polling cursor is advanced only by GET.
          // This prevents skipping other users' messages.
          mergeMessages(
            room,
            [data.message],
            "force"
          );

          $("rlcInput").value = "";
          resizeInput();

        } catch (error) {
          if (state.room !== room) return;

          if (
            error.status === 401 ||
            error.status === 403
          ) {
            room.blockedToken =
              account.token;

            notice(
              "rlcSendNotice",
              "Please log in again to send messages."
            );

          } else if (
            error.status === 404 ||
            error.status === 409
          ) {
            lockRoom(room);
            void refreshTrips();

          } else {
            notice(
              "rlcSendNotice",
              error.status
                ? error.message
                : "Sending was not confirmed. Check the chat before retrying."
            );
          }

        } finally {
          room.sending = false;

          if (state.room === room) {
            syncComposer();

            if (
              !$("rlcInput").disabled
            ) {
              $("rlcInput").focus();
            }
          }
        }
      }
    );

    // ==================================================
    // INPUT AND BUTTON EVENTS
    // ==================================================

    function resizeInput() {
      $("rlcInput").style.height =
        "38px";

      $("rlcInput").style.height =
        Math.min(
          Math.max(
            $("rlcInput").scrollHeight,
            38
          ),
          100
        ) + "px";

      syncComposer();
    }

    $("rlcInput").addEventListener(
      "input",
      () => {
        notice("rlcSendNotice", "");
        resizeInput();
      }
    );

    $("rlcInput").addEventListener(
      "keydown",
      (event) => {
        if (
          event.key === "Enter" &&
          !event.shiftKey &&
          !event.isComposing
        ) {
          event.preventDefault();

          if (
            !$("rlcSend").disabled
          ) {
            $("rlcForm").requestSubmit();
          }
        }
      }
    );

    $("rlcLauncher").addEventListener(
      "click",
      () => setOpen(!state.open)
    );

    $("rlcClose").addEventListener(
      "click",
      () => setOpen(false)
    );

    $("rlcBack").addEventListener(
      "click",
      showTrips
    );

    $("rlcRefresh").addEventListener(
      "click",
      () => void refreshTrips()
    );

    root.addEventListener(
      "keydown",
      (event) => {
        if (
          event.key === "Escape" &&
          state.open
        ) {
          event.preventDefault();
          setOpen(false);
        }
      }
    );

    document.addEventListener(
      "visibilitychange",
      () => tick(true)
    );

    window.addEventListener(
      "online",
      () => tick(true)
    );

    window.addEventListener(
      "storage",
      () => {
        syncComposer();
        tick(true);
      }
    );

    setInterval(() => {
      tick();
    }, 3000);
  }

  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      start,
      { once: true }
    );

  } else {
    start();
  }
})();