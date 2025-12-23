import nodemailer from 'nodemailer';

/**
 * Email service for sending notifications
 */

let transporter;

// Initialize transporter
export const initializeEmailService = async (config = {}) => {
  try {
    // Use environment variables or provided config
    const emailConfig = {
      host: config.host || process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: config.port || process.env.EMAIL_PORT || 587,
      secure: config.secure || process.env.EMAIL_SECURE === 'true' || false,
      auth: {
        user: config.user || process.env.EMAIL_USER,
        pass: config.pass || process.env.EMAIL_PASS
      }
    };

    // Only initialize if we have credentials
    if (emailConfig.auth.user && emailConfig.auth.pass) {
      transporter = nodemailer.createTransport(emailConfig);
      console.log('✅ Email service initialized');
      return true;
    } else {
      console.log('⚠️  Email service not configured (missing credentials)');
      return false;
    }
  } catch (err) {
    console.error('❌ Email service initialization error:', err.message);
    return false;
  }
};

/**
 * Send payroll update notification email
 */
export const sendPayrollUpdateNotification = async (options) => {
  try {
    if (!transporter) {
      console.log('⚠️  Email service not initialized');
      return false;
    }

    const {
      recipients = [],
      employeeUpdates = [],
      totalRecords = 0,
      performedBy = 'Unknown',
      reason = ''
    } = options;

    if (recipients.length === 0) {
      console.log('⚠️  No email recipients provided');
      return false;
    }

    // Build email content
    const updateDetails = employeeUpdates
      .map(
        emp =>
          `<tr>
            <td style="padding: 10px; border-bottom: 1px solid #ddd;">${emp.employeeName}</td>
            <td style="padding: 10px; border-bottom: 1px solid #ddd;">₱${emp.baseSalaryBefore} → ₱${emp.baseSalaryAfter}</td>
            <td style="padding: 10px; border-bottom: 1px solid #ddd;">${emp.affectedRecords}</td>
          </tr>`
      )
      .join('');

    const htmlContent = `
      <h2>📊 Payroll Base Salary Update Notification</h2>
      <p>A payroll base salary update has been processed.</p>
      
      <h3>Update Summary:</h3>
      <ul>
        <li><strong>Performed By:</strong> ${performedBy}</li>
        <li><strong>Date:</strong> ${new Date().toLocaleString()}</li>
        <li><strong>Total Records Updated:</strong> ${totalRecords}</li>
        <li><strong>Reason:</strong> ${reason || 'N/A'}</li>
      </ul>
      
      <h3>Employee Updates:</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background-color: #f5f5f5;">
            <th style="padding: 10px; border-bottom: 2px solid #ddd;">Employee Name</th>
            <th style="padding: 10px; border-bottom: 2px solid #ddd;">Base Salary Change</th>
            <th style="padding: 10px; border-bottom: 2px solid #ddd;">Records Affected</th>
          </tr>
        </thead>
        <tbody>
          ${updateDetails}
        </tbody>
      </table>
      
      <p style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd;">
        <small>This is an automated notification. If you have questions, please contact your administrator.</small>
      </p>
    `;

    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: recipients.join(', '),
      subject: `[RMI] Payroll Base Salary Update - ${new Date().toLocaleDateString()}`,
      html: htmlContent
    };

    const result = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${recipients.length} recipient(s)`);
    return true;
  } catch (err) {
    console.error('❌ Email sending error:', err.message);
    return false;
  }
};

/**
 * Send admin notification about failed updates
 */
export const sendErrorNotification = async (adminEmail, error, context = {}) => {
  try {
    if (!transporter) {
      console.log('⚠️  Email service not initialized');
      return false;
    }

    const htmlContent = `
      <h2>⚠️ Payroll Update Error Notification</h2>
      <p>An error occurred during payroll processing.</p>
      
      <h3>Error Details:</h3>
      <pre style="background-color: #f5f5f5; padding: 10px; border-radius: 5px;">
${error.message}
      </pre>
      
      <h3>Context:</h3>
      <ul>
        <li><strong>Time:</strong> ${new Date().toLocaleString()}</li>
        <li><strong>Employees:</strong> ${context.employees?.join(', ') || 'N/A'}</li>
        <li><strong>Stack:</strong> ${error.stack?.substring(0, 500) || 'N/A'}</li>
      </ul>
      
      <p>Please investigate and take appropriate action.</p>
    `;

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: adminEmail,
      subject: '[RMI] ⚠️ Payroll Update Error',
      html: htmlContent
    });

    console.log(`✅ Error notification sent to ${adminEmail}`);
    return true;
  } catch (err) {
    console.error('❌ Error notification sending failed:', err.message);
    return false;
  }
};

export default {
  initializeEmailService,
  sendPayrollUpdateNotification,
  sendErrorNotification
};
