import { EditRequest } from "../models/EditRequest.model.js";
import { Transaction } from "../models/transaction.js";
import { Website } from "../models/website.model.js";
import { User } from "../models/user.model.js";
import { BankTransaction } from "../models/BankTransaction.model.js";
import { WebsiteTransaction } from "../models/WebsiteTransaction.model.js";
import { Bank } from "../models/bank.model.js";
import AccountServices from "../services/Accounts.services.js";

const TransactionService = {
  createTransaction: async (req, res, subAdminName) => {
    try {
      const {
        transactionID,
        transactionType,
        amount,
        paymentMethod,
        userName,
        subAdminUserName,
        accountNumber,
        websiteName,
        bankName,
        bankCharges,
        bonus,
        remarks,
      } = req.body;
      if (!transactionID) {
        throw { code: 400, message: "Transaction ID is required" };
      }

      if (!amount || isNaN(amount)) {
        throw { code: 400, message: "Amount is required and must be a number" };
      }

      if (!paymentMethod) {
        throw { code: 400, message: "Payment Method is required" };
      }

      const existingTransaction = await Transaction.findOne({transactionID: transactionID}).exec();
      if (existingTransaction) {return res.status(400).json({ status: false, message: "Transaction already exists" });}
      
      // Website
      const dbWebsiteData = await Website.findOne({ websiteName: websiteName }).exec();
      const websiteId = dbWebsiteData._id;
      const websiteBalance = await AccountServices.getWebsiteBalance(websiteId);
      const totalBalance = bonus + amount;
        if (websiteBalance < totalBalance) {
          throw { code: 400, message: "Insufficient Website balance" };
        }
      console.log("totalBalance",totalBalance)


      // Bank
      const dbBankData = await Bank.findOne({ bankName: bankName }).exec();
      const bankId = dbBankData._id;
      const bankBalance = await AccountServices.getBankBalance(bankId);
      const totalBankBalance = bankCharges + amount;
      if (bankBalance < totalBankBalance) {
        throw { code: 400, message: "Insufficient Bank balance" };
      }


      // User
      const user = await User.findOne({ userName: userName }).exec();
      if (!user) {
        return res.status(404).send("User not found");
      }
      // Introducer
      const introducersUserName = user.introducersUserName;
      // Calculation of Deposit---- Amount will transfer from Website to Bank (Bonus)
      if (transactionType === "Deposit") {
       
        const newTransaction = new Transaction({
          bankId: dbBankData._id,
          websiteId: dbWebsiteData._id,
          transactionID: transactionID,
          transactionType: transactionType,
          amount: amount,
          paymentMethod: paymentMethod,
          subAdminUserName: subAdminUserName,
          subAdminName: subAdminName.firstname,
          userName: userName,
          accountNumber: accountNumber,
          bankName: bankName,
          websiteName: websiteName,
          bonus: bonus,
          remarks: remarks,
          introducerUserName: introducersUserName,
          createdAt: new Date(),
          isSubmit: false,
        });
       
        await newTransaction.save();
        const user = await User.findOne({ userName: userName });
        if (!user) {return res.status(404).json({ status: false, message: "User not found" });}
        user.transactionDetail.push(newTransaction);
        await user.save();
      }
      // Calculation of Withdraw---- Amount will transfer from Bank to Website (Bank Charge)
      if (transactionType === "Withdraw") {
     
        const newTransaction = new Transaction({
          bankId: dbBankData._id,
          websiteId: dbWebsiteData._id,
          transactionID: transactionID,
          transactionType: transactionType,
          amount: amount,
          paymentMethod: paymentMethod,
          subAdminUserName: subAdminUserName,
          subAdminName: subAdminName.firstname,
          userName: userName,
          accountNumber: accountNumber,
          bankName: bankName,
          websiteName: websiteName,
          bankCharges: bankCharges,
          remarks: remarks,
          introducerUserName: introducersUserName,
          createdAt: new Date(),
          isSubmit: false,
        });
        await newTransaction.save();
      
        const user = await User.findOne({ userName: userName });

        if (!user) {return res.status(404).json({ status: false, message: "User not found" });}
        user.transactionDetail.push(newTransaction);
        await user.save();
      }
      return res.status(200).json({ status: true, message: "Transaction created successfully" });
    } catch (e) {
      console.error(e);
      res.status(e.code || 500).send({ message: e.message || "Internal server error" });
    }
  },

  withdrawView: async (req, res) => {
    try {
      const withdraws = await Transaction.find({ transactionType: "Withdraw" })
        .sort({ createdAt: -1 })
        .exec();
      let sum = 0;
      for (let i = 0; i < withdraws.length; i++) {
        sum = sum + withdraws[i].withdrawAmount;
      }
      res.send({ totalWithdraws: sum, withdraws: withdraws });
    } catch (error) {
      return res.status(500).json({ status: false, message: error });
    }
  },

  depositView: async (req, res) => {
    try {
      const deposits = await Transaction.find({ transactionType: "Deposit" })
        .sort({ createdAt: -1 })
        .exec();
      let sum = 0;
      for (let i = 0; i < deposits.length; i++) {
        sum = sum + deposits[i].depositAmount;
      }
      res.send({ totalDeposits: sum, deposits: deposits });
    } catch (error) {
      return res.status(500).json({ status: false, message: error });
    }
  },

  updateTransaction: async (trans, data) => {
    const existingTransaction = await Transaction.findById(trans);
    if (existingTransaction) {throw {code: 409,message: "Edit Request Already Sent For Approval"};
    }

    let updatedTransactionData = {};
    let changedFields = {};

    if (existingTransaction.transactionType === "Deposit") {
      updatedTransactionData = {
        id: trans._id,
        transactionID: data.transactionID || existingTransaction.transactionID,
        transactionType: data.transactionType || existingTransaction.transactionType,
        amount: data.amount || existingTransaction.amount,
        paymentMethod: data.paymentMethod || existingTransaction.paymentMethod,
        userId: data.userId || existingTransaction.userId,
        subAdminId: data.subAdminId || existingTransaction.subAdminId,
        bankName: data.bankName || existingTransaction.bankName,
        websiteName: data.websiteName || existingTransaction.websiteName,
        remarks: data.remarks || existingTransaction.remarks,
      };

      for (const key in data) {
        if (existingTransaction[key] !== data[key]) {
          changedFields[key] = data[key];
        }
      }

      const editRequest = new EditRequest({
        ...updatedTransactionData,
        changedFields,
        isApproved: false,
        isSubmit: false,
        type: "Edit",
        message: "Deposit transaction is being edited.",
      });
      await editRequest.save();
    } else if (existingTransaction.transactionType === "Withdraw") {
      updatedTransactionData = {
        id: trans._id,
        transactionID: data.transactionID || existingTransaction.transactionID,
        transactionType: data.transactionType || existingTransaction.transactionType,
        amount: data.amount || existingTransaction.amount,
        paymentMethod: data.paymentMethod || existingTransaction.paymentMethod,
        userId: data.userId || existingTransaction.userId,
        subAdminId: data.subAdminId || existingTransaction.subAdminId,
        bankName: data.bankName || existingTransaction.bankName,
        websiteName: data.websiteName || existingTransaction.websiteName,
        remark: data.remark || existingTransaction.remarks,
      };

      for (const key in data) {
        if (existingTransaction[key] !== data[key]) {
          changedFields[key] = data[key];
        }
      }

      const editRequest = new EditRequest({
        ...updatedTransactionData,
        changedFields,
        isApproved: false,
        isSubmit: false,
        type: "Edit",
        message: "Withdraw transaction is being edited.",
      });
      await editRequest.save();
    }
    return changedFields;
  },

  updateBankTransaction: async (bankTransaction, data) => {
    const existingBankTransaction = await BankTransaction.findById(bankTransaction);
    if (existingBankTransaction) {throw {code: 409,message: "Edit Request Already Sent For Approval"};}
    let updatedTransactionData = {};
    let changedFields = {};
   
    if (existingBankTransaction.transactionType === "Manual-Bank-Deposit") {
      for (const key in data) {
        if (existingBankTransaction[key] !== data[key]) {
          changedFields[key] = data[key];
          updatedTransactionData[key] = data[key];
        }
      }
      updatedTransactionData = {
        id: bankTransaction._id,
        bankId: existingBankTransaction.bankId,
        bankName: existingBankTransaction.bankName,
        transactionType: data.transactionType || existingBankTransaction.transactionType,
        remarks: data.remarks || existingBankTransaction.remarks,
        depositAmount: data.depositAmount || existingBankTransaction.depositAmount,
        subAdminId: data.subAdminId || existingBankTransaction.subAdminId,
        subAdminName: data.subAdminName || existingBankTransaction.subAdminName,
        accountNumber: existingBankTransaction.accountNumber,
      };
      const editRequest = new EditRequest({...updatedTransactionData,changedFields,isApproved: false, type: "Edit",
        message: "Manual-Bank-Deposit transaction is being edited.",
      });
      await editRequest.save();
    } else if (
      existingBankTransaction.transactionType === "Manual-Bank-Withdraw"
    ) {
      for (const key in data) {
        if (existingBankTransaction[key] !== data[key]) {
          changedFields[key] = data[key];
          updatedTransactionData[key] = data[key];
        }
      }

      updatedTransactionData = {
        id: bankTransaction._id,
        bankId: existingBankTransaction.bankId,
        bankName: existingBankTransaction.bankName,
        transactionType: data.transactionType || existingBankTransaction.transactionType,
        remarks: data.remarks || existingBankTransaction.remarks,
        withdrawAmount: data.withdrawAmount || existingBankTransaction.withdrawAmount,
        subAdminId: data.subAdminId || existingBankTransaction.subAdminId,
        subAdminName: data.subAdminName || existingBankTransaction.subAdminName,
        accountNumber: existingBankTransaction.accountNumber,
      };
      const editRequest = new EditRequest({...updatedTransactionData, changedFields, isApproved: false,type: "Edit",
      message: "Manual-Bank-Withdraw transaction is being edited.",
      });
      await editRequest.save();
    }
    return changedFields;
  },

  updateWebsiteTransaction: async (websiteTransaction, data) => {
    const existingWebsiteTransaction = await WebsiteTransaction.findById(websiteTransaction);
    if (existingWebsiteTransaction) {throw {code: 409,message: "Edit Request Already Sent For Approval"};}

    let updatedTransactionData = {};
    let changedFields = {};
    if (
      existingWebsiteTransaction.transactionType === "Manual-Website-Deposit"
    ) {
      for (const key in data) {
        if (existingWebsiteTransaction[key] !== data[key]) {
          changedFields[key] = data[key];
          updatedTransactionData[key] = data[key];
        }
      }
      updatedTransactionData = {
        id: websiteTransaction._id,
        transactionType: data.transactionType || existingWebsiteTransaction.transactionType,
        remarks: data.remarks || existingWebsiteTransaction.remarks,
        depositAmount: data.depositAmount || existingWebsiteTransaction.depositAmount,
        subAdminId: data.subAdminId || existingWebsiteTransaction.subAdminId,
        subAdminName: data.subAdminName || existingWebsiteTransaction.subAdminName,
        websiteName: existingWebsiteTransaction.websiteName,
      };
      const editRequest = new EditRequest({
        ...updatedTransactionData,
        changedFields,
        isApproved: false,
        isSubmit: false,
        type: "Edit",
        message: "Manual-Website-Deposit transaction is being edited.",
      });
      await editRequest.save();
    } else if (
      existingWebsiteTransaction.transactionType === "Manual-Website-Withdraw"
    ) {
      for (const key in data) {
        if (existingWebsiteTransaction[key] !== data[key]) {
          changedFields[key] = data[key];
          updatedTransactionData[key] = data[key];
        }
      }
      updatedTransactionData = {
        id: websiteTransaction._id,
        transactionType: data.transactionType || existingWebsiteTransaction.transactionType,
        remarks: data.remarks || existingWebsiteTransaction.remarks,
        withdrawAmount: data.withdrawAmount || existingWebsiteTransaction.withdrawAmount,
        subAdminId: data.subAdminId || existingWebsiteTransaction.subAdminId,
        subAdminName: data.subAdminName || existingWebsiteTransaction.subAdminName,
        websiteName: existingWebsiteTransaction.websiteName,
      };
      const editRequest = new EditRequest({
        ...updatedTransactionData,
        changedFields,
        isApproved: false,
        isSubmit: false,
        type: "Edit",
        message: "Manual-Website-Withdraw transaction is being edited.",
      });
      await editRequest.save();
    }
    return changedFields;
  },
};

export default TransactionService;
