const socket = io();
let booksById = {};

socket.on("update", () => {
    loadDashboard();
});

async function loadDashboard() {

    const [usersResponse, booksResponse] = await Promise.all([
        fetch("/users"),
        fetch("/api/books")
    ]);

    const users = await usersResponse.json();
    booksById = await booksResponse.json();

    console.log(users);

    render(users);
}

function render(users) {

    const container =
        document.getElementById("usersContainer");

    container.innerHTML = "";

    Object.values(users).forEach(user => {

        const card =
            document.createElement("div");

        card.classList.add("userCard");

        const title =
            document.createElement("h2");

        title.innerText = user.nickname;

        card.appendChild(title);

        card.appendChild(createSavedBooksSection(user));

        container.appendChild(card);
    });
}

function createSavedBooksSection(user) {

    const section =
        document.createElement("section");

    section.classList.add("savedBooks");

    const heading =
        document.createElement("h3");

    heading.innerText = "Libri salvati";

    section.appendChild(heading);

    const savedBookIds = Array.isArray(user.savedBooks)
        ? user.savedBooks
        : [];

    if (!savedBookIds.length) {
        const empty =
            document.createElement("p");

        empty.classList.add("emptyState");
        empty.innerText = "Nessun libro salvato";

        section.appendChild(empty);

        return section;
    }

    const list =
        document.createElement("div");

    list.classList.add("savedBooksList");

    savedBookIds.forEach((bookId) => {
        const book = booksById[bookId];

        if (!book) {
            return;
        }

        list.appendChild(createBookCard(book));
    });

    section.appendChild(list);

    return section;
}

function createBookCard(book) {

    const item =
        document.createElement("article");

    item.classList.add("savedBookCard");

    if (book.coverImage) {
        const cover =
            document.createElement("img");

        cover.classList.add("savedBookCover");
        cover.src = `/books/${encodeURIComponent(book.coverImage)}`;
        cover.alt = `Copertina di ${book.title}`;

        item.appendChild(cover);
    }

    const details =
        document.createElement("div");

    details.classList.add("savedBookDetails");

    const title =
        document.createElement("h4");

    title.innerText = book.title;

    details.appendChild(title);

    if (book.author) {
        const author =
            document.createElement("p");

        author.innerText = book.author;

        details.appendChild(author);
    }

    const genres = Array.isArray(book.genres)
        ? book.genres
        : [];

    if (genres.length) {
        const stickerList =
            document.createElement("div");

        stickerList.classList.add("savedBookStickers");

        genres.forEach((genre) => {
            const sticker =
                document.createElement("img");

            sticker.classList.add("savedBookSticker");
            sticker.src = `/stickers/${genre}.png`;
            sticker.alt = genre;

            stickerList.appendChild(sticker);
        });

        details.appendChild(stickerList);
    }

    item.appendChild(details);

    return item;
}

loadDashboard();
