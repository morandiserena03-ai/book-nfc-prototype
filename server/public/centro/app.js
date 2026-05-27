const socket = io();

socket.on("update", () => {
    loadUsers();
});

async function loadUsers() {
    const response = await fetch("/users");
    const users = await response.json();

    renderUsers(users);
}

function renderUsers(users) {
    const container = document.getElementById("centerUsers");
    const userList = Object.entries(users).sort((a, b) => {
        return a[1].centerOrder - b[1].centerOrder;
    });
    const basePositions = getBasePositions(userList);
    const orderedIds = userList.map(([deviceId]) => deviceId);
    const currentIds = new Set(userList.map(([deviceId]) => deviceId));

    container.querySelectorAll(".centerUser").forEach(figure => {
        if (!currentIds.has(figure.dataset.deviceId)) {
            figure.remove();
        }
    });

    userList.forEach(([deviceId, user]) => {
        const left = basePositions.get(deviceId);
        const approachDirection = getApproachDirection(deviceId, user.approachTargetId, orderedIds);
        const usesRightShape = approachDirection === "left" || (!approachDirection && left >= 50);
        const shapeSrc = usesRightShape ? "/Icons/Sagoma-dx.png" : "/Icons/Sagoma-sx.png";
        let figure = container.querySelector(`[data-device-id="${deviceId}"]`);

        if (!figure) {
            figure = document.createElement("article");
            figure.classList.add("centerUser");
            figure.dataset.deviceId = deviceId;

            const img = document.createElement("img");
            img.alt = "";
            img.classList.add("centerUserShape");

            const nickname = document.createElement("h2");
            nickname.classList.add("centerUserNickname");

            figure.appendChild(img);
            figure.appendChild(nickname);
            container.appendChild(figure);
        }

        figure.classList.toggle("centerUserLeft", !usesRightShape);
        figure.classList.toggle("centerUserRight", usesRightShape);
        figure.querySelector(".centerUserShape").src = shapeSrc;
        figure.querySelector(".centerUserNickname").innerText = user.nickname;
        figure.style.left = `${left}%`;
    });
}

function getBasePositions(userList) {
    const positions = new Map();
    const minLeft = 24;
    const maxLeft = 76;

    userList.forEach(([deviceId], index) => {
        const ratio = userList.length <= 1 ? 0.5 : index / (userList.length - 1);
        positions.set(deviceId, minLeft + ((maxLeft - minLeft) * ratio));
    });

    return positions;
}

function getApproachDirection(deviceId, targetDeviceId, orderedIds) {
    if (!targetDeviceId) {
        return null;
    }

    const currentIndex = orderedIds.indexOf(deviceId);
    const targetIndex = orderedIds.indexOf(targetDeviceId);

    if (currentIndex === -1 || targetIndex === -1) {
        return null;
    }

    if (Math.abs(currentIndex - targetIndex) !== 1) {
        return null;
    }

    return currentIndex < targetIndex ? "right" : "left";
}

loadUsers();
