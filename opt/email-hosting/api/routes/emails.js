/**
 * Email Routes
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const emailService = require('../services/email');

/**
 * GET /api/emails/:folder
 * Get emails from a folder
 */
router.get('/:folder', auth, async (req, res) => {
    try {
        const { folder } = req.params;
        const { page = 1, limit = 50, search } = req.query;
        const userId = req.user.userId;

        const emails = await emailService.getEmails(userId, folder, {
            page: parseInt(page),
            limit: parseInt(limit),
            search
        });

        res.json({
            success: true,
            emails: emails.messages,
            total: emails.total,
            page: emails.page,
            totalPages: emails.totalPages
        });

    } catch (error) {
        console.error('Get emails error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch emails' 
        });
    }
});

/**
 * GET /api/emails/message/:id
 * Get single email by ID
 */
router.get('/message/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        const email = await emailService.getEmailById(userId, id);

        if (!email) {
            return res.status(404).json({ 
                success: false, 
                message: 'Email not found' 
            });
        }

        // Mark as read
        await emailService.markAsRead(userId, id);

        res.json({
            success: true,
            email
        });

    } catch (error) {
        console.error('Get email error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch email' 
        });
    }
});

/**
 * POST /api/emails/send
 * Send a new email
 */
router.post('/send', auth, [
    body('to').isEmail().normalizeEmail(),
    body('subject').trim().notEmpty(),
    body('body').trim().notEmpty()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid input',
                errors: errors.array() 
            });
        }

        const { to, cc, bcc, subject, body, attachments } = req.body;
        const userId = req.user.userId;
        const userEmail = req.user.email;

        const result = await emailService.sendEmail({
            from: userEmail,
            to,
            cc,
            bcc,
            subject,
            body,
            attachments
        });

        if (result.success) {
            // Save to sent folder
            await emailService.saveToSent(userId, {
                to,
                cc,
                bcc,
                subject,
                body,
                messageId: result.messageId
            });

            res.json({
                success: true,
                message: 'Email sent successfully',
                messageId: result.messageId
            });
        } else {
            throw new Error(result.error);
        }

    } catch (error) {
        console.error('Send email error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to send email' 
        });
    }
});

/**
 * POST /api/emails/:id/star
 * Toggle star status
 */
router.post('/:id/star', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { starred } = req.body;
        const userId = req.user.userId;

        await emailService.toggleStar(userId, id, starred);

        res.json({
            success: true,
            message: starred ? 'Email starred' : 'Star removed'
        });

    } catch (error) {
        console.error('Toggle star error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to update star status' 
        });
    }
});

/**
 * POST /api/emails/:id/read
 * Mark email as read/unread
 */
router.post('/:id/read', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { read } = req.body;
        const userId = req.user.userId;

        if (read) {
            await emailService.markAsRead(userId, id);
        } else {
            await emailService.markAsUnread(userId, id);
        }

        res.json({
            success: true,
            message: read ? 'Marked as read' : 'Marked as unread'
        });

    } catch (error) {
        console.error('Mark read error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to update read status' 
        });
    }
});

/**
 * POST /api/emails/:id/move
 * Move email to folder
 */
router.post('/:id/move', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { folder } = req.body;
        const userId = req.user.userId;

        await emailService.moveToFolder(userId, id, folder);

        res.json({
            success: true,
            message: `Email moved to ${folder}`
        });

    } catch (error) {
        console.error('Move email error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to move email' 
        });
    }
});

/**
 * DELETE /api/emails/:id
 * Delete email (move to trash or permanent delete)
 */
router.delete('/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { permanent } = req.query;
        const userId = req.user.userId;

        if (permanent === 'true') {
            await emailService.permanentDelete(userId, id);
        } else {
            await emailService.moveToFolder(userId, id, 'trash');
        }

        res.json({
            success: true,
            message: permanent ? 'Email permanently deleted' : 'Email moved to trash'
        });

    } catch (error) {
        console.error('Delete email error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to delete email' 
        });
    }
});

/**
 * POST /api/emails/batch
 * Batch operations on multiple emails
 */
router.post('/batch', auth, async (req, res) => {
    try {
        const { action, emailIds } = req.body;
        const userId = req.user.userId;

        if (!Array.isArray(emailIds) || emailIds.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'No emails selected' 
            });
        }

        let result;
        switch (action) {
            case 'delete':
                result = await emailService.batchDelete(userId, emailIds);
                break;
            case 'archive':
                result = await emailService.batchMove(userId, emailIds, 'archive');
                break;
            case 'markRead':
                result = await emailService.batchMarkRead(userId, emailIds, true);
                break;
            case 'markUnread':
                result = await emailService.batchMarkRead(userId, emailIds, false);
                break;
            case 'star':
                result = await emailService.batchStar(userId, emailIds, true);
                break;
            case 'unstar':
                result = await emailService.batchStar(userId, emailIds, false);
                break;
            default:
                return res.status(400).json({ 
                    success: false, 
                    message: 'Invalid action' 
                });
        }

        res.json({
            success: true,
            message: `${action} completed for ${emailIds.length} emails`,
            affected: result.affected
        });

    } catch (error) {
        console.error('Batch operation error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Batch operation failed' 
        });
    }
});

/**
 * POST /api/emails/draft
 * Save draft
 */
router.post('/draft', auth, async (req, res) => {
    try {
        const { to, cc, bcc, subject, body } = req.body;
        const userId = req.user.userId;

        const draftId = await emailService.saveDraft(userId, {
            to,
            cc,
            bcc,
            subject,
            body
        });

        res.json({
            success: true,
            message: 'Draft saved',
            draftId
        });

    } catch (error) {
        console.error('Save draft error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to save draft' 
        });
    }
});

module.exports = router;
