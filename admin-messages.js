requireAdminAuth();

const API = "http://localhost:5000/api/admin/messages";

const messageTable = document.getElementById("messageTable");
const searchInput = document.getElementById("searchInput");

let messages = [];

/* LOAD MESSAGES FROM MONGODB */
async function loadMessages(){
    try{
        const res = await adminFetch(API);
        const data = await res.json();

        messages = data.messages || [];
        renderMessages(messages);
        updateSummary();
    }
    catch(error){
        console.log(error);
        alert("Messages load error");
    }
}

/* SHOW MESSAGES */
function renderMessages(data){
    messageTable.innerHTML = "";

    if(data.length === 0){
        messageTable.innerHTML = `
            <tr>
                <td colspan="8" style="text-align:center;color:#777;">
                    No messages found
                </td>
            </tr>
        `;
        return;
    }

    data.forEach((msg)=>{
        const id = msg._id;
        const name = msg.name || "N/A";
        const email = msg.email || "N/A";
        const subject = msg.subject || "Contact Message";
        const message = msg.message || msg.text || "N/A";

        const date = msg.createdAt
            ? new Date(msg.createdAt).toLocaleDateString()
            : "N/A";

        const status = msg.isRead ? "Read" : "Unread";

        messageTable.innerHTML += `
            <tr>
                <td>${id.slice(-6).toUpperCase()}</td>
                <td>${name}</td>
                <td>${email}</td>
                <td>${subject}</td>
                <td class="message-text">${message}</td>
                <td>${date}</td>
                <td>
                    <span class="status ${status.toLowerCase()}">
                        ${status}
                    </span>
                </td>
                <td>
                    <button class="view-btn" onclick="viewMessage('${id}')">
                        View
                    </button>
                </td>
            </tr>
        `;
    });
}

/* SUMMARY */
function updateSummary(){
    document.getElementById("totalMessages").innerText = messages.length;

    document.getElementById("unreadMessages").innerText =
    messages.filter(msg => !msg.isRead).length;

    document.getElementById("readMessages").innerText =
    messages.filter(msg => msg.isRead).length;
}

/* SEARCH */
searchInput.addEventListener("input",function(){
    const value = searchInput.value.toLowerCase();

    const filtered = messages.filter(msg =>
        (msg.name || "").toLowerCase().includes(value) ||
        (msg.email || "").toLowerCase().includes(value) ||
        (msg.subject || "").toLowerCase().includes(value) ||
        (msg.message || msg.text || "").toLowerCase().includes(value)
    );

    renderMessages(filtered);
});

/* VIEW MESSAGE */
async function viewMessage(id){
    const msg = messages.find(m => m._id === id);

    if(!msg){
        alert("Message not found");
        return;
    }

    showDetailModal("Contact Message", [
        { label: "Message ID", value: msg._id },
        { label: "Name", value: msg.name || "N/A" },
        { label: "Email", value: msg.email || "N/A" },
        { label: "Subject", value: msg.subject || "Contact Message" },
        { label: "Message", value: msg.message || msg.text || "N/A", block: true },
    ]);

    if(msg.isRead) return;

    try{
        await adminFetch(`${API}/${id}/read`, { method: "PUT" });
        msg.isRead = true;
        renderMessages(messages);
        updateSummary();
    }
    catch(error){
        console.log(error);
    }
}

/* LOGOUT */
function logout(){
    localStorage.removeItem("adminToken");
        localStorage.removeItem("adminEmail");
    window.location.href = "admin-login.html";
}

loadMessages();