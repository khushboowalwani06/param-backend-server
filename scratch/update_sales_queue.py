import re

file_path = r'e:\ParamApplication\mobile\src\pages\sales\SalesQueue.js'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Imports
content = content.replace(
    "import { isThisMonth } from 'date-fns';",
    "import { isThisMonth, differenceInHours } from 'date-fns';\nimport { DateRangeFilter } from '../../components/DateRangeFilter';\nimport { OnDemandAudio } from '../../components/OnDemandAudio';"
)
content = content.replace(
    "import { Check, Calendar, User, History, ChevronUp, ChevronDown, Target } from 'lucide-react-native';",
    "import { Check, Calendar, User, History, ChevronUp, ChevronDown, Target, AlertTriangle, Save } from 'lucide-react-native';"
)

# 2. QueueCard
old_queue_card_start = 'const QueueCard = ({ order, index, isExpanded, onToggleExpand, hist, isSubmitting, onApprove, onReject, onEdit }) => {'
new_queue_card = '''const QueueCard = ({ order, index, isExpanded, onToggleExpand, hist, isSubmitting, onApprove, onReject, onEdit, onSavePrice }) => {
  const [editedPrice, setEditedPrice] = React.useState(order.EstimateAmt?.toString() || '');
  const [isSavingPrice, setIsSavingPrice] = React.useState(false);
  const isAging = differenceInHours(new Date(), new Date(order.OrderTimestamp)) > 24;

  const handleSavePrice = async () => {
    setIsSavingPrice(true);
    await onSavePrice(order.OrdID, editedPrice);
    setIsSavingPrice(false);
  };

  const hasAudio = order.AudioData || (order.Notes && order.Notes.includes('[Audio Note Attached]'));

  return (
    <View style={styles.card}>
      <View style={[styles.cardHeader, isAging && styles.cardHeaderAging]}>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
          <Text style={styles.cardNumber}>{(index + 1).toString().padStart(2, '0')}.</Text>
          {isAging && <AlertTriangle size={16} color="#DC2626" />}
        </View>
        <StatusBadge status={order.ApprovalStatus} />
      </View>

      <View style={styles.headline}>
        <View style={styles.reqBadge}><Text style={styles.reqBadgeText}>ORDER REQUEST</Text></View>
        <Text style={styles.orderId}>{order.OrdID}</Text>
        {isAging && <Text style={styles.agingText}>Waiting >24h</Text>}
      </View>

      <View style={styles.clientInfo}>
        <Text style={styles.sectionLabel}>CLIENT INFO</Text>
        <Text style={styles.companyName} numberOfLines={1}>{order.Company}</Text>
        <Text style={styles.clientName} numberOfLines={1}>{order.Name}</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.grid}>
        <View style={styles.gridItem}>
          <Text style={styles.sectionLabel}>PRODUCT TYPE</Text>
          <Text style={styles.gridVal} numberOfLines={1}>{order.Product}</Text>
        </View>
        <View style={styles.gridItem}>
          <Text style={styles.sectionLabel}>QUANTITY</Text>
          <Text style={styles.gridVal}>{order.EstimateQty} {order.Unit || 'tons'}</Text>
        </View>
        <View style={[styles.gridItem, { width: '100%' }]}>
          <Text style={styles.sectionLabel}>EST. AMOUNT</Text>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4}}>
            <Text style={{fontSize: 16, fontWeight: '600', color: '#0F172A'}}>₹</Text>
            <TextInput
              style={styles.priceInput}
              value={editedPrice}
              onChangeText={setEditedPrice}
              keyboardType="numeric"
            />
            {editedPrice !== order.EstimateAmt?.toString() && (
              <TouchableOpacity style={styles.savePriceBtn} onPress={handleSavePrice} disabled={isSavingPrice}>
                {isSavingPrice ? <ActivityIndicator size="small" color="#FFF" /> : <Save size={14} color="#FFF" />}
                <Text style={styles.savePriceText}>SAVE</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        {order.City ? (
          <View style={styles.gridItem}>
            <Text style={styles.sectionLabel}>DESTINATION</Text>
            <Text style={styles.gridVal} numberOfLines={1}>{order.City}</Text>
          </View>
        ) : null}
      </View>

      {(order.Notes || hasAudio) ? (
        <View style={styles.notesBox}>
          <Text style={styles.sectionLabel}>NOTES</Text>
          {order.Notes && order.Notes.replace(' [Audio Note Attached]', '').trim() ? (
            <Text style={styles.notesText}>"{order.Notes.replace(' [Audio Note Attached]', '')}"</Text>
          ) : null}
          {hasAudio && (
            <View style={{marginTop: 8}}>
              <OnDemandAudio audioUrl={order.AudioData} />
            </View>
          )}
        </View>
      ) : null}

      <TouchableOpacity onPress={onToggleExpand} style={styles.historyBtn}>
        <History size={14} color="#0F172A" />
        <Text style={styles.historyText}>Customer Profile</Text>
        {isExpanded ? <ChevronUp size={14} color="#0F172A" /> : <ChevronDown size={14} color="#0F172A" />}
      </TouchableOpacity>

      {isExpanded && hist && (
        <View style={styles.histGrid}>
          <View style={styles.histBox}>
            <Text style={styles.histNum}>{hist.TotalOrdersPlaced}</Text>
            <Text style={styles.histLbl}>Total</Text>
          </View>
          <View style={styles.histBox}>
            <Text style={styles.histNum}>{hist.TotalOrdersClosedOnTime}</Text>
            <Text style={styles.histLbl}>On Time</Text>
          </View>
          <View style={[styles.histBox, { borderRightWidth: 0 }]}>
            <Text style={styles.histNum}>{hist.TotalOrdersOverdue}</Text>
            <Text style={styles.histLbl}>Overdue</Text>
          </View>
        </View>
      )}

      <View style={styles.divider} />

      <View style={styles.actions}>
        <TouchableOpacity style={styles.editBtn} onPress={onEdit} disabled={isSubmitting}>
          <Text style={styles.editBtnText}>EDIT</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.rejectBtn} onPress={onReject} disabled={isSubmitting}>
          <Text style={styles.rejectBtnText}>REJECT</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.approveBtn} onPress={onApprove} disabled={isSubmitting}>
          <Check size={16} color="#FFF" />
          <Text style={styles.approveBtnText}>APPROVE</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}'''
