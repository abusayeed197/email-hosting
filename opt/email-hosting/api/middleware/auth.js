/**
 * Authentication Middleware
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

/**
 * Verify JWT token and attach user to request
 */
const auth = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                success: false, 
                message: 'Authentication required' 
            });
        }

        const token = authHeader.split(' ')[1];
        
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            req.user = decoded;
            next();
        } catch (jwtError) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid or expired token' 
            });
        }

    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Authentication error' 
        });
    }
};

/**
 * Admin only middleware
 */
const adminOnly = (req, res, next) => {
    if (!req.user || !req.user.isAdmin) {
        return res.status(403).json({ 
            success: false, 
            message: 'Admin access required' 
        });
    }
    next();
};

/**
 * Optional auth - doesn't fail if no token
 */
const optionalAuth = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                req.user = decoded;
            } catch (e) {
                // Token invalid, but continue without user
            }
        }
        
        next();
    } catch (error) {
        next();
    }
};

module.exports = auth;
module.exports.auth = auth;
module.exports.adminOnly = adminOnly;
module.exports.optionalAuth = optionalAuth;
