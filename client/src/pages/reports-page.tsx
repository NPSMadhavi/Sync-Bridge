import { useState } from "react";
import Dashboard from "@/components/layout/Dashboard";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { StringDatePicker } from "@/components/ui/string-date-picker";
import { parseYmd } from "@/components/ui/sync-bridge-date-picker";
import { 
  CalendarIcon, 
  Download, 
  FileDown, 
  FilePieChart, 
  Loader2, 
  UserPlus 
} from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

export default function ReportsPage() {
  const { user } = useAuth();
  const [reportType, setReportType] = useState<string>("expiringDocuments");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate]     = useState<string>("");
  const [daysThreshold, setDaysThreshold] = useState<string>("90");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  
  // Determine if the Generate Report button should be enabled
  const isGenerateEnabled = () => {
    if (reportType === "expiringDocuments") {
      return !!daysThreshold;
    } else if (reportType === "assetAssignments" || reportType === "maintenanceHistory") {
      return true; // No additional parameters required
    } else if (reportType === "customDateRange") {
      return !!fromDate && !!toDate;
    }
    return false;
  };
  
  const handleGenerateReport = () => {
    setIsGenerating(true);
    
    let url = "";
    
    switch (reportType) {
      case "expiringDocuments":
        url = `/api/reports/expiring-documents?days=${daysThreshold}`;
        break;
      case "assetAssignments":
        url = "/api/reports/asset-assignments";
        break;
      case "maintenanceHistory":
        url = "/api/reports/maintenance-history";
        break;
      case "customDateRange":
        if (fromDate && toDate) {
          url = `/api/reports/custom?from=${fromDate}&to=${toDate}`;
        }
        break;
    }
    
    if (url) {
      // Create a hidden anchor element for download
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = `${reportType}-${format(new Date(), "yyyy-MM-dd")}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    
    // Simulate a delay for demonstration purposes
    setTimeout(() => {
      setIsGenerating(false);
    }, 1500);
  };
  
  const renderReportTypeOptions = () => {
    switch (reportType) {
      case "expiringDocuments":
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="days-threshold">Days Threshold</Label>
              <Select 
                value={daysThreshold} 
                onValueChange={setDaysThreshold}
              >
                <SelectTrigger id="days-threshold" className="w-full">
                  <SelectValue placeholder="Select threshold" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="60">60 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                  <SelectItem value="180">180 days</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-gray-500 mt-1">
                Documents expiring within this many days will be included in the report
              </p>
            </div>
          </div>
        );
        
      case "customDateRange":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="from-date">From Date</Label>
              <StringDatePicker
                value={fromDate}
                onChange={setFromDate}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="to-date">To Date</Label>
              <StringDatePicker
                value={toDate}
                onChange={setToDate}
                disabledDate={(date) => {
                  const from = parseYmd(fromDate);
                  return from ? date < from : false;
                }}
              />
            </div>
          </div>
        );
        
      default:
        return (
          <p className="text-sm text-gray-500">
            No additional options needed for this report type.
          </p>
        );
    }
  };
  
  return (
    <Dashboard title="Reports" description="Generate and download reports.">
      <Tabs defaultValue="generate" className="space-y-6">
        <TabsList>
          <TabsTrigger value="generate">Generate Reports</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled Reports</TabsTrigger>
        </TabsList>
        
        <TabsContent value="generate">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Quick Reports</CardTitle>
                  <CardDescription>
                    Generate common reports with a single click
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button 
                    className="w-full justify-start"
                    variant="outline"
                    onClick={() => {
                      setReportType("expiringDocuments");
                      setDaysThreshold("30");
                    }}
                  >
                    <FilePieChart className="mr-2 h-4 w-4" />
                    Documents Expiring Soon (30 days)
                  </Button>
                  
                  <Button 
                    className="w-full justify-start"
                    variant="outline"
                    onClick={() => {
                      setReportType("assetAssignments");
                    }}
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Current Asset Assignments
                  </Button>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Recent Reports</CardTitle>
                  <CardDescription>
                    Your recently generated reports
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <FileDown className="mr-2 h-4 w-4 text-primary-500" />
                        <div>
                          <p className="text-sm font-medium">Expiring Documents</p>
                          <p className="text-xs text-gray-500">Generated 2 days ago</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <FileDown className="mr-2 h-4 w-4 text-primary-500" />
                        <div>
                          <p className="text-sm font-medium">Asset Assignments</p>
                          <p className="text-xs text-gray-500">Generated 5 days ago</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <div className="md:col-span-2">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>Generate Custom Report</CardTitle>
                  <CardDescription>
                    Select report type and customize parameters
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <Label htmlFor="report-type">Report Type</Label>
                    <Select 
                      value={reportType}
                      onValueChange={setReportType}
                    >
                      <SelectTrigger id="report-type" className="w-full">
                        <SelectValue placeholder="Select report type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="expiringDocuments">Expiring Documents</SelectItem>
                        <SelectItem value="assetAssignments">Asset Assignments</SelectItem>
                        <SelectItem value="maintenanceHistory">Maintenance History</SelectItem>
                        <SelectItem value="customDateRange">Custom Date Range</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="border rounded-md p-4 bg-gray-50">
                    <h3 className="text-sm font-medium mb-4">Report Options</h3>
                    {renderReportTypeOptions()}
                  </div>
                  
                  <div className="flex justify-end">
                    <Button 
                      onClick={handleGenerateReport} 
                      disabled={!isGenerateEnabled() || isGenerating}
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Download className="mr-2 h-4 w-4" />
                          Generate Report
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="scheduled">
          <Card>
            <CardHeader>
              <CardTitle>Scheduled Reports</CardTitle>
              <CardDescription>Configure reports to be automatically generated on a schedule</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <CalendarIcon className="h-12 w-12 text-gray-300 mb-3" />
                <h3 className="text-lg font-medium text-gray-800 mb-1">No scheduled reports</h3>
                <p className="text-sm text-gray-500 mb-4">Start scheduling reports for automatic delivery.</p>
                <Button>Schedule New Report</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </Dashboard>
  );
}
