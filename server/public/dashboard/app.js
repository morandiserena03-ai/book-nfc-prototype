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

        card.classList.add("userCard");

        const title =
            document.createElement("h2");

        title.innerText = user.nickname;

        card.appendChild(title);

        user.collection.forEach((genre) => {

            const img =
                document.createElement("img");

            img.src = `/stickers/${genre}.png`;

            img.classList.add("userSticker");

            card.appendChild(img);
        });

        container.appendChild(card);
    });
}

loadUsers();
