const socket = io();
const KEYWORD_ANIMATION_VISIBLE_MS = 7600;
const BOOK_VISIBLE_MS = KEYWORD_ANIMATION_VISIBLE_MS * 2;
const AURA_REFRESH_INTERVALS = {
    "book-0": BOOK_VISIBLE_MS,
    "book-1": BOOK_VISIBLE_MS,
    "book-2": BOOK_VISIBLE_MS,
    "keyword-0": KEYWORD_ANIMATION_VISIBLE_MS,
    "keyword-1": KEYWORD_ANIMATION_VISIBLE_MS,
    "keyword-2": KEYWORD_ANIMATION_VISIBLE_MS,
    "keyword-3": KEYWORD_ANIMATION_VISIBLE_MS,
    "keyword-4": KEYWORD_ANIMATION_VISIBLE_MS,
    "keyword-5": KEYWORD_ANIMATION_VISIBLE_MS,
    looseStickers: 3000
};
const AURA_REFRESH_OFFSETS = {
    "book-0": BOOK_VISIBLE_MS,
    "book-1": BOOK_VISIBLE_MS,
    "book-2": BOOK_VISIBLE_MS,
    "keyword-0": 2200,
    "keyword-1": 2800,
    "keyword-2": 2400,
    "keyword-3": 3000,
    "keyword-4": 2600,
    "keyword-5": 3200,
    looseStickers: 3000
};
const BOOK_SLOT_TYPES = ["book-0", "book-1", "book-2"];
const KEYWORD_SLOT_TYPES = ["keyword-0", "keyword-1", "keyword-2", "keyword-3", "keyword-4", "keyword-5"];
const MAX_VISIBLE_KEYWORDS_PER_BOOK = 2;
const MIN_AURA_ELEMENT_VISIBLE_MS = 3000;
const MIN_KEYWORD_VISIBLE_MS = KEYWORD_ANIMATION_VISIBLE_MS - 100;
const MIN_BOOK_VISIBLE_MS = BOOK_VISIBLE_MS;
const KEYWORD_BURST_CHANCE = 0.35;
const KEYWORD_BURST_DELAY = 140;
const BOOK_KEYWORD_RETRY_DELAY = KEYWORD_ANIMATION_VISIBLE_MS;
const KEYWORD_LOTTIE_PATH = "/animations/aura-keyword-text.json";
const KEYWORD_TEXT_VISIBLE_FRAME = 63;
const KEYWORD_STALL_FALLBACK_MS = 3200;
const KEYWORD_CLOSE_MS = 320;
const KEYWORD_DISAPPEAR_MS = 180;
const MATCH_KEYWORD_HOLD_FRAME = 142;
const MATCH_KEYWORD_COLLISION_GAP = 6;
const AURA_KEYWORD_COLORS = ["#0000FF", "#9797FD"];
const SHAPE_ALPHA_THRESHOLD = 8;
const SHAPE_PROTECTION_MARGIN = 3;
const LIGHT_BOX_ROTATION_MIN_DEG = 4;
const LIGHT_BOX_ROTATION_MAX_DEG = 10;
const TWO_USER_POSITION_MIN = 24;
const TWO_USER_POSITION_MAX = 76;
const AURA_GAP = 18;
const TWO_USER_VISUAL_SCALE = 0.85;
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
let bookMatchCloseTimer = null;
let currentBookMatchEvent = null;
let keywordLottieDataPromise = null;
const shapeMasks = new Map();

socket.on("update", () => {
    loadUsers();
});

socket.on("bookMatchStarted", event => {
    showBookMatchLoading(event);
});

