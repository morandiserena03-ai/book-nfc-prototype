const socket = io();
const AURA_REFRESH_INTERVALS = {
    "book-0": 7700,
    "book-1": 8600,
    "keyword-0": 5000,
    "keyword-1": 5000,
    "keyword-2": 5000
};
const AURA_REFRESH_OFFSETS = {
    "book-0": 7700,
    "book-1": 8600,
    "keyword-0": 5000,
    "keyword-1": 5600,
    "keyword-2": 6200
};
const BOOK_SLOT_TYPES = ["book-0", "book-1"];
const KEYWORD_SLOT_TYPES = ["keyword-0", "keyword-1", "keyword-2"];
const SHAPE_ALPHA_THRESHOLD = 8;
const SHAPE_PROTECTION_MARGIN = 3;
const TWO_USER_POSITION_MIN = 24;
const TWO_USER_POSITION_MAX = 76;
const AURA_GAP = 18;
const MULTI_USER_MAX_SCALE = 1.2;
const MULTI_USER_MIN_EDGE_PERCENT = 8;
const MULTI_USER_MAX_EDGE_PERCENT = 17;
const KEYWORD_FIELDS = [
    ["author", "Autore"],
    ["narrativeStyles", "Stile narrativo"],
    ["topic", "Topic"],
    ["plot", "Trama"],
    ["protagonists", "Protagonisti"],
    ["characters", "Personaggi"],
    ["temporalSetting", "Tempo"],
    ["geographicSetting", "Spazio"],
    ["moral", "Morale"]
];
const EXCLUDED_AURA_KEYWORD_FIELDS = new Set(["genres", "title"]);

let booksById = {};
let latestUsers = {};
let auraTimersStarted = false;
let bookMatchHideTimer = null;
const shapeMasks = new Map();

socket.on("update", () => {
    loadUsers();
});

socket.on("bookMatchStarted", event => {
    showBookMatchLoading(event);
});

socket.on("bookMatch", event => {
    showBookMatchResult(event.match);
});

socket.on("bookMatchError", () => {
    showBookMatchError();
});

async function loadBooks() {
    const response = await fetch("/api/books");
    booksById = await response.json();
}

async function loadUsers() {
    const response = await fetch("/users");
    const users = await response.json();

    latestUsers = users;
    renderUsers(users);
}

function renderUsers(users) {
    const container = document.getElementById("centerUsers");
    const userList = Object.entries(users).sort((a, b) => {
        return a[1].centerOrder - b[1].centerOrder;
    });
    const centerLayout = getCenterLayout(container, userList.length);
    const basePositions = getBasePositions(userList, centerLayout);
    const orderedIds = userList.map(([deviceId]) => deviceId);
    const currentIds = new Set(userList.map(([deviceId]) => deviceId));

    container.querySelectorAll(".centerUser").forEach(figure => {
        if (!currentIds.has(figure.dataset.deviceId)) {
            figure.remove();
        }
    });

    userList.forEach(([deviceId, user]) => {
        const left = basePositions.get(deviceId);
        const approachDirection = getApproachDirection(deviceId, user.approachTargetId, orderedIds);
        const usesRightShape = approachDirection === "left" || (!approachDirection && left >= 50);
        const shapeSrc = usesRightShape ? "/Icons/Sagoma-dx.png" : "/Icons/Sagoma-sx.png";
        let figure = container.querySelector(`[data-device-id="${deviceId}"]`);

        if (!figure) {
            figure = document.createElement("article");
            figure.classList.add("centerUser");
            figure.dataset.deviceId = deviceId;

            const img = document.createElement("img");
            img.alt = "";
            img.classList.add("centerUserShape");

            const nickname = document.createElement("h2");
            nickname.classList.add("centerUserNickname");

            const aura = document.createElement("div");
            aura.classList.add("centerUserAura");
            aura.setAttribute("aria-hidden", "true");

            figure.appendChild(img);
            figure.appendChild(aura);
            figure.appendChild(nickname);
            container.appendChild(figure);
        }

        figure.classList.toggle("centerUserLeft", !usesRightShape);
        figure.classList.toggle("centerUserRight", usesRightShape);
        updateShapeImage(figure, shapeSrc, user);
        figure.querySelector(".centerUserNickname").innerText = user.nickname;
        figure.style.left = `${left}%`;
        figure.style.width = `${centerLayout.figureWidth}px`;
        figure.style.setProperty("--center-user-scale", centerLayout.scale);
        ensureAuraMinimums(figure, user);
    });

    startAuraTimer();
}

