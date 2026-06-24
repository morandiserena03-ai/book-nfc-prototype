const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const books = require("./data/books");

loadEnvFile();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "anthropic/claude-haiku-4.5";
const THEMATIC_FIELDS = [
    "topic",
    "plot",
    "protagonists",
    "characters",
    "temporalSetting",
    "geographicSetting",
    "moral"
];
const AFFINITY_KEYWORD_FIELDS = [
    "topic",
    "plot",
    "moral"
];
const MATCH_TYPE_ORDER = [
    "temi_affini",
    "autore_uguale",
    "generi_uguali",
    "stili_narrativi_uguali"
];
const MATCH_PROMPT = `Sei il motore di matching semantico del prototipo Book Pride.

# CONTESTO

Riceverai:

* una coppia specifica di utenti
* per ogni utente: nickname e savedBooks
* un catalogo di libri
* eventualmente avoidBookPairs, cioe coppie di libri gia usate in match precedenti tra gli stessi utenti

Ogni libro puo contenere:

{
"id": "",
"title": "",
"author": "",
"genres": [],
"narrativeStyles": [],
"topic": [],
"plot": [],
"protagonists": [],
"characters": [],
"temporalSetting": [],
"geographicSetting": [],
"moral": []
}

# OBIETTIVO

Per la coppia di utenti ricevuta devi individuare il miglior match possibile tra un solo libro del primo utente e un solo libro del secondo utente.

La selezione della coppia di libri deve seguire una gerarchia di priorita.

Se ricevi avoidBookPairs, evita di selezionare quelle coppie di libri se esiste almeno un'altra coppia possibile con un collegamento significativo. Considera una coppia gia usata anche se i due titoli appaiono in ordine invertito. Usa una coppia gia presente in avoidBookPairs solo se non esistono alternative valide. Se ricevi preferNewBookPair uguale a true, dai massima priorita alla scelta di una coppia di libri non presente in avoidBookPairs.

Una volta individuata la migliore coppia di libri, devi restituire soprattutto il tema affine piu significativo tra i due libri.

# CAMPI TEMATICI

Considera come temi i seguenti campi:

* topic
* plot
* protagonists
* characters
* temporalSetting
* geographicSetting
* moral

# GERARCHIA DI PRIORITA

Per scegliere la migliore coppia di libri utilizza il seguente ordine:

1. temi affini
2. autore uguale
3. generi uguali
4. stili narrativi uguali

A parita di livello scegli la coppia che genera il collegamento culturale, emotivo o narrativo piu significativo.

# REGOLE DI CONFRONTO

I match di tipo:

* autore uguale
* generi uguali
* stili narrativi uguali

devono essere determinati esclusivamente tramite confronto letterale.

Una corrispondenza esiste solo quando la parola o espressione e scritta esattamente nello stesso modo.

Non considerare sinonimi, concetti simili o parole correlate come corrispondenze uguali.

# TEMI AFFINI

Esiste un match per temi affini quando due elementi appartenenti ai campi tematici condividono uno stesso campo semantico, emotivo, culturale, filosofico, simbolico o narrativo.

Per i temi affini non importa se le parole di partenza sono identiche o diverse:

* se due libri condividono letteralmente una parola tematica, usala come indizio semantico, non come "tema uguale"
* non restituire mai un match di tipo "temi_uguali"
* trasforma sempre la relazione in una nuova parola o breve espressione emergente
* il cuore del match deve essere il significato comune, non la coincidenza letterale

Quando individui temi affini:

* non restituire i termini originali
* genera una nuova parola o breve espressione che rappresenti il concetto comune
* la parola emergente non deve coincidere con nessuno dei termini originali
* non deve essere un semplice sinonimo di uno dei termini originali
* deve rappresentare un concetto piu ampio, trasversale o profondo
* deve essere preferibilmente composta da una o due parole
* deve essere evocativa e significativa per un lettore

La parola emergente deve provenire da parole chiave scelte nei campi topic, plot e moral dei due libri selezionati:

* scegli 2 o 3 parole chiave da topic, plot e moral del libro_1
* scegli 2 o 3 parole chiave da topic, plot e moral del libro_2
* scegli solo parole chiave gia presenti letteralmente nei dati dei rispettivi libri
* scegli le parole chiave piu concise disponibili
* preferisci parole singole; se necessario usa espressioni di massimo due parole
* evita espressioni lunghe quando nello stesso libro esiste una parola chiave piu breve nello stesso campo semantico
* le parole chiave scelte per entrambi i libri devono appartenere allo stesso campo semantico, emotivo, culturale, filosofico, simbolico o narrativo
* le parole chiave possono anche essere identiche nei due libri, ma l'elemento in elements deve essere sempre un concetto nuovo e piu ampio
* usa quelle parole chiave per generare la parola emergente
* inserisci le parole chiave del libro_1 in keywords_1
* inserisci le parole chiave del libro_2 in keywords_2

Se esistono piu possibili temi affini, restituisci il concetto emergente piu significativo.

# VALIDAZIONE OBBLIGATORIA DEI MATCH

Prima di restituire l'output, verifica ogni categoria.

Per "generi_uguali":

* ogni elemento deve comparire letteralmente in genres del libro_1
* lo stesso elemento deve comparire letteralmente in genres del libro_2
* se non compare in entrambi, non inserirlo

Per "stili_narrativi_uguali":

* ogni elemento deve comparire letteralmente in narrativeStyles del libro_1
* lo stesso elemento deve comparire letteralmente in narrativeStyles del libro_2
* se non compare in entrambi, non inserirlo

Per "autore_uguale":

* l'autore puo essere restituito solo se author del libro_1 e author del libro_2 sono identici carattere per carattere

Per "temi_affini":

* l'elemento restituito deve essere una nuova parola o breve espressione
* non deve essere identico a nessun elemento presente nei campi tematici del libro_1
* non deve essere identico a nessun elemento presente nei campi tematici del libro_2
* non deve essere identico a un genere, stile narrativo, autore o titolo dei due libri
* se il miglior tema affine coincide con un elemento originale, devi generarne uno piu ampio e trasversale
* se non riesci a generare un tema affine valido, non inserire "temi_affini"

# MATCH MULTIPLI

Dopo aver selezionato la migliore coppia di libri:

* individua il miglior tema affine
* raccogli tutti i generi uguali presenti
* raccogli tutti gli stili narrativi uguali presenti
* raccogli l'eventuale autore uguale

Le tipologie di match possono sommarsi.

# OUTPUT

Restituisci esclusivamente JSON valido.

Non aggiungere testo, spiegazioni o markdown.

Formato:

{
"user_1": "",
"book_1": "",
"user_2": "",
"book_2": "",
"matches": [
{
"type": "temi_affini",
"elements": [],
"keywords_1": [],
"keywords_2": []
},
{
"type": "autore_uguale",
"elements": [],
"keywords_1": [],
"keywords_2": []
},
{
"type": "generi_uguali",
"elements": [],
"keywords_1": [],
"keywords_2": []
},
{
"type": "stili_narrativi_uguali",
"elements": [],
"keywords_1": [],
"keywords_2": []
}
]
}

Nei campi book_1 e book_2 restituisci sempre il title del libro, non l'id.

Per tutte le categorie diverse da "temi_affini", keywords_1 e keywords_2 devono essere array vuoti.

Nell'array matches restituisci le categorie solo se presenti e sempre in questo ordine:

1. temi_affini
2. autore_uguale
3. generi_uguali
4. stili_narrativi_uguali

# REGOLE FINALI

* Utilizza esclusivamente le informazioni presenti nell'input.
* Non inventare dati.
* Non confrontare un utente con se stesso.
* Puoi selezionare un solo libro per utente.
* Non restituire mai "temi_uguali".
* Prima di rispondere, controlla che autore, generi e stili narrativi non siano stati dedotti semanticamente.
* Se autore, generi o stili narrativi non sono verificabili tramite confronto letterale esatto, rimuovili.
* Se una categoria non produce match non inserirla nell'array matches.
* Se non esiste alcun match restituisci:

{
"user_1": "",
"book_1": "",
"user_2": "",
"book_2": "",
"matches": []
}

L'obiettivo e far emergere connessioni culturali, emotive e narrative significative tra i lettori.`;
const matchedBookPairHistory = new Map();

