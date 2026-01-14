/**
 * Folder Routes
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const db = require('../services/database');

/**
 * GET /api/folders
 * Get all folders for user
 */
router.get('/', auth, async (req, res) => {
    try {
        const folders = await db.getUserFolders(req.user.userId);

        // Default system folders
        const systemFolders = [
            { name: 'inbox', label: 'Inbox', icon: 'inbox', count: 0 },
            { name: 'starred', label: 'Starred', icon: 'star', count: 0 },
            { name: 'sent', label: 'Sent', icon: 'paper-plane', count: 0 },
            { name: 'drafts', label: 'Drafts', icon: 'file-lines', count: 0 },
            { name: 'spam', label: 'Spam', icon: 'triangle-exclamation', count: 0 },
            { name: 'trash', label: 'Trash', icon: 'trash-can', count: 0 },
            { name: 'archive', label: 'Archive', icon: 'box-archive', count: 0 }
        ];

        res.json({
            success: true,
            systemFolders,
            customFolders: folders || []
        });

    } catch (error) {
        console.error('Get folders error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to get folders' 
        });
    }
});

/**
 * POST /api/folders
 * Create a new custom folder
 */
router.post('/', auth, async (req, res) => {
    try {
        const { name, color } = req.body;

        if (!name || name.trim().length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Folder name is required' 
            });
        }

        const folderId = await db.createFolder(req.user.userId, {
            name: name.trim(),
            color: color || '#6B7280'
        });

        res.status(201).json({
            success: true,
            message: 'Folder created',
            folderId
        });

    } catch (error) {
        console.error('Create folder error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to create folder' 
        });
    }
});

/**
 * PUT /api/folders/:id
 * Update a custom folder
 */
router.put('/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, color } = req.body;

        await db.updateFolder(req.user.userId, id, { name, color });

        res.json({
            success: true,
            message: 'Folder updated'
        });

    } catch (error) {
        console.error('Update folder error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to update folder' 
        });
    }
});

/**
 * DELETE /api/folders/:id
 * Delete a custom folder
 */
router.delete('/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;

        await db.deleteFolder(req.user.userId, id);

        res.json({
            success: true,
            message: 'Folder deleted'
        });

    } catch (error) {
        console.error('Delete folder error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to delete folder' 
        });
    }
});

module.exports = router;
