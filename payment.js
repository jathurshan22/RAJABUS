/* ===== Live 3D card sync ===== */
const card3d = document.getElementById("card3d");
const cardNameDisplay = document.getElementById("cardNameDisplay");
const cardNumberDisplay = document.getElementById("cardNumberDisplay");
const cardExpiryDisplay = document.getElementById("cardExpiryDisplay");
const cardCvvDisplay = document.getElementById("cardCvvDisplay");

const cardHolderInput = document.getElementById("cardHolderInput");
const cardNumberInput = document.getElementById("cardNumberInput");
const cardExpiryInput = document.getElementById("cardExpiryInput");
const cardCvvInput = document.getElementById("cardCvvInput");

if (cardHolderInput) {
  cardHolderInput.addEventListener("input", () => {
    const name = cardHolderInput.value.trim();
    cardNameDisplay.textContent = name ? name.toUpperCase() : "YOUR NAME";
  });
}

if (cardNumberInput) {
  cardNumberInput.addEventListener("input", () => {
    const digits = cardNumberInput.value.replace(/\D/g, "").slice(0, 16);
    const grouped = digits.replace(/(.{4})/g, "$1 ").trim();
    cardNumberInput.value = grouped;

    const placeholder = "•••• •••• •••• ••••";
    const shown = grouped ? (grouped + placeholder.slice(grouped.length)) : placeholder;
    cardNumberDisplay.textContent = shown;

    card3d.classList.remove("brand-visa", "brand-mastercard");
    if (digits.startsWith("4")) {
      card3d.classList.add("brand-visa");
    } else if (/^5[1-5]/.test(digits) || digits.startsWith("5")) {
      card3d.classList.add("brand-mastercard");
    }
  });
}

if (cardExpiryInput) {
  cardExpiryInput.addEventListener("input", () => {
    let digits = cardExpiryInput.value.replace(/\D/g, "").slice(0, 4);
    if (digits.length > 2) {
      digits = digits.slice(0, 2) + "/" + digits.slice(2);
    }
    cardExpiryInput.value = digits;
    cardExpiryDisplay.textContent = digits || "MM/YY";
  });
}

if (cardCvvInput) {
  cardCvvInput.addEventListener("input", () => {
    const digits = cardCvvInput.value.replace(/\D/g, "").slice(0, 3);
    cardCvvInput.value = digits;
    const placeholder = "•••";
    cardCvvDisplay.textContent = digits ? (digits + placeholder.slice(digits.length)) : placeholder;
  });

  cardCvvInput.addEventListener("focus", () => {
    card3d.classList.add("flipped");
  });

  cardCvvInput.addEventListener("blur", () => {
    card3d.classList.remove("flipped");
  });
}

const booking = JSON.parse(localStorage.getItem("currentBooking"));

if (!booking) {
  showToast("No booking found", "error");
  setTimeout(() => {
    window.location.href = "booking-details.html";
  }, 1500);
}

document.getElementById("paymentAmount").textContent =
  `Rs. ${booking.totalFare}`;

document.getElementById("payBtn").addEventListener("click", async () => {
  const res = await fetch(
    `http://localhost:5000/api/bookings/pay/${booking._id}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("userToken")}`,
      },
    }
  );

  const data = await res.json();

  if (data.success) {
    localStorage.setItem("currentBooking", JSON.stringify(data.booking));
    showToast("Payment successful", "success");
    setTimeout(() => {
      window.location.href = "booking-history.html";
    }, 1500);
  } else {
    showToast(data.message || "Payment failed", "error");
  }
});
