/**
 * TOTO DEVELOPMENT - GOOGLE APPS SCRIPT SETUP
 * -------------------------------------------
 * এই স্ক্রিপ্টটি আপনার Google Spreadsheet-এ ৩টি শিট (Sales_Orders, Expenses, Project_Payouts)
 * সঠিক হেডার, ফরম্যাটিং, ড্রপডাউন ভ্যালিডেশন এবং ফর্মুলা সহ ১-ক্লিকে তৈরি করে দেবে।
 */

function setupTotoSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // ১. Sales_Orders শিট সেটআপ
  setupSalesOrdersSheet(ss);

  // ২. Expenses শিট সেটআপ
  setupExpensesSheet(ss);

  // ৩. Project_Payouts শিট সেটআপ
  setupPayoutsSheet(ss);

  // ডিফল্ট "Sheet1" খালি থাকলে ডিলিট করে দেওয়া (ঐচ্ছিক)
  const defaultSheet = ss.getSheetByName("Sheet1");
  if (defaultSheet && ss.getSheets().length > 1) {
    try {
      ss.deleteSheet(defaultSheet);
    } catch (e) {}
  }

  SpreadsheetApp.getUi().alert("✅ TOTO Development-এর ৩টি শিট সফলভাবে তৈরি এবং ফরম্যাট করা হয়েছে!");
}

// -------------------------------------------------------------
// MODULE A: Sales_Orders
// -------------------------------------------------------------
function setupSalesOrdersSheet(ss) {
  let sheet = ss.getSheetByName("Sales_Orders");
  if (!sheet) {
    sheet = ss.insertSheet("Sales_Orders");
  }

  const headers = [
    "Order ID",
    "Booking Date/Time",
    "Target Deadline",
    "Client / Brand Name",
    "Client Contact",
    "Sales Representative",
    "Service / Project Name",
    "Quantity / Unit",
    "Total Amount (BDT)",
    "Paid Amount (BDT)",
    "Due Amount (BDT)",
    "Payment Method / Gateway",
    "Payment Status",
    "Delivery Status",
    "Remarks / Notes"
  ];

  // হেডার সেট ও স্টাইলিং
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  const headerRange = sheet.getRange("A1:O1");
  headerRange.setBackground("#1e293b"); // Slate Dark Navy
  headerRange.setFontColor("#38bdf8"); // Sky Blue Text
  headerRange.setFontWeight("bold");
  headerRange.setHorizontalAlignment("center");
  sheet.setFrozenRows(1);

  // ড্রপডাউন: Payment Status (Column M)
  const paymentStatuses = ["Unpaid", "Partial", "Paid", "Refunded", "Cancelled"];
  const paymentRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(paymentStatuses, true)
    .build();
  sheet.getRange("M2:M500").setDataValidation(paymentRule);

  // ড্রপডাউন: Delivery Status (Column N)
  const deliveryStatuses = [
    "Pending",
    "In Progress",
    "On Hold",
    "Review",
    "Revision",
    "Completed",
    "Delivered",
    "Cancelled"
  ];
  const deliveryRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(deliveryStatuses, true)
    .build();
  sheet.getRange("N2:N500").setDataValidation(deliveryRule);

  // ড্রপডাউন: Payment Method (Column L)
  const paymentMethods = ["bKash", "Nagad", "Rocket", "Bank Transfer", "Credit Card", "Cash"];
  const methodRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(paymentMethods, true)
    .build();
  sheet.getRange("L2:L500").setDataValidation(methodRule);

  // স্যাম্পল ডাটা (যদি শিটটি সম্পূর্ণ খালি থাকে)
  if (sheet.getLastRow() === 1) {
    sheet.appendRow([
      "ORD-1001",
      "2026-10-06 10:30",
      "2026-10-12 18:00",
      "Rajesh / VK Brand",
      "01711223344",
      "Rajib",
      "Graphic Design",
      "4 Pcs",
      4000,
      2000,
      2000,
      "bKash",
      "Partial",
      "In Progress",
      "Logo and Banner design"
    ]);
  }

  sheet.autoResizeColumns(1, headers.length);
}

