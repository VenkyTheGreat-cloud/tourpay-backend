# Landing Page Form Integration - Setup Guide

## Overview

This guide explains how to set up and test the AWS backend integration for your TourPay landing page forms.

## What Was Created

### 1. Database Schema
**File:** `database/leads_schema.sql`

Two new tables:
- `consumer_leads` - Stores tourist/consumer waitlist signups
- `operator_applications` - Stores merchant/operator applications

### 2. Backend Models
**Files:**
- `src/models/ConsumerLead.js`
- `src/models/OperatorApplication.js`

These handle all database operations for leads and applications.

### 3. API Routes
**File:** `src/routes/leadsRoutes.js`

**Public Endpoints (no auth required):**
- `POST /api/leads/consumer-waitlist` - Submit tourist waitlist form
- `POST /api/leads/operator-application` - Submit operator application form

**Admin Endpoints (require authentication):**
- `GET /api/leads/admin/consumer` - View all consumer leads
- `GET /api/leads/admin/consumer/stats` - Get consumer lead statistics
- `GET /api/leads/admin/applications` - View all operator applications
- `GET /api/leads/admin/applications/stats` - Get application statistics
- `PUT /api/leads/admin/consumer/:id` - Update consumer lead
- `PUT /api/leads/admin/applications/:id` - Update application status
- `POST /api/leads/admin/applications/:id/approve` - Approve application
- `POST /api/leads/admin/applications/:id/reject` - Reject application

### 4. Server Configuration
**File:** `src/server.js` (updated)

Added:
- Import for `leadsRoutes`
- Route registration: `/api/leads`
- CORS configuration for landing page domains

---

## Setup Instructions

### Step 1: Run Database Migrations

Connect to your PostgreSQL database and run the schema:

```bash
cd /Users/venkatarampey/Documents/tourpay-monorepo/.conductor/dili/backend

# Option A: If you have psql installed locally
psql -U your_username -d tourpay -f database/leads_schema.sql

# Option B: If using AWS RDS
psql -h your-rds-endpoint.amazonaws.com -U your_username -d tourpay -f database/leads_schema.sql

# Option C: Copy and paste SQL manually
cat database/leads_schema.sql
# Then paste into your database tool (pgAdmin, DBeaver, etc.)
```

**Verify tables were created:**
```sql
SELECT tablename FROM pg_tables WHERE tablename IN ('consumer_leads', 'operator_applications');
```

You should see both tables listed.

---

### Step 2: Install Dependencies (if needed)

```bash
cd /Users/venkatarampey/Documents/tourpay-monorepo/.conductor/dili/backend
npm install
```

---

### Step 3: Update Environment Variables

Make sure your `.env` file has:

```bash
# Database
DATABASE_URL=postgresql://username:password@host:port/tourpay

# CORS - Add your landing page URL
APP_URL=https://tourpay.ca

# Server
PORT=3000
NODE_ENV=development
```

---

### Step 4: Start the Backend Server

```bash
cd /Users/venkatarampey/Documents/tourpay-monorepo/.conductor/dili/backend
npm run dev
```

You should see:
```
TourPay API server running on port 3000
Environment: development
```

---

## Testing the API

### Test 1: Submit Consumer Waitlist

```bash
curl -X POST http://localhost:3000/api/leads/consumer-waitlist \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "province": "ON",
    "trips": "frequent",
    "wants_updates": true
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Successfully joined the waitlist!",
  "lead": {
    "id": "uuid-here",
    "email": "test@example.com",
    "province": "ON",
    "visit_frequency": "frequent"
  }
}
```

### Test 2: Submit Operator Application

```bash
curl -X POST http://localhost:3000/api/leads/operator-application \
  -H "Content-Type: application/json" \
  -d '{
    "business_name": "Test Tours Inc",
    "email": "business@example.com",
    "phone": "416-555-1234",
    "province": "ON",
    "transaction_volume": "100k-500k",
    "business_type": "tour-operator",
    "additional_info": "We run day tours in Niagara"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Application submitted successfully!",
  "application": {
    "id": "uuid-here",
    "business_name": "Test Tours Inc",
    "email": "business@example.com",
    "status": "pending"
  }
}
```

### Test 3: Check Database

```sql
-- View consumer leads
SELECT * FROM consumer_leads ORDER BY created_at DESC LIMIT 5;

-- View operator applications
SELECT * FROM operator_applications ORDER BY created_at DESC LIMIT 5;
```

---

## Integration with Landing Page

Your landing page forms currently submit to Netlify Forms. To add AWS backend integration:

### Option 1: Dual Submission (Recommended for now)
Submit to both Netlify Forms AND AWS backend. This gives you:
- ✅ Immediate backup in Netlify
- ✅ Data in your AWS database for future use
- ✅ No disruption if backend is down

### Option 2: AWS Only
Submit only to AWS backend. Use this when you're confident the backend is stable.

---

## Next Steps

### 1. Update Landing Page Forms

The forms need to be updated to call your AWS API endpoints:

**For Tourist Waitlist:**
```javascript
const handleSubmit = async (e) => {
  e.preventDefault();

  try {
    const response = await fetch('https://your-api-url.com/api/leads/consumer-waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: formData.email,
        province: formData.province,
        trips: formData.trips,
        wants_updates: true
      })
    });

    const data = await response.json();
    if (data.success) {
      setFormSubmitted(true);
    }
  } catch (error) {
    console.error('Error:', error);
  }
};
```

### 2. Deploy Backend to AWS

Options:
- **AWS Elastic Beanstalk** - Easy deployment for Node.js apps
- **AWS ECS/Fargate** - Containerized deployment
- **AWS EC2** - Traditional server deployment
- **AWS Lambda + API Gateway** - Serverless option

### 3. Set Up Email Notifications

Add email sending to the routes:
- Send confirmation email to user
- Send notification email to admin/sales team

Use AWS SES (Simple Email Service) for this.

### 4. Build Admin Dashboard

Create a React admin page to:
- View all leads and applications
- Update status (pending → contacted → converted)
- Add notes and follow-up reminders
- Export to CSV

---

## API Endpoints Summary

### Public (No Auth)
```
POST /api/leads/consumer-waitlist
POST /api/leads/operator-application
```

### Admin (Requires Auth Token)
```
GET    /api/leads/admin/consumer
GET    /api/leads/admin/consumer/stats
GET    /api/leads/admin/applications
GET    /api/leads/admin/applications/stats
PUT    /api/leads/admin/consumer/:id
PUT    /api/leads/admin/applications/:id
POST   /api/leads/admin/applications/:id/approve
POST   /api/leads/admin/applications/:id/reject
```

---

## Database Schema

### consumer_leads
```sql
id                UUID PRIMARY KEY
email             VARCHAR(255) UNIQUE NOT NULL
province          VARCHAR(2)
visit_frequency   VARCHAR(20)  -- never, yearly, biannual, frequent, snowbird
wants_updates     BOOLEAN DEFAULT true
status            VARCHAR(20) DEFAULT 'pending'  -- pending, contacted, converted, rejected
notes             TEXT
created_at        TIMESTAMP
updated_at        TIMESTAMP
```

### operator_applications
```sql
id                    UUID PRIMARY KEY
business_name         VARCHAR(255) NOT NULL
email                 VARCHAR(255) UNIQUE NOT NULL
phone                 VARCHAR(20)
province              VARCHAR(2)
monthly_volume_usd    VARCHAR(50)  -- under50k, 50k-100k, 100k-500k, 500k-1m, over1m
business_type         VARCHAR(50)  -- tour-operator, travel-agency, hotel, etc.
additional_info       TEXT
status                VARCHAR(20) DEFAULT 'pending'  -- pending, reviewing, approved, rejected
rejection_reason      TEXT
notes                 TEXT
created_at            TIMESTAMP
updated_at            TIMESTAMP
```

---

## Troubleshooting

### Database Connection Issues
```bash
# Test database connection
psql -h your-host -U your-user -d tourpay -c "SELECT NOW();"
```

### Server Won't Start
```bash
# Check if port 3000 is in use
lsof -i :3000

# Kill process if needed
kill -9 <PID>
```

### CORS Errors
Make sure your landing page domain is in the `allowedOrigins` array in `server.js`:
```javascript
const allowedOrigins = [
  'https://tourpay.ca',
  'https://www.tourpay.ca',
  'https://cute-sherbet-3be10c.netlify.app'
];
```

### Forms Not Submitting
1. Check browser console for errors
2. Verify API is running: `curl http://localhost:3000/health`
3. Check CORS headers in network tab
4. Verify database connection

---

## Support

For issues or questions, check:
- Backend logs: Check console where `npm run dev` is running
- Database logs: Query `consumer_leads` and `operator_applications` tables
- Network tab: Check API request/response in browser DevTools

---

## Status

✅ Database schema created
✅ Backend models created
✅ API routes created
✅ Server configuration updated
⏳ Database migration (run Step 1 above)
⏳ Backend testing (run Step 4 above)
⏳ Landing page integration (update form handlers)
⏳ Production deployment

Last Updated: 2025-11-02