socket.on("bookMatch", event => {
    showBookMatchResult(event);
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
    const centerUsers = getCenterUsers(users);

    latestUsers = centerUsers;
    renderUsers(centerUsers);
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

    const isTwoUserCenter = userList.length === 2;
    const twoUserVisualScale = isTwoUserCenter ? TWO_USER_VISUAL_SCALE : 1;

    document.body.classList.toggle("centerTwoUsers", isTwoUserCenter);
    document.body.style.setProperty("--center-visual-scale", twoUserVisualScale);
    document.body.style.setProperty("--center-keyword-scale", centerLayout.scale);
    document.body.style.setProperty("--match-user-scale", centerLayout.scale * twoUserVisualScale);

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
    updateVisibleBookMatchPosition();
}

function getCenterUsers(users) {
    return Object.fromEntries(
        Object.entries(users).filter(([, user]) => user.inCenter)
    );
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
    const twoUserCompression = window.matchMedia("(max-width:699px)").matches ? 0.94 : 0.88;
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
    const maxPreferredWidth = userCount === 2
        ? preferredWidth * twoUserCompression
        : (userCount > 2 ? preferredWidth * MULTI_USER_MAX_SCALE : preferredWidth);
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
    scheduleAuraTick("looseStickers", AURA_REFRESH_OFFSETS.looseStickers);
}

function scheduleAuraTick(type, delay) {
    setTimeout(() => {
        refreshAuraType(type);
        maybeRefreshKeywordBurst(type);
        scheduleAuraTick(type, AURA_REFRESH_INTERVALS[type]);
    }, delay);
}

function maybeRefreshKeywordBurst(type) {
    if (type !== "keyword-0" || Math.random() > KEYWORD_BURST_CHANCE) {
        return;
    }

    setTimeout(() => {
        refreshAuraType("keyword-1");
    }, KEYWORD_BURST_DELAY);
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
    BOOK_SLOT_TYPES.forEach(type => {
        renderAuraType(figure, user, type);
    });
    KEYWORD_SLOT_TYPES.forEach(type => {
        renderAuraType(figure, user, type);
    });
    renderAuraType(figure, user, "looseStickers");
}

function renderAuraType(figure, user, type, options = {}) {
    const aura = figure.querySelector(".centerUserAura");

    if (!aura) {
        return;
    }

    if (isBookSlot(type) && hasFreshBookInSlot(aura, type)) {
        const bookId = getCurrentSlotBookId(aura, type);

        if (bookId) {
            scheduleKeywordsForBook(figure, user, bookId);
        }

        return;
    }

    if (isKeywordSlot(type)) {
        pruneKeywordsWithoutVisibleBook(aura);

        if (hasFreshKeywordInSlot(aura, type)) {
            return;
        }
    }

    if (type === "looseStickers" && hasFreshAuraElementInType(aura, type)) {
        return;
    }

    const items = createAuraItems(user);
    const visibleItems = chooseVisibleAuraItems(items, type, aura, options);

    aura.querySelectorAll(`[data-aura-type="${type}"]`).forEach(removeAuraElement);

    if (!visibleItems.length) {
        if (isBookSlot(type)) {
            pruneKeywordsWithoutVisibleBook(aura);
        }

        return;
    }

    const placedBookIds = [];

    visibleItems
        .forEach((item, index) => {
            const element = createAuraElement(item);

            element.dataset.auraType = type;
            const didPlace = placeAuraElement(aura, element, type, index);

            if (didPlace && isBookSlot(type) && item.bookId) {
                placedBookIds.push(item.bookId);
            }
        });

    if (isBookSlot(type)) {
        pruneKeywordsWithoutVisibleBook(aura);
        placedBookIds.forEach(bookId => {
            scheduleKeywordsForBook(figure, user, bookId);
        });
        renderAuraType(figure, user, "looseStickers");
    }
}

function scheduleKeywordsForBook(figure, user, bookId) {
    if (!bookId) {
        return;
    }

    const aura = figure.querySelector(".centerUserAura");
    const slots = aura ? getKeywordSlotsForBook(aura, bookId) : KEYWORD_SLOT_TYPES.slice(0, MAX_VISIBLE_KEYWORDS_PER_BOOK);

    renderAuraType(figure, user, slots[0], { preferredBookId: bookId });

    setTimeout(() => {
        const currentAura = figure.querySelector(".centerUserAura");

        if (!currentAura || !getVisibleBookIds(currentAura).has(bookId)) {
            return;
        }

        renderAuraType(figure, user, slots[1] || slots[0], { preferredBookId: bookId });
    }, BOOK_KEYWORD_RETRY_DELAY);
}

function pruneKeywordsWithoutVisibleBook(aura) {
    const visibleBookIds = getVisibleBookIds(aura);

    aura.querySelectorAll(".auraKeyword").forEach(keyword => {
        if (!visibleBookIds.has(keyword.dataset.bookId)) {
            removeAuraElement(keyword);
        }
    });
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

    currentBookMatchEvent = null;
    clearBookMatchTimer();
    clearBookMatchPanel(panel);
    panel.hidden = true;
}

function showBookMatchResult(event) {
    const panel = document.getElementById("bookMatchPanel");
    const match = event && event.match;

    if (!panel || !match) {
        return;
    }

    currentBookMatchEvent = event;
    clearBookMatchTimer();
    clearBookMatchPanel(panel);
    panel.hidden = false;

    const scene = createBookMatchScene(match, getBookMatchSceneAnchor(event));

    panel.appendChild(scene);
    scheduleBookMatchKeywordLayout(scene);

    bookMatchHideTimer = setTimeout(() => {
        closeBookMatchPanel(panel, () => {
            panel.hidden = true;
            currentBookMatchEvent = null;
        });
    }, 18000);
}

function showBookMatchError() {
    const panel = document.getElementById("bookMatchPanel");

    if (!panel) {
        return;
    }

    currentBookMatchEvent = null;
    clearBookMatchTimer();
    clearBookMatchPanel(panel);
    panel.hidden = false;

    const status = document.createElement("p");
    status.classList.add("bookMatchStatus");
    status.textContent = "Match non disponibile";

    const title = document.createElement("h2");
    title.classList.add("bookMatchTitle");
    title.textContent = "Riprova tra poco";

    panel.append(status, title);

    bookMatchHideTimer = setTimeout(() => {
        clearBookMatchPanel(panel);
        panel.hidden = true;
    }, 8000);
}

function clearBookMatchTimer() {
    if (bookMatchHideTimer) {
        clearTimeout(bookMatchHideTimer);
        bookMatchHideTimer = null;
    }
}

function clearBookMatchPanel(panel) {
    if (bookMatchCloseTimer) {
        clearTimeout(bookMatchCloseTimer);
        bookMatchCloseTimer = null;
    }

    panel.querySelectorAll(".auraKeywordAnimation").forEach(disposeKeywordLottie);
    panel.replaceChildren();
}

function closeBookMatchPanel(panel, onComplete) {
    const pills = [...panel.querySelectorAll(".bookMatchPill")];

    if (!pills.length) {
        clearBookMatchPanel(panel);
        onComplete?.();
        return;
    }

    pills.forEach(pill => {
        closeKeywordElement(pill);
    });

    bookMatchCloseTimer = setTimeout(() => {
        bookMatchCloseTimer = null;
        clearBookMatchPanel(panel);
        onComplete?.();
    }, KEYWORD_CLOSE_MS + KEYWORD_DISAPPEAR_MS);
}

function getBookMatchSceneAnchor(event) {
    const userCount = Object.keys(latestUsers).length;

    if (userCount <= 2 || !event || !event.deviceId || !event.targetDeviceId) {
        return 50;
    }

    const firstFigure = getCenterUserFigure(event.deviceId);
    const secondFigure = getCenterUserFigure(event.targetDeviceId);
    const panel = document.getElementById("bookMatchPanel");

    if (!firstFigure || !secondFigure || !panel) {
        return 50;
    }

    const panelRect = panel.getBoundingClientRect();
    const firstRect = firstFigure.getBoundingClientRect();
    const secondRect = secondFigure.getBoundingClientRect();
    const midpoint = ((firstRect.left + (firstRect.width / 2)) + (secondRect.left + (secondRect.width / 2))) / 2;
    const anchor = ((midpoint - panelRect.left) / panelRect.width) * 100;

    return Math.min(92, Math.max(8, anchor));
}

function getCenterUserFigure(deviceId) {
    return [...document.querySelectorAll(".centerUser")].find(figure => {
        return figure.dataset.deviceId === deviceId;
    }) || null;
}

function updateVisibleBookMatchPosition() {
    const scene = document.querySelector(".bookMatchScene");

    if (!scene || !currentBookMatchEvent) {
        return;
    }

    scene.style.setProperty("--book-match-anchor", `${getBookMatchSceneAnchor(currentBookMatchEvent)}%`);
    scheduleBookMatchKeywordLayout(scene);
}

function scheduleBookMatchKeywordLayout(scene) {
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            arrangeBookMatchKeywords(scene);
        });
    });
}