// -------------------------------------------------------------
// MODULE B: Expenses
// -------------------------------------------------------------
function setupExpensesSheet(ss) {
  let sheet = ss.getSheetByName("Expenses");
  if (!sheet) {
    sheet = ss.insertSheet("Expenses");
  }

  const headers = [
    "Expense ID",
    "Date & Time",
    "Expense Category",
    "Sub-Category / Purpose",
    "Vendor / Receiver Name",
    "Amount (BDT)",
    "Payment Method",
    "Paid From Account",
    "Transaction / Ref ID",
    "Money Receipt / Invoice Link",
    "Approved By",
    "Remarks / Notes"
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  const headerRange = sheet.getRange("A1:L1");
  headerRange.setBackground("#1e293b");
  headerRange.setFontColor("#f43f5e"); // Rose Red Text
  headerRange.setFontWeight("bold");
  headerRange.setHorizontalAlignment("center");
  sheet.setFrozenRows(1);

  // ড্রপডাউন: Expense Category (Column C)
  const categories = [
    "Employee Salary",
    "Employee Advance",
    "Project Cost",
    "Freelancer Payment",
    "Marketing & Ads",
    "Software / Subscription",
    "Hosting / Domain",
    "Office Expense",
    "Transportation",
    "Equipment",
    "Utilities",
    "Internet / Communication",
    "Bank Charges",
    "Refund",
    "Other"
  ];
  const catRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(categories, true)
    .build();
  sheet.getRange("C2:C500").setDataValidation(catRule);

  // ড্রপডাউন: Payment Method (Column G)
  const methods = ["Bank Transfer", "bKash", "Nagad", "Credit Card", "Cash", "Cheque"];
  const methodRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(methods, true)
    .build();
  sheet.getRange("G2:G500").setDataValidation(methodRule);

  // স্যাম্পল ডাটা
  if (sheet.getLastRow() === 1) {
    sheet.appendRow([
      "EXP-2026-1001",
      "2026-10-06 10:30",
      "Employee Salary",
      "September 2026 Technical Salary",
      "Developer Sakib",
      15000,
      "Bank Transfer",
      "City Bank A/C",
      "TXN987654321",
      "https://drive.google.com/sample-receipt",
      "MD Yousuf Ali",
      "Full monthly salary cleared"
    ]);
  }

  sheet.autoResizeColumns(1, headers.length);
}

// -------------------------------------------------------------
// MODULE C: Project_Payouts
// -------------------------------------------------------------
function setupPayoutsSheet(ss) {
  let sheet = ss.getSheetByName("Project_Payouts");
  if (!sheet) {
    sheet = ss.insertSheet("Project_Payouts");
  }

  const headers = [
    "Payout ID",
    "Project / Order ID",
    "Project / Service Name",
    "Client Name",
    "Resource / Worker Name",
    "Total Project Budget (BDT)",
    "Commission Type",
    "Agreed Payout Amount (BDT)",
    "Advance Paid (BDT)",
    "Due / Final Payable (BDT)",
    "Delivery Status",
    "Payment Status",
    "Payment Method",
    "Transaction / Ref ID",
    "Remarks / Notes"
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  const headerRange = sheet.getRange("A1:O1");
  headerRange.setBackground("#1e293b");
  headerRange.setFontColor("#f59e0b"); // Amber Gold Text
  headerRange.setFontWeight("bold");
  headerRange.setHorizontalAlignment("center");
  sheet.setFrozenRows(1);

  // ড্রপডাউন: Commission Type (Column G)
  const commissionTypes = [
    "Fixed Commission",
    "Percentage (%)",
    "Hourly",
    "Per Unit",
    "Milestone Based",
    "Custom"
  ];
  const commRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(commissionTypes, true)
    .build();
  sheet.getRange("G2:G500").setDataValidation(commRule);

  // ড্রপডাউন: Delivery Status (Column K)
  const deliveryStatuses = [
    "Pending",
    "In Progress",
    "On Hold",
    "Review",
    "Revision",
    "Completed",
    "Delivered",
    "Cancelled"
  ];
  const deliveryRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(deliveryStatuses, true)
    .build();
  sheet.getRange("K2:K500").setDataValidation(deliveryRule);

  // ড্রপডাউন: Payment Status (Column L)
  const paymentStatuses = ["Unpaid", "Partial", "Paid"];
  const paymentRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(paymentStatuses, true)
    .build();
  sheet.getRange("L2:L500").setDataValidation(paymentRule);

  // স্যাম্পল ডাটা
  if (sheet.getLastRow() === 1) {
    sheet.appendRow([
      "PAY-PRJ-501",
      "ORD-1001",
      "Graphic Design",
      "Rajesh / VK Brand",
      "Freelancer Rahim",
      4000,
      "Fixed Commission",
      1500,
      500,
      1000,
      "Completed",
      "Paid",
      "bKash",
      "TRX987654321",
      "Cleared after final file delivery"
    ]);
  }

  sheet.autoResizeColumns(1, headers.length);
}

// -------------------------------------------------------------
// WEB APP API: doGet (Full Data Export for CRM Sync)
// -------------------------------------------------------------
function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Helper to read sheet into array of objects using Row 1 as headers
    function readSheetData(sheetName, idColName) {
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) return [];

      const lastRow = sheet.getLastRow();
      const lastCol = sheet.getLastColumn();
      if (lastRow <= 1 || lastCol < 1) {
        return []; // Confirmed empty sheet (0 records)
      }

      const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
      const headers = values[0].map(h => String(h || '').trim());
      const data = [];

      for (let r = 1; r < values.length; r++) {
        const row = values[r];
        if (!row || row.length === 0) continue;

        const obj = {};
        for (let c = 0; c < headers.length; c++) {
          const key = headers[c];
          if (key) {
            obj[key] = row[c] !== undefined && row[c] !== null ? row[c] : '';
          }
        }

        // Only include if primary permanent ID is present
        const idVal = obj[idColName];
        if (idVal && String(idVal).trim() !== '') {
          data.push(obj);
        }
      }

      return data;
    }

    const orders = readSheetData("Sales_Orders", "Order ID");
    const expenses = readSheetData("Expenses", "Expense ID");
    const payouts = readSheetData("Project_Payouts", "Payout ID");

    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      ordersCount: orders.length,
      expensesCount: expenses.length,
      payoutsCount: payouts.length,
      orders: orders,
      expenses: expenses,
      payouts: payouts
    };

    return ContentService.createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    const errorResponse = {
      success: false,
      error: err.toString(),
      timestamp: new Date().toISOString()
    };
    return ContentService.createTextOutput(JSON.stringify(errorResponse))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// -------------------------------------------------------------