function loadEnvFile() {
    const envPath = path.join(__dirname, "..", ".env");

    if (!fs.existsSync(envPath)) {
        return;
    }

    const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);

    lines.forEach(line => {
        const trimmedLine = line.trim();

        if (!trimmedLine || trimmedLine.startsWith("#")) {
            return;
        }

        const separatorIndex = trimmedLine.indexOf("=");

        if (separatorIndex === -1) {
            return;
        }

        const key = trimmedLine.slice(0, separatorIndex).trim();
        let value = trimmedLine.slice(separatorIndex + 1).trim();

        if (!key || process.env[key]) {
            return;
        }

        if (
            (value.startsWith('"') && value.endsWith('"'))
            || (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }

        process.env[key] = value;
    });
}

// Allow Socket.IO connections from the public tunnel host and localhost
const io = new Server(server, {
    cors: {
        origin: [
            "https://7bwqsgpg-3000.euw.devtunnels.ms",
            "http://localhost:3000",
            "http://127.0.0.1:3000"
        ],
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
    console.log(req.method, req.url);
    next();
});

// CARTELLA PUBLIC
app.use(express.static(path.join(__dirname, "public")));
// Serve Icons folder at /Icons (project root)
app.use('/Icons', express.static(path.join(__dirname, '..', 'Icons')));
// Serve project fonts so other devices do not depend on locally installed fonts
app.use('/fonts', express.static(path.join(__dirname, '..', 'fonts')));

// DATI
let users = {};

function normalizeCenterOrder() {
    Object.entries(users)
        .filter(([, user]) => user.inCenter)
        .sort((a, b) => {
            const orderA = Number.isInteger(a[1].centerOrder) ? a[1].centerOrder : Infinity;
            const orderB = Number.isInteger(b[1].centerOrder) ? b[1].centerOrder : Infinity;

            return orderA - orderB;
        })
        .forEach(([deviceId], index) => {
            users[deviceId].centerOrder = index;
        });
}

function getCenterOrderedIds() {
    normalizeCenterOrder();

    return Object.entries(users)
        .filter(([, user]) => user.inCenter)
        .sort((a, b) => a[1].centerOrder - b[1].centerOrder)
        .map(([deviceId]) => deviceId);
}

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

function addBookToUser(user, book, bookId) {
    if (!Array.isArray(user.savedBooks)) {
        user.savedBooks = [];
    }

    if (!user.savedBooks.includes(bookId)) {
        user.savedBooks.push(bookId);
    }

    book.genres.forEach(g => {
        user.collection.push(g);
    });

    io.emit("update");
}

function normalizeBookValue(value) {
    if (!value) {
        return [];
    }

    return Array.isArray(value) ? value : [value];
}

function getBookForMatchPayload(bookId) {
    const book = books[bookId];

    if (!book) {
        return null;
    }

    return {
        id: bookId,
        title: book.title,
        author: book.author,
        genres: normalizeBookValue(book.genres),
        narrativeStyles: normalizeBookValue(book.narrativeStyles),
        topic: normalizeBookValue(book.topic),
        plot: normalizeBookValue(book.plot),
        protagonists: normalizeBookValue(book.protagonists),
        characters: normalizeBookValue(book.characters),
        temporalSetting: normalizeBookValue(book.temporalSetting),
        geographicSetting: normalizeBookValue(book.geographicSetting),
        moral: normalizeBookValue(book.moral)
    };
}

function getBooksForMatchByIds(bookIds) {
    return [...new Set(bookIds)]
        .map(getBookForMatchPayload)
        .filter(Boolean);
}

function getUserSavedBookIds(user) {
    return Array.isArray(user.savedBooks)
        ? user.savedBooks.filter(bookId => books[bookId])
        : [];
}

function getUserPairHistoryKey(deviceId, targetDeviceId) {
    return [deviceId, targetDeviceId].sort().join("::");
}

function getBookPairHistoryKey(bookTitleA, bookTitleB) {
    return [bookTitleA, bookTitleB].sort().join("::");
}

function getPossibleBookPairCount(userA, userB) {
    const matchablePairCount = getMatchableBookPairsForUsers(userA, userB).length;

    return matchablePairCount || getUserSavedBookIds(userA).length * getUserSavedBookIds(userB).length;
}

function getBookPairsForUsers(userA, userB) {
    return getUserSavedBookIds(userA).flatMap(bookIdA => {
        return getUserSavedBookIds(userB).map(bookIdB => ({
            bookIdA,
            bookIdB,
            bookA: books[bookIdA],
            bookB: books[bookIdB]
        }));
    });
}

function hasDisplayableBookMatch(bookA, bookB) {
    if (!bookA || !bookB) {
        return false;
    }

    return getBookAffinityKeywords(bookA).length >= 2 && getBookAffinityKeywords(bookB).length >= 2;
}

function getBookPairMatchScore(bookA, bookB) {
    if (!bookA || !bookB) {
        return 0;
    }

    const equalGenreCount = getLiteralIntersection(
        normalizeBookValue(bookA.genres),
        normalizeBookValue(bookB.genres)
    ).length;
    const equalStyleCount = getLiteralIntersection(
        normalizeBookValue(bookA.narrativeStyles),
        normalizeBookValue(bookB.narrativeStyles)
    ).length;
    const equalAuthorCount = bookA.author && bookA.author === bookB.author ? 1 : 0;

    return (equalAuthorCount * 40)
        + (equalGenreCount * 20)
        + (equalStyleCount * 10);
}

function getMatchableBookPairsForUsers(userA, userB) {
    return getBookPairsForUsers(userA, userB)
        .filter(pair => {
            return hasDisplayableBookMatch(pair.bookA, pair.bookB);
        })
        .sort((pairA, pairB) => {
            return getBookPairMatchScore(pairB.bookA, pairB.bookB)
                - getBookPairMatchScore(pairA.bookA, pairA.bookB);
        });
}

function getUnusedBookPairs(userA, userB, avoidBookPairs) {
    const avoidedPairKeys = new Set(
        avoidBookPairs.map(pair => getBookPairHistoryKey(pair.book_1, pair.book_2))
    );
    const pairs = getMatchableBookPairsForUsers(userA, userB);
    const unusedPairs = pairs.filter(pair => {
        return !avoidedPairKeys.has(getBookPairHistoryKey(pair.bookA.title, pair.bookB.title));
    });

    return unusedPairs.length ? unusedPairs : pairs;
}

function getAvoidBookPairsForUsers(deviceId, targetDeviceId, userA, userB) {
    const historyKey = getUserPairHistoryKey(deviceId, targetDeviceId);
    const possiblePairCount = getPossibleBookPairCount(userA, userB);
    let history = matchedBookPairHistory.get(historyKey);

    if (!history || !possiblePairCount) {
        history = new Set();
        matchedBookPairHistory.set(historyKey, history);
    }

    if (history.size >= possiblePairCount) {
        history.clear();
    }

    return [...history]
        .map(pairKey => pairKey.split("::"))
        .map(([bookA, bookB]) => ({
            book_1: bookA,
            book_2: bookB
        }));
}

function recordSelectedBookPair(deviceId, targetDeviceId, bookPair) {
    if (!bookPair || !bookPair.bookA || !bookPair.bookB) {
        return;
    }

    recordBookPairTitles(deviceId, targetDeviceId, bookPair.bookA.title, bookPair.bookB.title);
}

function recordBookPairTitles(deviceId, targetDeviceId, bookTitleA, bookTitleB) {
    const historyKey = getUserPairHistoryKey(deviceId, targetDeviceId);
    const history = matchedBookPairHistory.get(historyKey) || new Set();

    history.add(getBookPairHistoryKey(bookTitleA, bookTitleB));
    matchedBookPairHistory.set(historyKey, history);
}

function isAvoidedBookPair(match, avoidBookPairs) {
    if (!match || !match.book_1 || !match.book_2) {
        return false;
    }

    const matchPairKey = getBookPairHistoryKey(match.book_1, match.book_2);

    return avoidBookPairs.some(pair => {
        return getBookPairHistoryKey(pair.book_1, pair.book_2) === matchPairKey;
    });
}

function isExpectedBookPair(match, bookPair) {
    if (!match || !match.book_1 || !match.book_2 || !bookPair) {
        return false;
    }

    return getBookPairHistoryKey(match.book_1, match.book_2)
        === getBookPairHistoryKey(bookPair.bookA.title, bookPair.bookB.title);
}

function findBookByMatchValue(value) {
    if (!value) {
        return null;
    }

    if (books[value]) {
        return books[value];
    }

    return Object.values(books).find(book => {
        return book && book.title === value;
    }) || null;
}

function getLiteralIntersection(valuesA, valuesB) {
    const setB = new Set(valuesB);

    return [...new Set(valuesA.filter(value => setB.has(value)))];
}

function getBookThemes(book) {
    return THEMATIC_FIELDS.flatMap(field => normalizeBookValue(book[field]));
}

function getBookAffinityKeywords(book) {
    return AFFINITY_KEYWORD_FIELDS.flatMap(field => normalizeBookValue(book[field]));
}

function getOriginalBookTerms(bookA, bookB) {
    return new Set([
        bookA.title,
        bookB.title,
        bookA.author,
        bookB.author,
        ...normalizeBookValue(bookA.genres),
        ...normalizeBookValue(bookB.genres),
        ...normalizeBookValue(bookA.narrativeStyles),
        ...normalizeBookValue(bookB.narrativeStyles),
        ...getBookThemes(bookA),
        ...getBookThemes(bookB)
    ].filter(Boolean));
}

function getModelMatchElements(match, type) {
    if (!match || !Array.isArray(match.matches)) {
        return [];
    }

    const foundMatch = match.matches.find(item => item.type === type);

    return foundMatch && Array.isArray(foundMatch.elements)
        ? foundMatch.elements.filter(Boolean)
        : [];
}

function getModelMatch(match, type) {
    if (!match || !Array.isArray(match.matches)) {
        return null;
    }

    return match.matches.find(item => item.type === type) || null;
}

function sanitizeModelKeywords(values, allowedValues) {
    if (!Array.isArray(values)) {
        return [];
    }

    const allowedSet = new Set(allowedValues);

    return [...new Set(values.filter(value => allowedSet.has(value)))].slice(0, 3);
}

function sanitizeBookMatch(match) {
    if (!match) {
        return null;
    }

    const bookA = findBookByMatchValue(match.book_1);
    const bookB = findBookByMatchValue(match.book_2);

    if (!bookA || !bookB) {
        return {
            user_1: match.user_1 || "",
            book_1: match.book_1 || "",
            user_2: match.user_2 || "",
            book_2: match.book_2 || "",
            matches: []
        };
    }

    const matches = [];
    const equalGenres = getLiteralIntersection(
        normalizeBookValue(bookA.genres),
        normalizeBookValue(bookB.genres)
    );
    const equalStyles = getLiteralIntersection(
        normalizeBookValue(bookA.narrativeStyles),
        normalizeBookValue(bookB.narrativeStyles)
    );
    const equalAuthor = bookA.author && bookA.author === bookB.author ? [bookA.author] : [];
    const originalTerms = getOriginalBookTerms(bookA, bookB);
    const relatedThemeMatch = getModelMatch(match, "temi_affini");
    const validRelatedThemes = getModelMatchElements(match, "temi_affini")
        .filter(element => !originalTerms.has(element))
        .slice(0, 1);
    const keywordsA = sanitizeModelKeywords(
        relatedThemeMatch ? relatedThemeMatch.keywords_1 : [],
        getBookAffinityKeywords(bookA)
    );
    const keywordsB = sanitizeModelKeywords(
        relatedThemeMatch ? relatedThemeMatch.keywords_2 : [],
        getBookAffinityKeywords(bookB)
    );

    if (validRelatedThemes.length && keywordsA.length >= 2 && keywordsB.length >= 2) {
        matches.push({
            type: "temi_affini",
            elements: validRelatedThemes,
            keywords_1: keywordsA,
            keywords_2: keywordsB
        });
    }

    if (equalAuthor.length) {
        matches.push({
            type: "autore_uguale",
            elements: equalAuthor,
            keywords_1: [],
            keywords_2: []
        });
    }

    if (equalGenres.length) {
        matches.push({
            type: "generi_uguali",
            elements: equalGenres,
            keywords_1: [],
            keywords_2: []
        });
    }

    if (equalStyles.length) {
        matches.push({
            type: "stili_narrativi_uguali",
            elements: equalStyles,
            keywords_1: [],
            keywords_2: []
        });
    }

    return {
        user_1: match.user_1 || "",
        book_1: bookA.title,
        user_2: match.user_2 || "",
        book_2: bookB.title,
        matches: matches.sort((a, b) => {
            return MATCH_TYPE_ORDER.indexOf(a.type) - MATCH_TYPE_ORDER.indexOf(b.type);
        })
    };
}

async function runBookMatch(deviceId, targetDeviceId) {
    if (!process.env.OPENROUTER_API_KEY) {
        throw new Error("OPENROUTER_API_KEY mancante");
    }

    const userA = users[deviceId];
    const userB = users[targetDeviceId];

    if (!userA || !userB || deviceId === targetDeviceId) {
        return null;
    }

    const avoidBookPairs = getAvoidBookPairsForUsers(deviceId, targetDeviceId, userA, userB);
    const candidateBookPairs = getUnusedBookPairs(userA, userB, avoidBookPairs);

    if (!candidateBookPairs.length) {
        return null;
    }

    for (const bookPair of candidateBookPairs) {
        recordSelectedBookPair(deviceId, targetDeviceId, bookPair);

        const match = await requestOpenRouterBookMatch({
            user_1: {
                nickname: userA.nickname,
                savedBooks: [bookPair.bookIdA]
            },
            user_2: {
                nickname: userB.nickname,
                savedBooks: [bookPair.bookIdB]
            },
            catalog: getBooksForMatchByIds([bookPair.bookIdA, bookPair.bookIdB]),
            avoidBookPairs,
            preferNewBookPair: true
        });

        if (
            isExpectedBookPair(match, bookPair)
            && !isAvoidedBookPair(match, avoidBookPairs)
            && Array.isArray(match.matches)
            && match.matches.length
        ) {
            return match;
        }
    }

    return null;
}

async function requestOpenRouterBookMatch(payload) {
    const response = await fetch(OPENROUTER_API_URL, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: OPENROUTER_MODEL,
            temperature: 0.1,
            max_tokens: 2000,
            messages: [
                {
                    role: "system",
                    content: MATCH_PROMPT
                },
                {
                    role: "user",
                    content: JSON.stringify(payload)
                }
            ],
            response_format: {
                type: "json_schema",
                json_schema: {
                    name: "book_match",
                    strict: true,
                    schema: {
                        type: "object",
                        properties: {
                            user_1: { type: "string" },
                            book_1: { type: "string" },
                            user_2: { type: "string" },
                            book_2: { type: "string" },
                            matches: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        type: {
                                            type: "string",
                                            enum: [
                                                "temi_affini",
                                                "autore_uguale",
                                                "generi_uguali",
                                                "stili_narrativi_uguali"
                                            ]
                                        },
                                        elements: {
                                            type: "array",
                                            items: { type: "string" }
                                        },
                                        keywords_1: {
                                            type: "array",
                                            items: { type: "string" }
                                        },
                                        keywords_2: {
                                            type: "array",
                                            items: { type: "string" }
                                        }
                                    },
                                    required: ["type", "elements", "keywords_1", "keywords_2"],
                                    additionalProperties: false
                                }
                            }
                        },
                        required: ["user_1", "book_1", "user_2", "book_2", "matches"],
                        additionalProperties: false
                    }
                }
            }
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices && data.choices[0] && data.choices[0].message
        ? data.choices[0].message.content
        : null;

    if (!content) {
        return null;
    }

    return sanitizeBookMatch(JSON.parse(content));
}

