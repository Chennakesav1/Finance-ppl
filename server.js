const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const xlsx = require('xlsx');
const cors = require('cors');
const { Invoice, Payable } = require('./models/Finance');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const upload = multer({ dest: 'uploads/' });

// Ensure your MongoDB URI is here
const MONGO_URI = 'mongodb+srv://chennakesavarao89_db_user:chenna12345@finance.ir4cjql.mongodb.net/?appName=Finance';
mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ Precifast Ultimate ERP Connected!'))
    .catch(err => console.log('❌ Database Connection Error:', err));

const parseExcelDate = (val) => {
    if (!val || val === '') return null; 
    let d = new Date(val);
    if (typeof val === 'number') d = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (isNaN(d.valueOf())) return null;
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0));
};

const getVal = (row, searchStr) => {
    const clean = (str) => str.replace(/[^a-z0-9]/gi, '').toLowerCase();
    const searchClean = clean(searchStr);
    const key = Object.keys(row).find(k => clean(k).includes(searchClean));
    return key ? row[key] : undefined;
};

const getSheetName = (workbook, targetName) => {
    return workbook.SheetNames.find(s => s.replace(/\s/g, '').toLowerCase() === targetName.toLowerCase());
};

app.post('/api/finance/upload-excel', upload.single('file'), async (req, res) => {
    try {
        const workbook = xlsx.readFile(req.file.path, { cellDates: true });
        
        // --- PROCESS NEW SALES FORMAT (TALLY) ---
        const salesTab = getSheetName(workbook, 'Sales');
        if (salesTab) {
            const sheet = workbook.Sheets[salesTab];
            const rawArray = xlsx.utils.sheet_to_json(sheet, { header: 1 });
            
            let headerRowIndex = -1;
            for (let i = 0; i < rawArray.length; i++) {
                const rowStr = (rawArray[i] || []).join(' ').toLowerCase().replace(/[^a-z0-9]/g, '');
                if (rowStr.includes('vchno') && rowStr.includes('particulars')) {
                    headerRowIndex = i;
                    break;
                }
            }

            if (headerRowIndex !== -1) {
                const rawSales = xlsx.utils.sheet_to_json(sheet, { range: headerRowIndex });
                const bulkSalesOps = [];

                rawSales.forEach(r => {
                    let customerName = r['Particulars'];
                    if (customerName && (customerName.trim().toLowerCase() === 'by' || customerName.trim().toLowerCase() === 'to')) {
                        customerName = r['__EMPTY'] || r['__EMPTY_1'] || r['__EMPTY_2'];
                    } else if (!customerName) {
                        customerName = r['__EMPTY'] || r['__EMPTY_1'];
                    }

                    const invNo = getVal(r, 'vchno');
                    if (!invNo) return; 

                    const doc = {
                        invoiceNo: invNo,
                        invoiceDate: parseExcelDate(getVal(r, 'date')),
                        customer: customerName,
                        invoiceValue: parseFloat(getVal(r, 'credit')) || parseFloat(getVal(r, 'debit')) || 0,
                        marketier: getVal(r, 'remakrs') || getVal(r, 'remarks')
                    };

                    // 💥 THIS APPENDS & UPDATES INSTEAD OF WIPING HISTORY
                    bulkSalesOps.push({
                        updateOne: {
                            filter: { invoiceNo: invNo },
                            update: { $set: doc },
                            upsert: true
                        }
                    });
                });

                if (bulkSalesOps.length > 0) await Invoice.bulkWrite(bulkSalesOps);
            }
        }

        // --- PROCESS PURCHASES ---
        const purchaseTab = getSheetName(workbook, 'Purchase');
        if (purchaseTab) {
            const sheet = workbook.Sheets[purchaseTab];
            const rawArray = xlsx.utils.sheet_to_json(sheet, { header: 1 });
            let headerRowIndex = -1;
            
            for (let i = 0; i < rawArray.length; i++) {
                const rowStr = (rawArray[i] || []).join(' ').toLowerCase().replace(/[^a-z0-9]/g, '');
                if (rowStr.includes('gstin') && rowStr.includes('supplier')) {
                    headerRowIndex = i;
                    break;
                }
            }

            if (headerRowIndex !== -1) {
                const rawPurchase = xlsx.utils.sheet_to_json(sheet, { range: headerRowIndex });
                const bulkPurchaseOps = [];

                rawPurchase.forEach(r => {
                    const vendor = getVal(r, 'tradelegalname') || getVal(r, 'supplier');
                    const invoiceNumber = getVal(r, 'invoicenumber');
                    if (!vendor && !invoiceNumber) return;

                    const doc = {
                        gstin: getVal(r, 'gstin'),
                        vendor: vendor,
                        invoiceNumber: invoiceNumber,
                        invoiceDate: parseExcelDate(getVal(r, 'invoicedate')),
                        matRecDate: parseExcelDate(getVal(r, 'matrecdate')) || parseExcelDate(getVal(r, 'tallydate')),
                        invoiceValue: parseFloat(getVal(r, 'invoicevalue')) || 0,
                        taxableValue: parseFloat(getVal(r, 'taxablevalue')) || 0,
                        integratedTax: parseFloat(getVal(r, 'integratedtax')) || 0,
                        centralTax: parseFloat(getVal(r, 'centraltax')) || 0,
                        stateTax: parseFloat(getVal(r, 'statetax')) || 0,
                        remarks: getVal(r, 'remakrs') || getVal(r, 'remarks')
                    };

                    // 💥 APPENDS & UPDATES INSTEAD OF WIPING HISTORY
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
        }

        res.json({ message: "Excel Data Attached Successfully!" });
    } catch (error) {
        console.error("Upload Error:", error);
        res.status(500).json({ error: "Failed to attach Excel data." });
    }
});

app.get('/api/finance/all-data', async (req, res) => {
    try {
        let targetDate;
        if (req.query.date && req.query.date !== '') {
            targetDate = new Date(req.query.date);
        } else {
            const latestInvoice = await Invoice.findOne().sort({ invoiceDate: -1 });
            const latestPayable = await Payable.findOne().sort({ matRecDate: -1 });
            
            const d1 = latestInvoice?.invoiceDate || new Date(0);
            const d2 = latestPayable?.matRecDate || new Date(0);
            
            targetDate = d1 > d2 ? d1 : d2;
            if (targetDate.getTime() === 0) targetDate = new Date(); 
        }

        const startOfMonth = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), 1));
        const startOfDay = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 0, 0, 0));
        const endOfDay = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 23, 59, 59));

        const matchMTDSales = { invoiceDate: { $gte: startOfMonth, $lte: endOfDay } };
        const matchMTDPurchase = { matRecDate: { $gte: startOfMonth, $lte: endOfDay } };

        const receivables = await Invoice.find({}).sort({ invoiceDate: -1 });
        const payables = await Payable.find({}).sort({ invoiceDate: -1 });

        const salesAnalysis = await Invoice.aggregate([
            { $match: matchMTDSales },
            {
                $group: {
                    _id: '$marketier',
                    mtd: { $sum: '$invoiceValue' },
                    today: { $sum: { $cond: [ { $and: [ { $gte: ['$invoiceDate', startOfDay] }, { $lte: ['$invoiceDate', endOfDay] } ] }, '$invoiceValue', 0 ] } }
                }
            }
        ]);

        const purchaseAnalysis = await Payable.aggregate([
            { $match: matchMTDPurchase },
            {
                $group: {
                    _id: '$remarks',
                    mtd: { $sum: '$taxableValue' },
                    today: { $sum: { $cond: [ { $and: [ { $gte: ['$matRecDate', startOfDay] }, { $lte: ['$matRecDate', endOfDay] } ] }, '$taxableValue', 0 ] } }
                }
            }
        ]);

        res.json({ currentDate: targetDate.toISOString().split('T')[0], tables: { receivables, payables }, analysis: { salesAnalysis, purchaseAnalysis } });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch data" });
    }
});

app.post('/api/finance/manual-sale', async (req, res) => {
    await new Invoice(req.body).save();
    res.json({ message: "Manual Sale Added!" });
});
app.post('/api/finance/manual-purchase', async (req, res) => {
    await new Payable(req.body).save();
    res.json({ message: "Manual Purchase Added!" });
});

// 💥 UNIVERSAL EXCEL-EDIT ENDPOINT
app.put('/api/finance/update-record/:type/:id', async (req, res) => {
    try {
        const { type, id } = req.params;
        const { field, value } = req.body;
        let Model = type === 'Sales' ? Invoice : Payable;
        
        let parsedValue = value;
        if (field.toLowerCase().includes('date')) {
            parsedValue = parseExcelDate(value);
        } else if (['invoiceValue', 'taxableValue', 'integratedTax', 'centralTax', 'stateTax'].includes(field)) {
            parsedValue = Number(value);
        }

        await Model.findByIdAndUpdate(id, { [field]: parsedValue });
        res.json({ message: "Cell Updated Successfully!" });
    } catch (error) {
        res.status(500).json({ error: "Failed to update record." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));