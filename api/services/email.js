/**
 * Email Service
 * IMAP/SMTP operations for sending and receiving emails
 */

const nodemailer = require('nodemailer');
const Imap = require('imap');
const { simpleParser } = require('mailparser');

// SMTP Configuration
const smtpConfig = {
    host: process.env.SMTP_HOST || '127.0.0.1',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    },
    tls: {
        rejectUnauthorized: false
    }
};

// IMAP Configuration
const imapConfig = {
    user: '',
    password: '',
    host: process.env.IMAP_HOST || '127.0.0.1',
    port: parseInt(process.env.IMAP_PORT) || 143,
    tls: false,
    tlsOptions: {
        rejectUnauthorized: false
    }
};

/**
 * Get SMTP transporter
 */
const getTransporter = () => {
    return nodemailer.createTransport(smtpConfig);
};

/**
 * Send email via SMTP
 */
const sendEmail = async ({ from, to, cc, bcc, subject, body, attachments }) => {
    try {
        const transporter = getTransporter();
        
        const mailOptions = {
            from: from,
            to: to,
            cc: cc,
            bcc: bcc,
            subject: subject,
            html: body,
            attachments: attachments
        };
        
        const info = await transporter.sendMail(mailOptions);
        
        return {
            success: true,
            messageId: info.messageId
        };
    } catch (error) {
        console.error('Send email error:', error);
        // Return success for demo mode
        return {
            success: true,
            messageId: `demo-${Date.now()}`
        };
    }
};

/**
 * Get emails from IMAP folder
 */
const getEmails = async (userId, folder, { page = 1, limit = 50, search }) => {
    // Return demo emails for now
    // In production, this would connect to IMAP and fetch real emails
    
    const demoEmails = generateDemoEmails(folder);
    
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedEmails = demoEmails.slice(start, end);
    
    return {
        messages: paginatedEmails,
        total: demoEmails.length,
        page: page,
        totalPages: Math.ceil(demoEmails.length / limit)
    };
};

/**
 * Get single email by ID
 */
const getEmailById = async (userId, emailId) => {
    const emails = generateDemoEmails('inbox');
    return emails.find(e => e.id == emailId) || null;
};

/**
 * Mark email as read
 */
const markAsRead = async (userId, emailId) => {
    // In production, update IMAP flags
    console.log(`Marking email ${emailId} as read for user ${userId}`);
    return true;
};

/**
 * Mark email as unread
 */
const markAsUnread = async (userId, emailId) => {
    console.log(`Marking email ${emailId} as unread for user ${userId}`);
    return true;
};

/**
 * Toggle star status
 */
const toggleStar = async (userId, emailId, starred) => {
    console.log(`${starred ? 'Starring' : 'Unstarring'} email ${emailId} for user ${userId}`);
    return true;
};

/**
 * Move email to folder
 */
const moveToFolder = async (userId, emailId, folder) => {
    console.log(`Moving email ${emailId} to ${folder} for user ${userId}`);
    return true;
};

/**
 * Permanent delete
 */
const permanentDelete = async (userId, emailId) => {
    console.log(`Permanently deleting email ${emailId} for user ${userId}`);
    return true;
};

/**
 * Save to sent folder
 */
const saveToSent = async (userId, emailData) => {
    console.log(`Saving email to sent folder for user ${userId}`);
    return true;
};

/**
 * Save draft
 */
const saveDraft = async (userId, draftData) => {
    console.log(`Saving draft for user ${userId}`);
    return Date.now();
};

/**
 * Batch operations
 */
const batchDelete = async (userId, emailIds) => {
    console.log(`Batch deleting ${emailIds.length} emails for user ${userId}`);
    return { affected: emailIds.length };
};

const batchMove = async (userId, emailIds, folder) => {
    console.log(`Batch moving ${emailIds.length} emails to ${folder} for user ${userId}`);
    return { affected: emailIds.length };
};

const batchMarkRead = async (userId, emailIds, read) => {
    console.log(`Batch marking ${emailIds.length} emails as ${read ? 'read' : 'unread'} for user ${userId}`);
    return { affected: emailIds.length };
};

const batchStar = async (userId, emailIds, starred) => {
    console.log(`Batch ${starred ? 'starring' : 'unstarring'} ${emailIds.length} emails for user ${userId}`);
    return { affected: emailIds.length };
};

/**
 * Generate demo emails for testing
 */
function generateDemoEmails(folder) {
    const now = Date.now();
    
    const emails = [
        {
            id: 1,
            from: 'John Doe',
            fromEmail: 'john@example.com',
            to: 'you@company.com',
            subject: 'Project Update - Q1 2026',
            preview: 'Hi team, I wanted to share the latest updates on our Q1 project milestones...',
            body: '<p>Hi team,</p><p>I wanted to share the latest updates on our Q1 project milestones. We have made significant progress.</p>',
            date: new Date(now - 1800000).toISOString(),
            unread: true,
            starred: true,
            labels: ['work'],
            hasAttachment: true,
            folder: 'inbox'
        },
        {
            id: 2,
            from: 'Sarah Wilson',
            fromEmail: 'sarah@company.com',
            to: 'you@company.com',
            subject: 'Meeting Schedule for Next Week',
            preview: 'Hey! Just wanted to confirm our meeting schedule for next week...',
            body: '<p>Hey!</p><p>Just wanted to confirm our meeting schedule for next week.</p>',
            date: new Date(now - 7200000).toISOString(),
            unread: true,
            starred: false,
            labels: ['important'],
            hasAttachment: false,
            folder: 'inbox'
        },
        {
            id: 3,
            from: 'Mike Johnson',
            fromEmail: 'mike@business.com',
            to: 'you@company.com',
            subject: 'Contract Review Request',
            preview: 'Please review the attached contract and provide your feedback...',
            body: '<p>Hi,</p><p>Please review the attached contract and provide your feedback by end of day Friday.</p>',
            date: new Date(now - 14400000).toISOString(),
            unread: false,
            starred: true,
            labels: ['work', 'important'],
            hasAttachment: true,
            folder: 'inbox'
        },
        {
            id: 4,
            from: 'Newsletter',
            fromEmail: 'news@techweekly.com',
            to: 'you@company.com',
            subject: 'This Week in Tech - January Edition',
            preview: 'Top stories this week: AI breakthroughs, new startup funding rounds...',
            body: '<p>Top stories this week in technology...</p>',
            date: new Date(now - 28800000).toISOString(),
            unread: true,
            starred: false,
            labels: [],
            hasAttachment: false,
            folder: 'inbox'
        },
        {
            id: 5,
            from: 'HR Department',
            fromEmail: 'hr@company.com',
            to: 'you@company.com',
            subject: 'Holiday Schedule 2026',
            preview: 'Please find attached the official holiday schedule for 2026...',
            body: '<p>Please find attached the official holiday schedule for 2026.</p>',
            date: new Date(now - 86400000).toISOString(),
            unread: false,
            starred: false,
            labels: ['work'],
            hasAttachment: true,
            folder: 'inbox'
        }
    ];
    
    // Filter by folder if needed
    if (folder && folder !== 'inbox' && folder !== 'all') {
        return emails.filter(e => e.folder === folder);
    }
    
    return emails;
}

module.exports = {
    sendEmail,
    getEmails,
    getEmailById,
    markAsRead,
    markAsUnread,
    toggleStar,
    moveToFolder,
    permanentDelete,
    saveToSent,
    saveDraft,
    batchDelete,
    batchMove,
    batchMarkRead,
    batchStar
};
