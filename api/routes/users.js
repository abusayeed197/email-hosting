/**
 * User Routes
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const db = require('../services/database');

/**
 * GET /api/users/me
 * Get current user profile
 */
router.get('/me', auth, async (req, res) => {
    try {
        const user = await db.findUserById(req.user.userId);
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                isAdmin: user.is_admin,
                quota: user.quota,
                createdAt: user.created_at,
                lastLogin: user.last_login
            }
        });

    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to get profile' 
        });
    }
});

/**
 * PUT /api/users/me
 * Update current user profile
 */
router.put('/me', auth, async (req, res) => {
    try {
        const { firstName, lastName } = req.body;
        
        await db.updateUser(req.user.userId, {
            first_name: firstName,
            last_name: lastName
        });

        res.json({
            success: true,
            message: 'Profile updated successfully'
        });

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to update profile' 
        });
    }
});

/**
 * GET /api/users/storage
 * Get user storage usage
 */
router.get('/storage', auth, async (req, res) => {
    try {
        const storage = await db.getUserStorage(req.user.userId);

        res.json({
            success: true,
            storage: {
                used: storage.used,
                quota: storage.quota,
                percentage: Math.round((storage.used / storage.quota) * 100)
            }
        });

    } catch (error) {
        console.error('Get storage error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to get storage info' 
        });
    }
});

/**
 * GET /api/users/settings
 * Get user settings
 */
router.get('/settings', auth, async (req, res) => {
    try {
        const settings = await db.getUserSettings(req.user.userId);

        res.json({
            success: true,
            settings: settings || {
                theme: 'light',
                language: 'en',
                signature: '',
                notificationsEnabled: true,
                autoRefresh: true,
                refreshInterval: 30
            }
        });

    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to get settings' 
        });
    }
});

/**
 * PUT /api/users/settings
 * Update user settings
 */
router.put('/settings', auth, async (req, res) => {
    try {
        const settings = req.body;
        
        await db.updateUserSettings(req.user.userId, settings);

        res.json({
            success: true,
            message: 'Settings updated successfully'
        });

    } catch (error) {
        console.error('Update settings error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to update settings' 
        });
    }
});

module.exports = router;