function arrangeBookMatchKeywords(scene) {
    const layer = scene.querySelector(".bookMatchKeywordLayer");

    if (!layer) {
        return;
    }

    const layerRect = layer.getBoundingClientRect();
    const leftPills = [...layer.querySelectorAll('.bookMatchKeywordCloud-left .bookMatchPill')];
    const rightPills = [...layer.querySelectorAll('.bookMatchKeywordCloud-right .bookMatchPill')];
    const generatedPill = layer.querySelector(".bookMatchGeneratedKeyword .bookMatchPill");
    const baseCenterY = layerRect.height * 0.43;
    const leftCenters = placeBookMatchKeywordColumn(leftPills, layerRect, {
        centerX: layerRect.width * 0.22,
        centerY: baseCenterY
    });
    const rightCenters = placeBookMatchKeywordColumn(rightPills, layerRect, {
        centerX: layerRect.width * 0.78,
        centerY: baseCenterY
    });
    const generatorCenters = [...leftCenters, ...rightCenters];
    const generatedCenterY = generatorCenters.length
        ? generatorCenters.reduce((sum, center) => sum + center, 0) / generatorCenters.length
        : baseCenterY;

    if (generatedPill) {
        placeBookMatchGeneratedKeyword(generatedPill, layerRect, generatedCenterY);
    }
}

function placeBookMatchKeywordColumn(pills, layerRect, anchor) {
    if (!pills.length) {
        return [];
    }

    const gap = clamp(layerRect.height * 0.07, 8, 16);
    const rects = pills.map(pill => pill.getBoundingClientRect());
    const totalHeight = rects.reduce((sum, rect) => sum + rect.height, 0) + (gap * (rects.length - 1));
    let top = clamp(anchor.centerY - (totalHeight / 2), 0, Math.max(0, layerRect.height - totalHeight));
    const centers = [];

    pills.forEach((pill, index) => {
        const rect = rects[index];
        const left = clamp(anchor.centerX - (rect.width / 2), 0, Math.max(0, layerRect.width - rect.width));

        pill.style.left = `${left}px`;
        pill.style.top = `${top}px`;
        centers.push(top + (rect.height / 2));
        top += rect.height + gap;
    });

    return centers;
}

function placeBookMatchGeneratedKeyword(pill, layerRect, centerY) {
    const rect = pill.getBoundingClientRect();
    const left = clamp((layerRect.width / 2) - (rect.width / 2), 0, Math.max(0, layerRect.width - rect.width));
    const top = clamp(centerY - (rect.height / 2), 0, Math.max(0, layerRect.height - rect.height));

    pill.style.left = `${left}px`;
    pill.style.top = `${top}px`;
    pill.style.setProperty("--match-pill-rotation", "0deg");
}

function resolveBookMatchKeywordPlacement(pill, anchor, rect, layerRect, placedRects) {
    const jitter = getBookMatchKeywordJitter(pill);
    const jitterX = (jitter.x / 100) * layerRect.width;
    const jitterY = (jitter.y / 100) * layerRect.height;
    const baseLeft = ((anchor.x / 100) * layerRect.width) - (rect.width / 2) + jitterX;
    const baseTop = ((anchor.y / 100) * layerRect.height) - (rect.height / 2) + jitterY + (anchor.offsetY || 0);
    const bounds = getBookMatchKeywordBounds(pill, layerRect, rect);
    const candidates = getBookMatchKeywordCandidates(baseLeft, baseTop, rect, layerRect, bounds);
    const openCandidate = candidates.find(candidate => {
        return !placedRects.some(placed => rectsOverlap(candidate, placed, MATCH_KEYWORD_COLLISION_GAP));
    });

    if (openCandidate) {
        return openCandidate;
    }

    const relaxedBounds = getBookMatchKeywordBounds(pill, layerRect, rect, { relaxed: true });
    const relaxedCandidates = getBookMatchKeywordCandidates(baseLeft, baseTop, rect, layerRect, relaxedBounds);
    const relaxedOpenCandidate = relaxedCandidates.find(candidate => {
        return !placedRects.some(placed => rectsOverlap(candidate, placed, MATCH_KEYWORD_COLLISION_GAP));
    });

    if (relaxedOpenCandidate) {
        return relaxedOpenCandidate;
    }

    const fullBounds = getBookMatchKeywordBounds(pill, layerRect, rect, { full: true });
    const fullCandidates = getBookMatchKeywordCandidates(baseLeft, baseTop, rect, layerRect, fullBounds);
    const fullOpenCandidate = fullCandidates.find(candidate => {
        return !placedRects.some(placed => rectsOverlap(candidate, placed, MATCH_KEYWORD_COLLISION_GAP));
    });

    if (fullOpenCandidate) {
        return fullOpenCandidate;
    }

    return getNextFreeBookMatchKeywordRow(baseLeft, rect, fullBounds, placedRects);
}

function getBookMatchKeywordBounds(pill, layerRect, rect, options = {}) {
    const centerGutter = MATCH_KEYWORD_COLLISION_GAP * 2;
    const maxLeft = Math.max(0, layerRect.width - rect.width);
    const maxTop = Math.max(0, layerRect.height - rect.height);

    if (options.full) {
        return {
            minLeft: 0,
            maxLeft,
            minTop: 0,
            maxTop
        };
    }

    if (pill.dataset.matchKeywordSide === "left") {
        return {
            minLeft: 0,
            maxLeft: Math.max(0, (layerRect.width * 0.47) - rect.width - centerGutter),
            minTop: 0,
            maxTop: options.relaxed ? maxTop : Math.max(0, Math.min(maxTop, layerRect.height * 0.58))
        };
    }

    if (pill.dataset.matchKeywordSide === "right") {
        return {
            minLeft: Math.min(maxLeft, (layerRect.width * 0.53) + centerGutter),
            maxLeft,
            minTop: 0,
            maxTop: options.relaxed ? maxTop : Math.max(0, Math.min(maxTop, layerRect.height * 0.58))
        };
    }

    return {
        minLeft: 0,
        maxLeft,
        minTop: 0,
        maxTop
    };
}