content = re.sub(r'const QueueCard = \({.*?};', new_queue_card, content, flags=re.DOTALL)

# 3. State
content = content.replace('const [orders, setOrders] = useState([]);', "const [viewMode, setViewMode] = useState('queue');\n  const [orders, setOrders] = useState([]);")
content = content.replace("const [searchQuery, setSearchQuery] = useState('');", "const [searchQuery, setSearchQuery] = useState('');\n  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });")

# 4. Filters & Save Price
old_filters = '''  const filteredOrders = orders.filter(o => {
    if (!searchQuery) return true;
    const term = searchQuery.toLowerCase();
    return o.OrdID?.toLowerCase().includes(term) || o.Company?.toLowerCase().includes(term);
  });

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);'''

new_filters = '''  const handleSavePrice = async (ordId, newPrice) => {
    try {
      await sheetsService.updateOrderPrice(user, ordId, newPrice);
      setRefreshKey(k => k + 1);
    } catch (err) {
      alert(err.message);
    }
  };

  const filteredOrders = orders.filter(o => {
    if (searchQuery) {
      const term = searchQuery.toLowerCase();
      if (!o.OrdID?.toLowerCase().includes(term) && !o.Company?.toLowerCase().includes(term)) {
        return false;
      }
    }
    if (dateRange.startDate) {
      if (new Date(o.OrderTimestamp) < new Date(dateRange.startDate)) return false;
    }
    if (dateRange.endDate) {
      const end = new Date(dateRange.endDate);
      end.setHours(23, 59, 59, 999);
      if (new Date(o.OrderTimestamp) > end) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const filteredDealers = dealers.filter(d => {
    if (!searchQuery) return true;
    const term = searchQuery.toLowerCase();
    return d.Company?.toLowerCase().includes(term) || d.Name?.toLowerCase().includes(term);
  });
  const dealersTotalPages = Math.ceil(filteredDealers.length / itemsPerPage);
  const paginatedDealers = filteredDealers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);'''
content = content.replace(old_filters, new_filters)

# 5. UI Layout
old_layout = '''        <View style={styles.tools}>
          <View style={{ flex: 1, minWidth: 200 }}>
            <SearchFilter value={searchQuery} onChange={setSearchQuery} placeholder="Search orders..." />
          </View>
          <ExportButton data={filteredOrders} filename="sales_queue" />
        </View>

        {filteredOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <Check size={48} color="#94A3B8" />
            <Text style={styles.emptyTitle}>Queue is Clear!</Text>
            <Text style={styles.emptySub}>No orders currently awaiting your approval.</Text>
          </View>
        ) : (
          paginatedOrders.map((order, idx) => (
            <QueueCard
              key={order.OrdID}
              order={order}
              index={idx}
              isExpanded={expandedOrders[order.OrdID]}
              onToggleExpand={() => handleToggleExpand(order)}
              hist={customerHistory[order.OrdID]}
              isSubmitting={submittingIds.has(order.OrdID)}
              onApprove={() => handleApprove(order.OrdID)}
              onReject={() => setRejectingOrder(order.OrdID)}
              onEdit={() => setEditingOrder(order)}
            />
          ))
        )}
      </ScrollView>

      {totalPages > 1 && (
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
      )}'''

