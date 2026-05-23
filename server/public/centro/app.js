async function loadBooksMenu() {

    const dropdown =
        document.getElementById("booksDropdown");

    if (!dropdown) {
        return;
    }

    try {
        const response = await fetch("/api/books");
        const books = await response.json();

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

loadBooksMenu();
