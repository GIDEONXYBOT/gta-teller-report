#!/usr/bin/env node

/**
 * Financial Summary Report - Test Script
 * 
 * This script tests the /api/admin/financial-summary/:date endpoint
 * 
 * Usage:
 *   node test-financial-summary.js [options]
 * 
 * Options:
 *   --token    Your JWT auth token (required)
 *   --date     Date to query (YYYY-MM-DD format, defaults to today)
 *   --url      API base URL (defaults to http://localhost:5000)
 * 
 * Example:
 *   node test-financial-summary.js --token "your_jwt_token" --date "2025-01-15"
 */

import axios from 'axios';

const getArgs = () => {
  const args = process.argv.slice(2);
  const result = {};
  
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].substring(2);
      result[key] = args[i + 1];
      i++;
    }
  }
  
  return result;
};

const formatMoney = (num) => {
  return `₱${num?.toLocaleString('en-PH', { minimumFractionDigits: 2 }) || '0.00'}`;
};

const main = async () => {
  const args = getArgs();
  const token = args.token;
  const date = args.date || new Date().toISOString().split('T')[0];
  const baseUrl = args.url || 'http://localhost:5000';
  
  if (!token) {
    console.error('❌ Error: --token is required');
    console.log('\nUsage: node test-financial-summary.js --token "your_token" --date "2025-01-15"');
    process.exit(1);
  }
  
  console.log('📊 Financial Summary Report - Test');
  console.log('═'.repeat(50));
  console.log(`Date: ${date}`);
  console.log(`API URL: ${baseUrl}`);
  console.log('═'.repeat(50));
  console.log('');
  
  try {
    console.log(`🔄 Fetching financial summary for ${date}...`);
    
    const response = await axios.get(
      `${baseUrl}/api/admin/financial-summary/${date}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );
    
    const data = response.data;
    
    console.log('✅ Request successful!\n');
    
    // Cash Position
    console.log('💰 CASH POSITION');
    console.log('─'.repeat(50));
    console.log(`  Revolving Money:    ${formatMoney(data.cashPosition?.revolvingMoney)}`);
    console.log(`  System Balance:     ${formatMoney(data.cashPosition?.systemBalance)}`);
    console.log(`  Cash on Hand:       ${formatMoney(data.cashPosition?.cashOnHand)}`);
    console.log(`  Difference:         ${formatMoney(data.cashPosition?.difference)}`);
    console.log('');
    
    // Salary & Over
    console.log('💵 SALARY & OVER');
    console.log('─'.repeat(50));
    console.log(`  Total Salary:       ${formatMoney(data.salary?.totalSalary)}`);
    console.log(`  Total Over:         ${formatMoney(data.salary?.totalOver)}`);
    console.log(`  OP Commission:      ${formatMoney(data.salary?.opCommission)}`);
    console.log(`  Admin Expense:      ${formatMoney(data.salary?.adminExpense)}`);
    console.log(`  Admin Draw:         ${formatMoney(data.salary?.adminDraw)}`);
    console.log('');
    
    // Expenses by Role
    if (data.expenseByRole && Object.keys(data.expenseByRole).length > 0) {
      console.log('👥 EXPENSES BY ROLE');
      console.log('─'.repeat(50));
      
      Object.entries(data.expenseByRole).forEach(([role, roleData]) => {
        if (roleData.totalSalary > 0 || roleData.count > 0) {
          console.log(`  ${role.toUpperCase()}`);
          console.log(`    Count: ${roleData.count}`);
          console.log(`    Total Salary: ${formatMoney(roleData.totalSalary)}`);
          console.log(`    Total Over: ${formatMoney(roleData.totalOver)}`);
        }
      });
      console.log('');
    }
    
    // Cashflow Expenses
    if (data.expenses && Object.values(data.expenses).some(v => v > 0)) {
      console.log('💸 CASHFLOW EXPENSES');
      console.log('─'.repeat(50));
      Object.entries(data.expenses).forEach(([category, amount]) => {
        if (amount > 0) {
          console.log(`  ${category.charAt(0).toUpperCase() + category.slice(1)}: ${formatMoney(amount)}`);
        }
      });
      console.log('');
    }
    
    // Totals
    console.log('📊 SUMMARY TOTALS');
    console.log('═'.repeat(50));
    console.log(`  Total Payroll Expense:  ${formatMoney(data.totals?.totalPayrollExpense)}`);
    console.log(`  Total Cash Expense:     ${formatMoney(data.totals?.totalCashExpense)}`);
    console.log(`  GRAND TOTAL:            ${formatMoney(data.totals?.grandTotal)}`);
    console.log('═'.repeat(50));
    
    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error fetching financial summary:');
    
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Message: ${error.response.data?.message || 'Unknown error'}`);
      
      if (error.response.status === 403) {
        console.error('\nℹ️  This user is not a SuperAdmin.');
        console.error('Make sure the authenticated user has:');
        console.error('  - role: "admin"');
        console.error('  - isSuperAdmin: true');
      }
    } else if (error.request) {
      console.error('No response from server');
      console.error(`Check if server is running at: ${baseUrl}`);
    } else {
      console.error(error.message);
    }
    
    process.exit(1);
  }
};

main();
