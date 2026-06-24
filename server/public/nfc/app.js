const params = new URLSearchParams(window.location.search);
const bookId = params.get("book");
const pageTitle = document.getElementById("pageTitle");
const bookTitle = document.getElementById("bookTitle");
const bookAuthor = document.getElementById("bookAuthor");
const bookCover = document.getElementById("bookCover");
const stickerLayer = document.getElementById("stickerLayer");
const confirmButton = document.getElementById("confirmButton");
const backButton = document.getElementById("backButton");
const successMessage = document.getElementById("successMessage");
const errorMessage = document.getElementById("errorMessage");
const feedbackOverlay = document.getElementById("feedbackOverlay");
const STICKER_BY_GENRE = {
    azione: "Azione.png",
    avventura: "Avventura.png",
    bambini: "Ragazzi.png",
    biografico: "Biografico.png",
    fantascienza: "Fantascienza.png",
    fantasy: "Fantasy.png",
    giallo: "Giallo.png",
    horror: "Horror.png",
    ragazzi: "Ragazzi.png",
    rosa: "Rosa.png",
    saggistica: "Saggistica.png",
    storico: "Storico.png",
    thriller: "Thriller.png",
    umoristico: "Umoristico.png"
};
const STICKER_COUNT = 10;
const FEATURED_BOOK_TITLES = new Set([
    "Trentatrè piccole storie di design",
    "Intermezzo",
    "Mar del plata",
    "Uno studio in rosso"
]);

initNfcPage();

async function initNfcPage() {
    backButton.addEventListener("click", goBack);

    const canContinue = await ensureRegisteredUser();

    if (!canContinue) {
        return;
    }

    if (!bookId) {
        showError("Parametro libro mancante nell'URL.");
    } else {
        loadBook(bookId);
    }
}

async function ensureRegisteredUser() {
    const deviceId = localStorage.getItem("deviceId");

    if (!deviceId) {
        await redirectToRegistration();
        return false;
    }

    try {
        const res = await fetch("/users");
        const users = await res.json();

        if (!users[deviceId]) {
            await redirectToRegistration();
            return false;
        }

        return true;
    } catch (err) {
        console.error("User check error:", err);
        showError("Impossibile verificare la registrazione. Riprova tra poco.");
        return false;
    }
}

async function redirectToRegistration() {
    document.body.classList.add("registration-redirect");
    await waitForPagePaint();

    alert("Registrazione necessaria per aggiungere un libro alla tua libreria.");
    window.location.href = "/mobile";
}

function waitForPagePaint() {
    return new Promise((resolve) => {
        requestAnimationFrame(() => {
            setTimeout(resolve, 0);
        });
    });
}

async function loadBook(bookId) {
    try {
        const res = await fetch(`/api/book/${encodeURIComponent(bookId)}`);

        if (!res.ok) {
            throw new Error("Libro non trovato");
        }

        const book = await res.json();

        pageTitle.textContent = FEATURED_BOOK_TITLES.has(book.title) ? "Libro di punta" : "";
        bookTitle.textContent = book.title;
        bookAuthor.textContent = book.author || "";
        renderGenreStickers(book.genres);

        if (book.coverImage) {
            bookCover.src = `/books/${encodeURIComponent(book.coverImage)}`;
            bookCover.hidden = false;
        }

        confirmButton.addEventListener("click", () => confirmBook(bookId));
        hidePageLoader();
    } catch (err) {
        showError(err.message);
    }
}

function showError(message) {
    hidePageLoader();
    pageTitle.textContent = "";
    bookTitle.textContent = "Errore";
    bookAuthor.textContent = "";
    stickerLayer.replaceChildren();
    bookCover.hidden = true;
    confirmButton.disabled = true;
    errorMessage.textContent = message;
}

function renderGenreStickers(genres = []) {
    const stickerFiles = genres
        .map(genre => STICKER_BY_GENRE[String(genre).toLowerCase()])
        .filter(Boolean);

    if (!stickerFiles.length) {
        stickerLayer.replaceChildren();
        return;
    }

    const stickers = Array.from({ length: STICKER_COUNT }, (_, index) => {
        const img = document.createElement("img");
        const file = stickerFiles[index % stickerFiles.length];

        img.className = "genre-sticker";
        img.src = `/stickers/${encodeURIComponent(file)}`;
        img.alt = "";

        return img;
    });

    stickerLayer.replaceChildren(...stickers);
}

function goBack() {
    if (window.history.length > 1) {
        window.history.back();
        return;
    }

    window.location.href = "/mobile";
}

function hidePageLoader() {
    document.body.classList.remove("loading");
}

function showAddBookFeedback() {
    return new Promise((resolve) => {
        if (!feedbackOverlay) {
            setTimeout(resolve, 2000);
            return;
        }

        feedbackOverlay.hidden = false;
        setTimeout(resolve, 2000);
    });
}

async function confirmBook(bookId) {
    confirmButton.disabled = true;

    const canContinue = await ensureRegisteredUser();

    if (!canContinue) {
        return;
    }

    const deviceId = localStorage.getItem("deviceId");

    try {
        const res = await fetch("/nfc/confirm", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                deviceId,
                bookId
            })
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
            throw new Error(data.error || "Errore aggiunta libro");
        }

        await showAddBookFeedback();
        window.location.href = "/mobile";
    } catch (err) {
        showError(err.message);
        confirmButton.disabled = false;
    }
}