function updateShapeImage(figure, shapeSrc, user) {
    const shape = figure.querySelector(".centerUserShape");

    if (shape.getAttribute("src") === shapeSrc) {
        return;
    }

    shape.addEventListener("load", () => {
        getShapeMask(shape);
        ensureAuraMinimums(figure, user);
    }, { once: true });
    shape.src = shapeSrc;
}

function getCenterLayout(container, userCount) {
    const containerWidth = container.getBoundingClientRect().width || window.innerWidth;
    const auraWidthRatio = window.matchMedia("(max-width:699px)").matches ? 2.5 : 2.05;
    const preferredWidth = getPreferredUserWidth();
    const positionBounds = getCenterPositionBounds(userCount);
    const requestedSpan = positionBounds.max - positionBounds.min;
    const centerGap = userCount <= 1
        ? containerWidth
        : (containerWidth * (requestedSpan / 100)) / (userCount - 1);
    const edgeGap = (containerWidth * (Math.min(positionBounds.min, 100 - positionBounds.max) / 100)) * 2;
    const maxWidthWithoutAuraOverlap = userCount <= 1
        ? preferredWidth
        : Math.max(0, (centerGap - AURA_GAP) / auraWidthRatio);
    const maxWidthWithinPageEdges = Math.max(0, (edgeGap - AURA_GAP) / auraWidthRatio);
    const maxPreferredWidth = userCount > 2 ? preferredWidth * MULTI_USER_MAX_SCALE : preferredWidth;
    const figureWidth = Math.min(maxPreferredWidth, maxWidthWithoutAuraOverlap, maxWidthWithinPageEdges);
    const scale = Math.min(1, figureWidth / preferredWidth);

    return {
        figureWidth,
        scale,
        minLeft: positionBounds.min,
        maxLeft: positionBounds.max
    };
}

function getCenterPositionBounds(userCount) {
    if (userCount <= 1) {
        return {
            min: 50,
            max: 50
        };
    }

    if (userCount === 2) {
        return {
            min: TWO_USER_POSITION_MIN,
            max: TWO_USER_POSITION_MAX
        };
    }

    const edgePercent = Math.min(
        MULTI_USER_MAX_EDGE_PERCENT,
        Math.max(MULTI_USER_MIN_EDGE_PERCENT, 50 / userCount)
    );

    return {
        min: edgePercent,
        max: 100 - edgePercent
    };
}

function getPreferredUserWidth() {
    if (window.matchMedia("(max-width:699px)").matches) {
        return 210;
    }

    return Math.min(310, Math.max(220, window.innerWidth * 0.205));
}

function getBasePositions(userList, centerLayout) {
    const positions = new Map();
    const minLeft = centerLayout.minLeft;
    const maxLeft = centerLayout.maxLeft;

    userList.forEach(([deviceId], index) => {
        const ratio = userList.length <= 1 ? 0.5 : index / (userList.length - 1);
        positions.set(deviceId, minLeft + ((maxLeft - minLeft) * ratio));
    });

    return positions;
}