// NFC page now served as static asset in public/nfc/index.html
app.get("/api/books", (req, res) => {
    res.json(books);
});

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

    addBookToUser(user, book, bookId);

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

// PAGINA CENTRO
app.get("/centro", (req, res) => {
    res.sendFile(path.join(__dirname, "public/centro/index.html"));
});

// PAGINA CENTRO MOBILE
app.get("/centro-mobile", (req, res) => {
    res.sendFile(path.join(__dirname, "public/centro-mobile/index.html"));
});

// PAGINA LIBRI
app.get("/libri", (req, res) => {
    res.sendFile(path.join(__dirname, "public/libri/index.html"));
});

// PAGINA DASHBOARD
app.get("/dashboard", (req, res) => {
    res.sendFile(path.join(__dirname, "public/dashboard/index.html"));
});

app.post("/center/approach", (req, res) => {

    const { deviceId, targetDeviceId } = req.body;

    if (!deviceId || !targetDeviceId || !users[deviceId] || !users[targetDeviceId]) {
        return res.status(400).json({
            error: "User not found"
        });
    }

    if (deviceId === targetDeviceId) {
        return res.status(400).json({
            error: "Target user must be different"
        });
    }

    if (!users[deviceId].inCenter || !users[targetDeviceId].inCenter) {
        return res.status(400).json({
            error: "Users must be in center"
        });
    }

    const orderedIds = getCenterOrderedIds();
    const currentIndex = orderedIds.indexOf(deviceId);
    const targetIndex = orderedIds.indexOf(targetDeviceId);
    const movingFromLeft = currentIndex < targetIndex;
    const nextOrder = orderedIds.filter(id => id !== deviceId);
    const targetIndexAfterRemoval = nextOrder.indexOf(targetDeviceId);
    const insertIndex = movingFromLeft ? targetIndexAfterRemoval : targetIndexAfterRemoval + 1;

    nextOrder.splice(insertIndex, 0, deviceId);

    nextOrder.forEach((id, index) => {
        users[id].centerOrder = index;
    });

    users[deviceId].approachTargetId = targetDeviceId;

    io.emit("update");

    io.emit("bookMatchStarted", {
        deviceId,
        targetDeviceId,
        user_1: users[deviceId].nickname,
        user_2: users[targetDeviceId].nickname
    });

    runBookMatch(deviceId, targetDeviceId)
        .then(match => {
            if (!match) {
                io.emit("bookMatchError", {
                    deviceId,
                    targetDeviceId
                });
                return;
            }

            io.emit("bookMatch", {
                deviceId,
                targetDeviceId,
                match
            });
        })
        .catch(error => {
            console.error("Book match failed:", error);
            io.emit("bookMatchError", {
                deviceId,
                targetDeviceId
            });
        });

    res.json({
        success: true
    });
});

app.post("/center/enter", (req, res) => {

    const { deviceId } = req.body;

    if (!deviceId || !users[deviceId]) {
        return res.status(400).json({
            error: "User not found"
        });
    }

    if (!users[deviceId].inCenter) {
        users[deviceId].centerOrder = Object.values(users).filter(user => user.inCenter).length;
        users[deviceId].inCenter = true;
        io.emit("update");
    }

    res.json(users[deviceId]);
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
        collection: [],
        savedBooks: [],
        inCenter: false,
        approachTargetId: null,
        centerOrder: Object.keys(users).length
    };

    console.log("REGISTER:", users[deviceId]);

    io.emit("update");

    res.json(users[deviceId]);
});

app.get("/users", (req, res) => {
    normalizeCenterOrder();
    Object.values(users).forEach(user => {
        if (!Array.isArray(user.savedBooks)) {
            user.savedBooks = [];
        }
    });
    res.json(users);
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

    Object.values(users).forEach(user => {
        if (user.approachTargetId === deviceId) {
            user.approachTargetId = null;
        }
    });

    normalizeCenterOrder();

    console.log("DELETE USER:", deletedUser);

    io.emit("update");

    res.json({
        success: true,
        message: "Utente cancellato"
    });
});

// START SERVER
server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});
