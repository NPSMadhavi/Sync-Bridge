import React, { useState, useRef } from 'react';
import Dashboard from "@/components/layout/Dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StringDatePicker } from "@/components/ui/string-date-picker";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Users, Loader2, Eye, EyeOff, Upload, Download, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-config";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { exportEmployeesToExcel, parseEmployeeImportFile, type EmployeeImportRow } from "@/lib/excel-utils";
import { insertEmployeeSchema } from "@shared/schema";
import { ZodError } from "zod";
import { TableRowActions } from "@/components/ui/table-row-actions";
import { CompanySearchSelect } from "@/components/ui/company-search-select";
import { EntityViewSheet } from "@/components/ui/entity-view-sheet";
import {
  EmployeeViewContent,
  getPrStatusLabel,
  getVisaTypeLabel,
} from "@/components/views/employee-view-content";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Employee {
  id: number;
  tenantId: number;
  employeeId: string;
  userId?: number;
  name: string;
  department: string;
  designation: string;
  joinDate: string;
  dateOfBirth?: string;
  salary?: string | number;
  status: 'active' | 'resigned' | 'on_hold' | 'terminated';
  nationality: 'citizen' | 'pr' | 'foreigner' | 'singaporean_pr';
  prStatus?: 'year_1' | 'year_2' | 'year_3_plus' | null;
  nricNumber?: string;
  finNumber?: string;
  passportNumber?: string;
  passportExpiry?: string;
  visaNumber?: string;
  visaExpiry?: string;
  visaType?: 's_pass' | 'work_permit' | 'employment_pass' | 'pr' | 'dependent_pass' | 'ltvp' | 'student_pass' | 'other';
  visaRemarks?: string;
  passportScan?: string;
  visaScan?: string;
  nricScan?: string;
  companyId?: number | null;
  companyName?: string | null;
  createdAt: string;
}

interface EmployeeCompanyHistoryRecord {
  id: number;
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  companyId?: number | null;
  companyName: string;
  dateChanged: string;
}

interface EmployeeFormData {
  employeeId: string;
  name: string;
  department: string;
  designation: string;
  joinDate: string;
  dateOfBirth: string;
  salary: string;
  status: 'active' | 'resigned' | 'on_hold' | 'terminated';
  nationality: 'citizen' | 'pr' | 'foreigner';
  prStatus: '' | 'year_1' | 'year_2' | 'year_3_plus';
  nricNumber: string;
  finNumber: string;
  passportNumber: string;
  passportExpiry: string;
  visaNumber: string;
  visaExpiry: string;
  visaType: 's_pass' | 'work_permit' | 'employment_pass' | 'pr' | 'dependent_pass' | 'ltvp' | 'student_pass' | 'other';
  visaRemarks: string;
  companyId: string;
  passportScan?: string;
  nricScan?: string;
  visaScan?: string;
}

interface Dependent {
  id?: number;
  employeeId?: number;
  name: string;
  relationship: 'spouse' | 'child' | 'parent' | 'sibling' | 'other';
  passportNumber: string;
  passportExpiry: string;
  visaNumber: string;
  visaExpiry: string;
  visaType?: 's_pass' | 'work_permit' | 'employment_pass' | 'pr' | 'dependent_pass' | 'ltvp' | 'student_pass' | 'other';
  passportScan?: string;
  visaScan?: string;
}

function normalizeNationality(n?: string | null): 'citizen' | 'pr' | 'foreigner' {
  if (n === 'foreigner') return 'foreigner';
  if (n === 'pr') return 'pr';
  if (n === 'singaporean_pr') return 'citizen';
  return 'citizen';
}

function buildEmployeePayload(
  data: EmployeeFormData,
  tenantId?: number | null
) {
  const joinDateRaw = data.joinDate?.trim();
  const joinDate = joinDateRaw
    ? /^\d{4}-\d{2}-\d{2}$/.test(joinDateRaw)
      ? new Date(`${joinDateRaw}T12:00:00`).toISOString()
      : new Date(joinDateRaw).toISOString()
    : new Date().toISOString();

  return {
    employeeId: data.employeeId?.trim() || '',
    name: data.name?.trim() || '',
    department: data.department?.trim() || '',
    designation: data.designation?.trim() || '',
    joinDate,
    dateOfBirth: data.dateOfBirth?.trim()
      ? data.dateOfBirth.includes('T')
        ? data.dateOfBirth.split('T')[0]
        : data.dateOfBirth
      : null,
    salary: data.salary === '' || data.salary == null ? null : String(data.salary),
    status: data.status || 'active',
    nationality: data.nationality || 'citizen',
    prStatus:
      data.nationality === 'pr'
        ? data.prStatus || 'year_3_plus'
        : null,
    nricNumber: data.nricNumber?.trim() || null,
    finNumber: data.finNumber?.trim() || null,
    passportNumber: data.passportNumber?.trim() || null,
    passportExpiry: data.passportExpiry?.trim()
      ? new Date(data.passportExpiry).toISOString()
      : null,
    visaNumber: data.visaNumber?.trim() || null,
    visaExpiry: data.visaExpiry?.trim()
      ? new Date(data.visaExpiry).toISOString()
      : null,
    visaType: data.visaType || null,
    visaRemarks: data.visaRemarks?.trim() || null,
    companyId: data.companyId ? Number(data.companyId) : null,
    passportScan: data.passportScan || null,
    nricScan: data.nricScan || null,
    visaScan: data.visaScan || null,
    ...(tenantId != null ? { tenantId } : {}),
  };
}

function residencyLabel(n?: string | null, prStatus?: string | null) {
  const r = normalizeNationality(n);
  if (r === 'foreigner') return 'Foreigner';
  if (r === 'pr') {
    const prMap: Record<string, string> = {
      year_1: 'PR (1 Year)',
      year_2: 'PR (2 Year)',
      year_3_plus: 'PR (3 Year+)',
    };
    return prMap[prStatus || ''] || 'Permanent Resident';
  }
  return 'Singapore Citizen';
}