function getApproachDirection(deviceId, targetDeviceId, orderedIds) {
    if (!targetDeviceId) {
        return null;
    }

    const currentIndex = orderedIds.indexOf(deviceId);
    const targetIndex = orderedIds.indexOf(targetDeviceId);

    if (currentIndex === -1 || targetIndex === -1) {
        return null;
    }

    if (Math.abs(currentIndex - targetIndex) !== 1) {
        return null;
    }

    return currentIndex < targetIndex ? "right" : "left";
}

function startAuraTimer() {
    if (auraTimersStarted) {
        return;
    }

    auraTimersStarted = true;
    BOOK_SLOT_TYPES.forEach(type => {
        scheduleAuraTick(type, AURA_REFRESH_OFFSETS[type]);
    });
    KEYWORD_SLOT_TYPES.forEach(type => {
        scheduleAuraTick(type, AURA_REFRESH_OFFSETS[type]);
    });
}

function scheduleAuraTick(type, delay) {
    setTimeout(() => {
        refreshAuraType(type);
        scheduleAuraTick(type, AURA_REFRESH_INTERVALS[type]);
    }, delay);
}

function refreshAuraType(type) {
    document.querySelectorAll(".centerUser").forEach(figure => {
        const user = latestUsers[figure.dataset.deviceId];

        if (user) {
            renderAuraType(figure, user, type);
        }
    });
}

function ensureAuraMinimums(figure, user) {
    renderAuraType(figure, user, "book-0");
    renderAuraType(figure, user, "book-1");
    KEYWORD_SLOT_TYPES.forEach(type => {
        renderAuraType(figure, user, type);
    });
    renderAuraType(figure, user, "looseStickers");
}

function renderAuraType(figure, user, type) {
    const aura = figure.querySelector(".centerUserAura");

    if (!aura) {
        return;
    }

    const items = createAuraItems(user);
    const visibleItems = chooseVisibleAuraItems(items, type, aura);

    aura.querySelectorAll(`[data-aura-type="${type}"]`).forEach(element => {
        element.remove();
    });

    if (!visibleItems.length) {
        return;
    }

    visibleItems
        .forEach((item, index) => {
            const element = createAuraElement(item);

            element.dataset.auraType = type;
            placeAuraElement(aura, element, type, index);
        });

    if (isBookSlot(type)) {
        renderAuraType(figure, user, "looseStickers");
    }
}

function createAuraItems(user) {
    const savedBookIds = Array.isArray(user.savedBooks) ? user.savedBooks : [];
    const collectedGenres = Array.isArray(user.collection) ? user.collection : [];
    const books = savedBookIds
        .map(bookId => [bookId, booksById[bookId]])
        .filter(([, book]) => book);
    const items = [];
    let stickerIndex = 0;

    books.forEach(([bookId, book]) => {
        items.push({
            type: "book",
            bookId,
            book
        });

        KEYWORD_FIELDS.forEach(([field, label]) => {
            if (EXCLUDED_AURA_KEYWORD_FIELDS.has(field)) {
                return;
            }

            normalizeBookValues(book[field]).forEach(value => {
                items.push({
                    type: "keyword",
                    label,
                    text: value,
                    bookId
                });
            });
        });
    });

    if (books.length) {
        books.forEach(([bookId, book]) => {
            book.genres.forEach((genre, index) => {
                items.push({
                    type: "looseSticker",
                    genre,
                    bookId,
                    stickerKey: `${bookId}-${genre}-${index}`,
                    stableIndex: stickerIndex
                });
                stickerIndex += 1;
            });
        });
    } else {
        collectedGenres.forEach((genre, index) => {
            items.push({
                type: "looseSticker",
                genre,
                bookId: null,
                stickerKey: `legacy-${genre}-${index}`,
                stableIndex: stickerIndex
            });
            stickerIndex += 1;
        });
    }

    return items;
}

function normalizeBookValues(value) {
    if (!value) {
        return [];
    }

    return Array.isArray(value) ? value : [value];
}