new_layout = '''        <View style={styles.viewToggles}>
          <TouchableOpacity 
            style={[styles.toggleBtn, viewMode === 'queue' && styles.toggleBtnActive]}
            onPress={() => { setViewMode('queue'); setCurrentPage(1); setSearchQuery(''); }}
          >
            <Text style={[styles.toggleBtnText, viewMode === 'queue' && styles.toggleBtnTextActive]}>Pending Approvals</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.toggleBtn, viewMode === 'balances' && styles.toggleBtnActive]}
            onPress={() => { setViewMode('balances'); setCurrentPage(1); setSearchQuery(''); }}
          >
            <Text style={[styles.toggleBtnText, viewMode === 'balances' && styles.toggleBtnTextActive]}>Outstanding Balances</Text>
          </TouchableOpacity>
        </View>

        {viewMode === 'queue' ? (
          <>
            <View style={styles.tools}>
              <View style={{ flex: 1, minWidth: 200 }}>
                <SearchFilter value={searchQuery} onChange={setSearchQuery} placeholder="Search orders..." />
              </View>
              <DateRangeFilter 
                startDate={dateRange.startDate}
                endDate={dateRange.endDate}
                onDateChange={setDateRange}
                onClear={() => setDateRange({ startDate: '', endDate: '' })}
              />
              <ExportButton data={filteredOrders} filename="sales_queue" />
            </View>

            {filteredOrders.length === 0 ? (
              <View style={styles.emptyState}>
                <Check size={48} color="#94A3B8" />
                <Text style={styles.emptyTitle}>Queue is Clear!</Text>
                <Text style={styles.emptySub}>No orders currently awaiting your approval.</Text>
              </View>
            ) : (
              paginatedOrders.map((order, idx) => (
                <QueueCard
                  key={order.OrdID}
                  order={order}
                  index={idx}
                  isExpanded={expandedOrders[order.OrdID]}
                  onToggleExpand={() => handleToggleExpand(order)}
                  hist={customerHistory[order.OrdID]}
                  isSubmitting={submittingIds.has(order.OrdID)}
                  onApprove={() => handleApprove(order.OrdID)}
                  onReject={() => setRejectingOrder(order.OrdID)}
                  onEdit={() => setEditingOrder(order)}
                  onSavePrice={handleSavePrice}
                />
              ))
            )}
          </>
        ) : (
          <>
            <View style={styles.tools}>
              <View style={{ flex: 1, minWidth: 200 }}>
                <SearchFilter value={searchQuery} onChange={setSearchQuery} placeholder="Search dealers..." />
              </View>
              <ExportButton data={filteredDealers} filename="dealers_balances" />
            </View>

            <View style={styles.dealersList}>
              <View style={styles.dealerHeaderRow}>
                <Text style={[styles.dealerColText, {flex: 2, fontWeight: '700'}]}>Dealer</Text>
                <Text style={[styles.dealerColText, {flex: 1, fontWeight: '700'}]}>Limit</Text>
                <Text style={[styles.dealerColText, {flex: 1, fontWeight: '700'}]}>Outstanding</Text>
              </View>
              {paginatedDealers.map(dealer => {
                const limit = Number(dealer.CreditLimit || 0);
                const outst = Number(dealer.OutstandingAmount || 0);
                const isOver = outst > limit;
                return (
                  <View key={dealer.UserID} style={[styles.dealerRow, isOver && styles.dealerRowOverLimit]}>
                    <View style={{flex: 2}}>
                      <Text style={styles.dealerCompanyName}>{dealer.Company}</Text>
                      <Text style={styles.dealerName}>{dealer.Name}</Text>
                    </View>
                    <Text style={[styles.dealerColText, {flex: 1}]}>₹{limit.toLocaleString('en-IN')}</Text>
                    <Text style={[styles.dealerColText, {flex: 1, fontWeight: '700'}, isOver && {color: '#DC2626'}]}>
                      ₹{outst.toLocaleString('en-IN')}
                    </Text>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      {(viewMode === 'queue' ? totalPages : dealersTotalPages) > 1 && (
        <Pagination 
          currentPage={currentPage} 
          totalPages={viewMode === 'queue' ? totalPages : dealersTotalPages} 
          onPageChange={setCurrentPage} 
        />
      )}'''
content = content.replace(old_layout, new_layout)

# 6. Styles
styles_to_add = '''  viewToggles: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    padding: 4,
    borderRadius: 8,
    marginBottom: 20,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  toggleBtnActive: {
    backgroundColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  toggleBtnTextActive: {
    color: '#0F172A',
  },
  priceInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#FFF',
  },
  savePriceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    gap: 4,
  },
  savePriceText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  cardHeaderAging: {
    backgroundColor: '#FEF2F2',
  },
  agingText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
    marginTop: 4,
  },
  dealersList: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  dealerHeaderRow: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  dealerColText: {
    fontSize: 14,
    color: '#475569',
  },
  dealerRow: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    alignItems: 'center',
  },
  dealerRowOverLimit: {
    backgroundColor: '#FEF2F2',
  },
  dealerCompanyName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  dealerName: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
'''
content = content.replace('const styles = StyleSheet.create({\n', 'const styles = StyleSheet.create({\n' + styles_to_add)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Updated SalesQueue.js successfully')