function getBookMatchKeywordCandidates(baseLeft, baseTop, rect, layerRect, bounds) {
    const candidates = [];
    const stepX = Math.max(20, rect.width * 0.24);
    const stepY = Math.max(18, rect.height + MATCH_KEYWORD_COLLISION_GAP);

    for (let y = bounds.minTop; y <= bounds.maxTop; y += stepY) {
        for (let x = bounds.minLeft; x <= bounds.maxLeft; x += stepX) {
            candidates.push(clampBookMatchKeywordRect({
                left: x,
                top: y,
                width: rect.width,
                height: rect.height
            }, bounds));
        }
    }

    candidates.push(clampBookMatchKeywordRect({
        left: baseLeft,
        top: baseTop,
        width: rect.width,
        height: rect.height
    }, bounds));

    [
        { left: bounds.minLeft, top: bounds.minTop },
        { left: bounds.maxLeft, top: bounds.minTop },
        { left: bounds.minLeft, top: bounds.maxTop },
        { left: bounds.maxLeft, top: bounds.maxTop }
    ].forEach(point => {
        candidates.push(clampBookMatchKeywordRect({
            left: point.left,
            top: point.top,
            width: rect.width,
            height: rect.height
        }, bounds));
    });

    return candidates
        .filter((candidate, index, list) => {
            return index === list.findIndex(item => {
                return Math.abs(item.left - candidate.left) < 1
                    && Math.abs(item.top - candidate.top) < 1;
            });
        })
        .sort((a, b) => {
            const distanceA = Math.hypot(a.left - baseLeft, a.top - baseTop);
            const distanceB = Math.hypot(b.left - baseLeft, b.top - baseTop);

            return distanceA - distanceB;
        });
}

function clampBookMatchKeywordRect(rect, bounds) {
    const left = clamp(rect.left, bounds.minLeft, bounds.maxLeft);
    const top = clamp(rect.top, bounds.minTop, bounds.maxTop);

    return {
        left,
        top,
        width: rect.width,
        height: rect.height,
        right: left + rect.width,
        bottom: top + rect.height
    };
}

function getNextFreeBookMatchKeywordRow(baseLeft, rect, bounds, placedRects) {
    const left = clamp(baseLeft, bounds.minLeft, bounds.maxLeft);
    const lowestBottom = placedRects.reduce((bottom, placed) => {
        return Math.max(bottom, placed.bottom);
    }, bounds.minTop);
    let top = lowestBottom + MATCH_KEYWORD_COLLISION_GAP;

    for (let attempt = 0; attempt < 12; attempt += 1) {
        const candidate = {
            left,
            top,
            width: rect.width,
            height: rect.height,
            right: left + rect.width,
            bottom: top + rect.height
        };

        if (!placedRects.some(placed => rectsOverlap(candidate, placed, MATCH_KEYWORD_COLLISION_GAP))) {
            return candidate;
        }

        top += rect.height + MATCH_KEYWORD_COLLISION_GAP;
    }

    return {
        left,
        top,
        width: rect.width,
        height: rect.height,
        right: left + rect.width,
        bottom: top + rect.height
    };
}

