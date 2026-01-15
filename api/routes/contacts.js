/**
 * Contact Routes
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const db = require('../services/database');

/**
 * GET /api/contacts
 * Get all contacts for user
 */
router.get('/', auth, async (req, res) => {
    try {
        const { search, page = 1, limit = 50 } = req.query;
        
        const contacts = await db.getUserContacts(req.user.userId, {
            search,
            page: parseInt(page),
            limit: parseInt(limit)
        });

        res.json({
            success: true,
            contacts: contacts.items,
            total: contacts.total,
            page: contacts.page,
            totalPages: contacts.totalPages
        });

    } catch (error) {
        console.error('Get contacts error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to get contacts' 
        });
    }
});

/**
 * GET /api/contacts/recent
 * Get recent contacts
 */
router.get('/recent', auth, async (req, res) => {
    try {
        const contacts = await db.getRecentContacts(req.user.userId, 10);

        res.json({
            success: true,
            contacts
        });

    } catch (error) {
        console.error('Get recent contacts error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to get recent contacts' 
        });
    }
});

/**
 * POST /api/contacts
 * Create a new contact
 */
router.post('/', auth, async (req, res) => {
    try {
        const { email, name, phone, company, notes } = req.body;

        if (!email) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email is required' 
            });
        }

        const contactId = await db.createContact(req.user.userId, {
            email,
            name,
            phone,
            company,
            notes
        });

        res.status(201).json({
            success: true,
            message: 'Contact created',
            contactId
        });

    } catch (error) {
        console.error('Create contact error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to create contact' 
        });
    }
});

/**
 * PUT /api/contacts/:id
 * Update a contact
 */
router.put('/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { email, name, phone, company, notes } = req.body;

        await db.updateContact(req.user.userId, id, {
            email,
            name,
            phone,
            company,
            notes
        });

        res.json({
            success: true,
            message: 'Contact updated'
        });

    } catch (error) {
        console.error('Update contact error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to update contact' 
        });
    }
});

/**
 * DELETE /api/contacts/:id
 * Delete a contact
 */
router.delete('/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;

        await db.deleteContact(req.user.userId, id);

        res.json({
            success: true,
            message: 'Contact deleted'
        });

    } catch (error) {
        console.error('Delete contact error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to delete contact' 
        });
    }
});

/**
 * POST /api/contacts/import
 * Import contacts from CSV
 */
router.post('/import', auth, async (req, res) => {
    try {
        const { contacts } = req.body;

        if (!Array.isArray(contacts) || contacts.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'No contacts to import' 
            });
        }

        const imported = await db.importContacts(req.user.userId, contacts);

        res.json({
            success: true,
            message: `Imported ${imported} contacts`
        });

    } catch (error) {
        console.error('Import contacts error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to import contacts' 
        });
    }
});

module.exports = router;