export default function EmployeesPage() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isViewDetailsModalOpen, setIsViewDetailsModalOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [historyEmployee, setHistoryEmployee] = useState<Employee | null>(null);
  const [dependents, setDependents] = useState<Dependent[]>([]);
  const [dependentFormData, setDependentFormData] = useState<Dependent>({
    name: '',
    relationship: 'spouse',
    passportNumber: '',
    passportExpiry: '',
    visaNumber: '',
    visaExpiry: '',
    visaType: 'other'
  });
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleNumbers, setVisibleNumbers] = useState<{
    [key: string]: { visible: boolean; timeout?: NodeJS.Timeout };
  }>({});
  const [formData, setFormData] = useState<EmployeeFormData>({
    employeeId: '',
    name: 'John',
    department: '',
    designation: '',
    joinDate: new Date().toISOString().split('T')[0],
    dateOfBirth: '',
    salary: '',
    status: 'active',
    nationality: 'citizen',
    prStatus: '',
    nricNumber: '',
    finNumber: '',
    passportNumber: '',
    passportExpiry: '',
    visaNumber: '',
    visaExpiry: '',
    visaType: 'other',
    visaRemarks: '',
    companyId: '',
    passportScan: '',
    nricScan: '',
    visaScan: '',
  });
  const [showDependentForm, setShowDependentForm] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importRows, setImportRows] = useState<EmployeeImportRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, isLoading: userLoading } = useAuth();

  // Function to toggle number visibility
  const toggleNumberVisibility = (key: string, number: string) => {
    if (!number) return;
    
    // Clear existing timeout if any
    if (visibleNumbers[key]?.timeout) {
      clearTimeout(visibleNumbers[key].timeout);
    }
    
    const isVisible = visibleNumbers[key]?.visible || false;
    
    if (!isVisible) {
      // Show the number and set timeout to hide after 30 seconds
      const timeout = setTimeout(() => {
        setVisibleNumbers(prev => ({
          ...prev,
          [key]: { visible: false }
        }));
      }, 30000);
      
      setVisibleNumbers(prev => ({
        ...prev,
        [key]: { visible: true, timeout }
      }));
    } else {
      // Hide the number immediately
      setVisibleNumbers(prev => ({
        ...prev,
        [key]: { visible: false }
      }));
    }
  };

  // Function to mask a number (show only last 4 digits)
  const maskNumber = (number: string) => {
    if (!number) return '';
    if (number.length <= 4) return number;
    return '*'.repeat(number.length - 4) + number.slice(-4);
  };

  // Function to get display value for a number
  const getDisplayValue = (key: string, number: string) => {
    if (!number) return '';
    
    // Check if user has permission to view unmasked data by default
    const canViewUnmasked = user?.isSuperAdmin || ['super_admin', 'admin', 'hr_manager'].includes(user?.role || '');
    
    // If user has permission, show full number by default, otherwise show masked
    const shouldShowMasked = !canViewUnmasked && !visibleNumbers[key]?.visible;
    
    return shouldShowMasked ? maskNumber(number) : number;
  };

  // Show loading state while checking authentication
  if (userLoading) {
    return (
      <Dashboard>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading authentication...</span>
        </div>
      </Dashboard>
    );
  }

  // Show error if user is not authenticated
  if (!user) {
    return (
      <Dashboard>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Authentication Required</h2>
            <p className="text-gray-600 mb-4">Please log in to view employees.</p>
            <Button onClick={() => window.location.href = '/auth'}>
              Go to Login
            </Button>
          </div>
        </div>
      </Dashboard>
    );
  }

  // Fetch employees with proper authentication and tenant context
  const { data: employees = [], isLoading, error } = useQuery({
    queryKey: ['employees', user?.tenantId],
    queryFn: async () => {
      console.log('Fetching employees for tenant:', user?.tenantId);
      const response = await apiRequest('GET', '/api/employees');
      console.log('Employee API response:', response);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Employee API error:', errorText);
        throw new Error(`Failed to fetch employees: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Employee data received:', data);
      return data;
    },
    enabled: !!user && ((Boolean(user?.tenantId) || user?.role === 'super_admin' || user?.isSuperAdmin) ?? false),
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['/api/companies'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/companies');
      return response.json();
    },
    enabled: !!user,
  });

  const { data: companyHistory = [], isLoading: isHistoryLoading } = useQuery({
    queryKey: ['/api/employees', historyEmployee?.id, 'company-history'],
    queryFn: async () => {
      if (!historyEmployee) return [];
      const response = await apiRequest('GET', `/api/employees/${historyEmployee.id}/company-history`);
      return response.json();
    },
    enabled: isHistoryDialogOpen && !!historyEmployee,
  });

  const getCompanyName = (companyId?: number | null) => {
    if (companyId == null) return '-';
    const id = Number(companyId);
    if (Number.isNaN(id)) return '-';
    const company = companies.find((c: { id: number; companyName: string }) => c.id === id);
    return company?.companyName || '-';
  };

  const displayCompanyName = (employee: Employee) => {
    if (employee.companyName?.trim()) return employee.companyName;
    return getCompanyName(employee.companyId);
  };

  console.log('Current employees state:', employees);
  console.log('Loading state:', isLoading);
  console.log('Error state:', error);
  console.log('User state:', user);
  console.log('Tenant ID from user:', user?.tenantId);
  console.log('Tenant ID from localStorage:', localStorage.getItem('tenantId'));

  // Add employee mutation
  const addEmployeeMutation = useMutation({
    mutationFn: async (data: EmployeeFormData) => {
      if (!data.employeeId?.trim() || !data.name?.trim() || !data.department?.trim() || !data.designation?.trim()) {
        throw new Error('Please fill in Employee ID, Name, Department, and Designation.');
      }
      if (!data.joinDate?.trim()) {
        throw new Error('Join date is required.');
      }
      const payload = buildEmployeePayload(data, user?.tenantId);
      console.log('Adding employee with data:', payload);
      const response = await apiRequest('POST', '/api/employees', payload);
      console.log('Add employee response:', response);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Add employee error:', errorText);
        throw new Error(`Failed to add employee: ${errorText}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Employee added successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setIsAddModalOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      console.error('Add employee mutation error:', error);
      toast({
        title: "Error",
        description: error.message || error.detail || "Failed to add employee",
        variant: "destructive",
      });
    },
  });

  // Update employee mutation
  const updateEmployeeMutation = useMutation({
    mutationFn: async (data: EmployeeFormData) => {
      console.log('Updating employee with data:', data);
      console.log('Selected employee ID:', selectedEmployee?.id);
      console.log('Form data being sent:', JSON.stringify(data, null, 2));
      
      const updateData = buildEmployeePayload(
        data,
        user?.tenantId || selectedEmployee?.tenantId
      );
      
      console.log('Update data with tenantId:', JSON.stringify(updateData, null, 2));
      
      const response = await apiRequest('PUT', `/api/employees/${selectedEmployee?.id}`, updateData);
      console.log('Update employee response:', response);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Update employee error:', errorText);
        throw new Error(`Failed to update employee: ${errorText}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Employee updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setIsEditModalOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      console.error('Update employee mutation error:', error);
      console.error('Error details:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update employee",
        variant: "destructive",
      });
    },
  });

  // Delete employee mutation
  const deleteEmployeeMutation = useMutation({
    mutationFn: async (id: number) => {
      console.log('Deleting employee with ID:', id);
      const response = await apiRequest('DELETE', `/api/employees/${id}`);
      console.log('Delete employee response:', response);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Delete employee error:', errorText);
        throw new Error(`Failed to delete employee: ${errorText}`);
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Employee deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setIsDeleteDialogOpen(false);
    },
    onError: (error: any) => {
      console.error('Delete employee mutation error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete employee",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      employeeId: '',
      name: 'John',
      department: '',
      designation: '',
      joinDate: new Date().toISOString().split('T')[0],
      dateOfBirth: '',
      salary: '',
      status: 'active',
      nationality: 'citizen',
      prStatus: '',
      nricNumber: '',
      finNumber: '',
      passportNumber: '',
      passportExpiry: '',
      visaNumber: '',
      visaExpiry: '',
      visaType: 'other',
      visaRemarks: '',
      companyId: '',
      passportScan: '',
      nricScan: '',
      visaScan: '',
    });
  };

  const handleEdit = (employee: Employee) => {
    setSelectedEmployee(employee);
    setFormData({
      employeeId: employee.employeeId,
      name: employee.name,
      department: employee.department,
      designation: employee.designation,
      joinDate: employee.joinDate ? employee.joinDate.split('T')[0] : '',
      dateOfBirth: employee.dateOfBirth ? employee.dateOfBirth.split('T')[0] : '',
      salary: employee.salary ? String(employee.salary) : '',
      status: employee.status,
      nationality: normalizeNationality(employee.nationality),
      prStatus: employee.prStatus || '',
      nricNumber: employee.nricNumber || '',
      finNumber: employee.finNumber || '',
      passportNumber: employee.passportNumber || '',
      passportExpiry: employee.passportExpiry || '',
      visaNumber: employee.visaNumber || '',
      visaExpiry: employee.visaExpiry || '',
      visaType: employee.visaType || 'other',
      visaRemarks: employee.visaRemarks || '',
      companyId: employee.companyId ? String(employee.companyId) : '',
      passportScan: employee.passportScan || '',
      nricScan: employee.nricScan || '',
      visaScan: employee.visaScan || '',
    });
    setIsEditModalOpen(true);
  };

  const handleViewDetails = (employee: Employee) => {
    setSelectedEmployee(employee);
    setIsViewDetailsModalOpen(true);
  };

  const handleDelete = (employee: Employee) => {
    setSelectedEmployee(employee);
    setIsDeleteDialogOpen(true);
  };

  const handleHistory = (employee: Employee) => {
    setHistoryEmployee(employee);
    setIsHistoryDialogOpen(true);
  };

  const confirmDelete = () => {
    if (selectedEmployee) {
      deleteEmployeeMutation.mutate(selectedEmployee.id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditModalOpen) {
      updateEmployeeMutation.mutate(formData);
    } else {
      addEmployeeMutation.mutate(formData);
    }
  };

  const filteredEmployees = employees.filter((employee: Employee) =>
    employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.employeeId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isForeigner = formData.nationality === 'foreigner';
  const isPr = formData.nationality === 'pr';
  const computedAnnualSalary = formData.salary
    ? (parseFloat(formData.salary) * 12).toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '—';

  const renderEmployeeFormDetailsGrid = (idPrefix: 'add' | 'edit') => {
    const p = idPrefix === 'edit' ? 'edit_' : '';
    const passportVisKey =
      idPrefix === 'edit' ? 'edit_passport' : isForeigner ? 'add_passport_foreigner' : 'add_passport';

    return (
      <div className="space-y-6">
        <h3 className="text-lg font-semibold border-b pb-2">Personal Information</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor={`${p}employee_id`}>Employee ID*</Label>
            <Input
              id={`${p}employee_id`}
              placeholder="e.g. EMP001"
              value={formData.employeeId}
              onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
              required
            />
            <p className="text-sm text-muted-foreground mt-1">Unique identifier for the employee</p>
          </div>
          <div>
            {!isForeigner ? (
              <>
                <Label htmlFor={`${p}nric_number`}>NRIC / ID Number</Label>
                <Input
                  id={`${p}nric_number`}
                  placeholder="e.g. S1234567A"
                  value={formData.nricNumber || ''}
                  onChange={(e) => setFormData({ ...formData, nricNumber: e.target.value })}
                />
                <p className="text-sm text-muted-foreground mt-1">Singapore NRIC or ID number</p>
              </>
            ) : (
              <>
                <Label htmlFor={`${p}fin_number`}>NRIC / ID Number</Label>
                <Input
                  id={`${p}fin_number`}
                  placeholder="e.g. G1234567X"
                  value={formData.finNumber || ''}
                  onChange={(e) => setFormData({ ...formData, finNumber: e.target.value })}
                />
                <p className="text-sm text-muted-foreground mt-1">Foreigner Identification Number</p>
              </>
            )}
          </div>

          <div>
            <Label htmlFor={`${p}first_name`}>Full Name*</Label>
            <Input
              id={`${p}first_name`}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <p className="text-sm text-muted-foreground mt-1">Employee's full legal name</p>
          </div>
          <div>
            <Label htmlFor={`${p}passport_number`}>Passport Number</Label>
            <div className="relative">
              <Input
                id={`${p}passport_number`}
                placeholder="e.g. A1234567 (will be masked in display)"
                value={formData.passportNumber || ''}
                onChange={(e) => setFormData({ ...formData, passportNumber: e.target.value })}
              />
              {formData.passportNumber && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                  onClick={() => toggleNumberVisibility(passportVisKey, formData.passportNumber || '')}
                >
                  {visibleNumbers[passportVisKey]?.visible ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
            {formData.passportNumber && (
              <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                <span className="font-medium">Display Value: </span>
                {getDisplayValue(passportVisKey, formData.passportNumber)}
              </div>
            )}
            <p className="text-sm text-muted-foreground mt-1">Passport number will be displayed as **** 1234 for security</p>
          </div>

          <div>
            <Label htmlFor={`${p}department`}>Department*</Label>
            <Input
              id={`${p}department`}
              placeholder="e.g. Engineering, HR, Finance"
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              required
            />
            <p className="text-sm text-muted-foreground mt-1">Employee's department or division</p>
          </div>
          <div>
            <Label htmlFor={`${p}passport_expiry`}>Passport Expiry</Label>
            <StringDatePicker
              value={formData.passportExpiry || ''}
              onChange={(val) => setFormData({ ...formData, passportExpiry: val })}
            />
            <p className="text-sm text-muted-foreground mt-1">When does the passport expire</p>
          </div>

          <div>
            <Label htmlFor={`${p}position`}>Designation*</Label>
            <Input
              id={`${p}position`}
              placeholder="e.g. Software Engineer, Manager"
              value={formData.designation}
              onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
              required
            />
            <p className="text-sm text-muted-foreground mt-1">Employee's job title or position</p>
          </div>
          <div>
            <Label htmlFor={`${p}date_of_birth`}>Date of Birth*</Label>
            <StringDatePicker
              value={formData.dateOfBirth}
              onChange={(val) => setFormData({ ...formData, dateOfBirth: val })}
            />
            <p className="text-sm text-muted-foreground mt-1">Employee's date of birth</p>
          </div>

          <div>
            <Label htmlFor={`${p}hire_date`}>Join Date*</Label>
            <StringDatePicker
              value={formData.joinDate}
              onChange={(val) => setFormData({ ...formData, joinDate: val })}
            />
            <p className="text-sm text-muted-foreground mt-1">When did the employee join the company</p>
          </div>
          <div>
            <Label htmlFor={`${p}status`}>Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value: 'active' | 'resigned' | 'on_hold' | 'terminated') =>
                setFormData({ ...formData, status: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="resigned">Resigned</SelectItem>
                <SelectItem value="on_hold">On Hold</SelectItem>
                <SelectItem value="terminated">Terminated</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground mt-1">Current employment status</p>
          </div>

          <div>
            <Label htmlFor={`${p}salary`}>Salary*</Label>
            <Input
              id={`${p}salary`}
              type="number"
              min="1"
              step="0.01"
              value={formData.salary}
              onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
              required
            />
          </div>
          <div>
            <Label>Annual Salary</Label>
            <Input value={computedAnnualSalary} readOnly className="bg-muted cursor-not-allowed" />
          </div>

          <div>
            <Label htmlFor={`${p}nationality`}>Nationality</Label>
            <Select
              value={formData.nationality}
              onValueChange={(value: 'citizen' | 'pr' | 'foreigner') =>
                setFormData({
                  ...formData,
                  nationality: value,
                  prStatus: value === 'pr' ? formData.prStatus || 'year_3_plus' : '',
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select residency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="citizen">Singapore Citizen</SelectItem>
                <SelectItem value="pr">PR</SelectItem>
                <SelectItem value="foreigner">Foreigner</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor={`${p}pr_status`}>PR Status</Label>
            {isPr ? (
              <Select
                value={formData.prStatus || 'year_3_plus'}
                onValueChange={(value: 'year_1' | 'year_2' | 'year_3_plus') =>
                  setFormData({ ...formData, prStatus: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select PR status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="year_1">1 Year PR</SelectItem>
                  <SelectItem value="year_2">2 Year PR</SelectItem>
                  <SelectItem value="year_3_plus">3 Year PR and Above</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Input readOnly disabled className="bg-muted cursor-not-allowed" value="—" />
            )}
          </div>

          <div className="col-span-2">
            <Label htmlFor={`${p}company`}>Company</Label>
            <CompanySearchSelect
              companies={companies}
              value={formData.companyId}
              onValueChange={(value) => setFormData({ ...formData, companyId: value })}
              placeholder="Search company..."
            />
            <p className="text-sm text-muted-foreground mt-1">Assign employee to a company</p>
          </div>
        </div>
      </div>
    );
  };

  const renderForeignerImmigrationFields = (idPrefix: 'add' | 'edit') => {
    const p = idPrefix === 'edit' ? 'edit_' : '';
    const visaVisKey = idPrefix === 'edit' ? 'edit_visa' : 'add_visa';

    return (
      <div className="space-y-6">
        <h3 className="text-lg font-semibold border-b pb-2">Immigration Details</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor={`${p}visa_type`}>Visa Type</Label>
            <Select
              value={formData.visaType}
              onValueChange={(value: 's_pass' | 'work_permit' | 'employment_pass' | 'pr' | 'dependent_pass' | 'ltvp' | 'student_pass' | 'other') =>
                setFormData({ ...formData, visaType: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select visa type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="s_pass">S Pass</SelectItem>
                <SelectItem value="work_permit">Work Permit</SelectItem>
                <SelectItem value="employment_pass">Employment Pass</SelectItem>
                <SelectItem value="pr">PR</SelectItem>
                <SelectItem value="dependent_pass">Dependent Pass</SelectItem>
                <SelectItem value="ltvp">LTVP</SelectItem>
                <SelectItem value="student_pass">Student Pass</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground mt-1">Type of work visa or permit</p>
          </div>
          <div>
            <Label htmlFor={`${p}work_permit_number`}>Work Permit Number</Label>
            <div className="relative">
              <Input
                id={`${p}work_permit_number`}
                placeholder="e.g. G1234567X (will be masked in display)"
                value={formData.visaNumber || ''}
                onChange={(e) => setFormData({ ...formData, visaNumber: e.target.value })}
              />
              {formData.visaNumber && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                  onClick={() => toggleNumberVisibility(visaVisKey, formData.visaNumber || '')}
                >
                  {visibleNumbers[visaVisKey]?.visible ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
            {formData.visaNumber && (
              <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                <span className="font-medium">Display Value: </span>
                {getDisplayValue(visaVisKey, formData.visaNumber)}
              </div>
            )}
            <p className="text-sm text-muted-foreground mt-1">Visa number will be displayed as **** 1234 for security</p>
          </div>
          <div>
            <Label htmlFor={`${p}visa_expiry`}>Visa Expiry</Label>
            <StringDatePicker
              value={formData.visaExpiry || ''}
              onChange={(val) => setFormData({ ...formData, visaExpiry: val })}
            />
            <p className="text-sm text-muted-foreground mt-1">When does the visa expire</p>
          </div>
          <div>
            <Label htmlFor={`${p}visa_remarks`}>Visa Remarks</Label>
            <Textarea
              id={`${p}visa_remarks`}
              placeholder="Any additional notes about visa status..."
              value={formData.visaRemarks || ''}
              onChange={(e) => setFormData({ ...formData, visaRemarks: e.target.value })}
            />
            <p className="text-sm text-muted-foreground mt-1">Optional notes about visa conditions or restrictions</p>
          </div>
        </div>
      </div>
    );
  };

  const addDependent = () => {
    if (dependentFormData.name && dependentFormData.relationship) {
      setDependents([...dependents, { ...dependentFormData, id: Date.now() }]);
      setDependentFormData({
        name: '',
        relationship: 'spouse',
        passportNumber: '',
        passportExpiry: '',
        visaNumber: '',
        visaExpiry: '',
        visaType: 'other'
      });
      setShowDependentForm(false); // Close the form after adding
    }
  };

  const removeDependent = (index: number) => {
    setDependents(dependents.filter((_, i) => i !== index));
  };

  const handleImportFile = async (file: File) => {
    const buffer = await file.arrayBuffer();
    const rows = parseEmployeeImportFile(buffer);
    const validated = rows.map((row) => {
      const errors = [...row.errors];
      if (errors.length === 0) {
        try {
          insertEmployeeSchema.parse({
            ...row.data,
            tenantId: user?.tenantId ?? undefined,
          });
        } catch (err: unknown) {
          if (err instanceof ZodError) {
            err.errors.forEach((e) => errors.push(`${e.path.join(".")}: ${e.message}`));
          } else if (err instanceof Error) {
            errors.push(err.message);
          } else {
            errors.push("Validation failed");
          }
        }
      }
      return { ...row, errors };
    });
    setImportRows(validated);
    setIsImportDialogOpen(true);
  };

  const handleConfirmImport = async () => {
    const validRows = importRows.filter((r) => r.errors.length === 0);
    if (validRows.length === 0) {
      toast({ title: "No valid rows", description: "Fix validation errors before importing.", variant: "destructive" });
      return;
    }

    setIsImporting(true);
    let created = 0;
    const failed: string[] = [];

    for (const row of validRows) {
      try {
        const d = row.data;
        const formRow: EmployeeFormData = {
          employeeId: String(d.employeeId ?? ""),
          name: String(d.name ?? ""),
          department: String(d.department ?? ""),
          designation: String(d.designation ?? ""),
          joinDate: String(d.joinDate ?? ""),
          dateOfBirth: d.dateOfBirth ? String(d.dateOfBirth) : "",
          salary: d.salary != null ? String(d.salary) : "",
          status: (d.status as EmployeeFormData["status"]) || "active",
          nationality: (d.nationality as EmployeeFormData["nationality"]) || "citizen",
          prStatus: (d.prStatus as EmployeeFormData["prStatus"]) || "",
          nricNumber: String(d.nricNumber ?? ""),
          finNumber: String(d.finNumber ?? ""),
          passportNumber: String(d.passportNumber ?? ""),
          passportExpiry: d.passportExpiry ? String(d.passportExpiry) : "",
          visaNumber: String(d.visaNumber ?? ""),
          visaExpiry: d.visaExpiry ? String(d.visaExpiry) : "",
          visaType: (d.visaType as EmployeeFormData["visaType"]) || "other",
          visaRemarks: String(d.visaRemarks ?? ""),
          companyId: "",
          passportScan: "",
          nricScan: "",
          visaScan: "",
        };
        const payload = buildEmployeePayload(formRow, user?.tenantId);
        const res = await apiRequest("POST", "/api/employees", payload);
        if (!res.ok) {
          const errText = await res.text();
          failed.push(`Row ${row.rowNumber}: ${errText}`);
        } else {
          created++;
        }
      } catch (err: any) {
        failed.push(`Row ${row.rowNumber}: ${err?.message || "Failed to create"}`);
      }
    }

    setIsImporting(false);
    queryClient.invalidateQueries({ queryKey: ['employees'] });
    setIsImportDialogOpen(false);
    setImportRows([]);

    if (failed.length === 0) {
      toast({ title: "Import complete", description: `${created} employee(s) created successfully.` });
    } else {
      toast({
        title: "Import partially complete",
        description: `${created} created, ${failed.length} failed. ${failed.slice(0, 2).join("; ")}`,
        variant: "destructive",
      });
    }
  };

  return (
    <Dashboard>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[32px] font-bold">Employees</h1>
            <p className="text-muted-foreground">Manage your employee information</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={importFileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImportFile(file);
                e.target.value = "";
              }}
            />
            <Button variant="outline" onClick={() => exportEmployeesToExcel(employees)} disabled={!employees.length}>
              <Download className="mr-2 h-4 w-4" />
              Export to Excel
            </Button>
            <Button variant="outline" onClick={() => importFileRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />
              Import from Excel
            </Button>
            <Button onClick={() => setIsAddModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Employee
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Employees</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                <p>Loading employees...</p>
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <p className="text-red-600 mb-2">Error loading employees:</p>
                <p className="text-sm text-gray-600">{error.message}</p>
                <Button 
                  onClick={() => queryClient.invalidateQueries({ queryKey: ['employees'] })}
                  className="mt-2"
                >
                  Retry
                </Button>
              </div>
            ) : employees.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Employees Found</h3>
                <p className="text-gray-600 mb-4">
                  {user?.tenantId ? 
                    `No employees found. Add your first employee to get started.` :
                    'Please log in to view employees.'
                  }
                </p>
                <Button onClick={() => setIsAddModalOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add First Employee
                </Button>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>DOB</TableHead>
                      <TableHead>Salary (Monthly)</TableHead>
                      <TableHead>Annual Salary</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Passport/Visa</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEmployees.map((employee: Employee) => (
                      <TableRow key={employee.id}>
                        <TableCell>{employee.employeeId}</TableCell>
                        <TableCell>{employee.name}</TableCell>
                        <TableCell>{employee.designation}</TableCell>
                        <TableCell>{employee.department}</TableCell>
                        <TableCell>{displayCompanyName(employee)}</TableCell>
                        <TableCell>{employee.dateOfBirth ? new Date(employee.dateOfBirth).toLocaleDateString('en-GB') : '-'}</TableCell>
                        <TableCell>{employee.salary ? `$${Number(employee.salary).toLocaleString('en-SG', { minimumFractionDigits: 2 })}` : '-'}</TableCell>
                        <TableCell>
                          {employee.salary
                            ? `$${(Number(employee.salary) * 12).toLocaleString('en-SG', { minimumFractionDigits: 2 })}`
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={employee.status === 'active' ? 'default' : 'secondary'}>
                            {employee.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {normalizeNationality(employee.nationality) !== 'foreigner' ? (
                              // Singaporean/PR - show NRIC
                              employee.nricNumber && (
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-gray-500">NRIC:</span>
                                  <span className="text-xs font-mono">
                                    {getDisplayValue(`table_nric_${employee.id}`, employee.nricNumber)}
                                  </span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-3 w-3 p-0"
                                    onClick={() => toggleNumberVisibility(`table_nric_${employee.id}`, employee.nricNumber || '')}
                                  >
                                    {visibleNumbers[`table_nric_${employee.id}`]?.visible ? (
                                      <EyeOff className="h-2 w-2" />
                                    ) : (
                                      <Eye className="h-2 w-2" />
                                    )}
                                  </Button>
                                </div>
                              )
                            ) : (
                              // Foreigner - show passport and visa
                              <>
                                {employee.passportNumber && (
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs text-gray-500">Passport:</span>
                                    <span className="text-xs font-mono">
                                      {getDisplayValue(`table_passport_${employee.id}`, employee.passportNumber)}
                                    </span>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-3 w-3 p-0"
                                      onClick={() => toggleNumberVisibility(`table_passport_${employee.id}`, employee.passportNumber || '')}
                                    >
                                      {visibleNumbers[`table_passport_${employee.id}`]?.visible ? (
                                        <EyeOff className="h-2 w-2" />
                                      ) : (
                                        <Eye className="h-2 w-2" />
                                      )}
                                    </Button>
                                  </div>
                                )}
                                {employee.visaNumber && (
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs text-gray-500">Visa:</span>
                                    <span className="text-xs font-mono">
                                      {getDisplayValue(`table_visa_${employee.id}`, employee.visaNumber)}
                                    </span>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-3 w-3 p-0"
                                      onClick={() => toggleNumberVisibility(`table_visa_${employee.id}`, employee.visaNumber || '')}
                                    >
                                      {visibleNumbers[`table_visa_${employee.id}`]?.visible ? (
                                        <EyeOff className="h-2 w-2" />
                                      ) : (
                                        <Eye className="h-2 w-2" />
                                      )}
                                    </Button>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <TableRowActions
                            actions={[
                              {
                                icon: Eye,
                                label: "View",
                                variant: "view",
                                onClick: () => handleViewDetails(employee),
                              },
                              {
                                icon: Edit,
                                label: "Edit",
                                variant: "edit",
                                onClick: () => handleEdit(employee),
                              },
                              {
                                icon: Trash2,
                                label: "Delete",
                                variant: "delete",
                                onClick: () => handleDelete(employee),
                              },
                            ]}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add Employee Modal */}
        {isAddModalOpen && (
          <Sheet open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
            <SheetContent 
              side="right" 
              className="p-0 flex flex-col"
              style={{ width: "50vw", maxWidth: "none", minWidth: "320px" }}
            >
              {/* Sticky Header */}
              <div className="sticky top-0 z-10 bg-background border-b px-6 py-4 shrink-0">
                <SheetHeader>
                  <SheetTitle className="text-2xl font-bold text-gray-900">
                    Add New Employee
                  </SheetTitle>
                  <p className="text-sm text-gray-600 mt-2">
                    Add a new employee to your organization
                  </p>
                </SheetHeader>
              </div>
              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto px-6 pb-24">
                <form onSubmit={handleSubmit} className="space-y-6">
                  {renderEmployeeFormDetailsGrid('add')}
                  {isForeigner && renderForeignerImmigrationFields('add')}

                  {/* Document Uploads Section */}
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold border-b pb-2">Document Uploads</h3>
                    
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <Label htmlFor="passport_scan">Passport Scan</Label>
                        <div className="mt-2">
                          <input
                            id="passport_scan"
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            className="w-full text-sm text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer border border-input rounded-md px-3 py-2"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onloadend = () => setFormData({ ...formData, passportScan: reader.result as string });
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                          {formData.passportScan && (
                            <p className="text-xs text-green-600 mt-1">File uploaded successfully</p>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">Upload passport scan (PDF/JPG/PNG)</p>
                      </div>

                      {!isForeigner ? (
                        <div>
                          <Label htmlFor="nric_scan">NRIC/ID Scan</Label>
                          <div className="mt-2">
                            <input
                              id="nric_scan"
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png"
                              className="w-full text-sm text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer border border-input rounded-md px-3 py-2"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onloadend = () => setFormData({ ...formData, nricScan: reader.result as string });
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                            {formData.nricScan && (
                              <p className="text-xs text-green-600 mt-1">File uploaded successfully</p>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">Upload NRIC or ID copy</p>
                        </div>
                      ) : (
                        <div>
                          <Label htmlFor="visa_scan">Visa/Work Permit Scan</Label>
                          <div className="mt-2">
                            <input
                              id="visa_scan"
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png"
                              className="w-full text-sm text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer border border-input rounded-md px-3 py-2"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onloadend = () => setFormData({ ...formData, visaScan: reader.result as string });
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                            {formData.visaScan && (
                              <p className="text-xs text-green-600 mt-1">File uploaded successfully</p>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">Upload visa or work permit scan</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Dependents Section */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Dependents</h3>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={() => setShowDependentForm(!showDependentForm)}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Dependent
                      </Button>
                    </div>
                    
                    {/* Dependent Form - Inline */}
                    {showDependentForm && (
                      <div className="border rounded-lg p-4 bg-gray-50">
                        <h4 className="font-medium mb-4">Add New Dependent</h4>
                        <div className="grid grid-cols-2 gap-4">
                          {/* First Row */}
                          <div>
                            <Label htmlFor="dependent_name">Full Name*</Label>
                            <Input
                              id="dependent_name"
                              value={dependentFormData.name}
                              onChange={(e) => setDependentFormData({ ...dependentFormData, name: e.target.value })}
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor="dependent_relationship">Relationship*</Label>
                            <Select value={dependentFormData.relationship} onValueChange={(value: 'spouse' | 'child' | 'parent' | 'sibling' | 'other') => setDependentFormData({ ...dependentFormData, relationship: value })}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select relationship" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="spouse">Spouse</SelectItem>
                                <SelectItem value="child">Child</SelectItem>
                                <SelectItem value="parent">Parent</SelectItem>
                                <SelectItem value="sibling">Sibling</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="dependent_passport_number">Passport Number</Label>
                            <div className="relative">
                            <Input
                              id="dependent_passport_number"
                              placeholder="e.g. A1234567 (will be masked in display)"
                              value={dependentFormData.passportNumber}
                              onChange={(e) => setDependentFormData({ ...dependentFormData, passportNumber: e.target.value })}
                            />
                              {dependentFormData.passportNumber && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                                  onClick={() => toggleNumberVisibility('dependent_passport', dependentFormData.passportNumber)}
                                >
                                  {visibleNumbers['dependent_passport']?.visible ? (
                                    <EyeOff className="h-4 w-4" />
                                  ) : (
                                    <Eye className="h-4 w-4" />
                                  )}
                                </Button>
                              )}
                            </div>
                            {dependentFormData.passportNumber && (
                              <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                                <span className="font-medium">Display Value: </span>
                                {getDisplayValue('dependent_passport', dependentFormData.passportNumber)}
                              </div>
                            )}
                          </div>
                          
                          {/* Second Row */}
                          <div>
                            <Label htmlFor="dependent_passport_expiry">Passport Expiry</Label>
                            <StringDatePicker value={dependentFormData.passportExpiry || ""} onChange={(val) => setDependentFormData({ ...dependentFormData, passportExpiry: val })} />
                          </div>
                          <div>
                            <Label htmlFor="dependent_visa_number">Visa Number</Label>
                            <div className="relative">
                            <Input
                              id="dependent_visa_number"
                              placeholder="e.g. G1234567X (will be masked in display)"
                              value={dependentFormData.visaNumber}
                              onChange={(e) => setDependentFormData({ ...dependentFormData, visaNumber: e.target.value })}
                            />
                              {dependentFormData.visaNumber && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                                  onClick={() => toggleNumberVisibility('dependent_visa', dependentFormData.visaNumber)}
                                >
                                  {visibleNumbers['dependent_visa']?.visible ? (
                                    <EyeOff className="h-4 w-4" />
                                  ) : (
                                    <Eye className="h-4 w-4" />
                                  )}
                                </Button>
                              )}
                            </div>
                            {dependentFormData.visaNumber && (
                              <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                                <span className="font-medium">Display Value: </span>
                                {getDisplayValue('dependent_visa', dependentFormData.visaNumber)}
                              </div>
                            )}
                          </div>
                          <div>
                            <Label htmlFor="dependent_visa_expiry">Visa Expiry</Label>
                            <StringDatePicker value={dependentFormData.visaExpiry || ""} onChange={(val) => setDependentFormData({ ...dependentFormData, visaExpiry: val })} />
                          </div>
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex justify-end space-x-4 mt-4 pt-4 border-t">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setShowDependentForm(false);
                              setDependentFormData({
                                name: '',
                                relationship: 'spouse',
                                passportNumber: '',
                                passportExpiry: '',
                                visaNumber: '',
                                visaExpiry: '',
                                visaType: 'other'
                              });
                            }}
                          >
                            Cancel
                          </Button>
                          <Button type="button" onClick={addDependent}>
                            Add Dependent
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    {/* Display Added Dependents */}
                    {dependents.length > 0 ? (
                      <div className="space-y-4">
                        {dependents.map((dependent, index) => (
                          <div key={index} className="border rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-medium">Dependent {index + 1}</h4>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeDependent(index)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                              <div>
                                <Label className="text-sm font-medium">Full Name</Label>
                                <p className="text-sm text-gray-600">{dependent.name}</p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium">Relationship</Label>
                                <p className="text-sm text-gray-600">{dependent.relationship}</p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium">Passport Number</Label>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm text-gray-600">
                                    {getDisplayValue(`dependent_display_passport_${index}`, dependent.passportNumber)}
                                  </p>
                                  {dependent.passportNumber && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-4 w-4 p-0"
                                      onClick={() => toggleNumberVisibility(`dependent_display_passport_${index}`, dependent.passportNumber)}
                                    >
                                      {visibleNumbers[`dependent_display_passport_${index}`]?.visible ? (
                                        <EyeOff className="h-3 w-3" />
                                      ) : (
                                        <Eye className="h-3 w-3" />
                                      )}
                                    </Button>
                                  )}
                              </div>
                              </div>
                              {dependent.visaNumber && (
                                <div>
                                  <Label className="text-sm font-medium">Visa Number</Label>
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm text-gray-600">
                                      {getDisplayValue(`dependent_display_visa_${index}`, dependent.visaNumber)}
                                    </p>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-4 w-4 p-0"
                                      onClick={() => toggleNumberVisibility(`dependent_display_visa_${index}`, dependent.visaNumber)}
                                    >
                                      {visibleNumbers[`dependent_display_visa_${index}`]?.visible ? (
                                        <EyeOff className="h-3 w-3" />
                                      ) : (
                                        <Eye className="h-3 w-3" />
                                      )}
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No dependents added yet. Click 'Add Dependent' to start.</p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end space-x-4 pt-6 border-t">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsAddModalOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={addEmployeeMutation.isPending}>
                      {addEmployeeMutation.isPending ? 'Creating...' : 'Create Employee'}
                    </Button>
                  </div>
                </form>
              </div>
            </SheetContent>
          </Sheet>
        )}

        {/* Edit Employee Modal - Similar structure but with edit functionality */}
        {isEditModalOpen && (
          <Sheet open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
            <SheetContent 
              side="right" 
              className="p-0 flex flex-col"
              style={{ width: "50vw", maxWidth: "none", minWidth: "320px" }}
            >
              {/* Sticky Header */}
              <div className="sticky top-0 z-10 bg-background border-b px-6 py-4 shrink-0">
                <SheetHeader>
                  <SheetTitle className="text-2xl font-bold text-gray-900">
                    Edit Employee
                  </SheetTitle>
                  <p className="text-sm text-gray-600 mt-2">
                    Update employee information
                  </p>
                </SheetHeader>
              </div>
              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto px-6 pb-24">
                <form onSubmit={handleSubmit} className="space-y-6">
                  {renderEmployeeFormDetailsGrid('edit')}
                  {isForeigner && renderForeignerImmigrationFields('edit')}

                  {/* Document Uploads Section */}
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold border-b pb-2">Document Uploads</h3>
                    
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <Label htmlFor="edit_passport_scan">Passport Scan</Label>
                        <div className="mt-2">
                          <input
                            id="edit_passport_scan"
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            className="w-full text-sm text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer border border-input rounded-md px-3 py-2"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onloadend = () => setFormData({ ...formData, passportScan: reader.result as string });
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                          {formData.passportScan && (
                            <p className="text-xs text-green-600 mt-1">File uploaded successfully</p>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">Upload passport scan (PDF/JPG/PNG)</p>
                      </div>

                      {!isForeigner ? (
                        <div>
                          <Label htmlFor="edit_nric_scan">NRIC/ID Scan</Label>
                          <div className="mt-2">
                            <input
                              id="edit_nric_scan"
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png"
                              className="w-full text-sm text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer border border-input rounded-md px-3 py-2"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onloadend = () => setFormData({ ...formData, nricScan: reader.result as string });
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                            {formData.nricScan && (
                              <p className="text-xs text-green-600 mt-1">File uploaded successfully</p>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">Upload NRIC or ID copy</p>
                        </div>
                      ) : (
                        <div>
                          <Label htmlFor="edit_visa_scan">Visa/Work Permit Scan</Label>
                          <div className="mt-2">
                            <input
                              id="edit_visa_scan"
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png"
                              className="w-full text-sm text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer border border-input rounded-md px-3 py-2"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onloadend = () => setFormData({ ...formData, visaScan: reader.result as string });
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                            {formData.visaScan && (
                              <p className="text-xs text-green-600 mt-1">File uploaded successfully</p>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">Upload visa or work permit scan</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Dependents Section */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Dependents</h3>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={() => setShowDependentForm(!showDependentForm)}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Dependent
                      </Button>
                    </div>
                    
                    {/* Dependent Form - Inline */}
                    {showDependentForm && (
                      <div className="border rounded-lg p-4 bg-gray-50">
                        <h4 className="font-medium mb-4">Add New Dependent</h4>
                        <div className="grid grid-cols-2 gap-4">
                          {/* First Row */}
                          <div>
                            <Label htmlFor="dependent_name">Full Name*</Label>
                            <Input
                              id="dependent_name"
                              value={dependentFormData.name}
                              onChange={(e) => setDependentFormData({ ...dependentFormData, name: e.target.value })}
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor="dependent_relationship">Relationship*</Label>
                            <Select value={dependentFormData.relationship} onValueChange={(value: 'spouse' | 'child' | 'parent' | 'sibling' | 'other') => setDependentFormData({ ...dependentFormData, relationship: value })}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select relationship" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="spouse">Spouse</SelectItem>
                                <SelectItem value="child">Child</SelectItem>
                                <SelectItem value="parent">Parent</SelectItem>
                                <SelectItem value="sibling">Sibling</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="dependent_passport_number">Passport Number</Label>
                            <div className="relative">
                            <Input
                              id="dependent_passport_number"
                              placeholder="e.g. A1234567 (will be masked in display)"
                              value={dependentFormData.passportNumber}
                              onChange={(e) => setDependentFormData({ ...dependentFormData, passportNumber: e.target.value })}
                            />
                              {dependentFormData.passportNumber && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                                  onClick={() => toggleNumberVisibility('dependent_passport', dependentFormData.passportNumber)}
                                >
                                  {visibleNumbers['dependent_passport']?.visible ? (
                                    <EyeOff className="h-4 w-4" />
                                  ) : (
                                    <Eye className="h-4 w-4" />
                                  )}
                                </Button>
                              )}
                            </div>
                            {dependentFormData.passportNumber && (
                              <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                                <span className="font-medium">Display Value: </span>
                                {getDisplayValue('dependent_passport', dependentFormData.passportNumber)}
                              </div>
                            )}
                          </div>
                          
                          {/* Second Row */}
                          <div>
                            <Label htmlFor="dependent_passport_expiry">Passport Expiry</Label>
                            <StringDatePicker value={dependentFormData.passportExpiry || ""} onChange={(val) => setDependentFormData({ ...dependentFormData, passportExpiry: val })} />
                          </div>
                          <div>
                            <Label htmlFor="dependent_visa_number">Visa Number</Label>
                            <div className="relative">
                            <Input
                              id="dependent_visa_number"
                              placeholder="e.g. G1234567X (will be masked in display)"
                              value={dependentFormData.visaNumber}
                              onChange={(e) => setDependentFormData({ ...dependentFormData, visaNumber: e.target.value })}
                            />
                              {dependentFormData.visaNumber && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                                  onClick={() => toggleNumberVisibility('dependent_visa', dependentFormData.visaNumber)}
                                >
                                  {visibleNumbers['dependent_visa']?.visible ? (
                                    <EyeOff className="h-4 w-4" />
                                  ) : (
                                    <Eye className="h-4 w-4" />
                                  )}
                                </Button>
                              )}
                            </div>
                            {dependentFormData.visaNumber && (
                              <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                                <span className="font-medium">Display Value: </span>
                                {getDisplayValue('dependent_visa', dependentFormData.visaNumber)}
                              </div>
                            )}
                          </div>
                          <div>
                            <Label htmlFor="dependent_visa_expiry">Visa Expiry</Label>
                            <StringDatePicker value={dependentFormData.visaExpiry || ""} onChange={(val) => setDependentFormData({ ...dependentFormData, visaExpiry: val })} />
                          </div>
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex justify-end space-x-4 mt-4 pt-4 border-t">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setShowDependentForm(false);
                              setDependentFormData({
                                name: '',
                                relationship: 'spouse',
                                passportNumber: '',
                                passportExpiry: '',
                                visaNumber: '',
                                visaExpiry: '',
                                visaType: 'other'
                              });
                            }}
                          >
                            Cancel
                          </Button>
                          <Button type="button" onClick={addDependent}>
                            Add Dependent
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    {/* Display Added Dependents */}
                    {dependents.length > 0 ? (
                      <div className="space-y-4">
                        {dependents.map((dependent, index) => (
                          <div key={index} className="border rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-medium">Dependent {index + 1}</h4>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeDependent(index)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                              <div>
                                <Label className="text-sm font-medium">Full Name</Label>
                                <p className="text-sm text-gray-600">{dependent.name}</p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium">Relationship</Label>
                                <p className="text-sm text-gray-600">{dependent.relationship}</p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium">Passport Number</Label>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm text-gray-600">
                                    {getDisplayValue(`dependent_display_passport_${index}`, dependent.passportNumber)}
                                  </p>
                                  {dependent.passportNumber && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-4 w-4 p-0"
                                      onClick={() => toggleNumberVisibility(`dependent_display_passport_${index}`, dependent.passportNumber)}
                                    >
                                      {visibleNumbers[`dependent_display_passport_${index}`]?.visible ? (
                                        <EyeOff className="h-3 w-3" />
                                      ) : (
                                        <Eye className="h-3 w-3" />
                                      )}
                                    </Button>
                                  )}
                              </div>
                              </div>
                              {dependent.visaNumber && (
                                <div>
                                  <Label className="text-sm font-medium">Visa Number</Label>
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm text-gray-600">
                                      {getDisplayValue(`dependent_display_visa_${index}`, dependent.visaNumber)}
                                    </p>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-4 w-4 p-0"
                                      onClick={() => toggleNumberVisibility(`dependent_display_visa_${index}`, dependent.visaNumber)}
                                    >
                                      {visibleNumbers[`dependent_display_visa_${index}`]?.visible ? (
                                        <EyeOff className="h-3 w-3" />
                                      ) : (
                                        <Eye className="h-3 w-3" />
                                      )}
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No dependents added yet. Click 'Add Dependent' to start.</p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end space-x-4 pt-6 border-t">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsEditModalOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={updateEmployeeMutation.isPending}>
                      {updateEmployeeMutation.isPending ? 'Updating...' : 'Update Employee'}
                    </Button>
                  </div>
                </form>
              </div>
            </SheetContent>
          </Sheet>
        )}

        {/* Import Preview Dialog */}
        <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Import Employees from Excel</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                {importRows.filter((r) => r.errors.length === 0).length} valid row(s),{" "}
                {importRows.filter((r) => r.errors.length > 0).length} with errors
              </p>
              <div className="rounded-md border max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Row</TableHead>
                      <TableHead>Employee ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Errors</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importRows.map((row) => (
                      <TableRow key={row.rowNumber}>
                        <TableCell>{row.rowNumber}</TableCell>
                        <TableCell>{String(row.data.employeeId ?? "")}</TableCell>
                        <TableCell>{String(row.data.name ?? "")}</TableCell>
                        <TableCell>
                          {row.errors.length === 0 ? (
                            <span className="text-green-600">Valid</span>
                          ) : (
                            <span className="text-red-600">Invalid</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-red-600">{row.errors.join("; ") || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsImportDialogOpen(false)} disabled={isImporting}>
                Cancel
              </Button>
              <Button
                onClick={handleConfirmImport}
                disabled={isImporting || importRows.every((r) => r.errors.length > 0)}
              >
                {isImporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  `Import ${importRows.filter((r) => r.errors.length === 0).length} Employee(s)`
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the employee
                "{selectedEmployee?.name}".
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* View Employee Details */}
        {selectedEmployee && (
          <EntityViewSheet
            open={isViewDetailsModalOpen}
            onOpenChange={setIsViewDetailsModalOpen}
            title="Employee Details"
            description="View complete employee information"
            showHistory
            onHistory={() => selectedEmployee && handleHistory(selectedEmployee)}
            onClose={() => setIsViewDetailsModalOpen(false)}
          >
            <EmployeeViewContent
              employee={selectedEmployee}
              companyDisplay={displayCompanyName(selectedEmployee)}
              nationalityLabel={residencyLabel(selectedEmployee.nationality, selectedEmployee.prStatus)}
              prStatusLabel={getPrStatusLabel(selectedEmployee.nationality, selectedEmployee.prStatus)}
              visaTypeLabel={getVisaTypeLabel(selectedEmployee.visaType)}
              getDisplayValue={getDisplayValue}
              onToggleVisibility={toggleNumberVisibility}
              isFieldVisible={(key) => !!visibleNumbers[key]?.visible}
            />
          </EntityViewSheet>
        )}

        <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Employee Company History</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-auto">
              {isHistoryLoading ? (
                <div className="py-8 text-center text-muted-foreground">Loading history...</div>
              ) : companyHistory.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  No company history found for this employee.
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>EmpID</TableHead>
                        <TableHead>EmpName</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Date Changed</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {companyHistory.map((record: EmployeeCompanyHistoryRecord) => (
                        <TableRow key={record.id}>
                          <TableCell>{record.employeeCode}</TableCell>
                          <TableCell>{record.employeeName}</TableCell>
                          <TableCell>{record.companyName}</TableCell>
                          <TableCell>
                            {new Date(record.dateChanged).toLocaleDateString('en-GB')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsHistoryDialogOpen(false);
                  setHistoryEmployee(null);
                }}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Dashboard>
  );
} 
