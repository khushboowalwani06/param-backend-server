import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { useWindowDimensions } from 'react-native';
import CustomDrawerContent from './CustomDrawerContent';
import HeaderRight from './HeaderRight';
import { useAuth } from '../context/AuthContext';

// Admin Pages
import { AdminOverview } from '../pages/admin/AdminOverview';
import { AdminProducts } from '../pages/admin/AdminProducts';
import { AdminTeam } from '../pages/admin/AdminTeam';
import { PendingRegistrations } from '../pages/admin/PendingRegistrations';
import { AdminQueue } from '../pages/admin/AdminQueue';
import { AllOrders } from '../pages/admin/AllOrders';
import { ChallanTracking } from '../pages/admin/ChallanTracking';
import { CreditManagement } from '../pages/admin/CreditManagement';
import { CustomerDocuments } from '../pages/admin/CustomerDocuments';
import { ImportData } from '../pages/admin/ImportData';
import { OutstandingNotes } from '../pages/admin/OutstandingNotes';
import { RetailersDirectory } from '../pages/shared/RetailersDirectory';

// Shared & Accountant pages
import AccountantAllInvoices from '../pages/accountant/AccountantAllInvoices';
import AccountantQueue from '../pages/accountant/AccountantQueue';
import AccountantCredit from '../pages/accountant/AccountantCredit';
import SharedLogistics from './SharedLogistics';
import CustomerAging from '../pages/shared/CustomerAging';
import CompetitorLog from '../pages/sales/CompetitorLog';
import SalesQueue from '../pages/sales/SalesQueue';
import SalesAwaiting from '../pages/sales/SalesAwaiting';
import SalesHistory from '../pages/sales/SalesHistory';
import SalesVisits from '../pages/sales/SalesVisits';
import DisputesPanel from '../pages/shared/DisputesPanel';

// Customer Pages
import CustomerOverview from '../pages/customer/CustomerOverview';
import CustomerOrders from '../pages/customer/CustomerOrders';
import PlaceOrder from '../pages/customer/PlaceOrder';
import CustomerInvoices from '../pages/customer/CustomerInvoices';
import DisputeForm from '../pages/customer/DisputeForm';
import RewardsDashboard from '../pages/customer/RewardsDashboard';
import CustomerProfile from '../pages/customer/CustomerProfile';

const Drawer = createDrawerNavigator();

