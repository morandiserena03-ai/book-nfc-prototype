const BASE_URL = window.location.origin;

let deviceId = localStorage.getItem("deviceId");

if (!deviceId) {
    deviceId = Date.now().toString();
    localStorage.setItem("deviceId", deviceId);
}

const socket = io();

socket.on("update", () => {
    refreshUser();
});

// --------------------
// INIT PAGE
// --------------------
async function initPage() {

    try {

        const res = await fetch(`${BASE_URL}/users`);
        const users = await res.json();

        const user = users[deviceId];

        if (user) {
            // Utente già registrato
            renderUser(user);
        } else {
            // Utente non trovato, mostra form registrazione
            document.getElementById("registerBox").style.display = "block";
            document.getElementById("deleteIconBtn").style.display = "none";
            hidePageLoader();
        }

    } catch (err) {
        console.error("Init error:", err);
        hidePageLoader();
    }
}

// Chiama initPage al caricamento
initPage();
loadBooksMenu();

function isDesktopLayout() {
    return window.matchMedia("(min-width: 700px)").matches;
}

async function loadBooksMenu() {

    const dropdown =
        document.getElementById("booksDropdown");

    if (!dropdown) {
        return;
    }

    try {
        const res = await fetch(`${BASE_URL}/api/books`);
        const books = await res.json();

        dropdown.innerHTML = "";

        Object.entries(books).forEach(([bookId, book]) => {

            const link =
                document.createElement("a");

            link.href = `/nfc?book=${encodeURIComponent(bookId)}`;
            link.textContent = book.title;

            dropdown.appendChild(link);
        });
    } catch (err) {
        console.error("Books menu error:", err);
    }
}

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

function getStickerStageMetrics() {

    const container =
        document.getElementById("stickers");

    return {
        width: Math.max(container.clientWidth, stickerSizeFallback()),
        height: Math.max(container.clientHeight, stickerSizeFallback())
    };
}

function stickerSizeFallback() {
    return isDesktopLayout() ? 230 : 180;
}

function isLayoutInsideStage(layout, stage, stickerSize) {

    const overflow = stickerSize * 0.32;
    const minVisible = stickerSize * 0.56;

    return (
        layout.x >= -overflow &&
        layout.x <= stage.width - minVisible &&
        layout.y >= 8 &&
        layout.y <= stage.height - minVisible
    );
}

