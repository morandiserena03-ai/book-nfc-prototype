const BASE_URL = window.location.origin;
const STICKER_STAGE_TOP = 205;

let deviceId = localStorage.getItem("deviceId");

if (!deviceId) {
    deviceId = Date.now().toString();
    localStorage.setItem("deviceId", deviceId);
}

const socket = io();

socket.on("update", () => {
    refreshUser();
});

function getStickerRect(layout, stickerSize) {

    return {
        left: layout.x,
        top: layout.y,
        right: layout.x + stickerSize,
        bottom: layout.y + stickerSize
    };
}

function rectsOverlap(a, b, gap) {

    return !(
        a.right + gap < b.left ||
        a.left - gap > b.right ||
        a.bottom + gap < b.top ||
        a.top - gap > b.bottom
    );
}

function isFarEnough(candidate, placedRects, stickerSize) {

    const candidateRect = getStickerRect(candidate, stickerSize);

    return placedRects.every((rect) => {
        return !rectsOverlap(candidateRect, rect, 18);
    });
}

function createStickerLayout(placedRects, index) {

    const stickerSize = 180;
    const containerTop = STICKER_STAGE_TOP;
    const containerHeight =
        Math.max(window.innerHeight - containerTop, stickerSize);

    /*
        Lascia una piccola porzione degli sticker libera di uscire
        dai bordi, ma mantiene sempre una parte importante visibile.
    */

    const overflow = stickerSize * 0.32;
    const minVisible = stickerSize * 0.56;

    const minX = -overflow;
    const maxX = window.innerWidth - minVisible;
    const minY = 8;
    const maxY = containerHeight - minVisible;

    let bestCandidate = null;
    let bestDistance = -1;

    for (let attempt = 0; attempt < 90; attempt++) {

        const candidate = {
            x: minX + (Math.random() * (maxX - minX)),
            y: minY + (Math.random() * (maxY - minY)),
            rotation: (Math.random() * 50) - 25
        };

        if (isFarEnough(candidate, placedRects, stickerSize)) {
            return candidate;
        }

        const candidateRect = getStickerRect(candidate, stickerSize);
        const nearestDistance = placedRects.reduce((nearest, rect) => {

            const centerX =
                (candidateRect.left + candidateRect.right) / 2;
            const centerY =
                (candidateRect.top + candidateRect.bottom) / 2;
            const rectCenterX =
                (rect.left + rect.right) / 2;
            const rectCenterY =
                (rect.top + rect.bottom) / 2;

            const distance = Math.hypot(
                centerX - rectCenterX,
                centerY - rectCenterY
            );

            return Math.min(nearest, distance);

        }, Infinity);

        if (nearestDistance > bestDistance) {
            bestDistance = nearestDistance;
            bestCandidate = candidate;
        }
    }

    if (bestCandidate) {
        return bestCandidate;
    }

    const columns = 2;
    const row = Math.floor(index / columns);
    const column = index % columns;

    return {
        x: column === 0 ? minX : maxX,
        y: minY + ((row * stickerSize * 0.62) % (maxY - minY)),
        rotation: (Math.random() * 50) - 25
    };
}

function renderUser(user) {

    // nickname
    document.getElementById("userNickname").innerText =
        user.nickname;

    // nasconde register dopo login
    document.getElementById("registerBox").style.display =
        "none";

    const container =
        document.getElementById("stickers");

    container.innerHTML = "";

    /*
        Layout persistente sticker.

        Viene salvato nel browser
        e NON cambia più.
    */

    let savedLayout =
        JSON.parse(localStorage.getItem("stickerLayout"));

    if (!savedLayout) {
        savedLayout = {};
    }

    const placedRects = [];

    user.collection.forEach((genre, index) => {

        const key = `${genre}-${index}`;

        // genera SOLO se non esiste
        if (!savedLayout[key]) {

            savedLayout[key] =
                createStickerLayout(placedRects, index);
        }

        const layout = savedLayout[key];
        const stickerSize = 180;

        placedRects.push(getStickerRect(layout, stickerSize));

        const img =
            document.createElement("img");

        img.src = `/stickers/${genre}.png`;

        img.classList.add("sticker");

        img.style.left = `${layout.x}px`;

        img.style.top = `${layout.y}px`;

        img.style.transform =
            `rotate(${layout.rotation}deg)`;

        container.appendChild(img);
    });

    // salva layout
    localStorage.setItem(
        "stickerLayout",
        JSON.stringify(savedLayout)
    );
}

// --------------------
// REGISTER (GLOBAL)
// --------------------
async function registerUser() {

    const nickname = document.getElementById("nickname").value;

    try {

        const res = await fetch(`${BASE_URL}/register`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                nickname,
                deviceId
            })
        });

        const user = await res.json();

        renderUser(user);

        document.getElementById("registerBox").style.display = "none";

    } catch (err) {
        console.error(err);
        alert("Register error");
    }
}

// --------------------
// SCAN (GLOBAL)
// --------------------
async function scan(bookId) {

    try {

        const res = await fetch(`${BASE_URL}/scan`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                deviceId,
                bookId
            })
        });

        const user = await res.json();

        renderUser(user);

    } catch (err) {
        console.error(err);
        alert("Scan error");
    }
}

// --------------------
// REFRESH
// --------------------
async function refreshUser() {

    try {

        const res = await fetch(`${BASE_URL}/users`);
        const users = await res.json();

        const user = users[deviceId];

        if (user) {
            renderUser(user);
        }

    } catch (err) {
        console.error(err);
    }
}
