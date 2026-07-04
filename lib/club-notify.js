const { Resend } = require('resend');

function getClient() {
    if (!process.env.RESEND_API_KEY) return null;
    return new Resend(process.env.RESEND_API_KEY);
}

async function sendAnnouncementEmail(member, announcement) {
    if (!member.email) {
        return { status: 'skipped_no_email' };
    }

    const client = getClient();
    if (!client) {
        return { status: 'skipped_no_provider' };
    }

    const fromEmail = process.env.CLUB_FROM_EMAIL || 'onboarding@resend.dev';
    const fromName = process.env.CLUB_FROM_NAME || 'Half Baked Club';

    try {
        const { error } = await client.emails.send({
            from: `${fromName} <${fromEmail}>`,
            to: member.email,
            subject: announcement.title,
            text: announcement.body
        });
        if (error) {
            return { status: 'failed', error: error.message };
        }
        return { status: 'sent' };
    } catch (err) {
        return { status: 'failed', error: err.message };
    }
}

module.exports = { sendAnnouncementEmail };
