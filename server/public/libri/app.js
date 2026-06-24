const booksCarousel = document.getElementById("booksCarousel");
const selectedBookTitle = document.getElementById("selectedBookTitle");
const selectedBookAuthor = document.getElementById("selectedBookAuthor");
const addBookButton = document.getElementById("addBookButton");
const libraryMessage = document.getElementById("libraryMessage");
const closeButton = document.getElementById("closeButton");
const feedbackOverlay = document.getElementById("feedbackOverlay");

const FEATURED_BOOK_TITLES = new Set([
    "Trentatrè piccole storie di design",
    "Intermezzo",
    "Mar del plata",
    "Uno studio in rosso"
]);

let libraryBooks = [];
let selectedBookId = null;
let scrollUpdateFrame = null;

initPublisherLibrary();

async function initPublisherLibrary() {
    closeButton.addEventListener("click", goBack);
    addBookButton.addEventListener("click", addSelectedBookToLibrary);
    booksCarousel.addEventListener("scroll", requestActiveBookUpdate, { passive: true });
    booksCarousel.addEventListener("wheel", handleCarouselWheel, { passive: false });

    await loadBooks();
}

async function loadBooks() {
    try {
        const response = await fetch("/api/books");
        const books = await response.json();

        libraryBooks = Object.entries(books)
            .filter(([, book]) => !FEATURED_BOOK_TITLES.has(book.title));

        renderBooks();
        setSelectedBook(libraryBooks[0]?.[0]);
        hidePageLoader();
    } catch (err) {
        console.error("Publisher library error:", err);
        showMessage("Impossibile caricare la libreria. Riprova tra poco.");
        addBookButton.disabled = true;
        hidePageLoader();
    }
}

function renderBooks() {
    const slides = libraryBooks.map(([bookId, book]) => {
        const slide = document.createElement("button");
        slide.className = "bookSlide";
        slide.type = "button";
        slide.dataset.bookId = bookId;
        slide.setAttribute("aria-label", `${book.title}, ${book.author}`);

        const cover = document.createElement("img");
        cover.className = "bookCover";
        cover.src = `/books/${encodeURIComponent(book.coverImage)}`;
        cover.alt = `Copertina di ${book.title}`;

        slide.appendChild(cover);
        slide.addEventListener("click", () => {
            slide.scrollIntoView({
                behavior: "smooth",
                block: "nearest",
                inline: "center"
            });
            setSelectedBook(bookId);
        });

        return slide;
    });

    booksCarousel.replaceChildren(...slides);
}

function requestActiveBookUpdate() {
    if (scrollUpdateFrame) {
        return;
    }

    scrollUpdateFrame = requestAnimationFrame(() => {
        scrollUpdateFrame = null;
        setSelectedBook(getClosestBookId());
    });
}

function handleCarouselWheel(event) {
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        return;
    }

    const maxScrollLeft = booksCarousel.scrollWidth - booksCarousel.clientWidth;
    const nextScrollLeft = booksCarousel.scrollLeft + event.deltaY;
    const canScrollLeft = event.deltaY < 0 && booksCarousel.scrollLeft > 0;
    const canScrollRight = event.deltaY > 0 && booksCarousel.scrollLeft < maxScrollLeft;

    if (!canScrollLeft && !canScrollRight) {
        return;
    }

    event.preventDefault();
    booksCarousel.scrollLeft = Math.max(0, Math.min(maxScrollLeft, nextScrollLeft));
}

function getClosestBookId() {
    const carouselCenter = booksCarousel.scrollLeft + booksCarousel.clientWidth / 2;
    let closestBookId = selectedBookId;
    let closestDistance = Number.POSITIVE_INFINITY;

    booksCarousel.querySelectorAll(".bookSlide").forEach(slide => {
        const slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
        const distance = Math.abs(carouselCenter - slideCenter);

        if (distance < closestDistance) {
            closestDistance = distance;
            closestBookId = slide.dataset.bookId;
        }
    });

    return closestBookId;
}

function setSelectedBook(bookId) {
    if (!bookId || bookId === selectedBookId) {
        return;
    }

    selectedBookId = bookId;
    const selectedEntry = libraryBooks.find(([entryBookId]) => entryBookId === selectedBookId);

    if (!selectedEntry) {
        return;
    }

    const [, book] = selectedEntry;
    selectedBookTitle.textContent = book.title;
    selectedBookAuthor.textContent = book.author || "";
    addBookButton.disabled = false;
    addBookButton.textContent = "Aggiungi in libreria";
    libraryMessage.textContent = "";

    const activeIndex = libraryBooks.findIndex(([entryBookId]) => entryBookId === selectedBookId);

    booksCarousel.querySelectorAll(".bookSlide").forEach((slide, index) => {
        const isActive = slide.dataset.bookId === selectedBookId;
        const distance = Math.abs(index - activeIndex);
        const scale = Math.max(0.64, 1 - distance * 0.1);
        const depth = Math.max(1, 30 - distance);

        slide.classList.toggle("is-active", isActive);
        slide.setAttribute("aria-current", isActive ? "true" : "false");
        slide.style.setProperty("--slide-scale", isActive ? "1.1" : scale.toFixed(2));
        slide.style.setProperty("--slide-depth", String(depth));
    });
}

async function addSelectedBookToLibrary() {
    const canContinue = await ensureRegisteredUser();

    if (!canContinue || !selectedBookId) {
        return;
    }

    addBookButton.disabled = true;

    try {
        const response = await fetch("/nfc/confirm", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                deviceId: localStorage.getItem("deviceId"),
                bookId: selectedBookId
            })
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || "Errore aggiunta libro");
        }

        await showAddBookFeedback();
        window.location.href = "/mobile";
    } catch (err) {
        addBookButton.disabled = false;
        addBookButton.textContent = "Aggiungi in libreria";
        showMessage(err.message);
    }
}

async function ensureRegisteredUser() {
    const deviceId = localStorage.getItem("deviceId");

    if (!deviceId) {
        redirectToRegistration();
        return false;
    }

    try {
        const response = await fetch("/users");
        const users = await response.json();

        if (!users[deviceId]) {
            redirectToRegistration();
            return false;
        }

        return true;
    } catch (err) {
        console.error("User check error:", err);
        showMessage("Impossibile verificare la registrazione. Riprova tra poco.");
        return false;
    }
}

function redirectToRegistration() {
    alert("Registrazione necessaria per aggiungere un libro alla tua libreria.");
    window.location.href = "/mobile";
}

function goBack() {
    if (window.history.length > 1) {
        window.history.back();
        return;
    }

    window.location.href = "/mobile";
}

function showMessage(message) {
    libraryMessage.textContent = message;
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

function hidePageLoader() {
    document.body.classList.remove("loading");
}
