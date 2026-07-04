const CLUB_API_BASE = '/api/club';

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('club')) {
        initClubAdmin();
    }
});

function initClubAdmin() {
    document.getElementById('createInviteForm').addEventListener('submit', handleCreateInvite);
    document.getElementById('sendAnnouncementForm').addEventListener('submit', handleSendAnnouncement);
    document.getElementById('refreshClub').addEventListener('click', loadClubAdmin);
    loadAnnouncementOptions();
    loadClubAdmin();
}

function renderCheckboxes(container, name, options) {
    container.innerHTML = options.map(opt => `
        <label class="checkbox-option">
            <input type="checkbox" name="${name}" value="${opt}">
            <span>${opt}</span>
        </label>
    `).join('');
}

function getCheckedValues(form, name) {
    return Array.from(form.querySelectorAll(`input[name="${name}"]:checked`)).map(el => el.value);
}

async function loadAnnouncementOptions() {
    const options = await fetch(`${CLUB_API_BASE}/options`).then(r => r.json());
    renderCheckboxes(document.getElementById('announceCategories'), 'categories', options.categories);
    renderCheckboxes(document.getElementById('announceAllergies'), 'allergy_tags', options.allergies);
    renderCheckboxes(document.getElementById('announceExclusions'), 'exclusion_tags', options.exclusions);
}

async function handleSendAnnouncement(event) {
    event.preventDefault();
    const form = event.target;
    const payload = {
        title: document.getElementById('announceTitle').value,
        body: document.getElementById('announceBody').value,
        categories: getCheckedValues(form, 'categories'),
        allergy_tags: getCheckedValues(form, 'allergy_tags'),
        exclusion_tags: getCheckedValues(form, 'exclusion_tags')
    };

    try {
        const res = await fetch(`${CLUB_API_BASE}/announcements`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to send announcement');

        const resultEl = document.getElementById('announcementResult');
        resultEl.innerHTML = `Matched ${data.matched_count} member(s) — ${data.sent_count} sent, ${data.skipped_count} skipped, ${data.failed_count} failed.`;
        resultEl.classList.remove('hidden');
        form.reset();
        loadAnnouncementOptions();
        loadClubAdmin();
    } catch (err) {
        alert(err.message);
    }
}

function renderAnnouncements(announcements) {
    const el = document.getElementById('announcementHistory');
    if (!announcements.length) {
        el.innerHTML = '<p>No announcements sent yet.</p>';
        return;
    }

    el.innerHTML = announcements.map(a => `
        <div class="activity-item">
            <p><strong>${a.title}</strong></p>
            <p style="font-size:0.85rem;color:#666;">${a.categories.join(', ')}</p>
            <p style="font-size:0.85rem;">${a.sent_count} sent &middot; ${a.skipped_count} skipped &middot; ${a.failed_count} failed (of ${a.matched_count} matched)</p>
            <p style="font-size:0.8rem;color:#999;">${new Date(a.created_at).toLocaleString()}</p>
        </div>
    `).join('');
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
        const [pending, activity, members, announcements] = await Promise.all([
            fetch(`${CLUB_API_BASE}/members/pending`).then(r => r.json()),
            fetch(`${CLUB_API_BASE}/activity`).then(r => r.json()),
            fetch(`${CLUB_API_BASE}/members`).then(r => r.json()),
            fetch(`${CLUB_API_BASE}/announcements`).then(r => r.json())
        ]);

        renderPending(pending);
        renderActivity(activity);
        renderMembers(members);
        renderAnnouncements(announcements);
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
