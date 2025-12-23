import express from 'express';
import TellerReport from '../models/TellerReport.js';

const router = express.Router();

// Route to check Apple's reports
router.get('/apple-check', async (req, res) => {
  try {
    console.log('🔍 Checking Apple supervisor reports...');
    
    const appleReports = await TellerReport.find({
      supervisorName: 'Apple'
    }).sort({ date: 1 });
    
    console.log('\n=== APPLE SUPERVISOR REPORTS ===');
    const reportSummary = appleReports.map(report => ({
      id: report._id,
      date: report.date.toISOString().split('T')[0],
      tellers: report.tellerDetails ? report.tellerDetails.map(t => t.tellerName) : []
    }));
    
    // Check for duplicates on November 11 and 12
    const nov11Reports = await TellerReport.find({
      supervisorName: 'Apple',
      date: { 
        $gte: new Date('2024-11-11T00:00:00.000Z'),
        $lt: new Date('2024-11-12T00:00:00.000Z')
      }
    });
    
    const nov12Reports = await TellerReport.find({
      supervisorName: 'Apple',
      date: { 
        $gte: new Date('2024-11-12T00:00:00.000Z'),
        $lt: new Date('2024-11-13T00:00:00.000Z')
      }
    });
    
    const result = {
      totalReports: appleReports.length,
      reports: reportSummary,
      nov11Count: nov11Reports.length,
      nov12Count: nov12Reports.length,
      hasIssue: nov12Reports.length > 0,
      message: nov12Reports.length > 0 
        ? 'Issue detected: Apple still has November 12 reports' 
        : 'Apple reports look correct'
    };
    
    console.log(`📊 Total Apple reports: ${result.totalReports}`);
    console.log(`📅 Nov 11 reports: ${result.nov11Count}`);
    console.log(`📅 Nov 12 reports: ${result.nov12Count}`);
    console.log(`${result.hasIssue ? '⚠️' : '✅'} ${result.message}`);
    
    res.json(result);
  } catch (error) {
    console.error('❌ Error checking Apple reports:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;