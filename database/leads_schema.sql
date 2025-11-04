-- Landing Page Leads Schema
-- Tables for storing consumer waitlist and operator applications from landing page

-- Consumer/Tourist Waitlist
CREATE TABLE IF NOT EXISTS consumer_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    province VARCHAR(2),
    visit_frequency VARCHAR(20),
    wants_updates BOOLEAN DEFAULT true,
    status VARCHAR(20) DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Operator/Merchant Applications
CREATE TABLE IF NOT EXISTS operator_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    province VARCHAR(2),
    monthly_volume_usd VARCHAR(50),
    business_type VARCHAR(50),
    additional_info TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    rejection_reason TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_consumer_leads_email ON consumer_leads(email);
CREATE INDEX idx_consumer_leads_status ON consumer_leads(status);
CREATE INDEX idx_consumer_leads_created_at ON consumer_leads(created_at DESC);

CREATE INDEX idx_operator_applications_email ON operator_applications(email);
CREATE INDEX idx_operator_applications_status ON operator_applications(status);
CREATE INDEX idx_operator_applications_created_at ON operator_applications(created_at DESC);

-- Comments
COMMENT ON TABLE consumer_leads IS 'Stores consumer/tourist waitlist signups from landing page';
COMMENT ON TABLE operator_applications IS 'Stores tour operator/merchant applications from landing page';

COMMENT ON COLUMN consumer_leads.visit_frequency IS 'Values: never, yearly, biannual, frequent, snowbird';
COMMENT ON COLUMN consumer_leads.status IS 'Values: pending, contacted, converted, rejected';
COMMENT ON COLUMN operator_applications.status IS 'Values: pending, reviewing, approved, rejected';
