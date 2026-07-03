const CLUB_API_BASE = '/api/club';
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

function getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
}

function renderCheckboxes(container, name, options, selected = []) {
    container.innerHTML = options.map(opt => `
        <label class="checkbox-option">
            <input type="checkbox" name="${name}" value="${opt}" ${selected.includes(opt) ? 'checked' : ''}>
            <span>${opt}</span>
        </label>
    `).join('');
}

function getCheckedValues(form, name) {
    return Array.from(form.querySelectorAll(`input[name="${name}"]:checked`)).map(el => el.value);
}

function populateMonthSelect(select) {
    select.innerHTML = '<option value="">Month</option>' +
        MONTH_NAMES.map((m, i) => `<option value="${i + 1}">${m}</option>`).join('');
}

function populateDaySelect(select) {
    select.innerHTML = '<option value="">Day</option>' +
        Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('');
}

async function loadClubOptions() {
    const res = await fetch(`${CLUB_API_BASE}/options`);
    return res.json();
}

function fillPreferenceGroups(form, options, member = {}) {
    renderCheckboxes(form.querySelector('#categoriesGroup'), 'item_categories', options.categories, member.item_categories || []);
    renderCheckboxes(form.querySelector('#exclusionsGroup'), 'exclusions', options.exclusions, member.exclusions || []);
    renderCheckboxes(form.querySelector('#allergiesGroup'), 'allergies', options.allergies, member.allergies || []);
    renderCheckboxes(form.querySelector('#channelsGroup'), 'channels', options.channels, member.channels || []);
    populateMonthSelect(form.querySelector('#birthMonth'));
    populateDaySelect(form.querySelector('#birthDay'));
    form.querySelector('#birthMonth').value = member.birth_month || '';
    form.querySelector('#birthDay').value = member.birth_day || '';
    form.querySelector('#name').value = member.name || '';
    if (form.querySelector('#email')) form.querySelector('#email').value = member.email || '';
    if (form.querySelector('#phone')) form.querySelector('#phone').value = member.phone || '';
    form.querySelector('#favoriteFood').value = member.favorite_food || '';
}

function readPreferenceForm(form) {
    return {
        name: form.querySelector('#name').value,
        email: form.querySelector('#email').value || null,
        phone: form.querySelector('#phone').value || null,
        birth_month: form.querySelector('#birthMonth').value || null,
        birth_day: form.querySelector('#birthDay').value || null,
        favorite_food: form.querySelector('#favoriteFood').value || null,
        item_categories: getCheckedValues(form, 'item_categories'),
        exclusions: getCheckedValues(form, 'exclusions'),
        allergies: getCheckedValues(form, 'allergies'),
        channels: getCheckedValues(form, 'channels')
    };
}

// ---- Invite signup page ----
async function initInvitePage() {
    const code = getQueryParam('code');
    const statusEl = document.getElementById('inviteStatus');
    const formSection = document.getElementById('inviteFormSection');
    const confirmSection = document.getElementById('inviteConfirmation');
    const form = document.getElementById('inviteForm');

    if (!code) {
        statusEl.textContent = 'This link is missing an invite code. Please use the link exactly as it was sent to you.';
        return;
    }

    let invite;
    try {
        const res = await fetch(`${CLUB_API_BASE}/invites/${code}`);
        if (!res.ok) throw new Error('not found');
        invite = await res.json();
    } catch {
        statusEl.textContent = "This invite link isn't valid. Please check the link or ask for a new invite.";
        return;
    }

    if (invite.status === 'completed') {
        statusEl.textContent = 'This invite has already been used.';
        return;
    }
    if (invite.status === 'expired') {
        statusEl.textContent = 'This invite link has expired. Please ask for a new one.';
        return;
    }

    statusEl.classList.add('hidden');
    formSection.classList.remove('hidden');

    const options = await loadClubOptions();
    fillPreferenceGroups(form, options);
    form.querySelector('#name').value = invite.invitee_name || '';
    if (invite.invitee_contact && invite.invitee_contact.includes('@')) {
        form.querySelector('#email').value = invite.invitee_contact;
    } else if (invite.invitee_contact) {
        form.querySelector('#phone').value = invite.invitee_contact;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = readPreferenceForm(form);

        try {
            const res = await fetch(`${CLUB_API_BASE}/invites/${code}/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Something went wrong');

            formSection.classList.add('hidden');
            confirmSection.classList.remove('hidden');

            const memberLink = `${window.location.origin}/club-member.html?token=${data.member_token}`;
            const linkEl = document.getElementById('memberLink');
            linkEl.href = memberLink;
            linkEl.textContent = memberLink;

            document.getElementById('confirmationMessage').textContent = data.status === 'approved'
                ? "Welcome to the Half Baked Club! You're approved. Save this link to manage your preferences any time:"
                : "Thanks! Your request is with Anne for approval. Save this link — it'll unlock your profile once you're approved:";
        } catch (err) {
            alert(err.message);
        }
    });
}

// ---- Member profile page ----
async function initMemberPage() {
    const token = getQueryParam('token');
    const statusEl = document.getElementById('memberStatus');
    const profileSection = document.getElementById('memberProfileSection');
    const form = document.getElementById('memberForm');

    if (!token) {
        statusEl.textContent = 'This link is missing your member token.';
        return;
    }

    let member;
    try {
        const res = await fetch(`${CLUB_API_BASE}/me/${token}`);
        if (!res.ok) throw new Error('not found');
        member = await res.json();
    } catch {
        statusEl.textContent = "We couldn't find your profile. Please check your link.";
        return;
    }

    if (member.status === 'rejected') {
        statusEl.textContent = "This invite request wasn't approved.";
        return;
    }

    if (member.status === 'pending_review') {
        statusEl.textContent = 'Your request is awaiting approval. Check back soon — you can still set your preferences below.';
        statusEl.classList.remove('hidden');
    } else {
        statusEl.classList.add('hidden');
    }

    profileSection.classList.remove('hidden');

    const options = await loadClubOptions();
    fillPreferenceGroups(form, options, member);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = readPreferenceForm(form);

        try {
            const res = await fetch(`${CLUB_API_BASE}/me/${token}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Something went wrong');
            const savedMsg = document.getElementById('savedMessage');
            savedMsg.classList.remove('hidden');
            setTimeout(() => savedMsg.classList.add('hidden'), 3000);
        } catch (err) {
            alert(err.message);
        }
    });

    const inviteSection = document.getElementById('inviteFriendSection');
    const inviteForm = document.getElementById('inviteFriendForm');
    if (inviteForm && member.status === 'approved') {
        inviteSection.classList.remove('hidden');
        inviteForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const invitee_name = document.getElementById('friendName').value;
            const invitee_contact = document.getElementById('friendContact').value;
            try {
                const res = await fetch(`${CLUB_API_BASE}/me/${token}/invites`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ invitee_name, invitee_contact })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Something went wrong');
                const fullLink = `${window.location.origin}${data.link}`;
                const linkEl = document.getElementById('friendInviteLink');
                linkEl.href = fullLink;
                linkEl.textContent = fullLink;
                document.getElementById('friendInviteResult').classList.remove('hidden');
                inviteForm.reset();
            } catch (err) {
                alert(err.message);
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('inviteForm')) initInvitePage();
    if (document.getElementById('memberForm')) initMemberPage();
});