// WEB APP API: doPost (CRM to Google Sheets Push)
// -------------------------------------------------------------
function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const payload = JSON.parse(e.postData.contents);
    const type = payload.type; // 'order' | 'expense' | 'payout'
    const action = payload.action || 'upsert'; // 'upsert' | 'delete'
    const data = payload.data || {};

    let sheetName = "";
    let idKey = "";
    let headers = [];

    if (type === 'order') {
      sheetName = "Sales_Orders";
      idKey = "Order ID";
      headers = [
        data.id || "",
        data.bookingDate || "",
        data.targetDeadline || "",
        data.clientName || "",
        data.clientContact || "",
        data.salesRep || "",
        data.serviceName || "",
        data.quantityUnit || "1 Unit",
        data.totalAmount || 0,
        data.paidAmount || 0,
        data.dueAmount || 0,
        data.paymentMethod || "bKash",
        data.paymentStatus || "Unpaid",
        data.deliveryStatus || "Pending",
        data.remarks || ""
      ];
    } else if (type === 'expense') {
      sheetName = "Expenses";
      idKey = "Expense ID";
      headers = [
        data.id || "",
        data.dateTime || "",
        data.category || "Other",
        data.subCategoryPurpose || "",
        data.vendorReceiverName || "",
        data.amount || 0,
        data.paymentMethod || "Bank Transfer",
        data.paidFromAccount || "Company Account",
        data.transactionRefId || "",
        data.receiptInvoiceLink || "",
        data.approvedBy || "",
        data.remarks || ""
      ];
    } else if (type === 'payout') {
      sheetName = "Project_Payouts";
      idKey = "Payout ID";
      headers = [
        data.id || "",
        data.projectOrderId || "",
        data.serviceName || "",
        data.clientName || "",
        data.resourceWorkerName || "",
        data.totalProjectBudget || 0,
        data.commissionType || "Fixed Commission",
        data.agreedPayoutAmount || 0,
        data.advancePaid || 0,
        data.dueFinalPayable || 0,
        data.deliveryStatus || "Pending",
        data.paymentStatus || "Unpaid",
        data.paymentMethod || "bKash",
        data.transactionRefId || "",
        data.remarks || ""
      ];
    } else {
      throw new Error("Invalid payload type: " + type);
    }

    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      throw new Error("Sheet tab not found: " + sheetName);
    }

    const targetId = String(data.id || "").trim();
    if (!targetId) {
      throw new Error("Missing permanent record ID");
    }

    const lastRow = sheet.getLastRow();
    let rowIndex = -1;

    // Search by permanent ID (Column 1 / A)
    if (lastRow > 1) {
      const idValues = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (let i = 0; i < idValues.length; i++) {
        if (String(idValues[i][0]).trim().toLowerCase() === targetId.toLowerCase()) {
          rowIndex = i + 2;
          break;
        }
      }
    }

    if (action === 'delete') {
      if (rowIndex !== -1) {
        sheet.deleteRow(rowIndex);
      }
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: "Record " + targetId + " deleted from " + sheetName
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Upsert: update existing row or append new row
    if (rowIndex !== -1) {
      sheet.getRange(rowIndex, 1, 1, headers.length).setValues([headers]);
    } else {
      sheet.appendRow(headers);
      rowIndex = sheet.getLastRow();
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: "Record " + targetId + " upserted in " + sheetName,
      rowIndex: rowIndex
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

