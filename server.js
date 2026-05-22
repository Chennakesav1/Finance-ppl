const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const xlsx = require('xlsx');
const cors = require('cors');
const { Invoice, Payable, BankTransaction } = require('./models/Finance');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const upload = multer({ dest: 'uploads/' });

const MONGO_URI = 'mongodb+srv://chennakesavarao89_db_user:chenna12345@finance.ir4cjql.mongodb.net/?appName=Finance';
mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ Precifast Ultimate ERP Connected!'))
    .catch(err => console.log('❌ Database Connection Error:', err));

const parseExcelDate = (val) => {
    if (!val || val === '') return null; 
    if (typeof val === 'number') {
        const d = new Date(Math.round((val - 25569) * 86400 * 1000));
        return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0));
    }
    let strVal = String(val).trim();
    const dmyMatch = strVal.match(/^(\d{2})-(\d{2})-(\d{4})/);
    if (dmyMatch) return new Date(Date.UTC(parseInt(dmyMatch[3]), parseInt(dmyMatch[2]) - 1, parseInt(dmyMatch[1]), 12, 0, 0));

    const d = new Date(val);
    if (isNaN(d.valueOf())) return null;
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0));
};

const parseExcelDateTime = (val) => {
    if (!val || val === '') return null; 
    if (typeof val === 'number') return new Date((val - 25569) * 86400 * 1000); 
    
    let strVal = String(val).trim();
    const dmyTimeMatch = strVal.match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})/);
    if (dmyTimeMatch) {
        return new Date(Date.UTC(parseInt(dmyTimeMatch[3]), parseInt(dmyTimeMatch[2]) - 1, parseInt(dmyTimeMatch[1]), parseInt(dmyTimeMatch[4]), parseInt(dmyTimeMatch[5]), parseInt(dmyTimeMatch[6])));
    }
    const dmyMatch = strVal.match(/^(\d{2})-(\d{2})-(\d{4})/);
    if (dmyMatch) return new Date(Date.UTC(parseInt(dmyMatch[3]), parseInt(dmyMatch[2]) - 1, parseInt(dmyMatch[1]), 12, 0, 0));

    const d = new Date(val);
    if (isNaN(d.valueOf())) return null;
    return d;
};

const getVal = (row, searchStrs) => {
    const keys = Object.keys(row);
    for (let search of searchStrs) {
        const cleanSearch = search.replace(/[^a-z0-9]/gi, '').toLowerCase();
        const foundKey = keys.find(k => k.replace(/[^a-z0-9]/gi, '').toLowerCase().includes(cleanSearch));
        if (foundKey && row[foundKey] !== undefined && row[foundKey] !== '') return row[foundKey];
    }
    return undefined;
};

const getSheetName = (workbook, targetName) => workbook.SheetNames.find(s => s.replace(/\s/g, '').toLowerCase() === targetName.toLowerCase());

