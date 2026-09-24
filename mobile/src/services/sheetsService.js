import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter, Platform } from 'react-native';
import Constants from 'expo-constants';

const API_BASE = process.env.EXPO_PUBLIC_API_URL;
const activeRequests = new Map();
const responseCache = new Map();
const CACHE_TTL = 30000; // 30 seconds

class SheetsService {
  constructor() {
    this.token = null;
    AsyncStorage.getItem('jwtToken').then(t => this.token = t).catch(()=>null);
  }

  _fetch(endpoint, options = {}) {
    const isGet = !options.method || options.method === 'GET';
    
    if (isGet) {
      if (activeRequests.has(endpoint)) {
        return activeRequests.get(endpoint);
      }
      if (responseCache.has(endpoint)) {
        const cached = responseCache.get(endpoint);
        if (Date.now() - cached.timestamp < CACHE_TTL) {
          return Promise.resolve(cached.data);
        }
      }
    } else {
      // Clear all cache on mutation to ensure fresh data
      responseCache.clear();
    }

    const requestPromise = (async () => {
      const fetchHeaders = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      };
      if (this.token && !fetchHeaders['Authorization']) {
        fetchHeaders['Authorization'] = `Bearer ${this.token}`;
      }

      const res = await fetch(`${API_BASE}${endpoint}`, {
        cache: 'no-store',
        ...options,
        headers: fetchHeaders
      });
      
      if (!res.ok) {
        let errMsg = `API Request Failed (${res.status})`;
        try {
          const text = await res.text();
          try {
            const err = JSON.parse(text);
            errMsg = err.error || errMsg;
          } catch (_e) {
            errMsg += ` - ${text.substring(0, 60)}`;
          }
        } catch (_e) {}

        if (res.status === 401 || res.status === 403) {
          this.logout();
          DeviceEventEmitter.emit('auth-expired');
        }
        throw new Error(errMsg);
      }
      const data = await res.json();
      if (isGet) {
        responseCache.set(endpoint, { data, timestamp: Date.now() });
      }
      return data;
    })();

    if (isGet) {
      activeRequests.set(endpoint, requestPromise);
      requestPromise.finally(() => {
        if (activeRequests.get(endpoint) === requestPromise) {
          activeRequests.delete(endpoint);
        }
      });
    }

