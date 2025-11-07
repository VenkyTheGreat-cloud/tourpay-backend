#!/usr/bin/env node

require('dotenv').config();
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

// Generate a test JWT token for testing wallet endpoints
const testUser = {
  id: uuidv4(),
  email: 'test@tourpay.com',
  role: 'user',
  username: 'testuser'
};

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-key-change-in-production-12345';

const token = jwt.sign(testUser, JWT_SECRET, {
  expiresIn: '24h'
});

console.log('========================================');
console.log('🔑 Test JWT Token Generated');
console.log('========================================');
console.log('');
console.log('Test User:');
console.log(`  ID: ${testUser.id}`);
console.log(`  Email: ${testUser.email}`);
console.log(`  Role: ${testUser.role}`);
console.log('');
console.log('========================================');
console.log('JWT Token (valid for 24 hours):');
console.log('========================================');
console.log('');
console.log(token);
console.log('');
console.log('========================================');
console.log('📋 Copy and use in your API calls:');
console.log('========================================');
console.log('');
console.log('export JWT_TOKEN="' + token + '"');
console.log('');
console.log('Or use directly in curl:');
console.log('');
console.log('curl -X POST http://localhost:3000/api/wallet/fund \\');
console.log('  -H "Authorization: Bearer ' + token + '" \\');
console.log('  -H "Content-Type: application/json" \\');
console.log('  -d \'{"amount": 100, "currency": "CAD"}\'');
console.log('');
