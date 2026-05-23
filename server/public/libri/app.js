const booksGrid = document.getElementById("booksGrid");

async function loadBooks() {
    if (!booksGrid) {
        return;
    }

    try {
        const response = await fetch("/api/books");
        const books = await response.json();

        booksGrid.innerHTML = "";

        Object.entries(books).forEach(([bookId, book]) => {
            const link = document.createElement("a");
            link.className = "bookCard";
            link.href = `/nfc?book=${encodeURIComponent(bookId)}`;

            const cover = document.createElement("img");
            cover.className = "bookCover";
            cover.src = `/books/${encodeURIComponent(book.coverImage)}`;
            cover.alt = `Copertina di ${book.title}`;

            const title = document.createElement("span");
            title.className = "bookTitle";
            title.textContent = book.title;

            link.appendChild(cover);
            link.appendChild(title);
            booksGrid.appendChild(link);
        });
    } catch (err) {
        console.error("Books page error:", err);
    }
}

loadBooks();
