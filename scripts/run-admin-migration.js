const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://venkatarampey@localhost:5432/tourpay'
});

async function runMigration() {
    try {
        console.log('Starting admin schema migration...');

        // Read the SQL file
        const sqlPath = path.join(__dirname, '..', 'database', 'admin_schema.sql');
        let sql = fs.readFileSync(sqlPath, 'utf8');

        // Generate a secure password hash for initial admin
        const password = 'TourPay2025!';
        const hash = await bcrypt.hash(password, 10);

        // Replace the placeholder hash with actual hash
        sql = sql.replace('$2b$10$YourBcryptHashWillGoHere', hash);

        // Execute the SQL
        await pool.query(sql);

        console.log('✅ Admin schema migration completed successfully!');
        console.log('\n📧 Initial Admin Credentials:');
        console.log('   Email: admin@tourpay.ca');
        console.log('   Password: TourPay2025!');
        console.log('\n⚠️  IMPORTANT: Change this password after first login!\n');

        // Verify the tables were created
        const result = await pool.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name IN ('admin_users', 'admin_sessions', 'activity_logs')
            ORDER BY table_name
        `);

        console.log('Created tables:', result.rows.map(r => r.table_name).join(', '));

        // Verify the admin user was created
        const adminCheck = await pool.query(
            'SELECT email, name, role FROM admin_users WHERE email = $1',
            ['admin@tourpay.ca']
        );

        if (adminCheck.rows.length > 0) {
            console.log('\n✅ Super admin user created:', adminCheck.rows[0]);
        }

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        throw error;
    } finally {
        await pool.end();
    }
}

runMigration();