app.post('/api/finance/upload-excel', upload.single('file'), async (req, res) => {
    try {
        const workbook = xlsx.readFile(req.file.path, { cellDates: true });
        
        // 1. 💥 THE FIX: SEARCH ALL SHEETS FOR BANK STATEMENT, NOT JUST THE FIRST ONE
        let isBankStmt = false;
        let bankHeaderIndex = -1;
        let bankSheetName = null;

        for (let sheetName of workbook.SheetNames) {
            const rawSheet = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
            for (let i = 0; i < Math.min(rawSheet.length, 20); i++) {
                const rowStr = (rawSheet[i] || []).join(' ').toLowerCase().replace(/[^a-z0-9]/g, '');
                // If we find Transaction Date and Balance, we know THIS is the Bank Statement tab
                if (rowStr.includes('transactiondate') && rowStr.includes('balance')) {
                    isBankStmt = true; 
                    bankSheetName = sheetName;
                    bankHeaderIndex = i; 
                    break;
                }
            }
            if (isBankStmt) break; // Stop searching once found
        }

        if (isBankStmt) {
            const bankSheet = workbook.Sheets[bankSheetName];
            const bankData = xlsx.utils.sheet_to_json(bankSheet, { range: bankHeaderIndex });
            const bulkBankOps = [];
            
            bankData.forEach(r => {
                const desc = getVal(r, ['description']);
                const tDate = parseExcelDateTime(getVal(r, ['transactiondate']));
                if (!desc || !tDate) return;

                const keys = Object.keys(r);
                const balanceKeys = keys.filter(k => k.toLowerCase().includes('balance'));
                const firstBal = balanceKeys.length > 0 ? parseFloat(r[balanceKeys[0]]) : 0;
                const secondBal = balanceKeys.length > 1 ? parseFloat(r[balanceKeys[1]]) : 0;

                const doc = {
                    transactionDate: tDate, valueDate: parseExcelDate(getVal(r, ['valuedate'])),
                    chequeNo: getVal(r, ['chequeno', 'cheque']), description: desc, branchCode: getVal(r, ['branchcode']),
                    debit: parseFloat(getVal(r, ['debit'])) || 0, credit: parseFloat(getVal(r, ['credit'])) || 0,
                    balance: firstBal || 0, finalBalance: secondBal || 0,
                    head: getVal(r, ['head']), name: getVal(r, ['name']), remarks: getVal(r, ['remarks', 'remakrs'])
                };
                bulkBankOps.push({ updateOne: { filter: { transactionDate: tDate, description: desc, debit: doc.debit, credit: doc.credit }, update: { $set: doc }, upsert: true }});
            });
            if (bulkBankOps.length > 0) await BankTransaction.bulkWrite(bulkBankOps);
        }

        // 2. PROCESS SALES
        const salesTab = getSheetName(workbook, 'Sales');
        if (salesTab) {
            const sheet = workbook.Sheets[salesTab];
            const rawArray = xlsx.utils.sheet_to_json(sheet, { header: 1 });
            let headerRowIndex = -1;
            for (let i = 0; i < rawArray.length; i++) {
                const rowStr = (rawArray[i] || []).join(' ').toLowerCase().replace(/[^a-z0-9]/g, '');
                if (rowStr.includes('vchno') && rowStr.includes('particulars')) { headerRowIndex = i; break; }
            }

            if (headerRowIndex !== -1) {
                const rawSales = xlsx.utils.sheet_to_json(sheet, { range: headerRowIndex });
                const bulkSalesOps = [];

                rawSales.forEach(r => {
                    let customerName = r['Particulars'];
                    if (customerName && (customerName.trim().toLowerCase() === 'by' || customerName.trim().toLowerCase() === 'to')) {
                        customerName = r['__EMPTY'] || r['__EMPTY_1'] || r['__EMPTY_2'];
                    } else if (!customerName) { customerName = r['__EMPTY'] || r['__EMPTY_1']; }

                    const invNo = getVal(r, ['vchno', 'invoiceno']);
                    if (!invNo) return; 
                    let invoiceValue = parseFloat(getVal(r, ['credit'])) || parseFloat(getVal(r, ['debit'])) || parseFloat(getVal(r, ['invoicevalue'])) || 0;

                    const doc = {
                        invoiceNo: invNo, invoiceDate: parseExcelDate(getVal(r, ['date', 'invoicedate'])),
                        customer: customerName, invoiceValue: invoiceValue, marketier: getVal(r, ['remakrs', 'remarks', 'marketier'])
                    };
                    bulkSalesOps.push({ updateOne: { filter: { invoiceNo: invNo }, update: { $set: doc }, upsert: true }});
                });
                if (bulkSalesOps.length > 0) await Invoice.bulkWrite(bulkSalesOps);
            }
        }

        // 3. PROCESS PURCHASES (Auto-detect based on headers instead of sheet name)
        let isPurchaseStmt = false;
        let purchaseHeaderIndex = -1;
        let purchaseSheetName = null;

        // Search all sheets for the Purchase data
        for (let sheetName of workbook.SheetNames) {
            const rawSheet = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
            for (let i = 0; i < Math.min(rawSheet.length, 20); i++) {
                const rowStr = (rawSheet[i] || []).join(' ').toLowerCase().replace(/[^a-z0-9]/g, '');
                // Check if the row contains typical purchase headers
                if (rowStr.includes('gstin') && rowStr.includes('supplier')) { 
                    isPurchaseStmt = true; 
                    purchaseSheetName = sheetName;
                    purchaseHeaderIndex = i; 
                    break; 
                }
            }
            if (isPurchaseStmt) break;
        }

        if (isPurchaseStmt) {
            const sheet = workbook.Sheets[purchaseSheetName];
            const rawPurchase = xlsx.utils.sheet_to_json(sheet, { range: purchaseHeaderIndex });
            const bulkPurchaseOps = [];

            rawPurchase.forEach(r => {
                const vendor = getVal(r, ['tradelegalname', 'supplier', 'name']);
                const invoiceNumber = getVal(r, ['invoicenumber', 'invoiceno']);
                if (!vendor && !invoiceNumber) return;

                const doc = {
                    gstin: getVal(r, ['gstin']), 
                    vendor: vendor, 
                    invoiceNumber: invoiceNumber,
                    invoiceDate: parseExcelDate(getVal(r, ['invoicedate', 'date'])),
                    matRecDate: parseExcelDate(getVal(r, ['matrecdate', 'tallydate'])),
                    invoiceValue: parseFloat(getVal(r, ['invoicevalue'])) || 0,
                    taxableValue: parseFloat(getVal(r, ['taxablevalue'])) || 0,
                    integratedTax: parseFloat(getVal(r, ['integratedtax', 'igst'])) || 0,
                    centralTax: parseFloat(getVal(r, ['centraltax', 'cgst'])) || 0,
                    stateTax: parseFloat(getVal(r, ['statetax', 'sgst'])) || 0,
                    remarks: getVal(r, ['remakrs', 'remarks'])
                };
                bulkPurchaseOps.push({ 
                    updateOne: { 
                        filter: { invoiceNumber: invoiceNumber, vendor: vendor }, 
                        update: { $set: doc }, 
                        upsert: true 
                    }
                });
            });
            if (bulkPurchaseOps.length > 0) await Payable.bulkWrite(bulkPurchaseOps);
        }
        
        res.json({ message: "Excel Data Attached & Updated Successfully!" });
    } catch (error) { res.status(500).json({ error: "Failed to process Excel data." }); }
});

