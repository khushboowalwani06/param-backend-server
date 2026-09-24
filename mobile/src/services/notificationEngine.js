import { sheetsService } from './sheetsService';
import { differenceInDays } from 'date-fns';

export const notificationEngine = {
  
  initPushNotifications: async (user) => {
    // In React Native, this would use expo-notifications
    // For now, it's safely stubbed to prevent crashes
    console.log('Mobile Push Notifications initialized for:', user?.UserID);
  },

  sendNotification: async (targets, title, message) => {
    console.log(`\n🔔 NOTIFICATION [${targets.join(', ')}]\n   Title: ${title}\n   Message: ${message}`);
    try {
      await sheetsService._fetch('/push/send', {
        method: 'POST',
        body: JSON.stringify({ targets, title, message })
      });
    } catch (e) {
      console.error('Failed to trigger push via backend:', e);
    }
  },

  sendWhatsAppInstantInvoice: async (customerPhone, orderId, pdfLink, amount) => {
    console.log(`\n📱 WHATSAPP INVOICE -> ${customerPhone}\n   Order: ${orderId}\n   Amount: ₹${amount}\n   Link: ${pdfLink}`);
  },

  sendWhatsAppDailySummary: async (customerPhone, activeOrdersCount, outstandingAmount, agingFlag) => {
    console.log(`\n📱 WHATSAPP DAILY SUMMARY -> ${customerPhone}\n   Active Orders: ${activeOrdersCount}\n   Outstanding: ₹${outstandingAmount}\n   Ageing Issue: ${agingFlag ? 'YES' : 'NO'}`);
  },

  sendWhatsAppStatement: async (customerPhone, customerName, totalOutstanding, statementPdfLink) => {
    console.log(`\n📱 WHATSAPP STATEMENT -> ${customerPhone}\n   Customer: ${customerName}\n   Outstanding: ₹${totalOutstanding}\n   Statement: ${statementPdfLink}`);
  },

  runDailyCron: async () => {
    console.log('\n--- RUNNING DAILY CRON FOR 15-DAY CREDIT LIFECYCLE ---');
    const today = new Date();
    
    try {
      const accounts = await sheetsService._fetch('/accounts');
      const orders = await sheetsService.getOrders({ Role: 'admin' }); 
      
      const activeAccounts = accounts.filter(acc => !acc.PaymentVerifiedBy);

      for (let acc of activeAccounts) {
        const order = orders.find(o => o.OrdID === acc.OrdID);
        if (!order) continue;

        if (!acc.PaymentDueDate) continue;

        const daysLeft = differenceInDays(new Date(acc.PaymentDueDate), today);
        const reminderLogStr = acc.ReminderLog || '{}';
        let reminderLog = {};
        try { reminderLog = JSON.parse(reminderLogStr); } catch (_e) {}

        let updated = false;

        if (daysLeft === 10 && !reminderLog['10-day']) {
          notificationEngine.sendNotification(
            ['retailer'], 
            `Payment Due in 10 Days`, 
            `Order ${acc.OrdID}: Please ensure payment of ₹${acc.FinalInvoicedAmount} is processed by ${new Date(acc.PaymentDueDate).toLocaleDateString()}.`
          );
          reminderLog['10-day'] = new Date().toISOString();
          updated = true;
        }

        if (daysLeft === 5 && !reminderLog['5-day']) {
          notificationEngine.sendNotification(
            ['retailer', 'accountant'], 
            `Payment Due in 5 Days`, 
            `Order ${acc.OrdID}: 5 days remaining for payment of ₹${acc.FinalInvoicedAmount}.`
          );
          reminderLog['5-day'] = new Date().toISOString();
          updated = true;
        }

        if (daysLeft === 1 && !reminderLog['1-day']) {
          notificationEngine.sendNotification(
            ['retailer', 'accountant', 'admin'], 
            `URGENT: Payment Due Tomorrow`, 
            `Order ${acc.OrdID}: 1 day remaining for payment of ₹${acc.FinalInvoicedAmount}.`
          );
          reminderLog['1-day'] = new Date().toISOString();
          updated = true;
        }

        if (daysLeft === 0 && !reminderLog['0-day']) {
          notificationEngine.sendNotification(
            ['retailer', 'accountant', 'admin'], 
            `CRITICAL: Payment Due Today`, 
            `Order ${acc.OrdID}: Payment is due today.`
          );
          reminderLog['0-day'] = new Date().toISOString();
          updated = true;
        }

        if (daysLeft < 0 && acc.OverdueFlag === 'FALSE') { 
          acc.OverdueFlag = true;
          const adminUser = { Role: 'admin', UserID: 'SYSTEM' };
          await sheetsService.updateOrderStatus(adminUser, acc.OrdID, 'Overdue');
          
          notificationEngine.sendNotification(
            ['admin', 'accountant', 'retailer'], 
            `OVERDUE: Order ${acc.OrdID}`, 
            `Order ${acc.OrdID} is now formally overdue.`
          );
          updated = true;
        }

        if (updated) {
           await sheetsService._fetch(`/accounts/${acc.OrdID}`, {
             method: 'PATCH',
             body: JSON.stringify({
                ReminderLog: JSON.stringify(reminderLog),
                OverdueFlag: acc.OverdueFlag === true ? 'TRUE' : acc.OverdueFlag
             })
           });
        }
      }
    } catch(err) {
      console.error('Cron failed:', err);
    }
    console.log('--- CRON FINISHED ---\n');
  }
};