    return requestPromise;
  }

  async logout() {
    this.token = null;
    await AsyncStorage.removeItem('jwtToken');
  }

  // Real Authentication Endpoints
  async register(userData) {
    const res = await this._fetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
    if (res.token) {
      this.token = res.token;
      await AsyncStorage.setItem('jwtToken', res.token);
    }
    return res.user;
  }

  async adminCreateUser(adminUser, userData) {
    if (!adminUser || adminUser.Role !== 'admin') throw new Error('Unauthorized');
    const res = await this._fetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
    // Deliberately ignore res.token so admin session is not overwritten
    return res.user;
  }

  async login(email, password) {
    const res = await this._fetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (res.token) {
      this.token = res.token;
      await AsyncStorage.setItem('jwtToken', res.token);
    }
    return res.user;
  }

  async fetchProfile() {
    const res = await this._fetch('/me', { method: 'GET' });
    return res.user;
  }

  async fetchAdminContact() {
    return this._fetch('/admin-contact');
  }

  async approveUser(userId, action = 'approve') {
    const res = await this._fetch('/admin/approve-user', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, action })
    });
    return res.user;
  }

  // --- PRODUCTS ---
  async getProducts() {
    return this._fetch(`/products?t=${Date.now()}`);
  }

  async addProduct(user, productData) {
    if (!user || user.Role !== 'admin') throw new Error('Unauthorized');
    const res = await this._fetch('/products', {
      method: 'POST',
      body: JSON.stringify(productData)
    });
    this._fetch('/push/send', {
      method: 'POST',
      body: JSON.stringify({ targets: ['sales'], title: 'New Product Added', message: `Admin added a new product: ${productData.ProductName}` })
    }).catch(e => console.error(e));
    return res;
  }

  async updateProduct(user, id, productData) {
    if (!user || user.Role !== 'admin') throw new Error('Unauthorized');
    const res = await this._fetch(`/products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(productData)
    });
    this._fetch('/push/send', {
      method: 'POST',
      body: JSON.stringify({ targets: ['sales'], title: 'Product Updated', message: `Product ${id} has been updated by Admin.` })
    }).catch(e => console.error(e));
    return res;
  }

  async deleteProduct(user, id) {
    if (!user || user.Role !== 'admin') throw new Error('Unauthorized');
    const res = await this._fetch(`/products/${id}`, {
      method: 'DELETE'
    });
    this._fetch('/push/send', {
      method: 'POST',
      body: JSON.stringify({ targets: ['sales'], title: 'Product Deleted', message: `Product ${id} has been removed from the catalog.` })
    }).catch(e => console.error(e));
    return res;
  }

  async deleteUser(user, id) {
    if (!user || user.Role !== 'admin') throw new Error('Unauthorized');
    const res = await this._fetch(`/users/${id}`, {
      method: 'DELETE'
    });
    return res;
  }

  // Get orders based on role constraints
  async getOrderAggregates() {
    try {
      const data = await this._fetch('/orders/aggregates');
      return data;
    } catch (e) {
      console.error('getOrderAggregates Error:', e);
      return {};
    }
  }

  async getOrders(user) {
    if (!user) return [];
    let orders = await this._fetch(`/orders?t=${Date.now()}`);
    
    // Filter to only show the customer's own orders
    if (user.Role === 'customer') {
      orders = orders.filter(o => o.UserID === user.UserID);
    }
    
    return orders.map(o => this._sanitizeOrderForRole(o, user.Role));
  }

  // Read accounts data
  async getAccountsData(user, ordId) {
    if (user.Role !== 'accountant' && user.Role !== 'admin') {
      throw new Error('Unauthorized: Role cannot view raw accounting ledger');
    }
    const accounts = await this._fetch('/accounts');
    const acc = accounts.find(a => a.OrdID === ordId);
    return acc || {};
  }

  async getAllAccounts(user) {
    if (user.Role !== 'accountant' && user.Role !== 'admin') {
      throw new Error('Unauthorized: Role cannot view raw accounting ledger');
    }
    return await this._fetch('/accounts');
  }

  // Customer creates order
  async createOrder(user, orderData) {
    if (!['customer', 'admin', 'sales', 'accountant'].includes(user.Role)) {
      throw new Error('Unauthorized to create orders');
    }
    
    const newOrder = {
      OrdID: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
      UserID: orderData.UserID || user.UserID,
      Name: orderData.OrderName || user.Name,
      Company: orderData.Company || user.Company,
      Phone: orderData.OrderPhone || user.Phone,
      Email: orderData.Email || user.Email,
      Address: orderData.OrderAddress || user.Address,
      City: orderData.OrderCity || user.City,
      Product: orderData.Product,
      EstimateQty: orderData.EstimateQty,
      Unit: orderData.Unit || 'Bags',
      EstimateAmt: orderData.EstimateAmt,
      BagPrice: orderData.BagPrice,
      TonPrice: orderData.TonPrice,
      Segment: orderData.Segment,
      ProjectType: orderData.ProjectType,
      Timeline: orderData.Timeline,
      Notes: orderData.Notes,
      AudioData: orderData.AudioData,
      ApprovalStatus: 'Pending Sales Approval',
      OrderTimestamp: new Date().toISOString(),
    };

    await this._fetch('/orders', {
      method: 'POST',
      body: JSON.stringify(newOrder)
    });

    // Notify Sales, Admin, and the actual customer if placed on their behalf
    this._fetch('/push/send', {
      method: 'POST',
      body: JSON.stringify({
        targets: ['admin', user.AssignedSalesRep || 'sales', newOrder.UserID],
        title: 'New Order Placed',
        message: `${newOrder.Name} (${newOrder.Company}) placed a new order for ${newOrder.Product}.`
      })
    }).catch(err => console.error('Failed to send push notification:', err));

    return newOrder;
  }

  async updateOrderPrice(user, ordId, newAmt) {
    if (user.Role !== 'sales' && user.Role !== 'admin') {
      throw new Error('Only sales and admin can update price');
    }
    await this._fetch(`/orders/${ordId}/price`, {
      method: 'PATCH',
      body: JSON.stringify({ newAmt })
    });
  }

  // Role-based state transitions
  async updateOrderStatus(user, ordId, newStatus, extraData = {}) {
    const updateFields = {};

    if (user.Role === 'sales') {
      const validSalesTransitions = ['Pending Admin Approval', 'Sales Rejected', 'Dispatched', 'In Transit', 'Delivered', 'Cancelled'];
      if (!validSalesTransitions.includes(newStatus)) throw new Error('Invalid state transition');
      if (newStatus === 'Pending Admin Approval' || newStatus === 'Sales Rejected') {
        updateFields.SalesApproverID = user.UserID;
        if (extraData.reason) updateFields.RejectionReason = extraData.reason;
      }
    } 
    else if (user.Role === 'admin') {
      const validAdminTransitions = ['Ready for Dispatch', 'Admin Rejected', 'Dispatched', 'In Transit', 'Delivered', 'Cancelled'];
      if (!validAdminTransitions.includes(newStatus)) throw new Error('Invalid state transition');
      if (newStatus === 'Ready for Dispatch' || newStatus === 'Admin Rejected') {
        updateFields.AdminApproverID = user.UserID;
        if (extraData.reason) updateFields.RejectionReason = extraData.reason;
      }
    }
    else if (user.Role === 'customer') {
      const validCustomerTransitions = ['Pending Sales Approval', 'Pending Invoice', 'Payment Sent', 'Closed'];
      if (!validCustomerTransitions.includes(newStatus)) throw new Error('Customer cannot transition to this state');
      if (newStatus === 'Pending Invoice' || newStatus === 'Closed') {
        updateFields.DeliveryConfirmedTimestamp = new Date().toISOString();
      }
      if (newStatus === 'Payment Sent') {
        updateFields.TransactionID = extraData.transactionId;
        updateFields.PaymentScreenshot = extraData.screenshot;
        // Update the accounts table with the payment proof
        try {
          await this._fetch(`/accounts/${ordId}`, {
            method: 'PATCH',
            body: JSON.stringify({
              PaymentReference: extraData.transactionId,
              PaymentProofLink: extraData.screenshot,
              TransactionID: extraData.transactionId,
              PaymentScreenshot: extraData.screenshot
            })
          });
        } catch (err) {
          console.error("Failed to update account with payment proof:", err);
        }
      }
    }
    else if (user.Role === 'accountant') {
      const validAccountantTransitions = ['Payment Pending', 'Closed'];
      if (!validAccountantTransitions.includes(newStatus)) throw new Error('Accountant cannot transition to this state');
      
      // If accountant uploads or edits invoice
      if (newStatus === 'Payment Pending' && extraData.invoiceAmount) {
        updateFields.EstimateAmt = extraData.invoiceAmount;
        if (extraData.invoicePdf) updateFields.InvoicePdfLink = extraData.invoicePdf;
        
        // Try to update existing account first
        try {
          const updates = { FinalInvoicedAmount: extraData.invoiceAmount };
          if (extraData.invoicePdf) updates.InvoicePdfLink = extraData.invoicePdf;
          await this._fetch(`/accounts/${ordId}`, { 
            method: 'PATCH', 
            body: JSON.stringify(updates) 
          });
        } catch (_e) {
          // If PATCH fails (row doesn't exist), create new account row
          const newAcc = {
            OrdID: ordId,
            InvoiceNumber: `INV-${Date.now()}`,
            FinalInvoicedAmount: extraData.invoiceAmount,
            InvoicePdfLink: extraData.invoicePdf,
            // Delivery confirmed + 15 days
            PaymentDueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
            OverdueFlag: false
          };
          await this._fetch('/accounts', { method: 'POST', body: JSON.stringify(newAcc) });
        }
      }

      
      if (newStatus === 'Closed') {
        await this._fetch(`/accounts/${ordId}`, { 
          method: 'PATCH', 
          body: JSON.stringify({ PaymentVerifiedBy: user.UserID }) 
        });
      }
    }

    // Finally, update the order status itself
    await this._fetch(`/orders/${ordId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ newStatus, updateFields })
    });
    
    // Notify relevant roles based on the new status
    let orderUserId = extraData.userId;
    let salesPersonId = null;
    if (!orderUserId) {
      try {
        const orders = await this._fetch('/orders');
        const order = orders.find(o => o.OrdID === ordId || o.ord_id === ordId);
        if (order) {
          orderUserId = order.UserID || order.user_id;
          salesPersonId = order.SalesApproverID || order.sales_approver_id;
        }
      } catch (e) {
        console.error('Failed to fetch order to get UserID', e);
      }
    }

    let targets = [];
    if (newStatus === 'Pending Admin Approval') targets = ['admin', orderUserId];
    else if (newStatus === 'Ready for Dispatch' || newStatus === 'In Transit') targets = [orderUserId, 'sales'];
    else if (newStatus === 'Delivered') targets = [orderUserId, 'sales', 'admin'];
    else if (newStatus === 'Pending Invoice') targets = ['accountant', 'admin', 'sales', orderUserId];
    else if (newStatus === 'Payment Pending') targets = [orderUserId, 'admin'];
    else if (newStatus === 'Payment Sent') targets = ['admin', 'accountant', 'sales', orderUserId];
    else if (newStatus === 'Closed') targets = [orderUserId, 'sales', 'admin'];
    else if (newStatus === 'Sales Rejected') targets = ['admin', orderUserId];
    else if (newStatus === 'Admin Rejected') targets = ['sales', orderUserId];

    targets = targets.filter(Boolean);
    if (salesPersonId) targets.push(salesPersonId);

    if (targets.length > 0) {
      this._fetch('/push/send', {
        method: 'POST',
        body: JSON.stringify({
          targets,
          title: `Order Update: ${ordId}`,
          message: `Order status changed to: ${newStatus}${extraData.reason ? `. Reason: ${extraData.reason}` : ''}`
        })
      }).catch(err => console.error('Failed to send push notification:', err));
    }
  }

  async getCustomerProfile(user, targetUserId) {
    if (user.Role === 'customer' && user.UserID !== targetUserId) {
      throw new Error('Unauthorized: Cannot view other customers profiles');
    }
    const users = await this._fetch('/users');
    return users.find(u => u.UserID === targetUserId);
  }

  async getBasicUserProfile(targetUserId) {
    return this._fetch(`/users/${targetUserId}/basic`);
  }

  async getUserDocuments(targetUserId) {
    return this._fetch(`/admin/users/${targetUserId}/documents`);
  }

  async updateUserRole(user, userId, newRole) {
    if (!user || user.Role !== 'admin') throw new Error('Unauthorized');
    const res = await this._fetch(`/users/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ newRole })
    });
    this._fetch('/push/send', {
      method: 'POST',
      body: JSON.stringify({ targets: [userId], title: 'Role Updated', message: `Your account role has been updated to ${newRole}.` })
    }).catch(e => console.error(e));
    return res;
  }

  // --- NEW ENDPOINTS ---
  async getAddresses(userId) {
    return this._fetch(`/addresses/${userId}`);
  }

  async addAddress(addressData) {
    return this._fetch('/addresses', {
      method: 'POST',
      body: JSON.stringify(addressData)
    });
  }

  async reportDispute(disputeData) {
    const res = await this._fetch('/disputes', {
      method: 'POST',
      body: JSON.stringify(disputeData)
    });
    let salesPersonId = null;
    try {
      const orders = await this._fetch('/orders');
      const order = orders.find(o => o.OrdID === disputeData.OrdID || o.ord_id === disputeData.OrdID);
      if (order) salesPersonId = order.SalesApproverID || order.sales_approver_id;
    } catch (e) {}

    const targets = ['admin', 'sales'];
    if (salesPersonId) targets.push(salesPersonId);

    // Add notification
    this._fetch('/push/send', {
      method: 'POST',
      body: JSON.stringify({ targets, title: 'New Dispute Reported', message: `A dispute has been reported for Order ${disputeData.OrdID || 'Unknown'}.` })
    }).catch(e => console.error(e));
    return res;
  }

  async getDisputes() {
    return this._fetch('/disputes');
  }

  async updateDispute(id, updates) {
    return this._fetch(`/disputes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
  }

  async recordAdjustment(user, userId, adjustments, reason) {
    if (!user || (user.Role !== 'admin' && user.Role !== 'accountant' && user.Role !== 'sales')) throw new Error('Unauthorized');
    
    const finalReason = `[By ${user.Name || 'Admin'}] ${reason}`;
    
    return this._fetch(`/customers/${userId}/adjustments`, {
      method: 'POST',
      body: JSON.stringify({ adjustments, reason: finalReason })
    });
  }

  async getOutstandingNotes(user) {
    if (!user || (user.Role !== 'admin' && user.Role !== 'accountant')) throw new Error('Unauthorized');
    return this._fetch('/admin/outstanding-notes');
  }

  async updateCustomerLimits(user, targetId, limitsData) {
    if (!user || (user.Role !== 'admin' && user.Role !== 'accountant' && user.Role !== 'sales')) throw new Error('Unauthorized');
    const res = await this._fetch(`/customers/${targetId}/limits`, {
      method: 'PATCH',
      body: JSON.stringify(limitsData)
    });
    this._fetch('/push/send', {
      method: 'POST',
      body: JSON.stringify({ targets: [targetId, 'sales'], title: 'Credit Limit Updated', message: `Credit limits for ${targetId} have been updated.` })
    }).catch(e => console.error(e));
    return res;
  }

  async recordPayment(user, targetId, amount) {
    if (!user || (user.Role !== 'admin' && user.Role !== 'accountant' && user.Role !== 'sales')) throw new Error('Unauthorized');
    const res = await this._fetch(`/customers/${targetId}/payments`, {
      method: 'POST',
      body: JSON.stringify({ amount })
    });
    return res;
  }

  // --- VISITS ---
  async getVisits() {
    return this._fetch('/visits');
  }

  async addVisit(visitData) {
    const res = await this._fetch('/visits', {
      method: 'POST',
      body: JSON.stringify(visitData)
    });
    this._fetch('/push/send', {
      method: 'POST',
      body: JSON.stringify({ targets: ['admin'], title: 'New Sales Visit', message: `Sales Rep visited ${visitData.retailerName}.` })
    }).catch(e => console.error(e));
    return res;
  }

  // --- RBAC COLUMN FILTERING ---
  _sanitizeOrderForRole(order, role) {
    if (role === 'customer') {
      return {
        OrdID: order.OrdID,
        Product: order.Product,
        EstimateQty: order.EstimateQty,
        Unit: order.Unit,
        EstimateAmt: order.EstimateAmt,
        ApprovalStatus: order.ApprovalStatus,
        OrderTimestamp: order.OrderTimestamp,
        Company: order.Company,
        Name: order.Name,
        UserID: order.UserID,
        Address: order.Address,
        City: order.City,
        Phone: order.Phone,
        Email: order.Email,
        ProjectType: order.ProjectType,
        Timeline: order.Timeline,
        Notes: order.Notes,
        AudioData: order.AudioData,
        RejectionReason: order.RejectionReason,
        PaymentDueDate: order.PaymentDueDate,
        TransactionID: order.TransactionID,
        PaymentScreenshot: order.PaymentScreenshot,
        PaymentProofLink: order.PaymentProofLink,
        InvoicePdfLink: order.InvoicePdfLink || order.InvoicePdf,
      };
    }
    return order;
  }

  async getAllUsers(user) {
    if (!user || !['admin', 'sales', 'accountant'].includes(user.Role)) throw new Error('Unauthorized');
    return this._fetch('/users');
  }

  async updateProfile(user, profileData) {
    if (!user) throw new Error('Unauthorized');
    const res = await this._fetch(`/users/${user.UserID}/profile`, {
      method: 'PATCH',
      body: JSON.stringify(profileData)
    });
    return res.user;
  }

  async updateCustomerProfile(user, targetUserId, profileData) {
    if (!user || user.Role !== 'admin') throw new Error('Unauthorized');
    const res = await this._fetch(`/users/${targetUserId}/profile`, {
      method: 'PATCH',
      body: JSON.stringify(profileData)
    });
    return res.user;
  }


  // --- REWARDS ENDPOINTS ---
  async getBulkCustomerRewards() {
    try {
      const data = await this._fetch('/rewards/bulk');
      return data;
    } catch (e) {
      console.error('getBulkCustomerRewards Error:', e);
      return {};
    }
  }

  async getCustomerRewards(userId) {
    try {
      const data = await this._fetch(`/users/${userId}/rewards`);
      return data;
    } catch (e) {
      console.error('getCustomerRewards Error:', e);
      return {
        targets: [
          { id: 1, target: 150, rewardName: 'Silver Tier Trip', rewardImage: 'Gift', color: '#94a3b8' },
          { id: 2, target: 280, rewardName: 'Gold Tier Trip (Dubai)', rewardImage: 'Trophy', color: '#fbbf24' }
        ]
      };
    }
  }

  async updateCustomerRewards(user, targetUserId, rewardsData) {
    if (!user || !['admin', 'sales', 'accountant'].includes(user.Role)) {
      throw new Error('Unauthorized to manage rewards');
    }
    try {
      const res = await this._fetch(`/users/${targetUserId}/rewards`, {
        method: 'PATCH',
        body: JSON.stringify({ rewards: rewardsData })
      });
      
      // Send a push notification to the customer about their new targets
      this._fetch('/push/send', {
        method: 'POST',
        body: JSON.stringify({ 
          targets: [targetUserId], 
          title: 'Rewards Updated!', 
          message: `Your campaign targets have been updated.` 
        })
      }).catch(e => console.error(e));
      
      return res;
    } catch (e) {
      console.error('Failed to save rewards to API', e);
      throw new Error('Failed to save rewards');
    }
  }

  // --- NOTIFICATIONS PROXY ENDPOINTS ---
  async getNotifications() {
    return this._fetch('/notifications/history');
  }

  async clearNotifications() {
    return this._fetch('/notifications/clear', { method: 'POST' });
  }

  async markNotificationsRead() {
    return this._fetch('/notifications/read', { method: 'POST' });
  }

  // --- COMPETITOR INTEL ENDPOINTS ---
  async getCompetitorIntel() {
    return this._fetch('/competitor-intel');
  }

  async submitCompetitorIntel(data) {
    return this._fetch('/competitor-intel', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // --- ZONE RATES ---
  async getZoneRates() {
    return this._fetch(`/zone-rates?t=${Date.now()}`);
  }

  async saveBasePrice(price, type) {
    return this._fetch('/admin/base-price', {
      method: 'POST',
      body: JSON.stringify({ price, type })
    });
  }

  async updateZoneRateCell(id, payload) {
    return this._fetch(`/admin/zone-rates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  }

  async addZoneRateGrade(grade, type) {
    return this._fetch('/admin/zone-rates/add-grade', {
      method: 'POST',
      body: JSON.stringify({ grade, type })
    });
  }

  async deleteZoneRateGrade(grade, type) {
    return this._fetch(`/admin/zone-rates/grade/${encodeURIComponent(type)}/${encodeURIComponent(grade)}`, {
      method: 'DELETE'
    });
  }

  async getZoneMappings() {
    return this._fetch(`/admin/zone-mappings?t=${Date.now()}`);
  }

  async saveZoneMappings(mappings) {
    return await this._fetch('/admin/zone-mappings', {
      method: 'POST',
      body: JSON.stringify({ mappings })
    });
  }

  async getAvailableDistricts() {
    return await this._fetch('/public/districts');
  }

  async uploadZoneRates(ratesData, type) {
    return this._fetch('/admin/zone-rates', {
      method: 'POST',
      body: JSON.stringify({ rates: ratesData, type })
    });
  }
}

export const sheetsService = new SheetsService();
