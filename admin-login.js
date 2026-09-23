const ADMIN_LOGIN_API = "http://localhost:5000/api/auth/admin-login";

document.getElementById("adminLoginForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    const btn = document.getElementById("loginBtn");

    btn.innerHTML = "Signing In...";
    btn.disabled = true;

    try {
        const res = await fetch(ADMIN_LOGIN_API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });

        const data = await res.json();

        if (data.success) {
            localStorage.setItem("adminToken", data.token);
            localStorage.setItem("adminEmail", data.admin.email);
            window.location.href = "admin-dashboard.html";
        } else {
            alert(data.message || "Invalid Admin Credentials");
            btn.innerHTML = "Sign In";
            btn.disabled = false;
        }
    } catch (error) {
        console.error(error);
        alert("Could not reach the server. Please try again.");
        btn.innerHTML = "Sign In";
        btn.disabled = false;
    }
});
