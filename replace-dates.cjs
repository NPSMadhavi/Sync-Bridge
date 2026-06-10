const fs = require('fs');
const files = [
  'client/src/pages/employees-page.tsx',
  'client/src/components/forms/PayrollConfigForm.tsx',
  'client/src/components/forms/PayrollRecordForm.tsx',
  'client/src/components/forms/ProcessPayrollForm.tsx',
  'client/src/components/modals/AssignAssetModal.tsx',
  'client/src/pages/vendor-orders-page-old.tsx',
  'client/src/pages/vendor-orders-page.tsx',
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');

  // Replace imports
  if (content.includes('import { Input }') && !content.includes('StringDatePicker')) {
    content = content.replace('import { Input } from "@/components/ui/input";', 
      'import { Input } from "@/components/ui/input";\nimport { StringDatePicker } from "@/components/ui/string-date-picker";');
  }

  // Replace employees-page
  if (file.includes('employees-page.tsx')) {
    content = content.replace(/<div className="relative">\s*<Input\s*id="hire_date"[\s\S]*?onChange=\{\(e\) => setFormData\(\{ \.\.\.formData, joinDate: e\.target\.value \}\)\}\s*required\s*\/>\s*<Calendar className="absolute[^"]*" \/>\s*<\/div>/, '<StringDatePicker value={formData.joinDate} onChange={(val) => setFormData({ ...formData, joinDate: val })} />');
    
    content = content.replace(/<div className="relative">\s*<Input\s*id="date_of_birth"[\s\S]*?onChange=\{\(e\) => setFormData\(\{ \.\.\.formData, dateOfBirth: e\.target\.value \}\)\}\s*required\s*\/>\s*<\/div>/, '<StringDatePicker value={formData.dateOfBirth} onChange={(val) => setFormData({ ...formData, dateOfBirth: val })} />');
    
    content = content.replace(/<div className="relative">\s*<Input\s*id="passport_expiry"[\s\S]*?value=\{formData\.passportExpiry \|\| ''\}\s*onChange=\{\(e\) => setFormData\(\{ \.\.\.formData, passportExpiry: e\.target\.value \}\)\}\s*\/>\s*<Calendar className="absolute[^"]*" \/>\s*<\/div>/g, '<StringDatePicker value={formData.passportExpiry || ""} onChange={(val) => setFormData({ ...formData, passportExpiry: val })} />');

    content = content.replace(/<div className="relative">\s*<Input\s*id="visa_expiry"[\s\S]*?value=\{formData\.visaExpiry \|\| ''\}\s*onChange=\{\(e\) => setFormData\(\{ \.\.\.formData, visaExpiry: e\.target\.value \}\)\}\s*\/>\s*<Calendar className="absolute[^"]*" \/>\s*<\/div>/g, '<StringDatePicker value={formData.visaExpiry || ""} onChange={(val) => setFormData({ ...formData, visaExpiry: val })} />');

    content = content.replace(/<div className="relative">\s*<Input\s*id="dependent_passport_expiry"[\s\S]*?value=\{dependentFormData\.passportExpiry\}\s*onChange=\{\(e\) => setDependentFormData\(\{ \.\.\.dependentFormData, passportExpiry: e\.target\.value \}\)\}\s*\/>\s*<Calendar className="absolute[^"]*" \/>\s*<\/div>/g, '<StringDatePicker value={dependentFormData.passportExpiry || ""} onChange={(val) => setDependentFormData({ ...dependentFormData, passportExpiry: val })} />');

    content = content.replace(/<div className="relative">\s*<Input\s*id="dependent_visa_expiry"[\s\S]*?value=\{dependentFormData\.visaExpiry\}\s*onChange=\{\(e\) => setDependentFormData\(\{ \.\.\.dependentFormData, visaExpiry: e\.target\.value \}\)\}\s*\/>\s*<Calendar className="absolute[^"]*" \/>\s*<\/div>/g, '<StringDatePicker value={dependentFormData.visaExpiry || ""} onChange={(val) => setDependentFormData({ ...dependentFormData, visaExpiry: val })} />');

    // Edit modal matches
    content = content.replace(/<Input\s*id="edit_hire_date"[\s\S]*?value=\{formData\.joinDate\}\s*onChange=\{\(e\) => setFormData\(\{ \.\.\.formData, joinDate: e\.target\.value \}\)\}\s*required\s*\/>\s*<Calendar className="absolute[^"]*" \/>/g, '<StringDatePicker value={formData.joinDate} onChange={(val) => setFormData({ ...formData, joinDate: val })} />');

    content = content.replace(/<Input\s*id="edit_date_of_birth"[\s\S]*?value=\{formData\.dateOfBirth\}\s*onChange=\{\(e\) => setFormData\(\{ \.\.\.formData, dateOfBirth: e\.target\.value \}\)\}\s*required\s*\/>/g, '<StringDatePicker value={formData.dateOfBirth} onChange={(val) => setFormData({ ...formData, dateOfBirth: val })} />');
  }

  // Replace PayrollConfigForm
  if (file.includes('PayrollConfigForm.tsx')) {
    content = content.replace(/<Input type="date" \{\.\.\.field\} \/>/g, '<StringDatePicker value={field.value || ""} onChange={field.onChange} />');
  }

  // Replace PayrollRecordForm
  if (file.includes('PayrollRecordForm.tsx')) {
    content = content.replace(/<Input type="date" \{\.\.\.field\} \/>/g, '<StringDatePicker value={field.value || ""} onChange={field.onChange} />');
  }

  // Replace ProcessPayrollForm
  if (file.includes('ProcessPayrollForm.tsx')) {
    content = content.replace(/<Input type="date" \{\.\.\.field\} \/>/g, '<StringDatePicker value={field.value || ""} onChange={field.onChange} />');
  }

  // Replace AssignAssetModal
  if (file.includes('AssignAssetModal.tsx')) {
    content = content.replace(/<Input type="date" \{\.\.\.field\} \/>/g, '<StringDatePicker value={field.value || ""} onChange={field.onChange} />');
  }

  // Replace vendor-orders-page
  if (file.includes('vendor-orders-page')) {
    content = content.replace(/<Input type="date" \{\.\.\.field\} \/>/g, '<StringDatePicker value={field.value || ""} onChange={field.onChange} />');
  }

  fs.writeFileSync(file, content);
}
