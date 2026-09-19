import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from '../server/db';
import { employees, employeePayroll, companies } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { 
  buildPayslipDataListForMonth,
  generatePayslipFilesForMonths
} from '../server/payroll';
import { 
  generatePayslipPdf, 
  generateCombinedPayslipPdf, 
  buildPayslipHtml, 
  isPdfBuffer,
  PayslipData
} from '../server/payslip-generator';
import { createPayslipZipArchive } from '../server/payslip-zip';
import { generateInvoicePDF } from '../server/routes/invoices';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runVerification() {
  console.log('====================================================');
  console.log('STARTING SYNCBRIDGE PDF & DATA VERIFICATION TEST');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, message: string) {
    totalTests++;
    if (condition) {
      console.log(`[PASS] ${message}`);
      passedTests++;
    } else {
      console.error(`[FAIL] ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // --- FETCH EMPLOYEE 928 & CONTEXT ---
  console.log('--- Fetching Employee 928 and Payroll Config ---');
  const [employee] = await db
    .select({
      id: employees.id,
      employeeId: employees.employeeId,
      name: employees.name,
      department: employees.department,
      designation: employees.designation,
      nricNumber: employees.nricNumber,
      finNumber: employees.finNumber,
      companyId: employees.companyId,
      tenantId: employees.tenantId,
      dateOfBirth: employees.dateOfBirth,
      nationality: employees.nationality,
      prStatus: employees.prStatus,
      joinDate: employees.joinDate,
    })
    .from(employees)
    .where(eq(employees.id, 928));

  assert(Boolean(employee), 'Found employee 928 in database');
  console.log('Employee:', { id: employee.id, name: employee.name, code: employee.employeeId, companyId: employee.companyId });

  const [config] = await db
    .select()
    .from(employeePayroll)
    .where(eq(employeePayroll.employeeId, 928));
  assert(Boolean(config), 'Found payroll config for employee 928');

  let company: { companyName: string | null; address: string | null } | null = null;
  if (employee.companyId) {
    [company] = await db
      .select({
        companyName: companies.companyName,
        address: companies.address,
      })
      .from(companies)
      .where(eq(companies.id, employee.companyId));
  }
  assert(Boolean(company), `Found company for employee 928 (company: ${company?.companyName})`);

  // --- TEST 1: Retrieve and verify PayslipData for Employee 928 (M MALLIGA) - July 2026 ---
  console.log('\n--- TEST 1: Retrieve PayslipData for Employee 928 (July 2026) ---');
  const payslipList = await buildPayslipDataListForMonth(
    config,
    employee,
    company,
    2026,
    7,
    0,
    { storedOnly: true }
  );

  assert(payslipList.length > 0, `Found ${payslipList.length} payslip(s) for employee 928 in July 2026`);

  const payslip = payslipList[0];
  console.log('Loaded Payslip Data:');
  console.log({
    employeeName: payslip.employeeName,
    employeeCode: payslip.employeeCode,
    icNo: payslip.icNo,
    department: payslip.department,
    jobTitle: payslip.jobTitle,
    companyName: payslip.companyName,
    companyAddress: payslip.companyAddress,
    payPeriodStart: payslip.payPeriodStart,
    payPeriodEnd: payslip.payPeriodEnd,
    basicRate: payslip.basicRate,
    basicPay: payslip.basicPay,
    grossPay: payslip.grossPay,
    employeeCpf: payslip.employeeCpf,
    employerCpf: payslip.employerCpf,
    netPay: payslip.netPay
  });

  assert(payslip.employeeName === 'M MALLIGA', `Employee name matches 'M MALLIGA' (got '${payslip.employeeName}')`);
  assert(Boolean(payslip.employeeCode && payslip.employeeCode.trim().length > 0), `Employee code is non-empty (got '${payslip.employeeCode}')`);
  assert(payslip.employeeCode === 'E0460', `Employee code matches 'E0460' (got '${payslip.employeeCode}')`);
  assert(Boolean(payslip.icNo && payslip.icNo.trim().length > 0), `IC / NRIC is non-empty (got '${payslip.icNo}')`);
  assert(payslip.icNo === 'S1755957E', `IC matches decrypted 'S1755957E' (got '${payslip.icNo}')`);
  assert(Boolean(payslip.department && payslip.department.trim().length > 0), `Department is non-empty (got '${payslip.department}')`);
  assert(payslip.department === 'OPERATIONS', `Department matches 'OPERATIONS' (got '${payslip.department}')`);
  assert(Boolean(payslip.jobTitle && payslip.jobTitle.trim().length > 0), `Job title is non-empty (got '${payslip.jobTitle}')`);
  assert(payslip.jobTitle === 'SERVICE STAFF', `Job title matches 'SERVICE STAFF' (got '${payslip.jobTitle}')`);
  assert(Boolean(payslip.companyName && payslip.companyName.trim().length > 0), `Company name is non-empty (got '${payslip.companyName}')`);
  assert(payslip.companyName === 'NEWTREEE TRADING PTE. LTD.', `Company name matches 'NEWTREEE TRADING PTE. LTD.' (got '${payslip.companyName}')`);
  assert(Boolean(payslip.companyAddress && payslip.companyAddress.trim().length > 0), `Company address is non-empty (got '${payslip.companyAddress}')`);
  assert(Boolean(payslip.payPeriodStart && payslip.payPeriodEnd), `Pay period is populated (${payslip.payPeriodStart} to ${payslip.payPeriodEnd})`);
  assert(payslip.basicPay > 0, `Basic pay is greater than 0 (got ${payslip.basicPay})`);
  assert(payslip.grossPay > 0, `Gross pay is greater than 0 (got ${payslip.grossPay})`);
  assert(payslip.netPay > 0, `Net pay is greater than 0 (got ${payslip.netPay})`);

  // --- TEST 2: HTML Payslip Preview ---
  console.log('\n--- TEST 2: HTML Payslip Preview Generation ---');
  const html = buildPayslipHtml(payslip);
  assert(typeof html === 'string' && html.length > 100, 'HTML generated and has content');
  assert(html.includes('M MALLIGA'), 'HTML contains employee name M MALLIGA');
  assert(html.includes(payslip.employeeCode), `HTML contains employee code ${payslip.employeeCode}`);
  assert(html.includes(payslip.companyName), `HTML contains company name ${payslip.companyName}`);
  assert(html.includes(payslip.jobTitle), `HTML contains job title ${payslip.jobTitle}`);

  // --- TEST 3: Pure Node PDF Generation (Single Payslip) ---
  console.log('\n--- TEST 3: Generate Single Payslip PDF with pdfmake ---');
  const pdfBuffer = await generatePayslipPdf(payslip);
  assert(Buffer.isBuffer(pdfBuffer), 'Result is a Node.js Buffer');
  assert(isPdfBuffer(pdfBuffer), 'Buffer passes isPdfBuffer check');
  assert(pdfBuffer.subarray(0, 5).toString('ascii') === '%PDF-', 'PDF starts with %PDF- magic bytes');
  assert(pdfBuffer.length > 3000, `PDF buffer has reasonable size (${pdfBuffer.length} bytes)`);

  const outPdfPath = path.join(__dirname, 'test-payslip-malliga.pdf');
  fs.writeFileSync(outPdfPath, pdfBuffer);
  console.log(`Saved sample payslip PDF to ${outPdfPath}`);

  // --- TEST 4: Pure Node Combined Multi-Payslip PDF Generation ---
  console.log('\n--- TEST 4: Generate Combined Multi-Payslip PDF ---');
  const combinedBuffer = await generateCombinedPayslipPdf([payslip, payslip]);
  assert(Buffer.isBuffer(combinedBuffer), 'Combined result is a Node.js Buffer');
  assert(isPdfBuffer(combinedBuffer), 'Combined buffer passes isPdfBuffer check');
  assert(combinedBuffer.subarray(0, 5).toString('ascii') === '%PDF-', 'Combined PDF starts with %PDF- header');
  assert(combinedBuffer.length > pdfBuffer.length, `Combined PDF size (${combinedBuffer.length} bytes) is larger than single (${pdfBuffer.length} bytes)`);

  const outCombinedPath = path.join(__dirname, 'test-combined-payslip.pdf');
  fs.writeFileSync(outCombinedPath, combinedBuffer);
  console.log(`Saved sample combined PDF to ${outCombinedPath}`);

  // --- TEST 5: Payslip ZIP Archive Creation ---
  console.log('\n--- TEST 5: Create Payslip ZIP Archive ---');
  const zipPath = await createPayslipZipArchive([
    { filename: 'Payslip_M_MALLIGA_July_2026.pdf', buffer: pdfBuffer }
  ]);
  assert(fs.existsSync(zipPath), `ZIP file was created at ${zipPath}`);
  const zipStats = fs.statSync(zipPath);
  assert(zipStats.size > 0, `ZIP file size is greater than 0 (${zipStats.size} bytes)`);
  const zipHeader = Buffer.alloc(4);
  const fd = fs.openSync(zipPath, 'r');
  fs.readSync(fd, zipHeader, 0, 4, 0);
  fs.closeSync(fd);
  assert(zipHeader.toString('hex') === '504b0304', 'ZIP file has valid PK header');
  // Clean up
  fs.unlinkSync(zipPath);

  // --- TEST 6: Invoice PDF Generation ---
  console.log('\n--- TEST 6: Generate Invoice PDF with pdfmake ---');
  const sampleInvoice = {
    invoiceNumber: 'INV-2026-001',
    issueDate: new Date('2026-07-15'),
    dueDate: new Date('2026-08-15'),
    status: 'paid',
    currency: 'SGD',
    subtotal: 100000,
    discountAmount: 5000,
    taxAmount: 8550,
    totalAmount: 103550,
    paidAmount: 103550,
    balanceAmount: 0,
    notes: 'Thank you for your business.',
    paymentTerms: 'Payment received in full.'
  };
  const sampleCustomer = {
    name: 'Acme Corporation',
    company: 'Acme Global Pte Ltd',
    email: 'billing@acme.example.com',
    phone: '+65 6123 4567',
    address: '10 Collyer Quay, Singapore'
  };
  const sampleItems = [
    { description: 'Consulting Services - July 2026', quantity: 40, unitPrice: 2000, totalPrice: 80000 },
    { description: 'Cloud Infrastructure Setup', quantity: 1, unitPrice: 20000, totalPrice: 20000 }
  ];
  const sampleDesign = {
    primaryColor: '#0891b2',
    headerNote: 'Enterprise Software & Solutions',
    footerNote: 'Terms & Conditions apply'
  };

  const invoiceBuffer = await generateInvoicePDF(sampleInvoice, sampleItems, sampleCustomer, sampleDesign);
  assert(Buffer.isBuffer(invoiceBuffer), 'Invoice PDF result is a Node.js Buffer');
  assert(isPdfBuffer(invoiceBuffer), 'Invoice PDF passes isPdfBuffer check');
  assert(invoiceBuffer.subarray(0, 5).toString('ascii') === '%PDF-', 'Invoice PDF starts with %PDF- header');
  assert(invoiceBuffer.length > 2000, `Invoice PDF size is valid (${invoiceBuffer.length} bytes)`);

  const outInvoicePath = path.join(__dirname, 'test-invoice.pdf');
  fs.writeFileSync(outInvoicePath, invoiceBuffer);
  console.log(`Saved sample invoice PDF to ${outInvoicePath}`);

  console.log('\n====================================================');
  console.log(`ALL VERIFICATION TESTS PASSED: ${passedTests}/${totalTests}`);
  console.log('====================================================\n');
}

runVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('VERIFICATION ERROR:', err);
    process.exit(1);
  });
