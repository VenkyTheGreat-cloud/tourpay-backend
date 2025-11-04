const express = require('express');
const router = express.Router();
const ConsumerLead = require('../models/ConsumerLead');
const OperatorApplication = require('../models/OperatorApplication');
const { authenticateAdmin, requireAdmin } = require('../middleware/adminAuth');
const logger = require('../config/logger');

/**
 * PUBLIC ROUTES - No authentication required
 * These are called directly from the landing page
 */

/**
 * POST /api/leads/consumer-waitlist
 * Submit consumer/tourist waitlist form
 */
router.post('/consumer-waitlist', async (req, res) => {
  try {
    const { email, province, trips, wants_updates } = req.body;

    // Validation
    if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return res.status(400).json({ error: 'Valid email is required' });
    }

    // Map 'trips' to 'visit_frequency' to match database column
    const leadData = {
      email: email.toLowerCase().trim(),
      province,
      visit_frequency: trips,
      wants_updates: wants_updates !== false
    };

    const lead = await ConsumerLead.create(leadData);

    logger.info(`New consumer lead created: ${email}`);

    res.status(201).json({
      success: true,
      message: 'Successfully joined the waitlist!',
      lead: {
        id: lead.id,
        email: lead.email,
        province: lead.province,
        visit_frequency: lead.visit_frequency
      }
    });
  } catch (error) {
    if (error.message === 'Email already registered') {
      return res.status(409).json({
        error: 'This email is already on our waitlist',
        message: 'You\'re already registered! We\'ll notify you when we launch.'
      });
    }

    logger.error('Error creating consumer lead:', error);
    res.status(500).json({ error: 'Failed to submit waitlist form' });
  }
});

/**
 * POST /api/leads/operator-application
 * Submit operator/merchant application form
 */
router.post('/operator-application', async (req, res) => {
  try {
    const {
      business_name,
      email,
      phone,
      province,
      transaction_volume,
      business_type,
      additional_info
    } = req.body;

    // Validation
    if (!business_name || !email) {
      return res.status(400).json({ error: 'Business name and email are required' });
    }

    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return res.status(400).json({ error: 'Valid email is required' });
    }

    const applicationData = {
      business_name: business_name.trim(),
      email: email.toLowerCase().trim(),
      phone,
      province,
      monthly_volume_usd: transaction_volume,
      business_type,
      additional_info
    };

    const application = await OperatorApplication.create(applicationData);

    logger.info(`New operator application created: ${business_name} (${email})`);

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully!',
      application: {
        id: application.id,
        business_name: application.business_name,
        email: application.email,
        status: application.status
      }
    });
  } catch (error) {
    if (error.message === 'Email already registered') {
      return res.status(409).json({
        error: 'Application already submitted',
        message: 'We already have your application on file. We\'ll be in touch soon!'
      });
    }

    logger.error('Error creating operator application:', error);
    res.status(500).json({ error: 'Failed to submit application' });
  }
});

/**
 * ADMIN ROUTES - Require authentication
 * These are for viewing and managing leads in admin dashboard
 */

/**
 * GET /api/leads/admin/consumer
 * Get all consumer leads (admin only)
 */
router.get('/admin/consumer', authenticateAdmin, requireAdmin, async (req, res) => {
  try {
    const { status, limit = 100, offset = 0 } = req.query;

    const leads = await ConsumerLead.findAll({
      status,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      count: leads.length,
      leads
    });
  } catch (error) {
    logger.error('Error fetching consumer leads:', error);
    res.status(500).json({ error: 'Failed to fetch consumer leads' });
  }
});

/**
 * GET /api/leads/admin/consumer/stats
 * Get consumer lead statistics (admin only)
 */
router.get('/admin/consumer/stats', authenticateAdmin, requireAdmin, async (req, res) => {
  try {
    const stats = await ConsumerLead.getStats();
    res.json({ success: true, stats });
  } catch (error) {
    logger.error('Error fetching consumer lead stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

/**
 * GET /api/leads/admin/applications
 * Get all operator applications (admin only)
 */
router.get('/admin/applications', authenticateAdmin, requireAdmin, async (req, res) => {
  try {
    const { status, business_type, limit = 100, offset = 0 } = req.query;

    const applications = await OperatorApplication.findAll({
      status,
      business_type,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      count: applications.length,
      applications
    });
  } catch (error) {
    logger.error('Error fetching operator applications:', error);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

/**
 * GET /api/leads/admin/applications/stats
 * Get operator application statistics (admin only)
 */
router.get('/admin/applications/stats', authenticateAdmin, requireAdmin, async (req, res) => {
  try {
    const stats = await OperatorApplication.getStats();
    const volumeDistribution = await OperatorApplication.getVolumeDistribution();

    res.json({
      success: true,
      stats,
      volumeDistribution
    });
  } catch (error) {
    logger.error('Error fetching operator application stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

/**
 * PUT /api/leads/admin/consumer/:id
 * Update consumer lead status (admin only)
 */
router.put('/admin/consumer/:id', authenticateAdmin, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const lead = await ConsumerLead.update(id, { status, notes });

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    logger.info(`Consumer lead ${id} updated by admin`);

    res.json({
      success: true,
      message: 'Lead updated successfully',
      lead
    });
  } catch (error) {
    logger.error('Error updating consumer lead:', error);
    res.status(500).json({ error: 'Failed to update lead' });
  }
});

/**
 * PUT /api/leads/admin/applications/:id
 * Update operator application status (admin only)
 */
router.put('/admin/applications/:id', authenticateAdmin, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejection_reason, notes } = req.body;

    const application = await OperatorApplication.update(id, {
      status,
      rejection_reason,
      notes
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    logger.info(`Operator application ${id} updated by admin to status: ${status}`);

    res.json({
      success: true,
      message: 'Application updated successfully',
      application
    });
  } catch (error) {
    logger.error('Error updating operator application:', error);
    res.status(500).json({ error: 'Failed to update application' });
  }
});

/**
 * POST /api/leads/admin/applications/:id/approve
 * Approve an operator application (admin only)
 */
router.post('/admin/applications/:id/approve', authenticateAdmin, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const application = await OperatorApplication.approve(id, notes);

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    logger.info(`Operator application ${id} approved by admin`);

    res.json({
      success: true,
      message: 'Application approved successfully',
      application
    });
  } catch (error) {
    logger.error('Error approving operator application:', error);
    res.status(500).json({ error: 'Failed to approve application' });
  }
});

/**
 * POST /api/leads/admin/applications/:id/reject
 * Reject an operator application (admin only)
 */
router.post('/admin/applications/:id/reject', authenticateAdmin, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { rejection_reason, notes } = req.body;

    if (!rejection_reason) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    const application = await OperatorApplication.reject(id, rejection_reason, notes);

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    logger.info(`Operator application ${id} rejected by admin`);

    res.json({
      success: true,
      message: 'Application rejected',
      application
    });
  } catch (error) {
    logger.error('Error rejecting operator application:', error);
    res.status(500).json({ error: 'Failed to reject application' });
  }
});

module.exports = router;
