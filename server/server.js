const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
    console.log(req.method, req.url);
    next();
});

// CARTELLA PUBLIC
app.use(express.static(path.join(__dirname, "public")));

// DATI
let users = {};

const books = {
    book1: {
    title: "I tredici colpevoli",
    coverImage: "I tredici colpevoli.png",
    genres: ["thriller", "giallo"]
  },
  book2: {
    title: "Intermezzo",
    coverImage: "Intermezzo.png",
    genres: ["rosa", "biografico", "giallo"]
  },
  book3: {
    title: "Trentatrè piccole storie di design",
    coverImage: "Trentatre.png",
    genres: ["saggistica"]
  }
};

function getLastUserId() {
    return Object.keys(users).pop();
}

function getUserForScan(deviceId) {
    const resolvedDeviceId = deviceId || getLastUserId();

    if (!resolvedDeviceId) {
        return {
            deviceId: null,
            user: null
        };
    }

    return {
        deviceId: resolvedDeviceId,
        user: users[resolvedDeviceId]
    };
}

function addBookToUser(user, book) {
    book.genres.forEach(g => {
        user.collection.push(g);
    });

    io.emit("update");
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function renderNfcConfirmationPage(bookId, book) {
    const safeBookId = escapeHtml(bookId);
    const safeTitle = escapeHtml(book.title);
    const safeCoverSrc = book.coverImage
        ? escapeHtml(`/books/${encodeURIComponent(book.coverImage)}`)
        : "";

    return `
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta
        name="viewport"
        content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
    <title>${safeTitle}</title>
    <style>
        * {
            box-sizing: border-box;
        }

        html,
        body {
            width: 100%;
            min-height: 100%;
            margin: 0;
            background: #05053E;
            color: white;
            font-family: Arial, sans-serif;
        }

        body {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
        }

        main {
            width: min(100%, 420px);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
        }

        h1 {
            margin: 0 0 20px;
            font-size: clamp(2rem, 9vw, 3.2rem);
            line-height: 1;
            font-weight: 900;
            text-align: center;
        }

        .book-cover {
            display: block;
            width: auto;
            height: auto;
            margin: 0 0 28px;
        }

        button {
            width: 100%;
            max-width: 320px;
            border: none;
            border-radius: 14px;
            padding: 16px 18px;
            background: white;
            color: #05053E;
            font-size: 1rem;
            font-weight: 800;
            text-transform: lowercase;
        }

        button:disabled {
            opacity: 0.72;
        }

        .message {
            display: none;
            margin: 0;
            font-size: clamp(1.5rem, 8vw, 2.5rem);
            line-height: 0.95;
            font-weight: 900;
        }

        main.added h1,
        main.added .book-cover,
        main.added button {
            display: none;
        }

        main.added .message {
            display: block;
        }
    </style>
</head>
<body>
    <main id="confirmation">
        <h1>${safeTitle}</h1>
        ${safeCoverSrc ? `<img class="book-cover" src="${safeCoverSrc}" alt="">` : ""}
        <button id="confirmButton" type="button">aggiungi alla libreria</button>
        <p class="message">Aggiunto in libreria</p>
    </main>

    <script>
        const confirmation = document.getElementById("confirmation");
        const button = document.getElementById("confirmButton");

        button.addEventListener("click", async () => {
            button.disabled = true;

            try {
                const res = await fetch("/nfc/${safeBookId}/confirm", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        deviceId: localStorage.getItem("deviceId")
                    })
                });

                const data = await res.json();

                if (!res.ok || !data.success) {
                    throw new Error(data.error || "Errore aggiunta libro");
                }

                confirmation.classList.add("added");
            } catch (err) {
                button.disabled = false;
                alert(err.message);
            }
        });
    </script>
</body>
</html>`;
}

// SOCKET
io.on("connection", () => {
    console.log("Client connected");
});

// PAGINA MOBILE
app.get("/mobile", (req, res) => {
    res.sendFile(path.join(__dirname, "public/mobile/index.html"));
});

// PAGINA DASHBOARD
app.get("/dashboard", (req, res) => {
    res.sendFile(path.join(__dirname, "public/dashboard/index.html"));
});

// REGISTER
app.post("/register", (req, res) => {

    const { nickname, deviceId } = req.body;

    console.log("BODY:", req.body);

    if (!nickname || !deviceId) {
        return res.status(400).json({
            error: "Missing nickname or deviceId"
        });
    }

    users[deviceId] = {
        nickname,
        collection: []
    };

    console.log("REGISTER:", users[deviceId]);

    io.emit("update");

    res.json(users[deviceId]);
});

// SCAN
app.post("/scan", (req, res) => {

    const { deviceId, bookId } = req.body;

    const user = users[deviceId];
    const book = books[bookId];

    if (!user || !book) {
        return res.status(400).json({
            error: "Invalid user or book"
        });
    }

    addBookToUser(user, book);

    console.log("SCAN:", user);

    res.json(user);
});

app.get("/users", (req, res) => {
    res.json(users);
});

app.get("/scan/:bookId", (req, res) => {

    const bookId = req.params.bookId;

    const book = books[bookId];

    if (!book) {
        return res.send("Invalid scan");
    }

    res.send(renderNfcConfirmationPage(bookId, book));
});

app.get("/nfc/:bookId", (req, res) => {

    const bookId = req.params.bookId;

    const book = books[bookId];

    if (!book) {
        return res.send("Book not found");
    }

    res.send(renderNfcConfirmationPage(bookId, book));
});

app.post("/nfc/:bookId/confirm", (req, res) => {

    const bookId = req.params.bookId;
    const { deviceId } = req.body;

    const { deviceId: resolvedDeviceId, user } = getUserForScan(deviceId);
    const book = books[bookId];

    if (!user || !book) {
        return res.status(400).json({
            error: "User or book not found"
        });
    }

    addBookToUser(user, book);

    console.log("NFC CONFIRMED:", resolvedDeviceId, user);

    res.json({
        success: true
    });
});

// START SERVER
server.listen(3000, "0.0.0.0", () => {
    console.log("Server running on port 3000");
});
