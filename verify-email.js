const API_URL = "http://localhost:5000/api/auth";

const icon = document.getElementById("verifyIcon");
const title = document.getElementById("verifyTitle");
const message = document.getElementById("verifyMessage");
const action = document.getElementById("verifyAction");

function showResult(success, msg) {
  icon.className = "verify-icon " + (success ? "success" : "error");
  icon.innerHTML = success
    ? '<i class="fa-solid fa-circle-check"></i>'
    : '<i class="fa-solid fa-circle-xmark"></i>';
  title.textContent = success ? "Email Verified!" : "Verification Failed";
  message.textContent = msg;
  action.style.display = "inline-block";
}

async function verify() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  const email = params.get("email");

  if (!token || !email) {
    showResult(false, "This verification link is missing information. Please use the link from your email exactly as sent.");
    return;
  }

  try {
    const res = await fetch(`${API_URL}/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, email }),
    });

    const data = await res.json();
    showResult(data.success, data.message || (data.success ? "Your email has been verified." : "Verification failed."));
  } catch (error) {
    console.error(error);
    showResult(false, "Could not reach the server. Please make sure the backend is running and try again.");
  }
}

verify();
