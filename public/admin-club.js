const CLUB_API_BASE = '/api/club';

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('club')) {
        initClubAdmin();
    }
});

function initClubAdmin() {
    document.getElementById('createInviteForm').addEventListener('submit', handleCreateInvite);
    document.getElementById('refreshClub').addEventListener('click', loadClubAdmin);
    loadClubAdmin();
}

async function handleCreateInvite(event) {
    event.preventDefault();
    const invitee_name = document.getElementById('inviteName').value;
    const invitee_contact = document.getElementById('inviteContact').value;

    try {
        const res = await fetch(`${CLUB_API_BASE}/invites/owner`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ invitee_name, invitee_contact })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create invite');

        const fullLink = `${window.location.origin}${data.link}`;
        const resultEl = document.getElementById('createInviteResult');
        resultEl.innerHTML = `Share this link with ${invitee_name}: <a href="${fullLink}" target="_blank">${fullLink}</a>`;
        resultEl.classList.remove('hidden');
        event.target.reset();
    } catch (err) {
        alert(err.message);
    }
}

async function loadClubAdmin() {
    try {
        const [pending, activity, members] = await Promise.all([
            fetch(`${CLUB_API_BASE}/members/pending`).then(r => r.json()),
            fetch(`${CLUB_API_BASE}/activity`).then(r => r.json()),
            fetch(`${CLUB_API_BASE}/members`).then(r => r.json())
        ]);

        renderPending(pending);
        renderActivity(activity);
        renderMembers(members);
    } catch (err) {
        console.error('Error loading club data:', err);
    }
}

function renderPending(pending) {
    const el = document.getElementById('pendingList');
    if (!pending.length) {
        el.innerHTML = '<p>No pending requests.</p>';
        return;
    }

    el.innerHTML = pending.map(m => `
        <div class="activity-item">
            <p><strong>${m.name}</strong> — ${m.email || ''} ${m.phone || ''}</p>
            <p>Favorite food: ${m.favorite_food || 'n/a'}</p>
            <button class="update-stock approve-btn" data-id="${m.id}">Approve</button>
            <button class="submit-order reject-btn" data-id="${m.id}">Reject</button>
        </div>
    `).join('');

    el.querySelectorAll('.approve-btn').forEach(btn => {
        btn.addEventListener('click', () => actOnMember(btn.dataset.id, 'approve'));
    });
    el.querySelectorAll('.reject-btn').forEach(btn => {
        btn.addEventListener('click', () => actOnMember(btn.dataset.id, 'reject'));
    });
}

async function actOnMember(id, action) {
    await fetch(`${CLUB_API_BASE}/members/${id}/${action}`, { method: 'POST' });
    loadClubAdmin();
}

function renderActivity(activity) {
    const el = document.getElementById('activityList');
    if (!activity.length) {
        el.innerHTML = '<p>No activity yet.</p>';
        return;
    }

    el.innerHTML = activity.map(a => `
        <div class="activity-item ${a.read_at ? '' : 'unread'}">
            <p>${a.message}</p>
            ${a.member ? `<p style="font-size:0.85rem;color:#666;">Favorite food: ${a.member.favorite_food || 'n/a'} | Birthday: ${a.member.birth_month || '?'}/${a.member.birth_day || '?'}</p>` : ''}
            <p style="font-size:0.8rem;color:#999;">${new Date(a.created_at).toLocaleString()}</p>
            ${a.read_at ? '' : `<button class="view-order mark-read-btn" data-id="${a.id}">Mark as read</button>`}
        </div>
    `).join('');

    el.querySelectorAll('.mark-read-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            await fetch(`${CLUB_API_BASE}/activity/${btn.dataset.id}/read`, { method: 'POST' });
            loadClubAdmin();
        });
    });
}

function renderMembers(members) {
    const tbody = document.getElementById('clubMembersTableBody');
    tbody.innerHTML = members.map(m => `
        <tr>
            <td>${m.name}</td>
            <td>${m.email || ''}<br>${m.phone || ''}</td>
            <td>${m.status}</td>
            <td>${m.favorite_food || ''}</td>
            <td>${m.birth_month || '?'}/${m.birth_day || '?'}</td>
        </tr>
    `).join('');
}