function getBookMatchKeywordJitter(element) {
    if (!element.dataset.matchKeywordJitterX) {
        element.dataset.matchKeywordJitterX = String(randomBetween(-4, 4));
        element.dataset.matchKeywordJitterY = String(randomBetween(-5, 5));
    }

    return {
        x: Number(element.dataset.matchKeywordJitterX) || 0,
        y: Number(element.dataset.matchKeywordJitterY) || 0
    };
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

function createBookMatchScene(match, anchor = 50) {
    const scene = document.createElement("div");
    scene.classList.add("bookMatchScene");
    scene.style.setProperty("--book-match-anchor", `${anchor}%`);

    const bookA = getBookFromMatchValue(match.book_1);
    const bookB = getBookFromMatchValue(match.book_2);
    const affinityMatch = getBookMatchByType(match.matches, "temi_affini");
    const sharedGenres = getBookMatchElements(match.matches, "generi_uguali");
    const sharedStyles = getBookMatchElements(match.matches, "stili_narrativi_uguali");
    const sharedGenre = sharedGenres[0] || "";
    const affinityKeyword = (affinityMatch.elements || [])[0] || "";

    const keywordLayer = document.createElement("div");
    keywordLayer.classList.add("bookMatchKeywordLayer");
    keywordLayer.append(
        createMatchKeywordCloud(affinityMatch.keywords_1, "left"),
        createMatchGeneratedKeyword(affinityKeyword),
        createMatchKeywordCloud(affinityMatch.keywords_2, "right")
    );

    const bottomLayer = document.createElement("div");
    bottomLayer.classList.add("bookMatchBottomLayer");
    bottomLayer.append(
        createMatchBookCluster(bookA, match.book_1, match.user_1, sharedGenre, "left"),
        createMatchSharedCluster(sharedGenre, sharedStyles),
        createMatchBookCluster(bookB, match.book_2, match.user_2, sharedGenre, "right")
    );

    scene.append(keywordLayer, bottomLayer);

    return scene;
}

function getBookMatchByType(matches, type) {
    return (Array.isArray(matches) ? matches : []).find(item => item.type === type) || {
        elements: [],
        keywords_1: [],
        keywords_2: []
    };
}

function getBookMatchElements(matches, type) {
    const foundMatch = getBookMatchByType(matches, type);

    return Array.isArray(foundMatch.elements) ? foundMatch.elements.filter(Boolean) : [];
}

function createMatchKeywordCloud(keywords, side) {
    const cloud = document.createElement("div");
    cloud.classList.add("bookMatchKeywordCloud", `bookMatchKeywordCloud-${side}`);

    (Array.isArray(keywords) ? keywords : []).slice(0, 3).forEach((keyword, index) => {
        const pill = createMatchPill(keyword, {
            color: index % 2 === 0 ? "blue" : "lavender",
            size: index === 0 ? "large" : "medium"
        });

        pill.dataset.matchKeywordSide = side;
        pill.dataset.matchKeywordIndex = String(index);
        cloud.appendChild(pill);
    });

    return cloud;
}

function createMatchGeneratedKeyword(keyword) {
    const wrapper = document.createElement("div");
    wrapper.classList.add("bookMatchGeneratedKeyword");

    if (!keyword) {
        wrapper.hidden = true;
        return wrapper;
    }

    const pill = createMatchPill(keyword, {
        color: "white"
    });

    pill.dataset.matchKeywordRole = "generated";
    wrapper.appendChild(pill);

    return wrapper;
}

function createMatchBookCluster(book, fallbackTitle, userName, sharedGenre, side) {
    const cluster = document.createElement("div");
    cluster.classList.add("bookMatchBookCluster", `bookMatchBookCluster-${side}`);

    const coverWrap = document.createElement("figure");
    coverWrap.classList.add("bookMatchCoverWrap");

    if (book && book.coverImage) {
        const cover = document.createElement("img");
        cover.classList.add("bookMatchCover");
        cover.alt = book.title || "";
        cover.src = `/books/${encodeURIComponent(book.coverImage)}`;
        coverWrap.appendChild(cover);
    }

    normalizeBookValues(book ? book.genres : [])
        .filter(genre => genre && genre !== sharedGenre)
        .forEach((genre, index) => {
            coverWrap.appendChild(createMatchSticker(genre, `bookMatchAttachedSticker-${index + 1}`));
        });

    const caption = document.createElement("figcaption");
    caption.classList.add("bookMatchBookCaption");
    caption.textContent = userName
        ? `${userName} - ${(book && book.title) || getReadableBookMatchValue(fallbackTitle)}`
        : ((book && book.title) || getReadableBookMatchValue(fallbackTitle));
    coverWrap.appendChild(caption);
    cluster.appendChild(coverWrap);

    return cluster;
}

function createMatchSharedCluster(sharedGenre, sharedStyles) {
    const cluster = document.createElement("div");
    cluster.classList.add("bookMatchSharedCluster");

    const stickerStack = document.createElement("div");
    stickerStack.classList.add("bookMatchSharedStickerStack");

    if (sharedGenre) {
        const leftSticker = createMatchSticker(sharedGenre, "bookMatchSharedSticker bookMatchSharedSticker-left", -12);
        const rightSticker = createMatchSticker(sharedGenre, "bookMatchSharedSticker bookMatchSharedSticker-right", 12);

        attachAuraMotion(leftSticker, {
            type: "matchSharedSticker",
            genre: sharedGenre,
            stableIndex: "left"
        });
        attachAuraMotion(rightSticker, {
            type: "matchSharedSticker",
            genre: sharedGenre,
            stableIndex: "right"
        });
        stickerStack.append(
            leftSticker,
            rightSticker
        );
    }

    const styleStack = document.createElement("div");
    styleStack.classList.add("bookMatchStyleStack");
    sharedStyles.slice(0, 3).forEach((style, index) => {
        styleStack.appendChild(createMatchPill(style, {
            color: index % 2 === 0 ? "blue" : "lavender",
            size: index === 0 ? "large" : "medium"
        }));
    });

    cluster.append(stickerStack, styleStack);

    return cluster;
}

function createMatchSticker(genre, className, rotation) {
    const sticker = document.createElement("img");
    sticker.classList.add("bookMatchSticker");
    className.split(/\s+/).filter(Boolean).forEach(name => {
        sticker.classList.add(name);
    });
    sticker.alt = genre;
    sticker.title = genre;
    sticker.src = `/stickers/${capitalize(genre)}.png`;

    if (typeof rotation === "number") {
        sticker.style.setProperty("--match-sticker-rotation", `${rotation}deg`);
    }

    return sticker;
}

function createMatchPill(text, options = {}) {
    const tag = document.createElement("span");
    const animation = document.createElement("span");
    const content = document.createElement("span");
    const dots = document.createElement("span");
    const fallback = document.createElement("span");
    const color = getMatchPillColor(options.color);
    const textColor = getMatchPillTextColor(options.color);

    tag.classList.add("bookMatchPill", `bookMatchPill-${options.color || "blue"}`);
    tag.classList.add(`bookMatchPill-${options.size || "medium"}`);
    tag.classList.add("bookMatchPillOverlayText");
    tag.classList.toggle("bookMatchPill-long", String(text).length > 11);
    tag.classList.toggle("bookMatchPill-veryLong", String(text).length > 16);
    tag.dataset.holdKeywordLottie = "true";
    tag.title = text;
    tag.style.setProperty("--aura-keyword-color", color);
    tag.style.setProperty("--match-pill-rotation", `${randomLightBoxRotation()}deg`);
    attachAuraMotion(tag, {
        type: "matchPill",
        text,
        stableIndex: options.size || "medium"
    });
    animation.classList.add("auraKeywordAnimation");
    animation.setAttribute("aria-hidden", "true");
    content.classList.add("auraKeywordContent");
    dots.classList.add("auraKeywordDots");
    dots.textContent = "...";
    fallback.classList.add("auraKeywordFallback");
    fallback.textContent = text;
    content.append(dots, fallback);
    tag.append(animation, content);
    renderKeywordLottie(animation, text, color, textColor, { hideLottieText: true });

    return tag;
}

function getMatchPillColor(colorName) {
    if (colorName === "white") {
        return "#FFFFFF";
    }

    if (colorName === "lavender") {
        return "#9797FD";
    }

    return "#0000FF";
}

function getMatchPillTextColor(colorName) {
    if (colorName === "white") {
        return "#0000FF";
    }

    return "#FFFFFF";
}

function createBookElement(item) {
    const wrapper = document.createElement("div");
    wrapper.classList.add("auraBook");
    wrapper.dataset.bookId = item.bookId;
    wrapper.dataset.createdAt = String(Date.now());

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
    const sticker = document.createElement("div");
    sticker.classList.add("auraLooseSticker");
    sticker.dataset.bookId = item.bookId || "";
    sticker.dataset.stickerKey = item.stickerKey;
    sticker.dataset.stableIndex = String(item.stableIndex);
    sticker.dataset.createdAt = String(Date.now());

    const image = document.createElement("img");
    image.alt = "";
    image.classList.add("auraLooseStickerImage");
    image.src = `/stickers/${capitalize(item.genre)}.png`;

    sticker.appendChild(image);

    return sticker;
}

function createKeywordElement(item) {
    const tag = document.createElement("span");
    const animation = document.createElement("span");
    const content = document.createElement("span");
    const dots = document.createElement("span");
    const fallback = document.createElement("span");
    const color = AURA_KEYWORD_COLORS[randomInt(0, AURA_KEYWORD_COLORS.length - 1)];

    tag.classList.add("auraKeyword");
    tag.classList.add("auraKeywordAnimated");
    tag.dataset.bookId = item.bookId;
    tag.dataset.keywordText = item.text;
    tag.dataset.createdAt = String(Date.now());
    tag.title = `${item.label}: ${item.text}`;
    tag.style.setProperty("--aura-keyword-color", color);
    animation.classList.add("auraKeywordAnimation");
    animation.setAttribute("aria-hidden", "true");
    content.classList.add("auraKeywordContent");
    dots.classList.add("auraKeywordDots");
    dots.textContent = "...";
    fallback.classList.add("auraKeywordFallback");
    fallback.textContent = item.text;
    content.append(dots, fallback);
    tag.append(animation, content);
    renderKeywordLottie(animation, item.text, color);

    return tag;
}

async function renderKeywordLottie(container, text, color, textColor = "#FFFFFF", options = {}) {
    const keyword = container.closest(".auraKeyword, .bookMatchPill");
    const shouldHoldOpen = keyword?.dataset.holdKeywordLottie === "true";
    let hasLoadedSvg = false;
    let hasReachedTextFrame = false;
    let hasHeldOpen = false;

    disposeKeywordLottie(container);

    if (!shouldHoldOpen) {
        setTimeout(() => {
            if (container.isConnected && !hasLoadedSvg) {
                keyword?.classList.add("auraKeywordFallbackVisible");
            }
        }, 1200);
    }

    if (!window.lottie) {
        keyword?.classList.add("auraKeywordFallbackVisible");
        return;
    }

    try {
        const animationData = await createKeywordLottieData(text, color, textColor, options);

        if (!container.isConnected) {
            return;
        }

        const animation = window.lottie.loadAnimation({
            container,
            renderer: "svg",
            loop: false,
            autoplay: true,
            animationData,
            rendererSettings: {
                preserveAspectRatio: "xMidYMid meet",
                progressiveLoad: false
            }
        });
        container.keywordLottieAnimation = animation;

        animation.addEventListener("DOMLoaded", () => {
            const svg = container.querySelector("svg");

            if (svg) {
                hasLoadedSvg = true;
                keyword?.dataset && (keyword.dataset.createdAt = String(Date.now()));
                const scene = keyword?.closest(".bookMatchScene");

                if (scene) {
                    scheduleBookMatchKeywordLayout(scene);
                }
            } else {
                keyword?.classList.add("auraKeywordFallbackVisible");
            }
        });

        animation.addEventListener("enterFrame", event => {
            if (event.currentTime >= KEYWORD_TEXT_VISIBLE_FRAME && !hasReachedTextFrame) {
                hasReachedTextFrame = true;
                keyword?.classList.add("auraKeywordLottieReady");
                keyword?.classList.remove("auraKeywordFallbackVisible");
                const scene = keyword?.closest(".bookMatchScene");

                if (scene) {
                    scheduleBookMatchKeywordLayout(scene);
                }
            }
        });

        setTimeout(() => {
            if (container.isConnected && !hasReachedTextFrame) {
                keyword?.classList.add("auraKeywordFallbackVisible");
            }
        }, KEYWORD_STALL_FALLBACK_MS);

        if (shouldHoldOpen) {
            animation.addEventListener("enterFrame", event => {
                if (event.currentTime >= MATCH_KEYWORD_HOLD_FRAME && !hasHeldOpen) {
                    hasHeldOpen = true;
                    animation.goToAndStop(MATCH_KEYWORD_HOLD_FRAME, true);
                }
            });

            animation.addEventListener("complete", () => {
                animation.goToAndStop(MATCH_KEYWORD_HOLD_FRAME, true);
            });
        } else {
            animation.addEventListener("complete", () => {
                if (keyword?.classList.contains("auraKeyword") && container.isConnected) {
                    closeKeywordElement(keyword, () => removeAuraElement(keyword));
                }
            });
        }
    } catch (error) {
        keyword?.classList.add("auraKeywordFallbackVisible");
    }
}

function disposeKeywordLottie(container) {
    const animation = container.keywordLottieAnimation;

    if (animation && typeof animation.destroy === "function") {
        animation.destroy();
    }

    delete container.keywordLottieAnimation;
}

async function createKeywordLottieData(text, color, textColor = "#FFFFFF", options = {}) {
    const source = await loadKeywordLottieData();
    const data = JSON.parse(JSON.stringify(source));

    data.layers
        .filter(layer => layer.ty === 5)
        .forEach(layer => {
            layer.t?.d?.k?.forEach(keyframe => {
                if (keyframe.s) {
                    keyframe.s.t = layer.nm === "... 2" ? "..." : "";
                    keyframe.s.fc = hexToLottieColor(textColor);
                }
            });
        });

    data.layers = data.layers.filter(layer => layer.ty !== 4);
    straightenKeywordLottieLayers(data);
    delete data.chars;

    return data;
}

function straightenKeywordLottieLayers(data) {
    data.layers.forEach(layer => {
        if (layer.ks?.r && typeof layer.ks.r.k === "number") {
            layer.ks.r.k = 0;
        }

        if (layer.ks?.rz && typeof layer.ks.rz.k === "number") {
            layer.ks.rz.k = 0;
        }
    });
}

function hexToLottieColor(hex) {
    const normalized = String(hex || "#0000FF").replace("#", "");
    if (!/^[0-9a-f]{6}$/i.test(normalized)) {
        return [0, 0, 1];
    }

    const red = parseInt(normalized.slice(0, 2), 16) / 255;
    const green = parseInt(normalized.slice(2, 4), 16) / 255;
    const blue = parseInt(normalized.slice(4, 6), 16) / 255;

    return [red, green, blue];
}

async function loadKeywordLottieData() {
    if (!keywordLottieDataPromise) {
        keywordLottieDataPromise = fetch(KEYWORD_LOTTIE_PATH)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Unable to load ${KEYWORD_LOTTIE_PATH}`);
                }

                return response.json();
            });
    }

    return keywordLottieDataPromise;
}

function createAuraElement(item) {
    let element;

    if (item.type === "book") {
        element = createBookElement(item);
    } else if (item.type === "looseSticker") {
        element = createLooseStickerElement(item);
    } else {
        element = createKeywordElement(item);
    }

    attachAuraMotion(element, item);

    return element;
}

function attachAuraMotion(element, item) {
    const delaySeed = [
        item.type,
        item.stableIndex ?? "",
        item.bookId ?? "",
        item.text ?? "",
        item.genre ?? ""
    ].join(":");

    element.classList.add("auraMotionElement");
    element.style.setProperty("--aura-motion-delay", `${getMotionDelay(delaySeed)}ms`);
}

function getMotionDelay(seed) {
    const text = String(seed);
    let hash = 0;

    for (let index = 0; index < text.length; index += 1) {
        hash = ((hash * 31) + text.charCodeAt(index)) % 1500;
    }

    return -hash;
}

function createAuraLayout(type, index, aura, element) {
    if (isKeywordSlot(type)) {
        return createKeywordAuraLayout(aura, element, index);
    }

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
        : (lanes[type] || fallbackLanes);
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

function createKeywordAuraLayout(aura, element, index) {
    const book = aura.querySelector(`.auraBook[data-book-id="${escapeCssString(element.dataset.bookId || "")}"]`);

    if (!book) {
        return createFallbackKeywordAuraLayout(index);
    }

    const auraRect = aura.getBoundingClientRect();
    const bookRect = book.getBoundingClientRect();
    const bookCenterX = ((bookRect.left + (bookRect.width / 2) - auraRect.left) / auraRect.width) * 100;
    const bookCenterY = ((bookRect.top + (bookRect.height / 2) - auraRect.top) / auraRect.height) * 100;
    const bookWidth = (bookRect.width / auraRect.width) * 100;
    const bookHeight = (bookRect.height / auraRect.height) * 100;
    const elementRect = element.getBoundingClientRect();
    const elementWidth = (elementRect.width / auraRect.width) * 100;
    const elementHeight = (elementRect.height / auraRect.height) * 100;
    const edgeGapX = (-4 / auraRect.width) * 100;
    const edgeGapY = (-3 / auraRect.height) * 100;
    const sideOffset = (bookWidth / 2) + (elementWidth / 2) + edgeGapX;
    const verticalOffset = (bookHeight / 2) + (elementHeight / 2) + edgeGapY;
    const lanes = [
        { x: -sideOffset, y: -(bookHeight * 0.18) },
        { x: sideOffset, y: -(bookHeight * 0.16) },
        { x: -sideOffset, y: bookHeight * 0.24 },
        { x: sideOffset, y: bookHeight * 0.22 },
        { x: 0, y: -verticalOffset },
        { x: 0, y: verticalOffset }
    ];
    const lane = lanes[index % lanes.length];
    const jitter = { x: 1.1, y: 0.9 };

    return {
        left: clamp(bookCenterX + lane.x + randomBetween(-jitter.x, jitter.x), 4, 96),
        top: clamp(bookCenterY + lane.y + randomBetween(-jitter.y, jitter.y), 4, 96),
        rotation: randomLightBoxRotation(),
        zIndex: 24 + index
    };
}

function createFallbackKeywordAuraLayout(index) {
    const fallbackLanes = [
        { left: 26, top: 28 },
        { left: 74, top: 28 },
        { left: 24, top: 62 },
        { left: 76, top: 62 }
    ];
    const lane = fallbackLanes[index % fallbackLanes.length];
    const jitter = getAuraJitter("keyword");

    return {
        left: lane.left + randomBetween(-jitter.x, jitter.x),
        top: lane.top + randomBetween(-jitter.y, jitter.y),
        rotation: randomLightBoxRotation(),
        zIndex: 24 + index
    };
}

function getAuraJitter(type) {
    if (type === "looseStickers") {
        return { x: 4, y: 4 };
    }

    if (isKeywordSlot(type) || type === "keyword") {
        return { x: 9, y: 8 };
    }

    return { x: 12, y: 9 };
}

function placeAuraElement(aura, element, type, index) {
    element.style.visibility = "hidden";
    aura.appendChild(element);
    const placementIndex = getAuraPlacementIndex(element, index);
    const attempts = isKeywordSlot(type) ? 96 : 48;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
        const layout = createAuraLayout(type, placementIndex + attempt, aura, element);
        applyAuraLayout(element, layout);
        const collisions = getCollidingAuraElements(aura, element);
        const overlapsShape = auraElementOverlapsProtectedShape(aura, element);

        if (!collisions.length && !overlapsShape) {
            element.style.visibility = "";
            return true;
        }

        if (!overlapsShape && canClearAuraCollisions(type, collisions)) {
            collisions.forEach(removeAuraElement);
            element.style.visibility = "";
            return true;
        }
    }

    removeAuraElement(element);

    return false;
}

function removeAuraElement(element) {
    element.querySelectorAll(".auraKeywordAnimation").forEach(disposeKeywordLottie);
    element.remove();
}

function closeKeywordElement(element, onComplete) {
    element.classList.add("auraKeywordClosing");
    setTimeout(() => {
        if (!element.isConnected) {
            return;
        }

        element.classList.add("auraKeywordClosed");
        setTimeout(() => {
            if (element.isConnected) {
                onComplete?.();
            }
        }, KEYWORD_DISAPPEAR_MS);
    }, KEYWORD_CLOSE_MS);
}

function getAuraPlacementIndex(element, fallbackIndex) {
    const stableIndex = Number(element.dataset.stableIndex);

    return Number.isFinite(stableIndex) ? stableIndex : fallbackIndex;
}

function applyAuraLayout(element, layout) {
    element.style.left = `${layout.left}%`;
    element.style.top = `${layout.top}%`;
    element.style.setProperty("--aura-rotation", `${layout.rotation}deg`);
    element.style.zIndex = String(layout.zIndex);
}

function getCollidingAuraElements(aura, candidate) {
    const candidateRect = getAuraCollisionRect(candidate);
    const margin = candidate.classList.contains("auraKeyword") ? 5 : 10;

    return [...aura.children].filter(element => {
        if (isKeywordAttachedToBook(candidate, element)) {
            return keywordOverlapsBookTooMuch(candidateRect, element.getBoundingClientRect());
        }

        return element !== candidate
            && rectsOverlap(candidateRect, getAuraCollisionRect(element), margin);
    });
}

function isKeywordAttachedToBook(candidate, element) {
    return candidate.classList.contains("auraKeyword")
        && element.classList.contains("auraBook")
        && candidate.dataset.bookId
        && candidate.dataset.bookId === element.dataset.bookId;
}

function keywordOverlapsBookTooMuch(keywordRect, bookRect) {
    const overlapLeft = Math.max(keywordRect.left, bookRect.left);
    const overlapRight = Math.min(keywordRect.right, bookRect.right);
    const overlapTop = Math.max(keywordRect.top, bookRect.top);
    const overlapBottom = Math.min(keywordRect.bottom, bookRect.bottom);
    const overlapWidth = Math.max(0, overlapRight - overlapLeft);
    const overlapHeight = Math.max(0, overlapBottom - overlapTop);

    if (!overlapWidth || !overlapHeight) {
        return false;
    }

    const keywordWidth = Math.max(1, keywordRect.right - keywordRect.left);
    const keywordHeight = Math.max(1, keywordRect.bottom - keywordRect.top);
    const keywordArea = keywordWidth * keywordHeight;
    const overlapArea = overlapWidth * overlapHeight;

    return overlapArea > keywordArea * 0.18
        || overlapWidth > keywordWidth * 0.34
        || overlapHeight > keywordHeight * 0.45;
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
        return collisions.every(element => {
            return !isBookSlot(element.dataset.auraType) && !isFreshAuraElement(element);
        });
    }

    if (isKeywordSlot(type)) {
        return collisions.every(element => {
            return element.dataset.auraType === "looseStickers" && !isFreshAuraElement(element);
        });
    }

    return false;
}

function hasFreshKeywordInSlot(aura, type) {
    return [...aura.querySelectorAll(`.auraKeyword[data-aura-type="${type}"]`)]
        .some(isFreshKeyword);
}

function hasFreshAuraElementInType(aura, type) {
    return [...aura.querySelectorAll(`[data-aura-type="${type}"]`)]
        .some(isFreshAuraElement);
}

function isFreshAuraElement(element) {
    if (isFreshBook(element)) {
        return true;
    }

    const createdAt = Number(element.dataset.createdAt);

    return Number.isFinite(createdAt) && Date.now() - createdAt < MIN_AURA_ELEMENT_VISIBLE_MS;
}

function isFreshKeyword(element) {
    if (!element.classList.contains("auraKeyword")) {
        return false;
    }

    const createdAt = Number(element.dataset.createdAt);

    return Number.isFinite(createdAt) && Date.now() - createdAt < MIN_KEYWORD_VISIBLE_MS;
}

function hasFreshBookInSlot(aura, type) {
    const currentBook = aura.querySelector(`.auraBook[data-aura-type="${type}"]`);

    return currentBook ? isFreshBook(currentBook) : false;
}

function isFreshBook(element) {
    if (!element.classList.contains("auraBook")) {
        return false;
    }

    const createdAt = Number(element.dataset.createdAt);

    return Number.isFinite(createdAt) && Date.now() - createdAt < MIN_BOOK_VISIBLE_MS;
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

function chooseVisibleAuraItems(items, type, aura, options = {}) {
    if (isBookSlot(type)) {
        return chooseBookSlotItem(items, type, aura);
    }

    if (isKeywordSlot(type)) {
        const visibleKeywords = getVisibleKeywordTexts(aura, type);
        const visibleBookIds = getVisibleBookIds(aura);
        const visibleKeywordCounts = getVisibleKeywordCountsByBook(aura, type);
        const assignedBookId = getBookIdForKeywordSlot(aura, type);
        const candidateBookIds = options.preferredBookId && visibleBookIds.has(options.preferredBookId)
            ? [options.preferredBookId]
            : (assignedBookId ? [assignedBookId] : [...visibleBookIds]);
        const availableBookIds = candidateBookIds.filter(bookId => {
            return (visibleKeywordCounts.get(bookId) || 0) < MAX_VISIBLE_KEYWORDS_PER_BOOK;
        });
        const leastUsedCount = availableBookIds.length
            ? Math.min(...availableBookIds.map(bookId => visibleKeywordCounts.get(bookId) || 0))
            : 0;

        return shuffle(items.filter(item => {
            return item.type === "keyword"
                && availableBookIds.includes(item.bookId)
                && !visibleKeywords.has(item.text)
                && (visibleKeywordCounts.get(item.bookId) || 0) === leastUsedCount;
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
    const previousBookId = getCurrentSlotBookId(aura, type);
    const availableBooks = items.filter(item => {
        return item.type === "book" && !visibleBookIds.has(item.bookId);
    });
    const freshBooks = availableBooks.filter(item => item.bookId !== previousBookId);
    const books = shuffle(freshBooks.length ? freshBooks : availableBooks);
    const slotIndex = BOOK_SLOT_TYPES.indexOf(type);

    if (!books.length) {
        return [];
    }

    return [books[slotIndex % books.length]];
}

function getKeywordSlotsForBook(aura, bookId) {
    const visibleBookIds = [...getVisibleBookIds(aura)];
    const bookIndex = visibleBookIds.indexOf(bookId);
    const slotStart = Math.max(0, bookIndex) * MAX_VISIBLE_KEYWORDS_PER_BOOK;

    return KEYWORD_SLOT_TYPES.slice(slotStart, slotStart + MAX_VISIBLE_KEYWORDS_PER_BOOK);
}

function getBookIdForKeywordSlot(aura, type) {
    const slotIndex = KEYWORD_SLOT_TYPES.indexOf(type);

    if (slotIndex === -1) {
        return "";
    }

    const visibleBookIds = [...getVisibleBookIds(aura)];
    const bookIndex = Math.floor(slotIndex / MAX_VISIBLE_KEYWORDS_PER_BOOK);

    return visibleBookIds[bookIndex] || "";
}

function getCurrentSlotBookId(aura, type) {
    const currentBook = aura.querySelector(`.auraBook[data-aura-type="${type}"]`);

    return currentBook ? currentBook.dataset.bookId : "";
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
            .map(element => element.dataset.keywordText || element.textContent)
            .filter(Boolean)
    );
}

function getVisibleKeywordCountsByBook(aura, currentType) {
    const counts = new Map();

    [...aura.querySelectorAll(".auraKeyword")]
        .filter(element => element.dataset.auraType !== currentType)
        .forEach(element => {
            const bookId = element.dataset.bookId;

            if (bookId) {
                counts.set(bookId, (counts.get(bookId) || 0) + 1);
            }
        });

    return counts;
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

function randomLightBoxRotation() {
    const direction = Math.random() > 0.5 ? 1 : -1;

    return direction * randomBetween(LIGHT_BOX_ROTATION_MIN_DEG, LIGHT_BOX_ROTATION_MAX_DEG);
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function escapeCssString(value) {
    return String(value).replace(/["\\]/g, "\\$&");
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