function showBookMatchLoading(event) {
    const panel = document.getElementById("bookMatchPanel");

    if (!panel) {
        return;
    }

    clearBookMatchTimer();
    panel.replaceChildren();
    panel.hidden = false;

    const status = document.createElement("p");
    status.classList.add("bookMatchStatus");
    status.textContent = "Match in corso";

    const title = document.createElement("h2");
    title.classList.add("bookMatchTitle");
    title.textContent = `${event.user_1} + ${event.user_2}`;

    panel.append(status, title);
}

function showBookMatchResult(match) {
    const panel = document.getElementById("bookMatchPanel");

    if (!panel || !match) {
        return;
    }

    clearBookMatchTimer();
    panel.replaceChildren();
    panel.hidden = false;

    const status = document.createElement("p");
    status.classList.add("bookMatchStatus");
    status.textContent = "Connessione trovata";

    const books = document.createElement("div");
    books.classList.add("bookMatchBooks");
    books.append(
        createBookMatchBook(match.user_1, match.book_1),
        createBookMatchConnector(),
        createBookMatchBook(match.user_2, match.book_2)
    );

    const tags = createBookMatchTags(match.matches);

    panel.append(status, books);

    if (tags) {
        panel.appendChild(tags);
    }

    bookMatchHideTimer = setTimeout(() => {
        panel.hidden = true;
    }, 18000);
}

function showBookMatchError() {
    const panel = document.getElementById("bookMatchPanel");

    if (!panel) {
        return;
    }

    clearBookMatchTimer();
    panel.replaceChildren();
    panel.hidden = false;

    const status = document.createElement("p");
    status.classList.add("bookMatchStatus");
    status.textContent = "Match non disponibile";

    const title = document.createElement("h2");
    title.classList.add("bookMatchTitle");
    title.textContent = "Riprova tra poco";

    panel.append(status, title);

    bookMatchHideTimer = setTimeout(() => {
        panel.hidden = true;
    }, 8000);
}

function clearBookMatchTimer() {
    if (bookMatchHideTimer) {
        clearTimeout(bookMatchHideTimer);
        bookMatchHideTimer = null;
    }
}

function createBookMatchBook(userName, bookTitle) {
    const wrapper = document.createElement("div");
    wrapper.classList.add("bookMatchBook");
    const resolvedBook = getBookFromMatchValue(bookTitle);

    const user = document.createElement("span");
    user.classList.add("bookMatchUser");
    user.textContent = userName || "";

    if (resolvedBook && resolvedBook.coverImage) {
        const cover = document.createElement("img");
        cover.classList.add("bookMatchCover");
        cover.alt = resolvedBook.title || "";
        cover.src = `/books/${encodeURIComponent(resolvedBook.coverImage)}`;
        wrapper.appendChild(cover);
    }

    const book = document.createElement("span");
    book.classList.add("bookMatchBookTitle");
    book.textContent = resolvedBook && resolvedBook.title
        ? resolvedBook.title
        : getReadableBookMatchValue(bookTitle);

    wrapper.append(user, book);

    return wrapper;
}

function getBookFromMatchValue(value) {
    if (!value) {
        return null;
    }

    if (booksById[value]) {
        return booksById[value];
    }

    return Object.values(booksById).find(book => {
        return book && book.title === value;
    }) || null;
}

function getReadableBookMatchValue(value) {
    if (!value || /^book\d+$/i.test(value)) {
        return "";
    }

    return value;
}

function createBookMatchConnector() {
    const connector = document.createElement("span");
    connector.classList.add("bookMatchConnector");
    connector.setAttribute("aria-hidden", "true");

    return connector;
}

