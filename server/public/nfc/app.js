const params = new URLSearchParams(window.location.search);
const bookId = params.get("book");
const bookTitle = document.getElementById("bookTitle");
const bookCover = document.getElementById("bookCover");
const bookGenres = document.getElementById("bookGenres");
const confirmButton = document.getElementById("confirmButton");
const successMessage = document.getElementById("successMessage");
const errorMessage = document.getElementById("errorMessage");

if (!bookId) {
    showError("Parametro libro mancante nell'URL.");
} else {
    loadBook(bookId);
}

async function loadBook(bookId) {
    try {
        const res = await fetch(`/api/book/${encodeURIComponent(bookId)}`);

        if (!res.ok) {
            throw new Error("Libro non trovato");
        }

        const book = await res.json();

        bookTitle.textContent = book.title;
        bookGenres.textContent = book.genres.join(" · ");

        if (book.coverImage) {
            bookCover.src = `/books/${encodeURIComponent(book.coverImage)}`;
            bookCover.hidden = false;
        }

        confirmButton.addEventListener("click", () => confirmBook(bookId));
    } catch (err) {
        showError(err.message);
    }
}

function showError(message) {
    bookTitle.textContent = "Errore";
    bookCover.hidden = true;
    bookGenres.textContent = "";
    confirmButton.disabled = true;
    errorMessage.textContent = message;
}

async function confirmBook(bookId) {
    confirmButton.disabled = true;

    const deviceId = localStorage.getItem("deviceId");

    if (!deviceId) {
        showError("Devi prima registrarti da /mobile prima di aggiungere un libro.");
        return;
    }

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