app.get('/api/finance/all-data', async (req, res) => {
    try {
        let targetDate;
        if (req.query.date && req.query.date !== '') {
            targetDate = new Date(req.query.date);
        } else {
            const latestInvoice = await Invoice.findOne().sort({ invoiceDate: -1 });
            const latestPayable = await Payable.findOne().sort({ matRecDate: -1 });
            const latestBank = await BankTransaction.findOne().sort({ transactionDate: -1 });
            const dates = [ latestInvoice?.invoiceDate || new Date(0), latestPayable?.matRecDate || new Date(0), latestBank?.transactionDate || new Date(0) ];
            targetDate = new Date(Math.max(...dates.map(d => d.getTime())));
            if (targetDate.getTime() === 0) targetDate = new Date(); 
        }

        const startOfMonth = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), 1));
        const startOfDay = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 0, 0, 0));
        const endOfDay = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 23, 59, 59));

        const matchMTDSales = { invoiceDate: { $gte: startOfMonth, $lte: endOfDay } };
        const matchMTDPurchase = { matRecDate: { $gte: startOfMonth, $lte: endOfDay } };
        const matchMTDBank = { transactionDate: { $gte: startOfMonth, $lte: endOfDay } };

        const receivables = await Invoice.find({}).sort({ invoiceDate: -1 });
        const payables = await Payable.find({}).sort({ matRecDate: -1 });
        const bankTransactions = await BankTransaction.find({}).sort({ transactionDate: -1 });

        const salesAnalysis = await Invoice.aggregate([
            { $match: matchMTDSales },
            { $group: { _id: '$marketier', mtd: { $sum: '$invoiceValue' }, today: { $sum: { $cond: [ { $and: [ { $gte: ['$invoiceDate', startOfDay] }, { $lte: ['$invoiceDate', endOfDay] } ] }, '$invoiceValue', 0 ] } } } }
        ]);

        const purchaseAnalysis = await Payable.aggregate([
            { $match: matchMTDPurchase },
            { $group: { _id: '$remarks', mtd: { $sum: '$taxableValue' }, today: { $sum: { $cond: [ { $and: [ { $gte: ['$matRecDate', startOfDay] }, { $lte: ['$matRecDate', endOfDay] } ] }, '$taxableValue', 0 ] } } } }
        ]);

        const paymentAnalysis = await BankTransaction.aggregate([
            { $match: { ...matchMTDBank, debit: { $gt: 0 } } },
            { $group: { _id: '$remarks', mtd: { $sum: '$debit' }, today: { $sum: { $cond: [ { $and: [ { $gte: ['$transactionDate', startOfDay] }, { $lte: ['$transactionDate', endOfDay] } ] }, '$debit', 0 ] } } } }
        ]);

        const collectionAnalysis = await BankTransaction.aggregate([
            { $match: { ...matchMTDBank, credit: { $gt: 0 } } },
            { $group: { _id: '$remarks', mtd: { $sum: '$credit' }, today: { $sum: { $cond: [ { $and: [ { $gte: ['$transactionDate', startOfDay] }, { $lte: ['$transactionDate', endOfDay] } ] }, '$credit', 0 ] } } } }
        ]);

        res.json({ currentDate: targetDate.toISOString().split('T')[0], tables: { receivables, payables, bankTransactions }, analysis: { salesAnalysis, purchaseAnalysis, paymentAnalysis, collectionAnalysis } });
    } catch (error) { res.status(500).json({ error: "Failed to fetch data" }); }
});

