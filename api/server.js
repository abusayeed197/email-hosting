/**
 * MailPro - Professional Email Hosting API
 * Main Server File
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Import routes
const authRoutes = require('./routes/auth');
const emailRoutes = require('./routes/emails');
const userRoutes = require('./routes/users');
const folderRoutes = require('./routes/folders');
const contactRoutes = require('./routes/contacts');

// Initialize Express
const app = express();

// Configuration
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Security Middleware
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

// CORS Configuration
app.use(cors({
    origin: NODE_ENV === 'production' 
        ? process.env.FRONTEND_URL 
        : ['http://localhost:3000', 'http://localhost:5000', 'http://127.0.0.1:5500'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Body Parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request Logging
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.path}`);
    next();
});

// Health Check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        environment: NODE_ENV
    });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/users', userRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/contacts', contactRoutes);

// Serve static files in production
if (NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../')));
    
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../index.html'));
    });
}

// 404 Handler
app.use((req, res) => {
    res.status(404).json({ 
        error: 'Not Found',
        message: `Cannot ${req.method} ${req.path}`
    });
});

// Error Handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    
    res.status(err.status || 500).json({
        error: NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
        ...(NODE_ENV !== 'production' && { stack: err.stack })
    });
});

// Start Server
app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║     📧 MailPro API Server                                    ║
║                                                              ║
║     Status:      Running                                     ║
║     Port:        ${PORT}                                          ║
║     Environment: ${NODE_ENV.padEnd(40)}║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
    `);
});

// Graceful Shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received. Shutting down gracefully...');
    process.exit(0);
});

module.exports = app;