function createBookMatchTags(matches) {
    if (!Array.isArray(matches) || !matches.length) {
        return null;
    }

    const wrapper = document.createElement("div");
    wrapper.classList.add("bookMatchTags");
    const orderedTypes = [
        "temi_uguali",
        "temi_affini",
        "autore_uguale",
        "generi_uguali",
        "stili_narrativi_uguali"
    ];

    orderedTypes.forEach(type => {
        const match = matches.find(item => item.type === type);

        if (!match || !Array.isArray(match.elements) || !match.elements.length) {
            return;
        }

        const row = document.createElement("div");
        row.classList.add("bookMatchRow");

        const label = document.createElement("span");
        label.classList.add("bookMatchRowLabel");
        label.textContent = getMatchLabel(type);

        const items = document.createElement("div");
        items.classList.add("bookMatchRowItems");

        if (type === "temi_affini") {
            appendBookMatchAffinityItems(items, match);
        } else {
            match.elements.forEach(element => {
                items.appendChild(createBookMatchElement(match.type, element));
            });
        }

        row.append(label, items);
        wrapper.appendChild(row);
    });

    return wrapper.children.length ? wrapper : null;
}

function appendBookMatchAffinityItems(container, match) {
    container.appendChild(createAffinityKeywordGroup(match.keywords_1, "bookMatchTagBlue"));
    container.appendChild(createAffinityKeywordGroup(match.keywords_2, "bookMatchTagLavender"));

    match.elements.forEach(element => {
        container.appendChild(createBookMatchElement(match.type, element));
    });
}

function createAffinityKeywordGroup(keywords, colorClass) {
    const group = document.createElement("div");
    group.classList.add("bookMatchKeywordGroup");

    (Array.isArray(keywords) ? keywords : []).forEach(keyword => {
        const tag = document.createElement("span");
        tag.classList.add("bookMatchSourceKeyword", colorClass);
        tag.textContent = keyword;
        group.appendChild(tag);
    });

    return group;
}

function createBookMatchElement(type, element) {
    if (type === "generi_uguali") {
        const sticker = document.createElement("img");
        sticker.classList.add("bookMatchSticker");
        sticker.alt = element;
        sticker.title = element;
        sticker.src = `/stickers/${capitalize(element)}.png`;

        return sticker;
    }

    const tag = document.createElement("span");
    tag.classList.add("bookMatchTag");

    if (type === "temi_affini") {
        tag.classList.add("bookMatchTagAffinity");
    } else if (type === "temi_uguali") {
        tag.classList.add("bookMatchTagBlue");
    } else {
        tag.classList.add("bookMatchTagLavender");
    }

    tag.textContent = element;
    tag.title = `${getMatchLabel(type)}: ${element}`;

    return tag;
}

function getMatchLabel(type) {
    const labels = {
        temi_uguali: "Temi uguali",
        temi_affini: "Temi affini",
        autore_uguale: "Autore",
        generi_uguali: "Generi",
        stili_narrativi_uguali: "Stili narrativi"
    };

    return labels[type] || "Match";
}

function createBookElement(item) {
    const wrapper = document.createElement("div");
    wrapper.classList.add("auraBook");
    wrapper.dataset.bookId = item.bookId;

    const cover = document.createElement("img");
    cover.alt = "";
    cover.classList.add("auraBookCover");
    cover.src = `/books/${encodeURIComponent(item.book.coverImage)}`;

    wrapper.appendChild(cover);

    item.book.genres.forEach((genre, index) => {
        const sticker = document.createElement("img");
        sticker.alt = "";
        sticker.classList.add("auraSticker");
        sticker.src = `/stickers/${capitalize(genre)}.png`;
        sticker.style.left = `${62 + ((index % 2) * 26)}%`;
        sticker.style.top = `${-16 + (index * 26)}%`;
        sticker.style.transform = `rotate(${randomBetween(-24, 24)}deg)`;
        wrapper.appendChild(sticker);
    });

    return wrapper;
}

function createLooseStickerElement(item) {
    const sticker = document.createElement("img");
    sticker.alt = "";
    sticker.classList.add("auraLooseSticker");
    sticker.dataset.bookId = item.bookId || "";
    sticker.dataset.stickerKey = item.stickerKey;
    sticker.dataset.stableIndex = String(item.stableIndex);
    sticker.src = `/stickers/${capitalize(item.genre)}.png`;

    return sticker;
}

