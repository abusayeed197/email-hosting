/**
 * Database Service
 * MySQL/MariaDB connection and queries
 */

const mysql = require('mysql2/promise');

// Database configuration
const dbConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'mailuser',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'mailserver',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// Create connection pool
let pool;

const getPool = () => {
    if (!pool) {
        pool = mysql.createPool(dbConfig);
    }
    return pool;
};

/**
 * User queries
 */

const findUserByEmail = async (email) => {
    try {
        const [rows] = await getPool().execute(
            'SELECT * FROM virtual_users WHERE email = ?',
            [email]
        );
        return rows[0] || null;
    } catch (error) {
        console.error('Database error (findUserByEmail):', error);
        // Return mock user for demo
        if (email) {
            return {
                id: 1,
                email: email,
                password: '$2a$12$demo', // This won't match but we handle it in auth
                first_name: email.split('@')[0],
                last_name: '',
                is_active: true,
                is_admin: false
            };
        }
        return null;
    }
};

const findUserById = async (id) => {
    try {
        const [rows] = await getPool().execute(
            'SELECT * FROM virtual_users WHERE id = ?',
            [id]
        );
        return rows[0] || null;
    } catch (error) {
        console.error('Database error (findUserById):', error);
        return null;
    }
};

const createUser = async ({ email, password, firstName, lastName }) => {
    try {
        const [result] = await getPool().execute(
            `INSERT INTO virtual_users (domain_id, email, password, first_name, last_name) 
             VALUES ((SELECT id FROM virtual_domains LIMIT 1), ?, ?, ?, ?)`,
            [email, password, firstName, lastName]
        );
        return result.insertId;
    } catch (error) {
        console.error('Database error (createUser):', error);
        throw error;
    }
};

const updateUser = async (id, data) => {
    try {
        const fields = [];
        const values = [];
        
        for (const [key, value] of Object.entries(data)) {
            if (value !== undefined) {
                fields.push(`${key} = ?`);
                values.push(value);
            }
        }
        
        values.push(id);
        
        await getPool().execute(
            `UPDATE virtual_users SET ${fields.join(', ')} WHERE id = ?`,
            values
        );
    } catch (error) {
        console.error('Database error (updateUser):', error);
        throw error;
    }
};

const updateLastLogin = async (id) => {
    try {
        await getPool().execute(
            'UPDATE virtual_users SET last_login = NOW() WHERE id = ?',
            [id]
        );
    } catch (error) {
        console.error('Database error (updateLastLogin):', error);
    }
};

const updatePassword = async (id, hashedPassword) => {
    try {
        await getPool().execute(
            'UPDATE virtual_users SET password = ? WHERE id = ?',
            [hashedPassword, id]
        );
    } catch (error) {
        console.error('Database error (updatePassword):', error);
        throw error;
    }
};

/**
 * Storage queries
 */

const getUserStorage = async (userId) => {
    // Return mock data for now
    return {
        used: 4831838208, // ~4.5 GB
        quota: 10737418240 // 10 GB
    };
};

/**
 * Settings queries
 */

const getUserSettings = async (userId) => {
    // Return default settings
    return {
        theme: 'light',
        language: 'en',
        signature: '',
        notificationsEnabled: true,
        autoRefresh: true,
        refreshInterval: 30
    };
};

const updateUserSettings = async (userId, settings) => {
    // Store in memory or database
    console.log('Updating settings for user:', userId, settings);
};

/**
 * Folder queries
 */

const getUserFolders = async (userId) => {
    // Return empty array - user can create custom folders
    return [];
};

const createFolder = async (userId, { name, color }) => {
    // Create folder
    return Date.now(); // Return mock ID
};

const updateFolder = async (userId, folderId, data) => {
    // Update folder
};

const deleteFolder = async (userId, folderId) => {
    // Delete folder
};

/**
 * Contact queries
 */

const getUserContacts = async (userId, { search, page, limit }) => {
    // Return mock data
    return {
        items: [],
        total: 0,
        page: 1,
        totalPages: 0
    };
};

const getRecentContacts = async (userId, limit) => {
    // Return mock recent contacts
    return [
        { id: 1, name: 'John Doe', email: 'john@example.com' },
        { id: 2, name: 'Sarah Wilson', email: 'sarah@company.com' },
        { id: 3, name: 'Mike Johnson', email: 'mike@business.com' }
    ];
};

const createContact = async (userId, data) => {
    return Date.now();
};

const updateContact = async (userId, contactId, data) => {
    // Update contact
};

const deleteContact = async (userId, contactId) => {
    // Delete contact
};

const importContacts = async (userId, contacts) => {
    return contacts.length;
};

module.exports = {
    getPool,
    findUserByEmail,
    findUserById,
    createUser,
    updateUser,
    updateLastLogin,
    updatePassword,
    getUserStorage,
    getUserSettings,
    updateUserSettings,
    getUserFolders,
    createFolder,
    updateFolder,
    deleteFolder,
    getUserContacts,
    getRecentContacts,
    createContact,
    updateContact,
    deleteContact,
    importContacts
};
