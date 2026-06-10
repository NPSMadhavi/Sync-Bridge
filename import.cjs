const fs = require('fs');
const files = [
  'client/src/components/forms/PayrollConfigForm.tsx',
  'client/src/components/forms/PayrollRecordForm.tsx',
  'client/src/components/forms/ProcessPayrollForm.tsx',
  'client/src/pages/vendor-orders-page-old.tsx',
  'client/src/pages/vendor-orders-page.tsx',
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes('import { StringDatePicker }')) {
    content = content.replace('import { Input } from "@/components/ui/input";', 
      'import { Input } from "@/components/ui/input";\nimport { StringDatePicker } from "@/components/ui/string-date-picker";');
    fs.writeFileSync(file, content);
  }
}