function createKeywordElement(item) {
    const tag = document.createElement("span");
    tag.classList.add("auraKeyword");
    tag.classList.add(Math.random() > 0.5 ? "auraKeywordBlue" : "auraKeywordLavender");
    tag.textContent = item.text;
    tag.title = `${item.label}: ${item.text}`;

    return tag;
}

function createAuraElement(item) {
    if (item.type === "book") {
        return createBookElement(item);
    }

    if (item.type === "looseSticker") {
        return createLooseStickerElement(item);
    }

    return createKeywordElement(item);
}

function createAuraLayout(type, index) {
    const lanes = {
        looseStickers: [
            { left: 22, top: 27 },
            { left: 34, top: 14 },
            { left: 58, top: 20 },
            { left: 78, top: 31 },
            { left: 20, top: 70 },
            { left: 44, top: 41 },
            { left: 80, top: 70 },
            { left: 25, top: 52 },
            { left: 76, top: 56 },
            { left: 74, top: 10 },
            { left: 20, top: 50 },
            { left: 82, top: 52 },
            { left: 22, top: 84 },
            { left: 55, top: 6 },
            { left: 78, top: 84 },
            { left: 24, top: 64 }
        ]
    };
    const bookLanes = [
        { left: 24, top: 38 },
        { left: 35, top: 22 },
        { left: 48, top: 40 },
        { left: 65, top: 24 },
        { left: 76, top: 40 },
        { left: 22, top: 66 },
        { left: 78, top: 66 }
    ];
    const keywordLanes = [
        { left: 23, top: 44 },
        { left: 30, top: 18 },
        { left: 50, top: 30 },
        { left: 68, top: 15 },
        { left: 77, top: 44 },
        { left: 22, top: 72 },
        { left: 78, top: 72 }
    ];
    const fallbackLanes = [
        { left: 22, top: 48 },
        { left: 28, top: 27 },
        { left: 40, top: 14 },
        { left: 56, top: 11 },
        { left: 70, top: 24 },
        { left: 78, top: 45 },
        { left: 22, top: 68 },
        { left: 78, top: 68 }
    ];
    const typeLanes = isBookSlot(type)
        ? bookLanes
        : (isKeywordSlot(type) ? keywordLanes : (lanes[type] || fallbackLanes));
    const laneIndex = type === "looseStickers"
        ? index % typeLanes.length
        : (index + randomInt(0, typeLanes.length - 1)) % typeLanes.length;
    const lane = typeLanes[laneIndex];
    const jitter = getAuraJitter(type);

    return {
        left: lane.left + randomBetween(-jitter.x, jitter.x),
        top: lane.top + randomBetween(-jitter.y, jitter.y),
        rotation: randomBetween(-18, 18),
        zIndex: 10 + index
    };
}

function getAuraJitter(type) {
    if (type === "looseStickers") {
        return { x: 0, y: 0 };
    }

    if (isKeywordSlot(type)) {
        return { x: 9, y: 8 };
    }

    return { x: 12, y: 9 };
}

function placeAuraElement(aura, element, type, index) {
    element.style.visibility = "hidden";
    aura.appendChild(element);
    const placementIndex = getAuraPlacementIndex(element, index);
    const attempts = isKeywordSlot(type) ? 96 : 48;
    let bestLayout = null;
    let bestCollisionCount = Infinity;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
        const layout = createAuraLayout(type, placementIndex + attempt);
        applyAuraLayout(element, layout);
        const collisions = getCollidingAuraElements(aura, element);
        const overlapsShape = auraElementOverlapsProtectedShape(aura, element);

        if (!collisions.length && !overlapsShape) {
            element.style.visibility = "";
            return;
        }

        if (!overlapsShape && collisions.length < bestCollisionCount) {
            bestCollisionCount = collisions.length;
            bestLayout = layout;
        }

        if (!overlapsShape && canClearAuraCollisions(type, collisions)) {
            collisions.forEach(collision => collision.remove());
            element.style.visibility = "";
            return;
        }
    }

    if (type === "looseStickers" && bestLayout) {
        applyAuraLayout(element, bestLayout);
        element.style.visibility = "";
        return;
    }

    element.remove();
}

