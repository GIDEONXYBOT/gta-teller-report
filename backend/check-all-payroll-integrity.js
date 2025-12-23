import mongoose from 'mongoose';
import Payroll from './models/Payroll.js';
import User from './models/User.js';
import TellerReport from './models/TellerReport.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkAllUsersPayrollIntegrity() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get all users who have payrolls
    const allPayrolls = await Payroll.find()
      .populate('user', 'username name role')
      .sort({ createdAt: 1 })
      .lean();

    // Group by user
    const byUser = new Map();
    allPayrolls.forEach(p => {
      if (!p.user || !p.user._id) return;
      const userId = p.user._id.toString();
      if (!byUser.has(userId)) {
        byUser.set(userId, {
          user: p.user,
          payrolls: []
        });
      }
      byUser.get(userId).payrolls.push(p);
    });

    console.log(`👥 Total users with payrolls: ${byUser.size}\n`);

    const issues = [];

    // Check each user
    for (const [userId, data] of byUser) {
      const userName = data.user.name || data.user.username;
      const payrolls = data.payrolls;

      // Get all teller reports for this user
      const reports = await TellerReport.find({ user: userId })
        .sort({ createdAt: 1 })
        .lean();

      // Group payrolls by date
      const payrollsByDate = new Map();
      payrolls.forEach(p => {
        const date = new Date(p.createdAt || p.date);
        const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        if (!payrollsByDate.has(dateKey)) {
          payrollsByDate.set(dateKey, []);
        }
        payrollsByDate.get(dateKey).push(p);
      });

      // Group reports by date
      const reportsByDate = new Map();
      reports.forEach(r => {
        const date = new Date(r.createdAt);
        const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        if (!reportsByDate.has(dateKey)) {
          reportsByDate.set(dateKey, []);
        }
        reportsByDate.get(dateKey).push(r);
      });

      // Check for issues
      const userIssues = [];

      // Check for payrolls without matching reports (for tellers/supervisors)
      if (data.user.role !== 'admin' && data.user.role !== 'super_admin') {
        for (const [dateKey, datePayrolls] of payrollsByDate) {
          const dateReports = reportsByDate.get(dateKey) || [];
          
          datePayrolls.forEach(p => {
            // Check if payroll has over/short amounts but no matching report
            if ((p.over > 0 || p.short > 0) && dateReports.length === 0) {
              userIssues.push({
                type: 'orphaned_payroll',
                date: dateKey,
                payrollId: p._id,
                over: p.over,
                short: p.short,
                total: p.totalSalary,
                message: `Payroll with over/short but no teller report`
              });
            }

            // Check for mismatched amounts
            if (dateReports.length > 0) {
              const report = dateReports[0];
              if (p.over !== (report.over || 0) || p.short !== (report.short || 0)) {
                userIssues.push({
                  type: 'mismatch',
                  date: dateKey,
                  payrollId: p._id,
                  payrollOver: p.over,
                  payrollShort: p.short,
                  reportOver: report.over || 0,
                  reportShort: report.short || 0,
                  message: `Payroll amounts don't match report`
                });
              }
            }
          });
        }
      }

      if (userIssues.length > 0) {
        issues.push({
          userId,
          userName,
          role: data.user.role,
          issues: userIssues
        });
      }
    }

    if (issues.length === 0) {
      console.log('✅ All payrolls are consistent with teller reports!');
      console.log('   No orphaned payrolls or mismatches found.');
    } else {
      console.log(`⚠️  Found issues for ${issues.length} users:\n`);
      
      issues.forEach(userIssue => {
        console.log(`👤 ${userIssue.userName} (${userIssue.role})`);
        console.log(`   Issues: ${userIssue.issues.length}\n`);
        
        userIssue.issues.forEach((issue, i) => {
          console.log(`   ${i + 1}. ${issue.type.toUpperCase()} - ${issue.date}`);
          console.log(`      ${issue.message}`);
          console.log(`      Payroll ID: ${issue.payrollId}`);
          
          if (issue.type === 'orphaned_payroll') {
            console.log(`      Over: ₱${issue.over}, Short: ₱${issue.short}, Total: ₱${issue.total}`);
            console.log(`      ⚠️  Should be DELETED or corrected`);
          } else if (issue.type === 'mismatch') {
            console.log(`      Payroll: Over ₱${issue.payrollOver}, Short ₱${issue.payrollShort}`);
            console.log(`      Report:  Over ₱${issue.reportOver}, Short ₱${issue.reportShort}`);
          }
          console.log('');
        });
      });

      // Summary
      const totalOrphaned = issues.reduce((sum, u) => sum + u.issues.filter(i => i.type === 'orphaned_payroll').length, 0);
      const totalMismatches = issues.reduce((sum, u) => sum + u.issues.filter(i => i.type === 'mismatch').length, 0);
      
      console.log(`\n📊 Summary:`);
      console.log(`   Orphaned payrolls: ${totalOrphaned}`);
      console.log(`   Mismatched amounts: ${totalMismatches}`);
      console.log(`   Total issues: ${totalOrphaned + totalMismatches}`);
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

checkAllUsersPayrollIntegrity();
