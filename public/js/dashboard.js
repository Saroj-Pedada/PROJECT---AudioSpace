const userName = document.getElementById('user-name');
const roomList = document.getElementById('ss-box');

async function getJson(url) {
    const res = await fetch(url);
    if (res.redirected || !res.ok) {
        window.location.href = '/';
        throw new Error(`Request to ${url} failed`);
    }
    return res.json();
}

function renderRooms(rooms) {
    roomList.replaceChildren(...rooms.map(room => {
        const card = document.createElement('a');
        card.className = 'ss';
        card.href = `/room/${room.id}`;

        const title = document.createElement('span');
        title.textContent = room.name;

        const listeners = document.createElement('span');
        listeners.className = 'listeners';
        listeners.textContent = room.listeners === 1 ? '1 person here' : `${room.listeners} people here`;

        card.append(title, listeners);
        return card;
    }));
}

async function init() {
    const me = await getJson('/api/me');
    userName.textContent = me.name;
    renderRooms(await getJson('/api/rooms'));
    setInterval(async () => renderRooms(await getJson('/api/rooms')), 10000);
}

init();
