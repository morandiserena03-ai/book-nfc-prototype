const socket = io();
const deviceId = localStorage.getItem("deviceId");
const backButton = document.getElementById("backButton");
const LIGHT_BOX_ROTATION_MIN_DEG = 4;
const LIGHT_BOX_ROTATION_MAX_DEG = 8;

socket.on("update", () => {
    loadUsers();
});

if (backButton) {
    backButton.addEventListener("click", goBack);
}

async function loadUsers() {
    const response = await fetch("/users");
    const users = await response.json();

    if (deviceId && users[deviceId] && !users[deviceId].inCenter) {
        users[deviceId] = await enterCenter();
    }

    renderUsers(users);
}

function renderUsers(users) {
    const buttons = document.getElementById("centerUserButtons");
    const message = document.getElementById("centerMobileMessage");
    const currentUser = users[deviceId];
    const otherUsers = Object.entries(users)
        .filter(([id, user]) => id !== deviceId && user.inCenter);

    buttons.innerHTML = "";

    if (!deviceId || !currentUser) {
        message.innerText = "Registrati dalla pagina Mobile per avvicinarti agli altri utenti.";
        return;
    }

    if (!otherUsers.length) {
        message.innerText = "Non ci sono ancora altri utenti nel centro.";
        return;
    }

    message.innerText = "";

    otherUsers.forEach(([targetDeviceId, user]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.innerText = user.nickname;
        button.style.setProperty("--mobile-box-rotation", `${randomLightBoxRotation()}deg`);

        if (currentUser.approachTargetId === targetDeviceId) {
            button.classList.add("isActive");
        }

        button.addEventListener("click", () => {
            approachUser(targetDeviceId);
        });

        buttons.appendChild(button);
    });
}

async function enterCenter() {
    const response = await fetch("/center/enter", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            deviceId
        })
    });

    if (!response.ok) {
        throw new Error("Center enter error");
    }

    return response.json();
}

async function approachUser(targetDeviceId) {
    const response = await fetch("/center/approach", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            deviceId,
            targetDeviceId
        })
    });

    if (!response.ok) {
        const message = document.getElementById("centerMobileMessage");
        message.innerText = "Non riesco ad avvicinarti ora. Riprova tra poco.";
        return;
    }

    await loadUsers();
}

loadUsers();

function goBack() {
    if (window.history.length > 1) {
        window.history.back();
        return;
    }

    window.location.href = "/mobile";
}

function randomLightBoxRotation() {
    const direction = Math.random() > 0.5 ? 1 : -1;

    return direction * randomBetween(LIGHT_BOX_ROTATION_MIN_DEG, LIGHT_BOX_ROTATION_MAX_DEG);
}

function randomBetween(min, max) {
    return min + (Math.random() * (max - min));
}
