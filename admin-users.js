requireAdminAuth();

const API = "http://localhost:5000/api/admin/users";

const userTable = document.getElementById("userTable");
const searchInput = document.getElementById("searchInput");

let users = [];

/* LOAD USERS FROM MONGODB */
async function loadUsers(){
    try{
        const res = await adminFetch(API);
        const data = await res.json();

        users = data.users || [];
        renderUsers(users);
        updateSummary();
    }
    catch(error){
        console.log(error);
        alert("Users load error");
    }
}

/* SHOW USERS */
function renderUsers(data){
    userTable.innerHTML = "";

    if(data.length === 0){
        userTable.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center;color:#777;">
                    No users found
                </td>
            </tr>
        `;
        return;
    }

    data.forEach((user)=>{
        const id = user._id;
        const name = user.fullName || user.name || "N/A";
        const email = user.email || "N/A";
        const phone = user.phone || "N/A";

        const joined = user.createdAt
            ? new Date(user.createdAt).toLocaleDateString()
            : "N/A";

        const bookings = user.bookingCount || user.bookings || 0;

        userTable.innerHTML += `
            <tr>
                <td>${id.slice(-6).toUpperCase()}</td>
                <td>${name}</td>
                <td>${email}</td>
                <td>${phone}</td>
                <td>${joined}</td>
                <td>${bookings}</td>
                <td>
                    <button class="view-btn" onclick="viewUser('${id}')">
                        View
                    </button>
                </td>
            </tr>
        `;
    });
}

/* SUMMARY */
function updateSummary(){
    document.getElementById("totalUsers").innerText = users.length;
    document.getElementById("activeUsers").innerText = users.length;

    const totalBookings = users.reduce(
        (sum,user)=> sum + Number(user.bookingCount || user.bookings || 0),0
    );

    document.getElementById("totalBookings").innerText = totalBookings;
}

/* SEARCH */
searchInput.addEventListener("input",function(){
    const value = searchInput.value.toLowerCase();

    const filtered = users.filter(user =>
        (user.fullName || user.name || "").toLowerCase().includes(value) ||
        (user.email || "").toLowerCase().includes(value) ||
        (user.phone || "").toLowerCase().includes(value) ||
        (user._id || "").toLowerCase().includes(value)
    );

    renderUsers(filtered);
});

/* VIEW USER */
function viewUser(id){
    const user = users.find(u => u._id === id);

    if(!user){
        alert("User not found");
        return;
    }

    showDetailModal("User Details", [
        { label: "User ID", value: user._id },
        { label: "Name", value: user.fullName || user.name || "N/A" },
        { label: "Email", value: user.email || "N/A" },
        { label: "Phone", value: user.phone || "N/A" },
        {
            label: "Joined",
            value: user.createdAt
                ? new Date(user.createdAt).toLocaleDateString()
                : "N/A",
        },
    ]);
}

/* LOGOUT */
function logout(){
    localStorage.removeItem("adminToken");
        localStorage.removeItem("adminEmail");
    window.location.href = "admin-login.html";
}

loadUsers();