export default function Layout() {
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const isLargeScreen = width >= 1024;
  const isAdmin = user?.Role === 'admin';
  const isSales = user?.Role === 'sales';
  const isCustomer = user?.Role === 'customer' || user?.Role === 'dealer' || user?.Role === 'retailer';
  const isAccountant = user?.Role === 'accountant';

  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        drawerType: isLargeScreen ? 'permanent' : 'front',
        headerShown: true,
        headerRight: () => <HeaderRight />,
        headerStyle: {
          backgroundColor: '#FFFFFF',
          borderBottomWidth: 1,
          borderBottomColor: '#F1F5F9',
        },
        headerTintColor: '#1A1A1A',
        headerTitleAlign: 'left',
        headerTitleStyle: {
          fontWeight: '600',
          fontSize: 17,
        },
        headerTitleContainerStyle: {
          flexShrink: 1,
          maxWidth: '55%',
          paddingRight: 10,
        },
        drawerActiveBackgroundColor: '#F1F5F9',
        drawerActiveTintColor: '#1A1A1A',
        drawerInactiveTintColor: '#64748B',
      }}
    >
      {isAdmin && (
        <>
          <Drawer.Screen name="admin/overview" component={AdminOverview} options={{ drawerLabel: 'Overview', title: 'Admin Overview' }} />
          <Drawer.Screen name="admin/retailers" component={RetailersDirectory} options={{ drawerLabel: 'Retailers Directory', title: 'Retailers Directory' }} />
          <Drawer.Screen name="admin/orders" component={AllOrders} options={{ drawerLabel: 'All Orders', title: 'All Orders' }} />
          <Drawer.Screen name="admin/products" component={AdminProducts} options={{ drawerLabel: 'Inventory & Pricing', title: 'Inventory & Pricing' }} />
          <Drawer.Screen name="admin/team" component={AdminTeam} options={{ drawerLabel: 'Team', title: 'Team & Assignments' }} />
          <Drawer.Screen name="admin/registrations" component={PendingRegistrations} options={{ drawerLabel: 'Pending Registrations', title: 'Pending Registrations' }} />
          <Drawer.Screen name="admin/queue" component={AdminQueue} options={{ drawerLabel: 'Admin Queue', title: 'Admin Queue' }} />
          <Drawer.Screen name="admin/challans" component={ChallanTracking} options={{ drawerLabel: 'Challan Tracking', title: 'Challan Tracking' }} />
          <Drawer.Screen name="admin/credit" component={CreditManagement} options={{ drawerLabel: 'Credit Management', title: 'Credit Management' }} />
          <Drawer.Screen name="admin/new-order" component={PlaceOrder} options={{ drawerItemStyle: { display: 'none' }, title: 'Place Order' }} />
          <Drawer.Screen name="admin/documents" component={CustomerDocuments} options={{ drawerLabel: 'Customer Documents', title: 'Customer Documents' }} />
          <Drawer.Screen name="admin/import" component={ImportData} options={{ drawerLabel: 'Import Data', title: 'Import Data' }} />
          <Drawer.Screen name="admin/notes" component={OutstandingNotes} options={{ drawerLabel: 'Outstanding Notes', title: 'Outstanding Notes' }} />

          <Drawer.Screen name="admin/all-invoices" component={AccountantAllInvoices} options={{ drawerLabel: 'All Invoices', title: 'All Invoices' }} />
          <Drawer.Screen name="admin/logistics" component={SharedLogistics} options={{ drawerLabel: 'Logistics', title: 'Logistics' }} />
          <Drawer.Screen name="admin/aging" component={CustomerAging} options={{ drawerLabel: 'Customer Ageing', title: 'Customer Ageing' }} />
          <Drawer.Screen name="shared/competitor-log" component={CompetitorLog} options={{ drawerLabel: 'Competitor Intel', title: 'Competitor Intel' }} />
          <Drawer.Screen name="admin/disputes" component={DisputesPanel} options={{ drawerLabel: 'Reported Issues', title: 'Reported Issues' }} />
        </>
      )}

      {isSales && (
        <>
          <Drawer.Screen name="sales/queue" component={SalesQueue} options={{ drawerLabel: 'Sales Queue', title: 'Sales Queue' }} />
          <Drawer.Screen name="sales/history" component={SalesHistory} options={{ drawerLabel: 'Sales Registry', title: 'Sales Registry' }} />
          <Drawer.Screen name="sales/visits" component={SalesVisits} options={{ drawerLabel: 'Log Visit', title: 'Log Visit' }} />
          <Drawer.Screen name="shared/competitor-log" component={CompetitorLog} options={{ drawerLabel: 'Competitor Intel', title: 'Competitor Intel' }} />
          <Drawer.Screen name="sales/awaiting" component={SalesAwaiting} options={{ drawerLabel: 'Dispatch Queue', title: 'Dispatch Queue' }} />
          <Drawer.Screen name="sales/retailers" component={RetailersDirectory} options={{ drawerLabel: 'Customers', title: 'Customers' }} />
          <Drawer.Screen name="sales/disputes" component={DisputesPanel} options={{ drawerLabel: 'Issues', title: 'Issues' }} />
          
          {/* Unmentioned but existing roles */}
          <Drawer.Screen name="sales/logistics" component={SharedLogistics} options={{ drawerLabel: 'Logistics', title: 'Logistics' }} />
          <Drawer.Screen name="sales/aging" component={CustomerAging} options={{ drawerLabel: 'Customer Ageing', title: 'Customer Ageing' }} />
          <Drawer.Screen name="sales/new-order" component={PlaceOrder} options={{ drawerItemStyle: { display: 'none' }, title: 'Place Order' }} />
        </>
      )}

      {isCustomer && (
        <>
          <Drawer.Screen name="customer/overview" component={CustomerOverview} options={{ drawerLabel: 'Dashboard', title: 'Dashboard' }} />
          <Drawer.Screen name="customer/order" component={PlaceOrder} options={{ drawerLabel: 'New Order', title: 'New Order' }} />
          <Drawer.Screen name="customer/orders" component={CustomerOrders} options={{ drawerLabel: 'My Orders', title: 'My Orders' }} />
          <Drawer.Screen name="customer/invoices" component={CustomerInvoices} options={{ drawerLabel: 'Invoices & Payments', title: 'Invoices & Payments' }} />
          <Drawer.Screen name="customer/disputes" component={DisputeForm} options={{ drawerLabel: 'Report Issue', title: 'Report Issue' }} />
          <Drawer.Screen name="customer/rewards" component={RewardsDashboard} options={{ drawerLabel: 'Rewards & Targets', title: 'Rewards & Targets' }} />
          <Drawer.Screen name="customer/aging" component={CustomerAging} options={{ drawerLabel: 'Aging Report', title: 'Aging Report' }} />
          <Drawer.Screen name="customer/profile" component={CustomerProfile} options={{ drawerLabel: 'Profile', title: 'Profile' }} />
        </>
      )}

      {isAccountant && (
        <>
          <Drawer.Screen name="accountant/queue" component={AccountantQueue} options={{ drawerLabel: 'Pending Invoices', title: 'Pending Invoices' }} />
          <Drawer.Screen name="accountant/credit" component={AccountantCredit} options={{ drawerLabel: 'Credit Cycles', title: 'Credit Cycles' }} />
          <Drawer.Screen name="accountant/all-invoices" component={AccountantAllInvoices} options={{ drawerLabel: 'All Invoices', title: 'All Invoices' }} />
          
          <Drawer.Screen name="accountant/retailers" component={RetailersDirectory} options={{ drawerItemStyle: { display: 'none' }, title: 'Retailers Directory' }} />
          <Drawer.Screen name="accountant/aging" component={CustomerAging} options={{ drawerItemStyle: { display: 'none' }, title: 'Customer Ageing' }} />
        </>
      )}
    </Drawer.Navigator>
  );
}
