requireAdminAuth();

const API = "http://localhost:5000/api/admin/bookings";

const bookingTable = document.getElementById("bookingTable");
const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");

let bookings = [];

/* LOAD BOOKINGS FROM MONGODB */
async function loadBookings(){
    try{
        const res = await adminFetch(API);
        const data = await res.json();

        bookings = data.bookings || [];
        renderBookings(bookings);
        updateSummary();
    }
    catch(error){
        console.log(error);
        alert("Bookings load error");
    }
}

/* SHOW BOOKINGS */
function renderBookings(data){
    bookingTable.innerHTML = "";

    if(data.length === 0){
        bookingTable.innerHTML = `
            <tr>
                <td colspan="9" style="text-align:center;color:#777;">
                    No bookings found
                </td>
            </tr>
        `;
        return;
    }

    data.forEach((booking)=>{
        const ticketId = booking.ticketId || booking._id;
        const passenger = booking.passengerName || booking.passenger || booking.name || "N/A";
        const email = booking.email || "N/A";
        const route = booking.route || `${booking.from || "N/A"} - ${booking.to || "N/A"}`;
        const seat = booking.seatNo || booking.seat || booking.seats || "N/A";
        const date = booking.date || booking.travelDate || "N/A";
        const amount = booking.totalFare || booking.amount || booking.totalAmount || booking.fare || 0;
        const status = booking.status || "Pending";

        bookingTable.innerHTML += `
            <tr>
                <td>${ticketId}</td>
                <td>${passenger}</td>
                <td>${email}</td>
                <td>${route}</td>
                <td>${seat}</td>
                <td>${date}</td>
                <td>Rs. ${amount}</td>
                <td>
                    <span class="status ${status.toLowerCase()}">
                        ${status}
                    </span>
                </td>
                <td>
                    <button class="view-btn" onclick="viewBooking('${booking._id}')">
                        View
                    </button>

                    <button
                        class="cancel-btn"
                        onclick="cancelBooking('${booking._id}')"
                        ${status === "Cancelled" ? "disabled" : ""}
                    >
                        Cancel
                    </button>
                </td>
            </tr>
        `;
    });
}

/* SUMMARY */
function updateSummary(){
    const total = bookings.length;

    const confirmed = bookings.filter(
        b => b.status === "Paid"
    ).length;

    const cancelled = bookings.filter(
        b => b.status === "Cancelled"
    ).length;

    const revenue = bookings
        .filter(b => b.status === "Paid")
        .reduce((sum,b)=> {
            return sum + Number(b.totalFare || b.amount || b.totalAmount || b.fare || 0);
        },0);

    document.getElementById("totalBookings").innerText = total;
    document.getElementById("confirmedBookings").innerText = confirmed;
    document.getElementById("cancelledBookings").innerText = cancelled;
    document.getElementById("totalRevenue").innerText = "Rs. " + revenue;
}

/* SEARCH + FILTER */
function filterBookings(){
    const searchValue = searchInput.value.toLowerCase();
    const statusValue = statusFilter.value;

    let filtered = bookings.filter((booking)=>{
        const text = `
            ${booking.ticketId || ""}
            ${booking.passengerName || ""}
            ${booking.passenger || ""}
            ${booking.name || ""}
            ${booking.email || ""}
            ${booking.route || ""}
            ${booking.from || ""}
            ${booking.to || ""}
            ${booking.seatNo || ""}
            ${booking.seat || ""}
        `.toLowerCase();

        return text.includes(searchValue);
    });

    if(statusValue !== "All"){
        filtered = filtered.filter(
            booking => (booking.status || "Pending") === statusValue
        );
    }

    renderBookings(filtered);
}

/* VIEW BOOKING */
function viewBooking(id){
    const booking = bookings.find(b => b._id === id);

    if(!booking){
        alert("Booking not found");
        return;
    }

    const status = (booking.status || "Pending").toLowerCase();

    showDetailModal("Booking Details", [
        { label: "Ticket ID", value: booking.ticketId || booking._id },
        { label: "Passenger", value: booking.passengerName || booking.passenger || booking.name || "N/A" },
        { label: "Email", value: booking.email || "N/A" },
        { label: "Route", value: booking.route || `${booking.from || "N/A"} - ${booking.to || "N/A"}` },
        { label: "Seat", value: booking.seatNo || booking.seat || booking.seats || "N/A" },
        { label: "Date", value: booking.date || booking.travelDate || "N/A" },
        { label: "Amount", value: "Rs. " + (booking.totalFare || booking.amount || booking.totalAmount || booking.fare || 0) },
        { label: "Status", value: booking.status || "Pending", badge: status },
    ]);
}

/* CANCEL BOOKING */
async function cancelBooking(id){
    if(confirm("Are you sure you want to cancel this booking?")){
        try{
            await adminFetch(`${API}/${id}/cancel`,{
                method:"PUT"
            });

            alert("Booking cancelled");
            loadBookings();
        }
        catch(error){
            console.log(error);
            alert("Cancel booking error");
        }
    }
}

/* LOGOUT */
function logout(){
    localStorage.removeItem("adminToken");
        localStorage.removeItem("adminEmail");
    window.location.href = "admin-login.html";
}

searchInput.addEventListener("input",filterBookings);
statusFilter.addEventListener("change",filterBookings);

loadBookings();