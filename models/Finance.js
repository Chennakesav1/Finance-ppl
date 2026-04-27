const mongoose = require('mongoose');

// STRICTLY NEW TALLY FORMAT FOR SALES
const invoiceSchema = new mongoose.Schema({
    invoiceDate: Date,            // "Date"
    customer: String,             // "Particulars"
    invoiceNo: String,            // "Vch No."
    invoiceValue: Number,         // "Credit" or "Debit"
    marketier: String,            // "Remakrs"
       // Kept for inline payment editing
});

// FULL FORMAT FOR PURCHASES (Unchanged)
const payableSchema = new mongoose.Schema({
    gstin: String,
    vendor: String, 
    invoiceNumber: String,
    invoiceDate: Date,
    matRecDate: Date, 
    invoiceValue: Number,
    taxableValue: Number,
    integratedTax: Number,
    centralTax: Number,
    stateTax: Number,
    remarks: String 
});

module.exports = {
    Invoice: mongoose.model('Invoice', invoiceSchema),
    Payable: mongoose.model('Payable', payableSchema)
};