const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const MEMBERS_FILE = path.join(DATA_DIR, 'club-members.json');
const INVITES_FILE = path.join(DATA_DIR, 'club-invites.json');
const ACTIVITY_FILE = path.join(DATA_DIR, 'club-activity.json');
const OPTIONS_FILE = path.join(DATA_DIR, 'club-options.json');

const INVITE_EXPIRY_DAYS = 30;

async function readJSON(file) {
    const contents = await fs.readFile(file, 'utf8');
    return JSON.parse(contents);
}

async function writeJSON(file, data) {
    await fs.writeFile(file, JSON.stringify(data, null, 2));
}

function generateId(list) {
    const maxId = list.reduce((max, item) => Math.max(max, item.id), 0);
    return maxId + 1;
}

function generateToken() {
    return crypto.randomBytes(12).toString('hex');
}

async function getOptions() {
    return readJSON(OPTIONS_FILE);
}

async function createOwnerInvite({ invitee_name, invitee_contact }) {
    const invites = await readJSON(INVITES_FILE);
    const invite = {
        id: generateId(invites),
        code: generateToken(),
        created_by_member_id: null,
        invited_by_label: 'owner',
        auto_approve: true,
        invitee_name,
        invitee_contact,
        status: 'sent',
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString(),
        completed_at: null
    };
    invites.push(invite);
    await writeJSON(INVITES_FILE, invites);
    return invite;
}

async function createMemberInvite(memberToken, { invitee_name, invitee_contact }) {
    const members = await readJSON(MEMBERS_FILE);
    const member = members.find(m => m.member_token === memberToken && m.status === 'approved');
    if (!member) {
        const err = new Error('Member not found or not approved');
        err.statusCode = 404;
        throw err;
    }

    const invites = await readJSON(INVITES_FILE);
    const invite = {
        id: generateId(invites),
        code: generateToken(),
        created_by_member_id: member.id,
        invited_by_label: member.name,
        auto_approve: false,
        invitee_name,
        invitee_contact,
        status: 'sent',
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString(),
        completed_at: null
    };
    invites.push(invite);
    await writeJSON(INVITES_FILE, invites);
    return invite;
}

async function getInviteByCode(code) {
    const invites = await readJSON(INVITES_FILE);
    const invite = invites.find(i => i.code === code);
    if (!invite) return null;

    if (invite.status === 'sent' && new Date(invite.expires_at) < new Date()) {
        invite.status = 'expired';
        await writeJSON(INVITES_FILE, invites);
    }

    return invite;
}

async function logActivity({ type, member_id, message }) {
    const activity = await readJSON(ACTIVITY_FILE);
    const entry = {
        id: generateId(activity),
        type,
        member_id,
        message,
        created_at: new Date().toISOString(),
        read_at: null
    };
    activity.push(entry);
    await writeJSON(ACTIVITY_FILE, activity);
    return entry;
}

async function completeInvite(code, formData) {
    const invites = await readJSON(INVITES_FILE);
    const invite = invites.find(i => i.code === code);

    if (!invite) {
        const err = new Error('Invite not found');
        err.statusCode = 404;
        throw err;
    }
    if (invite.status !== 'sent') {
        const err = new Error(`Invite is ${invite.status}`);
        err.statusCode = 409;
        throw err;
    }
    if (new Date(invite.expires_at) < new Date()) {
        invite.status = 'expired';
        await writeJSON(INVITES_FILE, invites);
        const err = new Error('Invite is expired');
        err.statusCode = 409;
        throw err;
    }

    const members = await readJSON(MEMBERS_FILE);
    const now = new Date().toISOString();
    const approved = invite.auto_approve;

    const member = {
        id: generateId(members),
        name: formData.name,
        email: formData.email || null,
        phone: formData.phone || null,
        birth_month: formData.birth_month || null,
        birth_day: formData.birth_day || null,
        favorite_food: formData.favorite_food || null,
        item_categories: formData.item_categories || [],
        exclusions: formData.exclusions || [],
        allergies: formData.allergies || [],
        channels: formData.channels || [],
        status: approved ? 'approved' : 'pending_review',
        role: 'member',
        invited_by_member_id: invite.created_by_member_id,
        invite_id: invite.id,
        member_token: generateToken(),
        created_at: now,
        approved_at: approved ? now : null
    };

    members.push(member);
    await writeJSON(MEMBERS_FILE, members);

    invite.status = 'completed';
    invite.completed_at = now;
    await writeJSON(INVITES_FILE, invites);

    await logActivity({
        type: approved ? 'auto_approved_signup' : 'pending_review_signup',
        member_id: member.id,
        message: approved
            ? `${member.name} joined via your direct invite and was auto-approved.`
            : `${member.name} requested to join via a member invite from ${invite.invited_by_label}. Needs your approval.`
    });

    return member;
}

async function listMembers() {
    return readJSON(MEMBERS_FILE);
}

async function listPendingMembers() {
    const members = await readJSON(MEMBERS_FILE);
    return members.filter(m => m.status === 'pending_review');
}

async function setMemberStatus(id, status) {
    const members = await readJSON(MEMBERS_FILE);
    const member = members.find(m => m.id === Number(id));
    if (!member) {
        const err = new Error('Member not found');
        err.statusCode = 404;
        throw err;
    }
    member.status = status;
    if (status === 'approved') {
        member.approved_at = new Date().toISOString();
    }
    await writeJSON(MEMBERS_FILE, members);
    return member;
}

async function getMemberByToken(token) {
    const members = await readJSON(MEMBERS_FILE);
    return members.find(m => m.member_token === token) || null;
}

async function updateMemberByToken(token, updates) {
    const members = await readJSON(MEMBERS_FILE);
    const member = members.find(m => m.member_token === token);
    if (!member) {
        const err = new Error('Member not found');
        err.statusCode = 404;
        throw err;
    }

    const editableFields = [
        'name', 'email', 'phone', 'birth_month', 'birth_day',
        'favorite_food', 'item_categories', 'exclusions', 'allergies', 'channels'
    ];
    for (const field of editableFields) {
        if (updates[field] !== undefined) {
            member[field] = updates[field];
        }
    }

    await writeJSON(MEMBERS_FILE, members);
    return member;
}

async function listActivity() {
    const [activity, members] = await Promise.all([readJSON(ACTIVITY_FILE), readJSON(MEMBERS_FILE)]);
    const membersById = new Map(members.map(m => [m.id, m]));

    return activity
        .slice()
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .map(entry => ({
            ...entry,
            member: membersById.get(entry.member_id) || null
        }));
}

async function markActivityRead(id) {
    const activity = await readJSON(ACTIVITY_FILE);
    const entry = activity.find(a => a.id === Number(id));
    if (!entry) {
        const err = new Error('Activity entry not found');
        err.statusCode = 404;
        throw err;
    }
    entry.read_at = new Date().toISOString();
    await writeJSON(ACTIVITY_FILE, activity);
    return entry;
}

module.exports = {
    getOptions,
    createOwnerInvite,
    createMemberInvite,
    getInviteByCode,
    completeInvite,
    listMembers,
    listPendingMembers,
    setMemberStatus,
    getMemberByToken,
    updateMemberByToken,
    listActivity,
    markActivityRead
};
