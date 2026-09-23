requireAdminAuth();

const API = "http://localhost:5000/api/admin/buses";

const busForm = document.getElementById("busForm");
const busTable = document.getElementById("busTable");
const searchInput = document.getElementById("searchInput");

let buses = [];
let editId = null;

// LOAD BUSES FROM MONGODB
async function loadBuses(){
    const res = await adminFetch(API);
    const data = await res.json();

    buses = data.buses || [];
    renderBuses(buses);
    updateBusStats();
}

// SHOW BUSES
function renderBuses(data){
    busTable.innerHTML = "";

    if(data.length === 0){
        busTable.innerHTML = `
            <tr>
                <td colspan="8" style="text-align:center;color:#777;">
                    No buses found
                </td>
            </tr>
        `;
        return;
    }

    data.forEach((bus)=>{
        const busNo = bus.busNo || bus.bus_no || bus.regNo || "-";
        const from = bus.from || "-";
        const to = bus.to || "-";
        const date = bus.date || "-";
        const depart = bus.depart || "-";
        const arrive = bus.arrive || "-";
        const type = bus.type || "-";
        const fareMin = bus.fareMin ?? bus.fare_min ?? 0;
        const fareMax = bus.fareMax ?? bus.fare_max ?? 0;
        const totalSeats = bus.totalSeats ?? "-";

        busTable.innerHTML += `
            <tr>
                <td>${busNo}</td>
                <td>${from} - ${to}</td>
                <td>${date}</td>
                <td>${depart} - ${arrive}</td>
                <td>${type}</td>
                <td>Rs.${fareMin} - Rs.${fareMax}</td>
                <td>${totalSeats}</td>
                <td>
                    <button class="edit-btn" onclick="editBus('${bus._id}')">Edit</button>
                    <button class="delete-btn" onclick="deleteBus('${bus._id}')">Delete</button>
                </td>
            </tr>
        `;
    });
}

// ADD / UPDATE BUS
busForm.addEventListener("submit", async function(e){
    e.preventDefault();

   const bus = {
    from: document.getElementById("from").value,
    to: document.getElementById("to").value,
    date: document.getElementById("date").value,
    depart: document.getElementById("depart").value,
    arrive: document.getElementById("arrive").value,
    type: document.getElementById("type").value,

    busNo: document.getElementById("bus_no").value,
    regNo: document.getElementById("bus_no").value,

    distanceKm: Number(document.getElementById("distance_km").value),
    fareMin: Number(document.getElementById("fare_min").value),
    fareMax: Number(document.getElementById("fare_max").value),
    totalSeats: Number(document.getElementById("total_seats").value) || 40
};

    if(editId === null){
        await adminFetch(API,{
            method:"POST",
            headers:{
                "Content-Type":"application/json"
            },
            body:JSON.stringify(bus)
        });

        alert("Bus added to MongoDB");
    }
    else{
        await adminFetch(`${API}/${editId}`,{
            method:"PUT",
            headers:{
                "Content-Type":"application/json"
            },
            body:JSON.stringify(bus)
        });

        alert("Bus updated in MongoDB");
        editId = null;
        document.getElementById("saveBtn").innerText = "Save Bus";
    }

    busForm.reset();
    loadBuses();
});

// EDIT BUS
function editBus(id){
    const bus = buses.find(b => b._id === id);

    document.getElementById("from").value = bus.from || "";
    document.getElementById("to").value = bus.to || "";
    document.getElementById("date").value = bus.date || "";
    document.getElementById("depart").value = bus.depart || "";
    document.getElementById("arrive").value = bus.arrive || "";
    document.getElementById("type").value = bus.type || "";
    document.getElementById("bus_no").value = bus.busNo || bus.bus_no || bus.regNo || "";
    document.getElementById("distance_km").value = bus.distanceKm || bus.distance_km || "";
    document.getElementById("fare_min").value = bus.fareMin || bus.fare_min || "";
    document.getElementById("fare_max").value = bus.fareMax || bus.fare_max || "";
    document.getElementById("total_seats").value = bus.totalSeats || 40;

    editId = id;
    document.getElementById("saveBtn").innerText = "Update Bus";

    window.scrollTo({top:0,behavior:"smooth"});
}

// DELETE BUS
async function deleteBus(id){
    if(confirm("Are you sure you want to delete this bus?")){
        await adminFetch(`${API}/${id}`,{
            method:"DELETE"
        });

        alert("Bus deleted from MongoDB");
        loadBuses();
    }
}

// LOGOUT
function logout(){
    localStorage.removeItem("adminToken");
        localStorage.removeItem("adminEmail");
    window.location.href = "admin-login.html";
}

loadBuses();

const typeFilter = document.getElementById("typeFilter");

function updateBusStats(){
    document.getElementById("busCount").innerText = buses.length;

    const routes = new Set(
        buses.map(bus => `${bus.from}-${bus.to}`)
    );

    const destinations = new Set(
        buses.map(bus => bus.to)
    );

    const totalFare = buses.reduce((sum,bus)=>{
        return sum + Number(bus.fareMin || bus.fare_min || 0);
    },0);

    const avgFare = buses.length
        ? Math.round(totalFare / buses.length)
        : 0;

    document.getElementById("routeCount").innerText = routes.size;
    document.getElementById("destinationCount").innerText = destinations.size;
    document.getElementById("fareAvg").innerText = "Rs. " + avgFare;
}

function applyFilters(){
    const searchValue = searchInput.value.toLowerCase();
    const typeValue = typeFilter.value;

    let filtered = buses.filter(bus =>
        (bus.busNo || bus.bus_no || "").toLowerCase().includes(searchValue) ||
        (bus.from || "").toLowerCase().includes(searchValue) ||
        (bus.to || "").toLowerCase().includes(searchValue)
    );

    if(typeValue !== ""){
        filtered = filtered.filter(bus => bus.type === typeValue);
    }

    renderBuses(filtered);
}

searchInput.addEventListener("input", applyFilters);
typeFilter.addEventListener("change", applyFilters);