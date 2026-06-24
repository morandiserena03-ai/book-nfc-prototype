const desktopHeader = document.querySelector(".desktopHeaderDrawer");
const desktopMenuButton = document.querySelector(".desktopMenuButton");
const desktopMenuPanel = document.querySelector(".desktopMenuPanel");

if (desktopHeader && desktopMenuButton && desktopMenuPanel) {
    const setDesktopMenuOpen = isOpen => {
        desktopHeader.classList.toggle("menuOpen", isOpen);
        desktopMenuButton.setAttribute("aria-expanded", String(isOpen));
        desktopMenuButton.setAttribute("aria-label", isOpen ? "Chiudi menu" : "Apri menu");
        desktopMenuPanel.setAttribute("aria-hidden", String(!isOpen));
    };

    desktopMenuButton.addEventListener("click", () => {
        setDesktopMenuOpen(!desktopHeader.classList.contains("menuOpen"));
    });

    desktopMenuPanel.querySelectorAll("a").forEach(link => {
        link.addEventListener("click", () => setDesktopMenuOpen(false));
    });

    document.addEventListener("click", event => {
        if (!desktopHeader.classList.contains("menuOpen")) {
            return;
        }

        if (!desktopHeader.contains(event.target)) {
            setDesktopMenuOpen(false);
        }
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            setDesktopMenuOpen(false);
        }
    });

    window.addEventListener("resize", () => {
        if (window.matchMedia("(max-width: 699px)").matches) {
            setDesktopMenuOpen(false);
        }
    });
}