app.post('/api/finance/manual-sale', async (req, res) => { await new Invoice({...req.body, invoiceDate: parseExcelDate(req.body.invoiceDate)}).save(); res.json({ message: "Manual Sale Added!" }); });
app.post('/api/finance/manual-purchase', async (req, res) => { await new Payable({...req.body, invoiceDate: parseExcelDate(req.body.invoiceDate), matRecDate: parseExcelDate(req.body.matRecDate)}).save(); res.json({ message: "Manual Purchase Added!" }); });
app.post('/api/finance/manual-bank', async (req, res) => { 
    try {
        const incomingData = { ...req.body };
        incomingData.transactionDate = new Date(req.body.transactionDate);
        incomingData.valueDate = parseExcelDate(req.body.valueDate);
        await new BankTransaction(incomingData).save(); 
        res.json({ message: "Manual Bank Entry Added!" }); 
    } catch (err) { res.status(500).json({ error: "Failed to save bank entry" }); }
});

app.put('/api/finance/update-record/:type/:id', async (req, res) => {
    try {
        const { type, id } = req.params;
        const { field, value } = req.body;
        let Model = type === 'Sales' ? Invoice : (type === 'Purchase' ? Payable : BankTransaction);
        
        let parsedValue = value;
        if (field === 'transactionDate') parsedValue = parseExcelDateTime(value);
        else if (field.toLowerCase().includes('date')) parsedValue = parseExcelDate(value);
        else if (['invoiceValue', 'taxableValue', 'integratedTax', 'centralTax', 'stateTax', 'debit', 'credit', 'balance', 'finalBalance'].includes(field)) parsedValue = Number(value);
        
        await Model.findByIdAndUpdate(id, { [field]: parsedValue });
        res.json({ message: "Cell Updated Successfully!" });
    } catch (error) { res.status(500).json({ error: "Failed to update record." }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));