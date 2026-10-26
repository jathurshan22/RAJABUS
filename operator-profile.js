
/* ==============================================
   RAJABUS - OPERATOR PROFILE
   STEP 07H

   Real Profile Data
   Edit / Save / Cancel
   Secure Change Password
   Refresh / Logout
   ============================================== */

document.addEventListener("DOMContentLoaded", () => {

  // ==========================================
  // CONFIGURATION
  // ==========================================

  const PROFILE_API =
    "http://localhost:5000/api/operators/profile";

  const PASSWORD_API =
    "http://localhost:5000/api/operators/change-password";

  const LOGIN_PAGE = "operator-login.html";

  const get = (id) =>
    document.getElementById(id);

  // ==========================================
  // PROFILE DOM ELEMENTS
  // ==========================================

  const refreshBtn = get("refreshProfileBtn");
  const logoutBtn = get("logoutBtn");

  const editBtn = get("editProfileBtn");
  const cancelBtn = get("cancelProfileBtn");
  const saveBtn = get("saveProfileBtn");

  const profileForm = get("operatorProfileForm");
  const message = get("profileMessage");

  const companyTitle = get("profileCompanyTitle");
  const ownerTitle = get("profileOwnerTitle");

  const statusBadge = get("profileStatus");
  const statusText = get("accountStatusText");
  const memberSince = get("accountCreatedAt");

  // ==========================================
  // PROFILE INPUT FIELDS
  // ==========================================

  const fields = {
    companyName: get("companyName"),
    ownerName: get("ownerName"),
    email: get("operatorEmail"),
    phone: get("operatorPhone"),
    address: get("operatorAddress"),
  };

  const editableKeys = [
    "companyName",
    "ownerName",
    "phone",
    "address",
  ];

  // ==========================================
  // PASSWORD DOM ELEMENTS
  // ==========================================

  const passwordForm = get("changePasswordForm");

  const changePasswordBtn =
    get("changePasswordBtn");

  const currentPasswordInput =
    get("currentPassword");

  const newPasswordInput =
    get("newPassword");

  const confirmPasswordInput =
    get("confirmPassword");

  const passwordFields = [
    currentPasswordInput,
    newPasswordInput,
    confirmPasswordInput,
  ];

  // ==========================================
  // APPLICATION STATE
  // ==========================================

  let currentOperator = null;

  let editing = false;
  let busy = false;

  let activeController = null;

  // ==========================================
  // LOGOUT
  // ==========================================

  function logout() {

    activeController?.abort();

    passwordForm?.reset();

    localStorage.removeItem("operatorToken");

    localStorage.removeItem("operatorData");

    window.location.replace(LOGIN_PAGE);
  }

  // ==========================================
  // DISPLAY MESSAGE
  // ==========================================

  function displayMessage(text, kind = "error") {

    if (!message) return;

    message.textContent = text;

    message.className =
      `profile-message${text ? ` ${kind}` : ""}`;
  }

  // ==========================================
  // DISPLAY TEXT
  // ==========================================

  function displayText(
    node,
    value,
    fallback = "—"
  ) {

    if (!node) return;

    node.textContent =
      value == null ||
      String(value).trim() === ""
        ? fallback
        : String(value);
  }

  // ==========================================
  // FORMAT MEMBER DATE
  // ==========================================

  function formatMemberDate(value) {

    const date = new Date(value);

    if (
      !value ||
      Number.isNaN(date.getTime())
    ) {
      return "—";
    }

    return new Intl.DateTimeFormat(
      "en-LK",
      {
        day: "2-digit",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Colombo",
      }
    ).format(date);
  }

  // ==========================================
  // ENABLE / DISABLE CONTROLS
  // ==========================================

  function updateControls() {

    const canModify =
      currentOperator?.status === "Active";

    // Profile buttons.

    if (editBtn) {
      editBtn.disabled =
        busy || editing || !canModify;
    }

    if (cancelBtn) {
      cancelBtn.disabled =
        busy || !editing;
    }

    if (saveBtn) {
      saveBtn.disabled =
        busy || !editing;
    }

    if (refreshBtn) {
      refreshBtn.disabled =
        busy || editing;
    }

    // Editable profile fields.

    for (const key of editableKeys) {

      if (fields[key]) {
        fields[key].readOnly =
          !editing || busy;
      }
    }

    // Email must remain read-only.

    if (fields.email) {
      fields.email.readOnly = true;
    }

    // Password form is available only
    // to an active operator who is not
    // currently editing another form.

    const enablePasswords =
      canModify &&
      !editing &&
      !busy;

    for (const field of passwordFields) {

      if (field) {
        field.disabled = !enablePasswords;
      }
    }

    if (changePasswordBtn) {
      changePasswordBtn.disabled =
        !enablePasswords;
    }
  }

  // ==========================================
  // RENDER OPERATOR PROFILE
  // ==========================================

  function renderProfile(operator) {

    displayText(
      companyTitle,
      operator.companyName
    );

    displayText(
      ownerTitle,
      operator.ownerName
    );

    // Fill profile inputs.

    for (
      const [name, field] of Object.entries(fields)
    ) {

      if (field) {
        field.value =
          String(operator[name] ?? "");
      }
    }

    // Account status.

    const status = String(
      operator.status || "Unknown"
    ).trim();

    displayText(statusBadge, status);
    displayText(statusText, status);

    displayText(
      memberSince,
      formatMemberDate(operator.createdAt)
    );

    if (statusBadge) {

      statusBadge.className =
        "account-badge";

      const statusClass =
        status.toLowerCase();

      if (
        ["active", "suspended"].includes(
          statusClass
        )
      ) {
        statusBadge.classList.add(statusClass);
      }
    }
  }

  // ==========================================
  // PROFILE UNAVAILABLE
  // ==========================================

  function renderUnavailable() {

    displayText(
      companyTitle,
      "Profile unavailable"
    );

    displayText(
      ownerTitle,
      "Could not load operator details"
    );

    displayText(statusBadge, "Unavailable");
    displayText(statusText, "—");
    displayText(memberSince, "—");

    if (statusBadge) {
      statusBadge.className = "account-badge";
    }

    for (const field of Object.values(fields)) {

      if (field) {
        field.value = "";
      }
    }
  }

  // ==========================================
  // UPDATE LOCAL OPERATOR CACHE
  // ==========================================

  function syncOperatorCache(operator) {

    const raw =
      localStorage.getItem("operatorData");

    if (!raw) return;

    try {

      const stored = JSON.parse(raw);

      if (
        !stored ||
        typeof stored !== "object" ||
        Array.isArray(stored)
      ) {
        return;
      }

      const target =
        stored.operator &&
        typeof stored.operator === "object"
          ? stored.operator
          : stored;

      for (const key of editableKeys) {

        target[key] = operator[key];
      }

      localStorage.setItem(
        "operatorData",
        JSON.stringify(stored)
      );

    } catch {

      // Invalid old cache must not
      // interrupt profile updates.
    }
  }

  // ==========================================
  // AUTH TOKEN
  // ==========================================

  function authToken() {

    const token =
      localStorage.getItem("operatorToken");

    if (!token) {
      logout();
    }

    return token;
  }

  // ==========================================
  // HANDLE API RESPONSE
  // ==========================================

  async function readResponse(response) {

    const data = await response.json()
      .catch(() => ({}));

    if (
      response.status === 401 ||
      response.status === 403
    ) {

      logout();

      throw new Error(
        "Operator session expired"
      );
    }

    if (
      !response.ok ||
      data.success !== true
    ) {

      throw new Error(
        data.message ||
        "Request failed. Please retry."
      );
    }

    return data;
  }

  // ==========================================
  // LOAD PROFILE
  // ==========================================

  async function loadProfile() {

    if (editing || busy) return;

    const token = authToken();

    if (!token) return;

    const controller = new AbortController();

    activeController = controller;

    busy = true;
    updateControls();

    displayMessage("");

    const icon =
      refreshBtn?.querySelector("i");

    icon?.classList.add("fa-spin");

    try {

      const response = await fetch(
        PROFILE_API,
        {
          headers: {
            Authorization: `Bearer ${token}`
          },

          cache: "no-store",

          signal: controller.signal,
        }
      );

      if (controller.signal.aborted) return;

      const data =
        await readResponse(response);

      if (!data.operator) {

        throw new Error(
          "Operator data missing from response"
        );
      }

      currentOperator = data.operator;

      editing = false;

      renderProfile(currentOperator);

    } catch (error) {

      if (error.name === "AbortError") return;

      console.error(
        "Operator profile load error:",
        error.message
      );

      currentOperator = null;
      editing = false;

      renderUnavailable();

      displayMessage(
        "Unable to load profile. Click Refresh to retry."
      );

    } finally {

      if (activeController === controller) {

        activeController = null;

        busy = false;

        icon?.classList.remove("fa-spin");

        updateControls();
      }
    }
  }

  // ==========================================
  // START EDITING PROFILE
  // ==========================================

  function startEditing() {

    if (
      !currentOperator ||
      currentOperator.status !== "Active" ||
      busy
    ) {
      return;
    }

    editing = true;

    passwordForm?.reset();

    displayMessage("");

    updateControls();

    fields.companyName?.focus();
  }

  // ==========================================
  // CANCEL PROFILE EDIT
  // ==========================================

  function cancelEditing() {

    if (!editing || busy) return;

    editing = false;

    renderProfile(currentOperator);

    updateControls();

    displayMessage(
      "Unsaved changes discarded.",
      "success"
    );
  }

  // ==========================================
  // SAVE PROFILE
  // ==========================================

  async function saveProfile(event) {

    event.preventDefault();

    if (
      !editing ||
      !currentOperator ||
      busy
    ) {
      return;
    }

    const payload = {

      companyName:
        fields.companyName?.value.trim() ?? "",

      ownerName:
        fields.ownerName?.value.trim() ?? "",

      phone:
        fields.phone?.value.trim() ?? "",

      address:
        fields.address?.value.trim() ?? "",
    };

    // Validate profile values.

    if (
      !payload.companyName ||
      payload.companyName.length > 120 ||

      !payload.ownerName ||
      payload.ownerName.length > 120 ||

      !payload.phone ||
      payload.phone.length > 20 ||

      payload.address.length > 500
    ) {

      displayMessage(
        "Check required fields and maximum text lengths."
      );

      return;
    }

    if (!profileForm?.reportValidity()) {
      return;
    }

    // Check for changes.

    const noChanges =
      editableKeys.every(
        (key) =>
          payload[key] ===
          String(currentOperator[key] ?? "")
      );

    if (noChanges) {

      editing = false;

      renderProfile(currentOperator);

      updateControls();

      displayMessage(
        "No changes to save.",
        "success"
      );

      return;
    }

    const token = authToken();

    if (!token) return;

    const controller = new AbortController();

    activeController = controller;

    busy = true;

    updateControls();

    displayMessage("");

    try {

      const response = await fetch(
        PROFILE_API,
        {
          method: "PUT",

          headers: {

            Authorization:
              `Bearer ${token}`,

            "Content-Type":
              "application/json",
          },

          body: JSON.stringify(payload),

          signal: controller.signal,
        }
      );

      if (controller.signal.aborted) return;

      const data =
        await readResponse(response);

      if (!data.operator) {

        throw new Error(
          "Updated profile missing from response"
        );
      }

      currentOperator = data.operator;

      editing = false;

      renderProfile(currentOperator);

      syncOperatorCache(currentOperator);

      displayMessage(
        "Profile updated successfully!",
        "success"
      );

    } catch (error) {

      if (error.name === "AbortError") return;

      console.error(
        "Operator profile save error:",
        error.message
      );

      displayMessage(
        error.message ||
        "Could not save profile. Try again."
      );

    } finally {

      if (activeController === controller) {

        activeController = null;

        busy = false;

        updateControls();
      }
    }
  }

  // ==========================================
  // CHANGE PASSWORD
  // ==========================================

  async function changePassword(event) {

    event.preventDefault();

    // Require active operator.

    if (
      busy ||
      editing ||
      currentOperator?.status !== "Active"
    ) {
      return;
    }

    if (!passwordForm?.reportValidity()) {
      return;
    }

    // Read values without trimming.
    // Spaces may be part of a password.

    const currentPassword =
      currentPasswordInput?.value ?? "";

    const newPassword =
      newPasswordInput?.value ?? "";

    const confirmPassword =
      confirmPasswordInput?.value ?? "";

    // ======================================
    // VALIDATE REQUIRED FIELDS
    // ======================================

    if (
      !currentPassword.trim() ||
      !newPassword.trim() ||
      !confirmPassword.trim()
    ) {

      displayMessage(
        "Fill in all three password fields."
      );

      return;
    }

    // ======================================
    // VALIDATE PASSWORD LENGTH
    // ======================================

    const characterLength =
      [...newPassword].length;

    const byteLength =
      new TextEncoder()
        .encode(newPassword).length;

    if (
      characterLength < 8 ||
      byteLength > 72
    ) {

      displayMessage(
        "New password must have at least 8 characters and at most 72 UTF-8 bytes."
      );

      newPasswordInput?.focus();

      return;
    }

    // ======================================
    // CONFIRM PASSWORD MUST MATCH
    // ======================================

    if (newPassword !== confirmPassword) {

      displayMessage(
        "New Password and Confirm Password do not match."
      );

      confirmPasswordInput?.focus();

      return;
    }

    // ======================================
    // NEW PASSWORD MUST BE DIFFERENT
    // ======================================

    if (newPassword === currentPassword) {

      displayMessage(
        "New password must be different from your current password."
      );

      newPasswordInput?.focus();

      return;
    }

    const token = authToken();

    if (!token) return;

    const controller = new AbortController();

    activeController = controller;

    busy = true;

    updateControls();

    displayMessage("");

    // ======================================
    // SEND SECURE PASSWORD REQUEST
    // ======================================

    try {

      const response = await fetch(
        PASSWORD_API,
        {
          method: "POST",

          headers: {

            Authorization:
              `Bearer ${token}`,

            "Content-Type":
              "application/json",
          },

          // Only current and new passwords
          // are sent to the backend.
          //
          // Confirm password remains local.

          body: JSON.stringify({
            currentPassword,
            newPassword,
          }),

          signal: controller.signal,
        }
      );

      if (controller.signal.aborted) return;

      await readResponse(response);

      // ====================================
      // SUCCESS
      // ====================================

      // Clear sensitive fields.

      passwordForm.reset();

      displayMessage(
        "Password changed successfully!",
        "success"
      );

    } catch (error) {

      if (error.name === "AbortError") return;

      // Clear current password on failure.

      if (currentPasswordInput) {
        currentPasswordInput.value = "";
      }

      console.error(
        "Password change request failed:",
        error.message
      );

      displayMessage(
        error.message ||
        "Could not update password."
      );

    } finally {

      if (activeController === controller) {

        activeController = null;

        busy = false;

        updateControls();
      }
    }
  }

  // ==========================================
  // EVENT LISTENERS
  // ==========================================

  editBtn?.addEventListener(
    "click",
    startEditing
  );

  cancelBtn?.addEventListener(
    "click",
    cancelEditing
  );

  profileForm?.addEventListener(
    "submit",
    saveProfile
  );

  passwordForm?.addEventListener(
    "submit",
    changePassword
  );

  refreshBtn?.addEventListener(
    "click",
    loadProfile
  );

  logoutBtn?.addEventListener(
    "click",
    logout
  );

  // ==========================================
  // PAGE CLEANUP
  // ==========================================

  window.addEventListener(
    "beforeunload",
    () => {
      activeController?.abort();
    }
  );

  // ==========================================
  // INITIAL LOAD
  // ==========================================

  updateControls();

  loadProfile();

});
