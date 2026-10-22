const roomId = window.location.pathname.split('/')[2];
const roomName = document.getElementById('room-name');
const statusText = document.getElementById('status');
const participantsEl = document.getElementById('participants');
const micButton = document.getElementById('toggle-mic');
const enableAudioButton = document.getElementById('enable-audio');

// id -> { name, muted, peer?, audio?, pendingCandidates? }
const participants = new Map();
let iceServers = [];
let myName = '';
let selfId = null;
let hostId = null;
let localStream = null;
let socket = null;

function setStatus(text) {
    statusText.textContent = text;
}

function isMicMuted() {
    const track = localStream?.getAudioTracks()[0];
    return !track || !track.enabled;
}

function render() {
    participantsEl.replaceChildren(...[...participants].map(([id, p]) => {
        const tile = document.createElement('div');
        tile.className = 'participant';
        tile.classList.toggle('muted', p.muted);

        const avatar = document.createElement('div');
        avatar.className = 'avatar';
        avatar.textContent = p.name.charAt(0).toUpperCase();

        const name = document.createElement('div');
        name.className = 'participant-name';
        name.textContent = id === selfId ? `${p.name} (you)` : p.name;

        tile.append(avatar, name);

        if (id === hostId) {
            const badge = document.createElement('div');
            badge.className = 'badge';
            badge.textContent = 'Host';
            tile.append(badge);
        }

        if (selfId === hostId && id !== selfId) {
            const muteButton = document.createElement('button');
            muteButton.className = 'glass-button';
            muteButton.textContent = p.muted ? 'Unmute' : 'Mute';
            muteButton.addEventListener('click', () => {
                socket.emit('set muted', { target: id, muted: !p.muted });
            });
            tile.append(muteButton);
        }

        return tile;
    }));
}

function setLocalMuted(muted) {
    const track = localStream?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !muted;
    micButton.textContent = muted ? 'Unmute' : 'Mute';
    participants.get(selfId).muted = muted;
    socket.emit('mute state', muted);
    render();
}

function playAudio(audio) {
    audio.play().catch(() => {
        // Autoplay was blocked; wait for a click before starting playback.
        enableAudioButton.hidden = false;
    });
}

enableAudioButton.addEventListener('click', () => {
    participants.forEach(p => p.audio?.play());
    enableAudioButton.hidden = true;
});

function createPeer(id) {
    const p = participants.get(id);
    const peer = new RTCPeerConnection({ iceServers });
    p.peer = peer;
    p.pendingCandidates = [];

    if (localStream) {
        localStream.getTracks().forEach(track => peer.addTrack(track, localStream));
    } else {
        peer.addTransceiver('audio', { direction: 'recvonly' });
    }

    peer.onicecandidate = e => {
        if (e.candidate) socket.emit('ice-candidate', { target: id, candidate: e.candidate });
    };

    peer.ontrack = e => {
        if (!p.audio) {
            p.audio = new Audio();
            p.audio.autoplay = true;
        }
        p.audio.srcObject = e.streams[0] ?? new MediaStream([e.track]);
        playAudio(p.audio);
    };

    return peer;
}

async function applyRemoteDescription(p, sdp) {
    await p.peer.setRemoteDescription(sdp);
    for (const candidate of p.pendingCandidates) {
        await p.peer.addIceCandidate(candidate);
    }
    p.pendingCandidates = [];
}

function removeParticipant(id) {
    const p = participants.get(id);
    if (!p) return;
    p.peer?.close();
    p.audio?.pause();
    participants.delete(id);
    render();
}

function connect() {
    socket = io();

    socket.on('connect_error', err => {
        if (err.message === 'unauthorized') window.location.href = '/';
        else setStatus('Connection problem, retrying...');
    });

    socket.on('connect', () => {
        setStatus(localStream ? '' : 'Microphone unavailable, so you are listening only.');
        socket.emit('user joined room', roomId);
    });

    socket.on('disconnect', () => {
        setStatus('Disconnected, reconnecting...');
        [...participants.keys()].forEach(id => id !== selfId && removeParticipant(id));
        participants.delete(selfId);
    });

    socket.on('room is full', () => {
        setStatus('This room is full. Try another one.');
        socket.disconnect();
    });

    // We just joined: call everyone who was already here.
    socket.on('joined', async ({ selfId: id, hostId: host, otherUsers }) => {
        selfId = id;
        hostId = host;
        participants.set(selfId, { name: myName, muted: isMicMuted() });
        socket.emit('mute state', isMicMuted());

        for (const user of otherUsers) {
            participants.set(user.id, { name: user.name, muted: false });
            const peer = createPeer(user.id);
            await peer.setLocalDescription(await peer.createOffer());
            socket.emit('connection offer', { target: user.id, sdp: peer.localDescription });
        }
        render();
    });

    socket.on('user joined', ({ id, name }) => {
        participants.set(id, { name, muted: false });
        render();
        socket.emit('mute state', isMicMuted());
    });

    socket.on('connection offer', async ({ from, sdp }) => {
        const p = participants.get(from);
        if (!p) return;
        const peer = createPeer(from);
        await applyRemoteDescription(p, sdp);
        await peer.setLocalDescription(await peer.createAnswer());
        socket.emit('connection answer', { target: from, sdp: peer.localDescription });
    });

    socket.on('connection answer', async ({ from, sdp }) => {
        const p = participants.get(from);
        if (p?.peer) await applyRemoteDescription(p, sdp);
    });

    socket.on('ice-candidate', async ({ from, candidate }) => {
        const p = participants.get(from);
        if (!p?.peer) return;
        if (p.peer.remoteDescription) await p.peer.addIceCandidate(candidate);
        else p.pendingCandidates.push(candidate);
    });

    socket.on('user disconnected', removeParticipant);

    socket.on('host changed', id => {
        hostId = id;
        render();
    });

    socket.on('mute state', ({ id, muted }) => {
        const p = participants.get(id);
        if (!p) return;
        p.muted = muted;
        render();
    });

    socket.on('force muted', ({ muted }) => {
        setLocalMuted(muted);
        setStatus(muted ? 'The host muted you.' : 'The host unmuted you.');
    });
}

micButton.addEventListener('click', () => setLocalMuted(!isMicMuted()));

async function init() {
    const [meRes, roomRes, iceRes] = await Promise.all([
        fetch('/api/me'), fetch(`/api/rooms/${roomId}`), fetch('/api/ice-servers'),
    ]);
    if (!meRes.ok || !roomRes.ok || !iceRes.ok || meRes.redirected) {
        window.location.href = '/';
        return;
    }
    myName = (await meRes.json()).name;
    iceServers = await iceRes.json();
    const room = await roomRes.json();
    roomName.textContent = room.name;
    document.title = `${room.name} - AudioSpace`;

    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        micButton.disabled = false;
    } catch (err) {
        console.warn('No microphone access:', err);
    }

    connect();
}

init();
