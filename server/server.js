const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path");
const books = require("./data/books");

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

// NFC page now served as static asset in public/nfc/index.html
// ROUTE API per ottenere dati libro
app.get("/api/book/:bookId", (req, res) => {

    const bookId = req.params.bookId;
    const book = books[bookId];

    if (!book) {
        return res.status(404).json({
            error: "Book not found"
        });
    }

    res.json(book);
});

// PAGINA NFC UNICA
app.get("/nfc", (req, res) => {
    res.sendFile(path.join(__dirname, "public/nfc/index.html"));
});

// Compatibilità con le vecchie URL
app.get("/nfc/:bookId", (req, res) => {
    res.redirect(`/nfc?book=${encodeURIComponent(req.params.bookId)}`);
});

app.get("/scan/:bookId", (req, res) => {
    res.redirect(`/nfc?book=${encodeURIComponent(req.params.bookId)}`);
});

app.post("/nfc/confirm", (req, res) => {

    const { deviceId, bookId } = req.body;

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

// DELETE USER
app.post("/delete", (req, res) => {

    const { deviceId } = req.body;

    if (!deviceId || !users[deviceId]) {
        return res.status(400).json({
            error: "User not found"
        });
    }

    const deletedUser = users[deviceId];
    delete users[deviceId];

    console.log("DELETE USER:", deletedUser);

    io.emit("update");

    res.json({
        success: true,
        message: "Utente cancellato"
    });
});

// START SERVER
server.listen(3000, "0.0.0.0", () => {
    console.log("Server running on port 3000");
});
