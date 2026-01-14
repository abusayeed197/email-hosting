/**
 * Authentication Routes
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db = require('../services/database');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

/**
 * POST /api/auth/login
 * User login
 */
router.post('/login', [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty()
], async (req, res) => {
    try {
        // Validate input
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid input',
                errors: errors.array() 
            });
        }

        const { email, password } = req.body;

        // Find user in database
        const user = await db.findUserByEmail(email);
        
        if (!user) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid email or password' 
            });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password);
        
        if (!isValidPassword) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid email or password' 
            });
        }

        // Check if user is active
        if (!user.is_active) {
            return res.status(403).json({ 
                success: false, 
                message: 'Account is disabled' 
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            { 
                userId: user.id, 
                email: user.email,
                isAdmin: user.is_admin 
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        // Update last login
        await db.updateLastLogin(user.id);

        // Return success response
        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                isAdmin: user.is_admin
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error during login' 
        });
    }
});

/**
 * POST /api/auth/register
 * User registration (admin only or self-registration if enabled)
 */
router.post('/register', [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('firstName').trim().notEmpty(),
    body('lastName').trim().optional()
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

        const { email, password, firstName, lastName } = req.body;

        // Check if user already exists
        const existingUser = await db.findUserByEmail(email);
        if (existingUser) {
            return res.status(409).json({ 
                success: false, 
                message: 'Email already registered' 
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create user
        const userId = await db.createUser({
            email,
            password: hashedPassword,
            firstName,
            lastName
        });

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            userId
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error during registration' 
        });
    }
});

/**
 * POST /api/auth/forgot-password
 * Request password reset
 */
router.post('/forgot-password', [
    body('email').isEmail().normalizeEmail()
], async (req, res) => {
    try {
        const { email } = req.body;

        // Always return success to prevent email enumeration
        res.json({
            success: true,
            message: 'If the email exists, a password reset link will be sent'
        });

        // TODO: Implement actual password reset email sending

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
});

/**
 * POST /api/auth/change-password
 * Change password (authenticated)
 */
router.post('/change-password', [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 8 })
], async (req, res) => {
    try {
        // This route requires authentication middleware
        const { currentPassword, newPassword } = req.body;
        const userId = req.user?.userId;

        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                message: 'Authentication required' 
            });
        }

        // Get user
        const user = await db.findUserById(userId);
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        // Verify current password
        const isValid = await bcrypt.compare(currentPassword, user.password);
        if (!isValid) {
            return res.status(401).json({ 
                success: false, 
                message: 'Current password is incorrect' 
            });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        // Update password
        await db.updatePassword(userId, hashedPassword);

        res.json({
            success: true,
            message: 'Password changed successfully'
        });

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
});

/**
 * GET /api/auth/verify
 * Verify JWT token
 */
router.get('/verify', (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                success: false, 
                message: 'No token provided' 
            });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);

        res.json({
            success: true,
            user: {
                userId: decoded.userId,
                email: decoded.email,
                isAdmin: decoded.isAdmin
            }
        });

    } catch (error) {
        res.status(401).json({ 
            success: false, 
            message: 'Invalid or expired token' 
        });
    }
});

module.exports = router;
