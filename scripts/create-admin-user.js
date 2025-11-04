const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://venkatarampey@localhost:5432/tourpay'
});

async function createAdminUser() {
    try {
        console.log('Creating admin user...');

        // Generate password hash
        const password = 'TourPay2025!';
        const hash = await bcrypt.hash(password, 10);

        // Insert or update admin user
        const result = await pool.query(`
            INSERT INTO admin_users (
                id,
                email,
                password_hash,
                name,
                role,
                is_active,
                created_at,
                updated_at
            ) VALUES (
                gen_random_uuid(),
                $1,
                $2,
                $3,
                $4,
                true,
                NOW(),
                NOW()
            )
            ON CONFLICT (email)
            DO UPDATE SET
                password_hash = EXCLUDED.password_hash,
                updated_at = NOW()
            RETURNING email, name, role, is_active
        `, ['admin@tourpay.ca', hash, 'Super Admin', 'super_admin']);

        console.log('✅ Admin user created successfully!');
        console.log('\n📧 Admin Credentials:');
        console.log('   Email: admin@tourpay.ca');
        console.log('   Password: TourPay2025!');
        console.log('\n👤 User Details:', result.rows[0]);
        console.log('\n⚠️  IMPORTANT: Change this password after first login!\n');

    } catch (error) {
        console.error('❌ Failed to create admin user:', error.message);
        console.error('Details:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

createAdminUser();
