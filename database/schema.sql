-- TourPay Database Schema
-- PostgreSQL database schema for the TourPay blockchain payment platform

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    country VARCHAR(2) DEFAULT 'CA',
    user_type VARCHAR(20) DEFAULT 'traveler' CHECK (user_type IN ('traveler', 'operator', 'admin')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Wallets table
CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    coinbase_wallet_id VARCHAR(255),
    coinbase_wallet_address VARCHAR(255),
    network VARCHAR(20) DEFAULT 'base',
    balance_usdc DECIMAL(20, 2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tour_id VARCHAR(255),
    tour_operator_id UUID REFERENCES users(id),
    tour_name VARCHAR(255) NOT NULL,
    tour_price_cad DECIMAL(10, 2) NOT NULL,
    tour_price_usd DECIMAL(10, 2) NOT NULL,
    number_of_travelers INTEGER DEFAULT 1,
    travel_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'paid', 'checked_in', 'completed', 'cancelled', 'refunded')),
    payment_method VARCHAR(50),
    smart_contract_tx_hash VARCHAR(255),
    check_in_qr_code VARCHAR(255),
    check_in_time TIMESTAMP,
    cancelled_at TIMESTAMP,
    completed_at TIMESTAMP,
    refund_amount DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('deposit', 'payment', 'refund', 'withdrawal')),
    amount_usdc DECIMAL(20, 6) NOT NULL,
    amount_cad DECIMAL(20, 2),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    payment_method VARCHAR(50),
    coinbase_transaction_id VARCHAR(255),
    blockchain_tx_hash VARCHAR(255),
    network_token_id UUID,
    error_message TEXT,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Network Tokens table (Apple Pay, Transit Cards, Discover, etc.)
CREATE TABLE IF NOT EXISTS network_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    token_type VARCHAR(50) NOT NULL CHECK (token_type IN ('apple_pay', 'transit_card', 'discover', 'google_pay')),
    token_identifier VARCHAR(255) UNIQUE NOT NULL,
    token_data JSONB,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'expired', 'revoked')),
    device_id VARCHAR(255),
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP,
    deactivated_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tour Operators table
CREATE TABLE IF NOT EXISTS tour_operators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL,
    business_number VARCHAR(50),
    wallet_address VARCHAR(255),
    website VARCHAR(255),
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'suspended', 'rejected')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Tours table
CREATE TABLE IF NOT EXISTS tours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operator_id UUID NOT NULL REFERENCES tour_operators(id) ON DELETE CASCADE,
    tour_name VARCHAR(255) NOT NULL,
    description TEXT,
    price_cad DECIMAL(10, 2) NOT NULL,
    price_usd DECIMAL(10, 2) NOT NULL,
    duration_days INTEGER,
    max_capacity INTEGER,
    available_dates JSONB,
    location VARCHAR(255),
    category VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Operator Payment Methods table
CREATE TABLE IF NOT EXISTS operator_payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operator_id UUID NOT NULL REFERENCES tour_operators(id) ON DELETE CASCADE,
    payment_type VARCHAR(20) NOT NULL CHECK (payment_type IN ('ach', 'coinbase_wallet', 'bank_wire')),
    is_primary BOOLEAN DEFAULT false,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending_verification', 'rejected')),

    -- ACH details
    ach_routing_number VARCHAR(9),
    ach_account_number VARCHAR(17),
    ach_account_type VARCHAR(20) CHECK (ach_account_type IN ('checking', 'savings', NULL)),
    ach_bank_name VARCHAR(255),

    -- Coinbase Wallet details
    coinbase_wallet_address VARCHAR(255),
    coinbase_wallet_id VARCHAR(255),
    coinbase_network VARCHAR(20) DEFAULT 'base',

    -- Bank Wire details
    wire_bank_name VARCHAR(255),
    wire_swift_code VARCHAR(11),
    wire_account_number VARCHAR(34),
    wire_iban VARCHAR(34),
    wire_routing_number VARCHAR(9),

    -- Verification
    verification_status VARCHAR(20) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'failed', 'manual_review')),
    verification_date TIMESTAMP,
    verification_method VARCHAR(50),

    -- Metadata
    plaid_account_id VARCHAR(255),
    last_used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Operator Payouts table (track all payments to operators)
CREATE TABLE IF NOT EXISTS operator_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operator_id UUID NOT NULL REFERENCES tour_operators(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    payment_method_id UUID REFERENCES operator_payment_methods(id) ON DELETE SET NULL,

    amount_usdc DECIMAL(20, 6) NOT NULL,
    amount_usd DECIMAL(20, 2),
    fee_amount DECIMAL(20, 6) DEFAULT 0,
    net_amount DECIMAL(20, 6),

    payout_type VARCHAR(20) NOT NULL CHECK (payout_type IN ('ach', 'coinbase_wallet', 'bank_wire')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),

    -- Transaction details
    coinbase_transaction_id VARCHAR(255),
    ach_transaction_id VARCHAR(255),
    blockchain_tx_hash VARCHAR(255),
    external_reference VARCHAR(255),

    -- Timing
    initiated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    completed_at TIMESTAMP,
    failed_at TIMESTAMP,

    -- Error handling
    error_code VARCHAR(50),
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,

    -- Metadata
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better query performance
CREATE INDEX idx_wallets_user_id ON wallets(user_id);
CREATE INDEX idx_bookings_user_id ON bookings(user_id);
CREATE INDEX idx_bookings_tour_operator_id ON bookings(tour_operator_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_travel_date ON bookings(travel_date);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_wallet_id ON transactions(wallet_id);
CREATE INDEX idx_transactions_booking_id ON transactions(booking_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_network_tokens_user_id ON network_tokens(user_id);
CREATE INDEX idx_network_tokens_wallet_id ON network_tokens(wallet_id);
CREATE INDEX idx_network_tokens_token_identifier ON network_tokens(token_identifier);
CREATE INDEX idx_tours_operator_id ON tours(operator_id);
CREATE INDEX idx_tours_status ON tours(status);
CREATE INDEX idx_operator_payment_methods_operator_id ON operator_payment_methods(operator_id);
CREATE INDEX idx_operator_payment_methods_status ON operator_payment_methods(status);
CREATE INDEX idx_operator_payouts_operator_id ON operator_payouts(operator_id);
CREATE INDEX idx_operator_payouts_booking_id ON operator_payouts(booking_id);
CREATE INDEX idx_operator_payouts_status ON operator_payouts(status);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to automatically update updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON wallets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_network_tokens_updated_at BEFORE UPDATE ON network_tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tour_operators_updated_at BEFORE UPDATE ON tour_operators
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tours_updated_at BEFORE UPDATE ON tours
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_operator_payment_methods_updated_at BEFORE UPDATE ON operator_payment_methods
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_operator_payouts_updated_at BEFORE UPDATE ON operator_payouts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