function getAuraPlacementIndex(element, fallbackIndex) {
    const stableIndex = Number(element.dataset.stableIndex);

    return Number.isFinite(stableIndex) ? stableIndex : fallbackIndex;
}

function applyAuraLayout(element, layout) {
    element.style.left = `${layout.left}%`;
    element.style.top = `${layout.top}%`;
    element.style.transform = `translate(-50%, -50%) rotate(${layout.rotation}deg)`;
    element.style.zIndex = String(layout.zIndex);
}

function getCollidingAuraElements(aura, candidate) {
    const candidateRect = getAuraCollisionRect(candidate);
    const margin = candidate.classList.contains("auraKeyword") ? 5 : 10;

    return [...aura.children].filter(element => {
        return element !== candidate
            && rectsOverlap(candidateRect, getAuraCollisionRect(element), margin);
    });
}

function auraElementOverlapsProtectedShape(aura, element) {
    const candidateRect = getAuraShapeCollisionRect(element);
    const figure = aura.closest(".centerUser");
    const shape = figure ? figure.querySelector(".centerUserShape") : null;
    const mask = shape ? getShapeMask(shape) : null;

    if (shape && mask) {
        return rectOverlapsShapeMask(candidateRect, shape, mask);
    }

    return getProtectedShapeRects(aura).some(rect => {
        return rectsOverlap(candidateRect, rect, SHAPE_PROTECTION_MARGIN);
    });
}

function getProtectedShapeRects(aura) {
    const figure = aura.closest(".centerUser");

    if (!figure) {
        return [];
    }

    const rect = figure.getBoundingClientRect();

    return [
        {
            left: rect.left + (rect.width * 0.27),
            right: rect.left + (rect.width * 0.73),
            top: rect.top + (rect.height * 0.05),
            bottom: rect.top + (rect.height * 0.5)
        },
        {
            left: rect.left + (rect.width * 0.12),
            right: rect.left + (rect.width * 0.88),
            top: rect.top + (rect.height * 0.38),
            bottom: rect.bottom
        }
    ];
}

function canClearAuraCollisions(type, collisions) {
    if (isBookSlot(type)) {
        return collisions.every(element => !isBookSlot(element.dataset.auraType));
    }

    if (isKeywordSlot(type)) {
        return collisions.every(element => element.dataset.auraType === "looseStickers");
    }

    return false;
}

function getAuraCollisionRect(element) {
    const rect = element.getBoundingClientRect();
    const expand = element.classList.contains("auraBook") ? 30 : 0;

    return expandRect(rect, expand);
}

function getAuraShapeCollisionRect(element) {
    const rect = element.getBoundingClientRect();

    return expandRect(rect, SHAPE_PROTECTION_MARGIN);
}

function expandRect(rect, expand) {
    return {
        left: rect.left - expand,
        right: rect.right + expand,
        top: rect.top - expand,
        bottom: rect.bottom + expand
    };
}

function getShapeMask(shape) {
    if (!shape.complete || !shape.naturalWidth || !shape.naturalHeight) {
        return null;
    }

    const cacheKey = shape.currentSrc || shape.src;
    const cached = shapeMasks.get(cacheKey);

    if (cached) {
        return cached;
    }

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });

    if (!context) {
        return null;
    }

    canvas.width = shape.naturalWidth;
    canvas.height = shape.naturalHeight;
    let imageData;

    try {
        context.drawImage(shape, 0, 0);
        imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    } catch (error) {
        return null;
    }

    const mask = {
        alpha: imageData.data,
        width: canvas.width,
        height: canvas.height
    };

    shapeMasks.set(cacheKey, mask);

    return mask;
}

