const socket = io();

socket.on("update", () => {
    loadUsers();
});

async function loadUsers() {

    const response = await fetch("/users");

    const users = await response.json();

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

        card.style.border = "1px solid white";
        card.style.padding = "20px";
        card.style.margin = "20px";

        const title =
            document.createElement("h2");

        title.innerText = user.nickname;

        card.appendChild(title);

        user.collection.forEach((genre) => {

            const img =
                document.createElement("img");

            img.src = `/stickers/${genre}.png`;

            img.style.width = "80px";
            img.style.margin = "5px";

            card.appendChild(img);
        });

        container.appendChild(card);
    });
}

loadUsers();