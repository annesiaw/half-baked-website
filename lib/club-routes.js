const express = require('express');
const store = require('./club-store');
const notify = require('./club-notify');

const router = express.Router();

function asyncRoute(handler) {
    return (req, res, next) => handler(req, res, next).catch(next);
}

function handleError(err, res) {
    const status = err.statusCode || 500;
    res.status(status).json({ error: err.message || 'Something went wrong' });
}

async function validateSignupPayload(body) {
    const errors = [];
    const options = await store.getOptions();

    if (!body.name || !body.name.trim()) {
        errors.push('Name is required');
    }
    if (!body.email && !body.phone) {
        errors.push('An email or phone number is required');
    }

    const channels = body.channels || [];
    if (!Array.isArray(channels) || channels.length === 0) {
        errors.push('Pick at least one way to be notified');
    } else if (channels.some(c => !options.channels.includes(c))) {
        errors.push('Invalid notification channel selected');
    }

    for (const [field, allowed] of [
        ['item_categories', options.categories],
        ['exclusions', options.exclusions],
        ['allergies', options.allergies]
    ]) {
        const values = body[field] || [];
        if (!Array.isArray(values) || values.some(v => !allowed.includes(v))) {
            errors.push(`Invalid value in ${field}`);
        }
    }

    if (body.birth_month !== undefined && body.birth_month !== null && body.birth_month !== '') {
        const month = Number(body.birth_month);
        if (!Number.isInteger(month) || month < 1 || month > 12) {
            errors.push('Birth month must be between 1 and 12');
        }
    }
    if (body.birth_day !== undefined && body.birth_day !== null && body.birth_day !== '') {
        const day = Number(body.birth_day);
        if (!Number.isInteger(day) || day < 1 || day > 31) {
            errors.push('Birth day must be between 1 and 31');
        }
    }

    return errors;
}

// Shared config for signup/preferences forms
router.get('/options', asyncRoute(async (req, res) => {
    res.json(await store.getOptions());
}));

// Owner creates an invite -> auto-approved on completion
router.post('/invites/owner', asyncRoute(async (req, res) => {
    const { invitee_name, invitee_contact } = req.body;
    if (!invitee_name || !invitee_contact) {
        return res.status(400).json({ error: 'invitee_name and invitee_contact are required' });
    }
    const invite = await store.createOwnerInvite({ invitee_name, invitee_contact });
    res.status(201).json({ code: invite.code, link: `/club-invite.html?code=${invite.code}` });
}));

// Existing member invites a friend -> requires owner approval on completion
router.post('/me/:token/invites', asyncRoute(async (req, res) => {
    const { invitee_name, invitee_contact } = req.body;
    if (!invitee_name || !invitee_contact) {
        return res.status(400).json({ error: 'invitee_name and invitee_contact are required' });
    }
    const invite = await store.createMemberInvite(req.params.token, { invitee_name, invitee_contact });
    res.status(201).json({ code: invite.code, link: `/club-invite.html?code=${invite.code}` });
}));

// Look up an invite by code (for prefilling/validating the signup form)
router.get('/invites/:code', asyncRoute(async (req, res) => {
    const invite = await store.getInviteByCode(req.params.code);
    if (!invite) {
        return res.status(404).json({ error: 'Invite not found' });
    }
    res.json({
        status: invite.status,
        invitee_name: invite.invitee_name,
        invitee_contact: invite.invitee_contact
    });
}));

// Complete signup from an invite link
router.post('/invites/:code/complete', asyncRoute(async (req, res) => {
    const errors = await validateSignupPayload(req.body);
    if (errors.length) {
        return res.status(400).json({ error: errors.join('; ') });
    }
    const member = await store.completeInvite(req.params.code, req.body);
    res.status(201).json({
        status: member.status,
        member_token: member.member_token
    });
}));

// Admin: pending approval queue (must be registered before /members/:id routes)
router.get('/members/pending', asyncRoute(async (req, res) => {
    res.json(await store.listPendingMembers());
}));

// Admin: full member list
router.get('/members', asyncRoute(async (req, res) => {
    res.json(await store.listMembers());
}));

router.post('/members/:id/approve', asyncRoute(async (req, res) => {
    const member = await store.setMemberStatus(req.params.id, 'approved');
    res.json(member);
}));

router.post('/members/:id/reject', asyncRoute(async (req, res) => {
    const member = await store.setMemberStatus(req.params.id, 'rejected');
    res.json(member);
}));

// Member's own profile (token-based, no login system)
router.get('/me/:token', asyncRoute(async (req, res) => {
    const member = await store.getMemberByToken(req.params.token);
    if (!member) {
        return res.status(404).json({ error: 'Member not found' });
    }
    res.json(member);
}));

router.put('/me/:token', asyncRoute(async (req, res) => {
    const errors = await validateSignupPayload(req.body);
    if (errors.length) {
        return res.status(400).json({ error: errors.join('; ') });
    }
    const member = await store.updateMemberByToken(req.params.token, req.body);
    res.json(member);
}));

// Admin: activity/glance feed
router.get('/activity', asyncRoute(async (req, res) => {
    res.json(await store.listActivity());
}));

router.post('/activity/:id/read', asyncRoute(async (req, res) => {
    const entry = await store.markActivityRead(req.params.id);
    res.json(entry);
}));

// Admin: compose and send an announcement to matched members
router.post('/announcements', asyncRoute(async (req, res) => {
    const { title, body, categories, allergy_tags = [], exclusion_tags = [] } = req.body;
    const options = await store.getOptions();
    const errors = [];

    if (!title || !title.trim()) errors.push('Title is required');
    if (!body || !body.trim()) errors.push('Body is required');
    if (!Array.isArray(categories) || categories.length === 0 || categories.some(c => !options.categories.includes(c))) {
        errors.push('Pick at least one valid category');
    }
    if (!Array.isArray(allergy_tags) || allergy_tags.some(a => !options.allergies.includes(a))) {
        errors.push('Invalid allergy tag');
    }
    if (!Array.isArray(exclusion_tags) || exclusion_tags.some(e => !options.exclusions.includes(e))) {
        errors.push('Invalid exclusion tag');
    }
    if (errors.length) {
        return res.status(400).json({ error: errors.join('; ') });
    }

    const announcement = await store.createAnnouncement({ title, body, categories, allergy_tags, exclusion_tags });
    const matched = await store.matchMembers({ categories, allergy_tags, exclusion_tags });

    const results = [];
    for (const member of matched) {
        if (!member.channels.includes('email')) {
            results.push({ member_id: member.id, status: 'skipped_channel_not_selected' });
            continue;
        }
        const result = await notify.sendAnnouncementEmail(member, announcement);
        results.push({ member_id: member.id, ...result });
    }

    await store.logNotifications(announcement.id, results);
    const updated = await store.recordAnnouncementResults(announcement.id, results);

    res.status(201).json(updated);
}));

router.get('/announcements', asyncRoute(async (req, res) => {
    res.json(await store.listAnnouncements());
}));

router.get('/announcements/:id/log', asyncRoute(async (req, res) => {
    res.json(await store.listNotificationLog(req.params.id));
}));

// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => handleError(err, res));

module.exports = router;