function rectOverlapsShapeMask(rect, shape, mask) {
    const shapeRect = shape.getBoundingClientRect();
    const scaleX = mask.width / shapeRect.width;
    const scaleY = mask.height / shapeRect.height;
    const left = Math.max(0, Math.floor((rect.left - shapeRect.left) * scaleX));
    const right = Math.min(mask.width, Math.ceil((rect.right - shapeRect.left) * scaleX));
    const top = Math.max(0, Math.floor((rect.top - shapeRect.top) * scaleY));
    const bottom = Math.min(mask.height, Math.ceil((rect.bottom - shapeRect.top) * scaleY));

    if (left >= right || top >= bottom) {
        return false;
    }

    for (let y = top; y < bottom; y += 1) {
        for (let x = left; x < right; x += 1) {
            const alphaIndex = ((y * mask.width) + x) * 4 + 3;

            if (mask.alpha[alphaIndex] > SHAPE_ALPHA_THRESHOLD) {
                return true;
            }
        }
    }

    return false;
}

function rectsOverlap(a, b, margin) {
    return a.left < b.right + margin
        && a.right > b.left - margin
        && a.top < b.bottom + margin
        && a.bottom > b.top - margin;
}

function chooseVisibleAuraItems(items, type, aura) {
    if (isBookSlot(type)) {
        return chooseBookSlotItem(items, type, aura);
    }

    if (isKeywordSlot(type)) {
        const visibleKeywords = getVisibleKeywordTexts(aura, type);

        return shuffle(items.filter(item => {
            return item.type === "keyword" && !visibleKeywords.has(item.text);
        }))
            .slice(0, 1);
    }

    if (type === "looseStickers") {
        const visibleBookIds = getVisibleBookIds(aura);

        return items.filter(item => {
            return item.type === "looseSticker"
                && (!item.bookId || !visibleBookIds.has(item.bookId));
        });
    }

    return [];
}

function chooseBookSlotItem(items, type, aura) {
    const visibleBookIds = getVisibleBookIds(aura, type);
    const books = shuffle(items.filter(item => {
        return item.type === "book" && !visibleBookIds.has(item.bookId);
    }));
    const slotIndex = BOOK_SLOT_TYPES.indexOf(type);

    if (!books.length) {
        return [];
    }

    return [books[slotIndex % books.length]];
}

function getVisibleBookIds(aura, currentType) {
    return new Set(
        [...aura.querySelectorAll(".auraBook")]
            .filter(element => element.dataset.auraType !== currentType)
            .map(element => element.dataset.bookId)
            .filter(Boolean)
    );
}

function getVisibleKeywordTexts(aura, currentType) {
    return new Set(
        [...aura.querySelectorAll(".auraKeyword")]
            .filter(element => element.dataset.auraType !== currentType)
            .map(element => element.textContent)
            .filter(Boolean)
    );
}

function isBookSlot(type) {
    return BOOK_SLOT_TYPES.includes(type);
}

function isKeywordSlot(type) {
    return KEYWORD_SLOT_TYPES.includes(type);
}

function shuffle(items) {
    return [...items].sort(() => Math.random() - 0.5);
}

function randomBetween(min, max) {
    return Math.round((min + (Math.random() * (max - min))) * 10) / 10;
}

function randomInt(min, max) {
    return Math.floor(min + (Math.random() * ((max - min) + 1)));
}

function capitalize(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

async function initCenter() {
    await loadBooks();
    await loadUsers();
}

initCenter();

window.addEventListener("resize", () => {
    if (Object.keys(latestUsers).length) {
        renderUsers(latestUsers);
    }
});
