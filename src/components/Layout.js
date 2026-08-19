import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { useWindowDimensions } from 'react-native';
import CustomDrawerContent from './CustomDrawerContent';
import HeaderRight from './HeaderRight';

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
import SharedLogistics from './SharedLogistics';
import CustomerAging from '../pages/shared/CustomerAging';
import CompetitorLog from '../pages/sales/CompetitorLog';
import DisputesPanel from '../pages/shared/DisputesPanel';

const Drawer = createDrawerNavigator();

export default function Layout() {
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 1024;

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
        headerTitleStyle: {
          fontWeight: '600',
        },
        drawerActiveBackgroundColor: '#F1F5F9',
        drawerActiveTintColor: '#1A1A1A',
        drawerInactiveTintColor: '#64748B',
      }}
    >
      <Drawer.Screen name="admin/overview" component={AdminOverview} options={{ drawerLabel: 'Overview', title: 'Admin Overview' }} />
      <Drawer.Screen name="admin/retailers" component={RetailersDirectory} options={{ drawerLabel: 'Retailers', title: 'Retailers Directory' }} />
      <Drawer.Screen name="admin/orders" component={AllOrders} options={{ drawerLabel: 'All Orders', title: 'All Orders' }} />
      <Drawer.Screen name="admin/products" component={AdminProducts} options={{ drawerLabel: 'Products', title: 'Inventory & Pricing' }} />
      <Drawer.Screen name="admin/team" component={AdminTeam} options={{ drawerLabel: 'Team', title: 'Team & Assignments' }} />
      <Drawer.Screen name="admin/registrations" component={PendingRegistrations} options={{ drawerLabel: 'Pending Registrations', title: 'Pending Registrations' }} />
      <Drawer.Screen name="admin/queue" component={AdminQueue} options={{ drawerLabel: 'Admin Queue', title: 'Admin Queue' }} />
      <Drawer.Screen name="admin/challans" component={ChallanTracking} options={{ drawerLabel: 'Challan Tracking', title: 'Challan Tracking' }} />
      <Drawer.Screen name="admin/credit" component={CreditManagement} options={{ drawerLabel: 'Credit Management', title: 'Credit Management' }} />
      <Drawer.Screen name="admin/documents" component={CustomerDocuments} options={{ drawerLabel: 'Customer Documents', title: 'Customer Documents' }} />
      <Drawer.Screen name="admin/import" component={ImportData} options={{ drawerLabel: 'Import Data', title: 'Import Data' }} />
      <Drawer.Screen name="admin/notes" component={OutstandingNotes} options={{ drawerLabel: 'Outstanding Notes', title: 'Outstanding Notes' }} />
      
      {/* Newly ported shared routes */}
      <Drawer.Screen name="admin/all-invoices" component={AccountantAllInvoices} options={{ drawerLabel: 'All Invoices', title: 'All Invoices' }} />
      <Drawer.Screen name="admin/logistics" component={SharedLogistics} options={{ drawerLabel: 'Logistics', title: 'Logistics' }} />
      <Drawer.Screen name="admin/aging" component={CustomerAging} options={{ drawerLabel: 'Customer Ageing', title: 'Customer Ageing' }} />
      <Drawer.Screen name="admin/competitor-log" component={CompetitorLog} options={{ drawerLabel: 'Competitor Intel', title: 'Competitor Intel' }} />
      <Drawer.Screen name="admin/disputes" component={DisputesPanel} options={{ drawerLabel: 'Reported Issues', title: 'Reported Issues' }} />
    </Drawer.Navigator>
  );
}