function createStickerLayout(placedRects, index) {

    const stickerSize = stickerSizeFallback();
    const stage = getStickerStageMetrics();
    const containerHeight = stage.height;

    if (isDesktopLayout()) {
        return createDesktopStickerLayout(placedRects, index, stage, stickerSize);
    }

    /*
        Lascia una piccola porzione degli sticker libera di uscire
        dai bordi, ma mantiene sempre una parte importante visibile.
    */

    const overflow = stickerSize * 0.32;
    const minVisible = stickerSize * 0.56;

    const minX = -overflow;
    const maxX = stage.width - minVisible;
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

function createDesktopStickerLayout(placedRects, index, stage, stickerSize) {

    const overflow = stickerSize * 0.36;
    const minVisible = stickerSize * 0.58;
    const minX = -overflow;
    const maxX = stage.width - minVisible;
    const minY = 108;
    const maxY = stage.height - minVisible;

    const centerBlock = {
        left: stage.width * 0.22,
        top: stage.height * 0.32,
        right: stage.width * 0.78,
        bottom: stage.height * 0.68
    };

    let bestCandidate = null;
    let bestScore = -Infinity;

    for (let attempt = 0; attempt < 140; attempt++) {

        const candidate = {
            x: minX + (Math.random() * (maxX - minX)),
            y: minY + (Math.random() * (maxY - minY)),
            rotation: (Math.random() * 44) - 22
        };

        const candidateRect = getStickerRect(candidate, stickerSize);

        if (rectsOverlap(candidateRect, centerBlock, 34)) {
            continue;
        }

        if (!isFarEnough(candidate, placedRects, stickerSize)) {
            continue;
        }

        const centerX =
            candidate.x + (stickerSize / 2);
        const centerY =
            candidate.y + (stickerSize / 2);
        const distanceFromCenter =
            Math.hypot(centerX - (stage.width / 2), centerY - (stage.height / 2));

        if (distanceFromCenter > bestScore) {
            bestScore = distanceFromCenter;
            bestCandidate = candidate;
        }
    }

    if (bestCandidate) {
        return bestCandidate;
    }

    const fallbackPositions = [
        { x: stage.width * 0.08, y: stage.height * 0.28 },
        { x: stage.width * 0.74, y: stage.height * 0.22 },
        { x: stage.width * 0.05, y: stage.height * 0.62 },
        { x: stage.width * 0.68, y: stage.height * 0.68 },
        { x: stage.width * 0.26, y: stage.height * 0.76 },
        { x: stage.width * 0.56, y: stage.height * 0.14 }
    ];
    const fallback = fallbackPositions[index % fallbackPositions.length];

    return {
        x: Math.min(Math.max(fallback.x, minX), maxX),
        y: Math.min(Math.max(fallback.y, minY), maxY),
        rotation: (Math.random() * 44) - 22
    };
}

function renderUser(user) {
    hidePageLoader();

    // nickname
    document.getElementById("userNickname").innerText =
        user.nickname;

    // nasconde register dopo login
    document.getElementById("registerBox").style.display =
        "none";

    // mostra delete icona vicino al nickname
    document.getElementById("deleteIconBtn").style.display = "inline-flex";

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

        const key = `${isDesktopLayout() ? "desktop" : "mobile"}-${genre}-${index}`;

        // genera SOLO se non esiste
        if (!savedLayout[key]) {

            savedLayout[key] =
                createStickerLayout(placedRects, index);
        }

        const layout = savedLayout[key];
        const stickerSize = stickerSizeFallback();
        const stage = getStickerStageMetrics();

        if (!isLayoutInsideStage(layout, stage, stickerSize)) {
            savedLayout[key] =
                createStickerLayout(placedRects, index);
        }

        const currentLayout = savedLayout[key];

        placedRects.push(getStickerRect(currentLayout, stickerSize));

        const img =
            document.createElement("img");

        img.src = `/stickers/${genre}.png`;

        img.classList.add("sticker");

        img.style.left = `${currentLayout.x}px`;

        img.style.top = `${currentLayout.y}px`;

        img.style.transform =
            `rotate(${currentLayout.rotation}deg)`;

        container.appendChild(img);
    });

    // salva layout
    localStorage.setItem(
        "stickerLayout",
        JSON.stringify(savedLayout)
    );
}

function hidePageLoader() {
    document.body.classList.remove("loading");
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
// DELETE
// --------------------
async function deleteUser() {

    if (!confirm("Sei sicuro di voler cancellare il tuo account?")) {
        return;
    }

    try {

        const res = await fetch(`${BASE_URL}/delete`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                deviceId
            })
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || "Delete error");
        }

        // Pulisci localStorage
        localStorage.removeItem("deviceId");
        localStorage.removeItem("stickerLayout");

        // Pulisci interfaccia
        document.getElementById("userNickname").innerText = "";
        document.getElementById("registerBox").style.display = "block";
        document.getElementById("nickname").value = "";
        document.getElementById("stickers").innerHTML = "";
        document.getElementById("deleteIconBtn").style.display = "none";

        alert("Account cancellato");

        // Ricarica la pagina per generare un nuovo deviceId
        location.reload();

    } catch (err) {
        console.error(err);
        alert("Delete error: " + err.message);
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
        } else {
            // Utente non trovato, reset interfaccia
            document.getElementById("userNickname").innerText = "";
            document.getElementById("registerBox").style.display = "block";
            document.getElementById("nickname").value = "";
            document.getElementById("stickers").innerHTML = "";
            document.getElementById("deleteIconBtn").style.display = "none";
        }

    } catch (err) {
        console.error(err);
    }
}
