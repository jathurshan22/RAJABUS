requireAdminAuth();

const STATS_API = "http://localhost:5000/api/admin/stats";

const defaultProfile = {
    fullName:"JATHURSHAN",
    email:"jathurshanjohn2217@gmail.com",
    phone:"0778446248",
    role:"Super Admin",
    joinedDate:"22-06-2026"
};

function loadProfile(){
    const savedProfile =
    JSON.parse(localStorage.getItem("adminProfile")) || defaultProfile;

    document.getElementById("fullName").value = savedProfile.fullName;
    document.getElementById("email").value = savedProfile.email;
    document.getElementById("phone").value = savedProfile.phone;
    document.getElementById("role").value = savedProfile.role;
    document.getElementById("joinedDate").value = savedProfile.joinedDate;

    document.getElementById("profileNameText").innerText = savedProfile.fullName;
    document.getElementById("profileEmailText").innerText = savedProfile.email;

    const savedPhoto = localStorage.getItem("adminPhoto");

    if(savedPhoto){
        document.getElementById("profilePreview").src = savedPhoto;
    }
}

const ADMIN_ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ADMIN_MAX_PHOTO_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

document.getElementById("profileImage").addEventListener("change",function(e){
    const file = e.target.files[0];

    if(!file) return;

    if(!ADMIN_ALLOWED_PHOTO_TYPES.includes(file.type)){
        alert("Please choose a valid image file (JPG, PNG, WEBP or GIF).");
        e.target.value = "";
        return;
    }

    if(file.size > ADMIN_MAX_PHOTO_SIZE_BYTES){
        alert("Image is too large. Please choose a photo under 2MB.");
        e.target.value = "";
        return;
    }

    const reader = new FileReader();

    reader.onload = function(event){
        document.getElementById("profilePreview").src = event.target.result;
        localStorage.setItem("adminPhoto",event.target.result);
        alert("Profile photo updated");
    };

    reader.onerror = function(){
        alert("Could not read that image. Please try a different file.");
    };

    reader.readAsDataURL(file);
});

function saveProfile(){
    const profile = {
        fullName:document.getElementById("fullName").value,
        email:document.getElementById("email").value,
        phone:document.getElementById("phone").value,
        role:document.getElementById("role").value,
        joinedDate:document.getElementById("joinedDate").value
    };

    localStorage.setItem("adminProfile",JSON.stringify(profile));

    document.getElementById("profileNameText").innerText = profile.fullName;
    document.getElementById("profileEmailText").innerText = profile.email;

    alert("Profile updated successfully");
}

function openPasswordBox(){
    const box = document.getElementById("passwordBox");

    box.style.display =
    box.style.display === "none" ? "block" : "none";
}

async function changePassword(){
    const currentPassword = document.getElementById("currentPassword").value;
    const newPassword = document.getElementById("newPassword").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    if(!currentPassword || !newPassword){
        alert("Please fill in both password fields");
        return;
    }

    if(newPassword.length < 6){
        alert("New password must be at least 6 characters");
        return;
    }

    if(newPassword !== confirmPassword){
        alert("Confirm password does not match");
        return;
    }

    try{
        const res = await adminFetch("http://localhost:5000/api/auth/admin-change-password", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ currentPassword, newPassword }),
        });

        const data = await res.json();

        if(!data.success){
            alert(data.message || "Could not update password");
            return;
        }

        document.getElementById("currentPassword").value = "";
        document.getElementById("newPassword").value = "";
        document.getElementById("confirmPassword").value = "";

        alert("Password changed successfully");
    }
    catch(error){
        console.error(error);
        alert("Could not reach the server. Please try again.");
    }
}

async function loadStats(){
    try{
        const res = await adminFetch(STATS_API);
        const data = await res.json();

        document.getElementById("totalUsers").innerText = data.totalUsers || 0;
        document.getElementById("totalBookings").innerText = data.totalBookings || 0;
        document.getElementById("totalBuses").innerText = data.totalBuses || 0;
        document.getElementById("totalRevenue").innerText = "Rs. " + (data.totalRevenue || 0);
    }
    catch(error){
        console.log(error);
    }
}

function logout(){
    localStorage.removeItem("adminToken");
        localStorage.removeItem("adminEmail");
    window.location.href = "admin-login.html";
}

loadProfile();
loadStats();