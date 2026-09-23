// LOGIN CHECK
requireAdminAuth();

const STATS_API = "http://localhost:5000/api/admin/stats";
const BOOKINGS_API = "http://localhost:5000/api/admin/bookings";

let recentBookings = [];

// LOAD DASHBOARD STATS
async function loadStats(){
    try{

        const response = await adminFetch(STATS_API);
        const data = await response.json();

        document.getElementById("totalUsers").innerText =
        data.totalUsers || 0;

        document.getElementById("totalBookings").innerText =
        data.totalBookings || 0;

        document.getElementById("totalBuses").innerText =
        data.totalBuses || 0;

        document.getElementById("totalRevenue").innerText =
        "Rs. " + (data.totalRevenue || 0);

    }
    catch(error){
        console.error(error);
    }
}

// LOAD RECENT BOOKINGS
async function loadRecentBookings(){

    try{

        const response = await adminFetch(BOOKINGS_API);
        const data = await response.json();

        recentBookings = data.bookings || [];

        const table =
        document.getElementById("recentBookingTable");

        table.innerHTML = "";

        const latestBookings =
        recentBookings.slice(0,5);

        if(latestBookings.length === 0){

            table.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center">
                    No Bookings Found
                </td>
            </tr>
            `;

            return;
        }

        latestBookings.forEach((booking)=>{

            const ticketId =
            booking.ticketId || booking._id;

            const passenger =
            booking.passengerName ||
            booking.passenger ||
            booking.name ||
            "N/A";

            const route =
            booking.route ||
            `${booking.from || ""} - ${booking.to || ""}`;

            const seat =
            booking.seatNo ||
            booking.seat ||
            booking.seats ||
            "N/A";

            const date =
            booking.travelDate ||
            booking.date ||
            "N/A";

            const status =
            booking.status ||
            "Confirmed";

            table.innerHTML += `
            <tr>

                <td>${ticketId}</td>

                <td>${passenger}</td>

                <td>${route}</td>

                <td>${seat}</td>

                <td>${date}</td>

                <td>
                    <span class="status">
                        ${status}
                    </span>
                </td>

                <td>
                    <button
                    class="view-btn"
                    onclick="viewBooking('${booking._id}')">
                    View
                    </button>
                </td>

            </tr>
            `;
        });

    }
    catch(error){
        console.error(error);
    }
}

// VIEW BOOKING
function viewBooking(id){

    const booking =
    recentBookings.find(
        b => b._id === id
    );

    if(!booking){
        return;
    }

    const status = (booking.status || "Confirmed").toLowerCase();

    showDetailModal("Booking Details", [
        { label: "Ticket ID", value: booking.ticketId || booking._id },
        { label: "Passenger", value: booking.passengerName || booking.passenger || "N/A" },
        { label: "Email", value: booking.email || "N/A" },
        { label: "Route", value: booking.route || `${booking.from || ""} - ${booking.to || ""}` },
        { label: "Seat", value: booking.seatNo || booking.seat || booking.seats || "N/A" },
        { label: "Date", value: booking.travelDate || booking.journeyDate || booking.date || "N/A" },
        { label: "Amount", value: "Rs. " + (booking.totalFare || booking.amount || booking.totalAmount || booking.fare || 0) },
        { label: "Status", value: booking.status || "Confirmed", badge: status },
    ]);
}

// LOGOUT
function logout(){

    if(confirm("Logout from Admin Panel?")){

        localStorage.removeItem("adminToken");
        localStorage.removeItem("adminEmail");

        window.location.href =
        "admin-login.html";
    }
}

// INITIAL LOAD
loadStats();
loadRecentBookings();

// AUTO REFRESH EVERY 30 SEC
setInterval(()=>{

    loadStats();
    loadRecentBookings();

},30000);
function loadAdminPhoto(){
    const savedPhoto = localStorage.getItem("adminPhoto");

    if(savedPhoto){
        document.getElementById("dashboardAdminPhoto").src = savedPhoto;
    }
}

loadAdminPhoto();