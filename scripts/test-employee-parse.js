import { insertEmployeeSchema } from "../shared/schema.ts";

const samples = [
  {
    employeeId: "EMP001",
    name: "Test User",
    department: "IT",
    designation: "Dev",
    joinDate: "2026-01-01",
    dateOfBirth: "1990-05-15",
    salary: "5000",
    status: "active",
    nationality: "citizen",
    prStatus: "",
    nricNumber: "S1234567A",
    finNumber: "",
    passportNumber: "",
    passportExpiry: "",
    visaNumber: "",
    visaExpiry: "",
    visaType: "other",
    visaRemarks: "",
    tenantId: 1,
  },
  {
    employeeId: "EMP002",
    name: "PR User",
    department: "HR",
    designation: "Mgr",
    joinDate: new Date().toISOString(),
    dateOfBirth: "1985-03-20",
    salary: "6000",
    status: "active",
    nationality: "pr",
    prStatus: "year_1",
    tenantId: 1,
  },
];

const edge = {
  employeeId: "E1",
  name: "T",
  department: "D",
  designation: "X",
  joinDate: "",
  dateOfBirth: "",
  salary: "5000",
  status: "active",
  nationality: "citizen",
  prStatus: "",
  tenantId: 1,
};
try {
  insertEmployeeSchema.parse(edge);
  console.log("edge empty dates OK");
} catch (e) {
  console.log("edge empty dates FAIL", e.errors);
}

const fullForm = {
  employeeId: "EMP-99",
  name: "John",
  department: "Engineering",
  designation: "Developer",
  joinDate: new Date().toISOString().split("T")[0],
  dateOfBirth: "1995-06-04",
  salary: "5000",
  status: "active",
  nationality: "citizen",
  prStatus: "",
  nricNumber: "",
  finNumber: "",
  passportNumber: "",
  passportExpiry: "",
  visaNumber: "",
  visaExpiry: "",
  visaType: "other",
  visaRemarks: "",
  passportScan: "",
  nricScan: "",
  visaScan: "",
};
try {
  insertEmployeeSchema.parse(fullForm);
  console.log("fullForm without tenant OK");
} catch (e) {
  console.log("fullForm without tenant FAIL", e.errors);
}
try {
  insertEmployeeSchema.parse({ ...fullForm, tenantId: 1 });
  console.log("fullForm with tenant OK");
} catch (e) {
  console.log("fullForm with tenant FAIL", e.errors);
}
for (const bad of [
  { ...fullForm, department: "" },
  { ...fullForm, employeeId: "" },
  { ...fullForm, joinDate: "invalid" },
  { ...fullForm, nationality: "invalid" },
  { ...fullForm, prStatus: "invalid" },
]) {
  try {
    insertEmployeeSchema.parse({ ...bad, tenantId: 1 });
    console.log("unexpected ok");
  } catch (e) {
    console.log("bad case", e.errors?.[0]?.path, e.errors?.[0]?.message || e.message);
  }
}

for (const body of samples) {
  try {
    const r = insertEmployeeSchema.parse(body);
    console.log("OK", body.nationality, r.nationality, r.prStatus);
  } catch (e) {
    console.log("FAIL", body.nationality, e.errors || e.message);
  }
}
