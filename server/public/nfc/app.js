const params = new URLSearchParams(window.location.search);
const bookId = params.get("book");
const bookTitle = document.getElementById("bookTitle");
const bookCover = document.getElementById("bookCover");
const confirmButton = document.getElementById("confirmButton");
const successMessage = document.getElementById("successMessage");
const errorMessage = document.getElementById("errorMessage");

initNfcPage();

async function initNfcPage() {
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

        bookTitle.textContent = book.title;

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
    bookTitle.textContent = "Errore";
    bookCover.hidden = true;
    confirmButton.disabled = true;
    errorMessage.textContent = message;
}

function hidePageLoader() {
    document.body.classList.remove("loading");
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

        successMessage.style.display = "block";
        confirmButton.style.display = "none";

        setTimeout(() => {
            window.location.href = "/mobile";
        }, 2000);
    } catch (err) {
        showError(err.message);
        confirmButton.disabled = false;
    }
}
